import http, { type IncomingMessage, type ServerResponse } from 'node:http';
import type { JobSyncBatchInput, JobSyncBridgeStatus } from '../../shared/domain';
import type { WorkspaceService } from './workspace-service';

const MAX_BODY_BYTES = 2 * 1024 * 1024;

export class JobSyncService {
  private server?: http.Server;
  private status: JobSyncBridgeStatus;

  constructor(private readonly workspace: WorkspaceService, readonly port = 19426) {
    this.status = { running: false, port };
  }

  getStatus(): JobSyncBridgeStatus {
    return { ...this.status };
  }

  async start(): Promise<JobSyncBridgeStatus> {
    if (this.server) return this.getStatus();
    this.server = http.createServer((request, response) => {
      void this.handle(request, response);
    });
    await new Promise<void>((resolve) => {
      this.server?.once('error', (error) => {
        this.status = { running: false, port: this.port, lastError: error.message };
        resolve();
      });
      this.server?.listen(this.port, '127.0.0.1', () => {
        const address = this.server?.address();
        const activePort = typeof address === 'object' && address ? address.port : this.port;
        this.status = { running: true, port: activePort };
        resolve();
      });
    });
    return this.getStatus();
  }

  async stop(): Promise<void> {
    const server = this.server;
    this.server = undefined;
    if (!server) return;
    await new Promise<void>((resolve) => server.close(() => resolve()));
    this.status = { ...this.status, running: false };
  }

  private applyCors(request: IncomingMessage, response: ServerResponse): boolean {
    const origin = String(request.headers.origin ?? '');
    if (origin && !origin.startsWith('chrome-extension://')) {
      this.json(response, 403, { ok: false, error: 'Only the Interview OS browser extension may use this bridge.' });
      return false;
    }
    if (origin) response.setHeader('Access-Control-Allow-Origin', origin);
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Interview-OS-Token');
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    response.setHeader('Vary', 'Origin');
    return true;
  }

  private async handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
    if (!this.applyCors(request, response)) return;
    if (request.method === 'OPTIONS') {
      response.writeHead(204);
      response.end();
      return;
    }
    if (request.method === 'GET' && request.url === '/health') {
      this.json(response, 200, { ok: true, service: 'Interview OS Job Sync Bridge', port: this.port });
      return;
    }
    if (request.method !== 'POST' || request.url !== '/jobs') {
      this.json(response, 404, { ok: false, error: 'Not found' });
      return;
    }
    try {
      const body = await this.readBody(request);
      const parsed = JSON.parse(body) as JobSyncBatchInput;
      const headerToken = String(request.headers['x-interview-os-token'] ?? '');
      parsed.token = headerToken || parsed.token;
      const result = await this.workspace.ingestSyncedJobs(parsed);
      this.status = { running: true, port: this.port, lastBatchAt: new Date().toISOString() };
      this.json(response, 200, { ok: true, ...result });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Job sync failed';
      this.status = { ...this.status, lastError: message };
      this.json(response, 400, { ok: false, error: message });
    }
  }

  private readBody(request: IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      let size = 0;
      request.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > MAX_BODY_BYTES) {
          reject(new Error('同步数据不能超过 2 MB'));
          request.destroy();
          return;
        }
        chunks.push(chunk);
      });
      request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      request.on('error', reject);
    });
  }

  private json(response: ServerResponse, status: number, body: unknown): void {
    response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    response.end(JSON.stringify(body));
  }
}
