import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { safeStorage } from 'electron';

export interface SecretStore {
  set(name: string, value: string): Promise<void>;
  get(name: string): Promise<string | undefined>;
  delete(name: string): Promise<void>;
}

type SecretMap = Record<string, string>;

export class ElectronSecretStore implements SecretStore {
  private readonly filePath: string;

  constructor(rootDirectory: string) {
    this.filePath = path.join(rootDirectory, 'secure', 'secrets.json');
  }

  async set(name: string, value: string): Promise<void> {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('当前系统安全存储不可用，拒绝保存明文密钥');
    }
    const secrets = await this.readAll();
    secrets[name] = safeStorage.encryptString(value).toString('base64');
    await this.writeAll(secrets);
  }

  async get(name: string): Promise<string | undefined> {
    const secrets = await this.readAll();
    const encoded = secrets[name];
    if (!encoded) return undefined;
    if (!safeStorage.isEncryptionAvailable()) return undefined;
    return safeStorage.decryptString(Buffer.from(encoded, 'base64'));
  }

  async delete(name: string): Promise<void> {
    const secrets = await this.readAll();
    delete secrets[name];
    await this.writeAll(secrets);
  }

  private async readAll(): Promise<SecretMap> {
    try {
      return JSON.parse(await readFile(this.filePath, 'utf8')) as SecretMap;
    } catch {
      return {};
    }
  }

  private async writeAll(secrets: SecretMap): Promise<void> {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(secrets, null, 2), { encoding: 'utf8', mode: 0o600 });
  }
}

export class MemorySecretStore implements SecretStore {
  private readonly values = new Map<string, string>();
  async set(name: string, value: string): Promise<void> { this.values.set(name, value); }
  async get(name: string): Promise<string | undefined> { return this.values.get(name); }
  async delete(name: string): Promise<void> { this.values.delete(name); }
}

