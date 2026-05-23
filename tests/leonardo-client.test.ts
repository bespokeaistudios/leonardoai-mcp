import { describe, expect, it, vi } from 'vitest';
import { LeonardoClient } from '../src/leonardo-client.js';

describe('LeonardoClient', () => {
  it('sends auth header and JSON body when creating a generation', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ sdGenerationJob: { generationId: 'gen-123' } }), { status: 200 }));
    const client = new LeonardoClient({ apiKey: 'test-key', fetch: fetchMock as typeof fetch });

    const result = await client.createGeneration({ prompt: 'a cat', width: 1024, height: 768, num_images: 2 });

    expect(result).toEqual({ sdGenerationJob: { generationId: 'gen-123' } });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://cloud.leonardo.ai/api/rest/v1/generations');
    expect(init?.method).toBe('POST');
    expect(init?.headers).toMatchObject({ authorization: 'Bearer test-key', accept: 'application/json', 'content-type': 'application/json' });
    expect(JSON.parse(init?.body as string)).toMatchObject({ prompt: 'a cat', width: 1024, height: 768, num_images: 2 });
  });

  it('normalizes API errors without leaking authorization or response body', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ error: 'bad request' }), { status: 400, statusText: 'Bad Request' }));
    const client = new LeonardoClient({ apiKey: 'secret-key', fetch: fetchMock as typeof fetch });

    await expect(client.getGeneration('gen-404')).rejects.toThrow(/Leonardo API error 400 Bad Request/);
    // Neither the API key nor the response body should appear in the error message
    await expect(client.getGeneration('gen-404')).rejects.not.toThrow(/secret-key/);
    await expect(client.getGeneration('gen-404')).rejects.not.toThrow(/bad request/);
  });
});
