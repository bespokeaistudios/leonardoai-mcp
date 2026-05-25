export type FetchLike = typeof fetch;

const DEFAULT_FETCH_TIMEOUT_MS = 30_000;

export class LeonardoApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly statusText: string,
    public readonly responseBody: string,
  ) {
    super(`Leonardo API error ${status} ${statusText}`);
    this.name = 'LeonardoApiError';
    // Log full body to stderr for debugging; do not include in message
    // to avoid leaking sensitive data from Leonardo error responses.
    console.error(`[leonardo-mcp] API error ${status}: ${responseBody.slice(0, 1000)}`);
  }
}

export interface LeonardoClientOptions {
  apiKey: string;
  baseUrl?: string;
  v2BaseUrl?: string;
  fetch?: FetchLike;
  fetchTimeoutMs?: number;
}

export type JsonObject = Record<string, unknown>;

export class LeonardoClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly v2BaseUrl: string;
  private readonly fetchImpl: FetchLike;
  private readonly fetchTimeoutMs: number;

  constructor(options: LeonardoClientOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? 'https://cloud.leonardo.ai/api/rest/v1').replace(/\/$/, '');
    this.v2BaseUrl = (options.v2BaseUrl ?? 'https://cloud.leonardo.ai/api/rest/v2').replace(/\/$/, '');
    this.fetchImpl = options.fetch ?? fetch;
    this.fetchTimeoutMs = options.fetchTimeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS;
  }

  async createGeneration(payload: JsonObject): Promise<JsonObject> {
    return this.request('/generations', { method: 'POST', body: payload });
  }

  async getGeneration(generationId: string): Promise<JsonObject> {
    return this.request(`/generations/${encodeURIComponent(generationId)}`, { method: 'GET' });
  }

  async listModels(): Promise<JsonObject> {
    return this.request('/platformModels', { method: 'GET' });
  }

  async createInitImage(uploadPayload: JsonObject): Promise<JsonObject> {
    return this.request('/init-image', { method: 'POST', body: uploadPayload });
  }

  async getInitImage(initImageId: string): Promise<JsonObject> {
    return this.request(`/init-image/${encodeURIComponent(initImageId)}`, { method: 'GET' });
  }

  async createMotionGeneration(payload: JsonObject): Promise<JsonObject> {
    return this.request('/generations-motion-svd', { method: 'POST', body: payload });
  }

  async listV2Models(): Promise<JsonObject> {
    return this.v2Request('/models', { method: 'GET' });
  }

  async createV2Generation(payload: JsonObject): Promise<JsonObject> {
    return this.v2Request('/generations', { method: 'POST', body: payload });
  }

  private async v2Request(path: string, options: { method: string; body?: JsonObject }): Promise<JsonObject> {
    const init: RequestInit = {
      method: options.method,
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        accept: 'application/json',
        'content-type': 'application/json',
      },
    };
    if (options.body !== undefined) {
      init.body = JSON.stringify(options.body);
    }

    const controller = new AbortController();
    const timeoutMs = this.fetchTimeoutMs;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await this.fetchImpl(`${this.v2BaseUrl}${path}`, { ...init, signal: controller.signal });
      const text = await response.text();
      if (!response.ok) {
        throw new LeonardoApiError(response.status, response.statusText, text);
      }
      if (!text) {
        return {};
      }
      try {
        return JSON.parse(text) as JsonObject;
      } catch {
        return { text };
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new Error(`Leonardo API request timed out after ${timeoutMs / 1000}s`);
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async request(path: string, options: { method: string; body?: JsonObject }): Promise<JsonObject> {
    const init: RequestInit = {
      method: options.method,
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        accept: 'application/json',
        'content-type': 'application/json',
      },
    };
    if (options.body !== undefined) {
      init.body = JSON.stringify(options.body);
    }

    const controller = new AbortController();
    const timeoutMs = this.fetchTimeoutMs;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await this.fetchImpl(`${this.baseUrl}${path}`, { ...init, signal: controller.signal });
      const text = await response.text();
      if (!response.ok) {
        throw new LeonardoApiError(response.status, response.statusText, text);
      }
      if (!text) {
        return {};
      }
      try {
        return JSON.parse(text) as JsonObject;
      } catch {
        return { text };
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new Error(`Leonardo API request timed out after ${timeoutMs / 1000}s`);
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
