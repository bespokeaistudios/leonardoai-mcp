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

  it('sends auth header and JSON body when creating a motion generation', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ motionSvdGenerationJob: { generationId: 'motion-456' } }), { status: 200 }));
    const client = new LeonardoClient({ apiKey: 'test-key', fetch: fetchMock as typeof fetch });

    const result = await client.createMotionGeneration({ imageId: 'img-1', motionStrength: 5 });

    expect(result).toEqual({ motionSvdGenerationJob: { generationId: 'motion-456' } });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://cloud.leonardo.ai/api/rest/v1/generations-motion-svd');
    expect(init?.method).toBe('POST');
    expect(init?.headers).toMatchObject({ authorization: 'Bearer test-key', accept: 'application/json', 'content-type': 'application/json' });
    expect(JSON.parse(init?.body as string)).toMatchObject({ imageId: 'img-1', motionStrength: 5 });
  });

  it('normalizes API errors without leaking authorization or response body', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ error: 'bad request' }), { status: 400, statusText: 'Bad Request' }));
    const client = new LeonardoClient({ apiKey: 'secret-key', fetch: fetchMock as typeof fetch });

    await expect(client.getGeneration('gen-404')).rejects.toThrow(/Leonardo API error 400 Bad Request/);
    // Neither the API key nor the response body should appear in the error message
    await expect(client.getGeneration('gen-404')).rejects.not.toThrow(/secret-key/);
    await expect(client.getGeneration('gen-404')).rejects.not.toThrow(/bad request/);
  });

  it('listV2Models calls GET /models on v2 base URL', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ productionApiAvailableModels: [{ id: 'nano-banana-2', name: 'Nano Banana 2' }] }), { status: 200 }));
    const client = new LeonardoClient({ apiKey: 'test-key', fetch: fetchMock as typeof fetch });

    const result = await client.listV2Models();

    expect(result).toEqual({ productionApiAvailableModels: [{ id: 'nano-banana-2', name: 'Nano Banana 2' }] });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://cloud.leonardo.ai/api/rest/v2/models');
    expect(init?.method).toBe('GET');
    expect(init?.headers).toMatchObject({ authorization: 'Bearer test-key' });
  });

  it('createV2Generation sends GraphQL mutation to v2 /generations', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ data: { generate: { id: 'gen-v2', status: 'PENDING', images: [] } } }), { status: 200 }));
    const client = new LeonardoClient({ apiKey: 'test-key', fetch: fetchMock as typeof fetch });

    const result = await client.createV2Generation({
      query: 'mutation { generate { id } }',
      variables: { model: 'nano-banana-2', parameters: { prompt: 'a cat' } },
    });

    expect(result).toEqual({ data: { generate: { id: 'gen-v2', status: 'PENDING', images: [] } } });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://cloud.leonardo.ai/api/rest/v2/generations');
    expect(init?.method).toBe('POST');
    expect(init?.headers).toMatchObject({ authorization: 'Bearer test-key', 'content-type': 'application/json' });
    expect(JSON.parse(init?.body as string)).toMatchObject({ query: 'mutation { generate { id } }', variables: { model: 'nano-banana-2' } });
  });

  it('v2Request normalizes errors same as v1 request', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, statusText: 'Unauthorized' }));
    const client = new LeonardoClient({ apiKey: 'secret-key', fetch: fetchMock as typeof fetch });

    await expect(client.listV2Models()).rejects.toThrow(/Leonardo API error 401 Unauthorized/);
    await expect(client.listV2Models()).rejects.not.toThrow(/secret-key/);
    await expect(client.listV2Models()).rejects.not.toThrow(/unauthorized/);
  });
});
