import type { ConnectionResult, ProviderConfig } from '../../shared/domain';

export interface CompletionRequest {
  system: string;
  prompt: string;
  conversationId?: string;
  image?: {
    mimeType: 'image/png' | 'image/jpeg' | 'image/webp';
    base64: string;
  };
}

export interface CompletionResponse {
  text: string;
  conversationId?: string;
}

export interface AIProvider {
  readonly config: ProviderConfig;
  testConnection(apiKey: string): Promise<ConnectionResult>;
  complete(request: CompletionRequest, apiKey: string): Promise<CompletionResponse>;
}

export class ProviderHttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = 'ProviderHttpError';
  }
}

export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = 15_000
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
