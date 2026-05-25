import { describe, expect, it, vi } from 'vitest';

vi.mock('node:dns', () => ({
  promises: {
    resolve: vi.fn().mockResolvedValue(['93.184.216.34']),
  },
}));

import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promises as dns } from 'node:dns';
import { createToolHandlers, validateDownloadUrl } from '../src/tools.js';

describe('tool handlers', () => {
  it('generate_image returns a compact generation id response', async () => {
    const client = {
      createGeneration: vi.fn(async () => ({ sdGenerationJob: { generationId: 'gen-abc' } })),
    } as any;
    const handlers = createToolHandlers(client);

    const response = await handlers.generate_image({ prompt: 'castle', num_images: 1 });

    expect(client.createGeneration).toHaveBeenCalledWith({ prompt: 'castle', num_images: 1 });
    expect(response).toMatchObject({ generation_id: 'gen-abc', raw: { sdGenerationJob: { generationId: 'gen-abc' } } });
  });

  it('get_generation extracts image urls from Leonardo response shapes', async () => {
    const client = {
      getGeneration: vi.fn(async () => ({
        generations_by_pk: {
          id: 'gen-abc',
          status: 'COMPLETE',
          generated_images: [{ id: 'img-1', url: 'https://example.com/1.png' }],
        },
      })),
    } as any;
    const handlers = createToolHandlers(client);

    const response = await handlers.get_generation({ generation_id: 'gen-abc' });

    expect(response).toMatchObject({ generation_id: 'gen-abc', status: 'COMPLETE', images: [{ id: 'img-1', url: 'https://example.com/1.png' }] });
  });

  it('wait_for_generation polls until a generation has images', async () => {
    const client = {
      getGeneration: vi
        .fn()
        .mockResolvedValueOnce({ generations_by_pk: { id: 'gen-abc', status: 'PENDING', generated_images: [] } })
        .mockResolvedValueOnce({
          generations_by_pk: {
            id: 'gen-abc',
            status: 'COMPLETE',
            generated_images: [{ id: 'img-1', url: 'https://example.com/1.png' }],
          },
        }),
    } as any;
    const handlers = createToolHandlers(client);

    const response = await handlers.wait_for_generation({ generation_id: 'gen-abc', timeout_ms: 1000, poll_interval_ms: 1 });

    expect(client.getGeneration).toHaveBeenCalledTimes(2);
    expect(response).toMatchObject({ generation_id: 'gen-abc', timed_out: false, images: [{ id: 'img-1' }] });
  });

  it('generate_image_and_wait can create, wait, and download images', async () => {
    const client = {
      createGeneration: vi.fn(async () => ({ sdGenerationJob: { generationId: 'gen-abc' } })),
      getGeneration: vi.fn(async () => ({
        generations_by_pk: {
          id: 'gen-abc',
          status: 'COMPLETE',
          generated_images: [{ id: 'img-1', url: 'https://example.com/1.png' }],
        },
      })),
    } as any;
    const fetchMock = vi.fn(async () => new Response(Buffer.from('fake image'), { status: 200, headers: { 'content-type': 'image/png' } }));
    const outputDir = await mkdtemp(join(tmpdir(), 'leonardo-test-'));
    const handlers = createToolHandlers(client, fetchMock as typeof fetch);

    try {
      const response = await handlers.generate_image_and_wait({
        prompt: 'castle',
        download: true,
        output_dir: outputDir,
        poll_interval_ms: 1,
        timeout_ms: 1000,
      });

      expect(client.createGeneration).toHaveBeenCalledWith({ prompt: 'castle' });
      expect(client.getGeneration).toHaveBeenCalledWith('gen-abc');
      expect(fetchMock).toHaveBeenCalledWith('https://example.com/1.png');
      expect(response.generation_id).toBe('gen-abc');
      expect(response.downloaded?.[0]).toMatchObject({ id: 'img-1', bytes: 10 });
      await expect(readFile(response.downloaded![0].path, 'utf8')).resolves.toBe('fake image');
    } finally {
      await rm(outputDir, { recursive: true, force: true });
    }
  });

  it('list_models returns compact model identifiers and preserves raw response', async () => {
    const client = {
      listModels: vi.fn(async () => ({
        custom_models: [
          { id: 'model-1', name: 'Leonardo Vision XL' },
          { id: 'model-2', displayName: 'Anime Pastel' },
          { name: 'missing id ignored' },
        ],
      })),
      listV2Models: vi.fn(async () => ({ productionApiAvailableModels: [] })),
    } as any;
    const handlers = createToolHandlers(client);

    const response = await handlers.list_models();

    expect(response.models).toEqual([
      { id: 'model-1', name: 'Leonardo Vision XL', source: 'v1' },
      { id: 'model-2', name: 'Anime Pastel', source: 'v1' },
    ]);
    expect(response.v1_raw).toMatchObject({ custom_models: expect.any(Array) });
  });

  it('download_generation_images downloads all extracted generation images', async () => {
    const client = {
      getGeneration: vi.fn(async () => ({
        generations_by_pk: {
          id: 'gen-abc',
          status: 'COMPLETE',
          generated_images: [
            { id: 'img-1', url: 'https://example.com/1.png' },
            { id: 'img-2', url: 'https://example.com/2.webp' },
          ],
        },
      })),
    } as any;
    const fetchMock = vi.fn(async (url: string) => new Response(Buffer.from(url.endsWith('webp') ? 'two' : 'one'), { status: 200, headers: { 'content-type': 'image/png' } }));
    const outputDir = await mkdtemp(join(tmpdir(), 'leonardo-test-'));
    const handlers = createToolHandlers(client, fetchMock as unknown as typeof fetch);

    try {
      const response = await handlers.download_generation_images({ generation_id: 'gen-abc', output_dir: outputDir });

      expect(response.downloaded).toHaveLength(2);
      expect(response.downloaded.map((image) => image.bytes)).toEqual([3, 3]);
      expect(response.downloaded[1].path.endsWith('.webp')).toBe(true);
    } finally {
      await rm(outputDir, { recursive: true, force: true });
    }
  });

  it('motion_generation maps snake_case args to camelCase API payload', async () => {
    const client = {
      createMotionGeneration: vi.fn(async () => ({ sdGenerationJob: { generationId: 'gen-mot' } })),
    } as any;
    const handlers = createToolHandlers(client);

    const response = await handlers.motion_generation({
      image_id: 'img-1',
      motion_strength: 7,
      is_public: true,
      is_init_image: false,
      is_variation: true,
    });

    expect(client.createMotionGeneration).toHaveBeenCalledWith({
      imageId: 'img-1',
      motionStrength: 7,
      isPublic: true,
      isInitImage: false,
      isVariation: true,
    });
    expect(response).toMatchObject({
      generation_id: 'gen-mot',
      raw: { sdGenerationJob: { generationId: 'gen-mot' } },
    });
  });

  it('upload_init_image calls createInitImage with extension and extracts response fields', async () => {
    const client = {
      createInitImage: vi.fn(async () => ({
        uploadInitImage: { id: 'init-abc', url: 'https://s3.example.com/upload', fields: { key: 'images/img.png' } },
      })),
    } as any;
    const handlers = createToolHandlers(client);

    const response = await handlers.upload_init_image({ extension: 'png' });

    expect(client.createInitImage).toHaveBeenCalledWith({ extension: 'png' });
    expect(response).toMatchObject({
      init_image_id: 'init-abc',
      url: 'https://s3.example.com/upload',
      fields: { key: 'images/img.png' },
    });
  });

  it('get_init_image calls getInitImage with the provided id', async () => {
    const client = {
      getInitImage: vi.fn(async () => ({ id: 'init-abc', status: 'UPLOADED' })),
    } as any;
    const handlers = createToolHandlers(client);

    const response = await handlers.get_init_image({ init_image_id: 'init-abc' });

    expect(client.getInitImage).toHaveBeenCalledWith('init-abc');
    expect(response.raw).toEqual({ id: 'init-abc', status: 'UPLOADED' });
  });

  it('list_models merges v1 and v2 model lists with source field', async () => {
    const client = {
      listModels: vi.fn(async () => ({
        custom_models: [
          { id: 'b2617f7e-1f69-4c8b-a5b1-8f7a2e8e4e0a', name: 'Leonardo Vision XL' },
          { id: 'shared-model', name: 'Shared Model v1' },
        ],
      })),
      listV2Models: vi.fn(async () => ({
        productionApiAvailableModels: [
          { id: 'nano-banana-2', name: 'Nano Banana 2', modelType: 'image', description: 'Fast model' },
          { id: 'shared-model', name: 'Shared Model v2', modelType: 'image' },
        ],
      })),
    } as any;
    const handlers = createToolHandlers(client);

    const response = await handlers.list_models();

    expect(client.listModels).toHaveBeenCalled();
    expect(client.listV2Models).toHaveBeenCalled();
    expect(response.models).toEqual([
      { id: 'nano-banana-2', name: 'Nano Banana 2', source: 'v2' },
      { id: 'shared-model', name: 'Shared Model v2', source: 'v2' },
      { id: 'b2617f7e-1f69-4c8b-a5b1-8f7a2e8e4e0a', name: 'Leonardo Vision XL', source: 'v1' },
    ]);
    expect(response.v1_raw).toBeTruthy();
    expect(response.v2_raw).toBeTruthy();
  });

  it('list_models handles v1 failure gracefully', async () => {
    const client = {
      listModels: vi.fn(async () => { throw new Error('v1 down'); }),
      listV2Models: vi.fn(async () => ({
        productionApiAvailableModels: [{ id: 'nano-banana-2', name: 'Nano Banana 2' }],
      })),
    } as any;
    const handlers = createToolHandlers(client);

    const response = await handlers.list_models();

    expect(response.models).toEqual([{ id: 'nano-banana-2', name: 'Nano Banana 2', source: 'v2' }]);
    expect(response.v1_raw).toBeNull();
    expect(response.v2_raw).toBeTruthy();
  });

  it('generate_image routes v2 model IDs to createV2Generation', async () => {
    const client = {
      listV2Models: vi.fn(async () => ({ productionApiAvailableModels: [{ id: 'nano-banana-2', name: 'Nano Banana 2' }] })),
      createGeneration: vi.fn(),
      createV2Generation: vi.fn(async () => ({
        data: { generate: { id: 'gen-v2-123', status: 'PENDING', images: [] } },
      })),
    } as any;
    const handlers = createToolHandlers(client);

    const response = await handlers.generate_image({ prompt: 'a cat', model_id: 'nano-banana-2' });

    expect(client.createGeneration).not.toHaveBeenCalled();
    expect(client.createV2Generation).toHaveBeenCalledWith({
      query: expect.stringContaining('mutation generate'),
      variables: { model: 'nano-banana-2', parameters: { prompt: 'a cat' } },
    });
    expect(response.generation_id).toBe('gen-v2-123');
  });

  it('generate_image routes UUID model IDs to createGeneration (v1)', async () => {
    const client = {
      createGeneration: vi.fn(async () => ({ sdGenerationJob: { generationId: 'gen-v1' } })),
      createV2Generation: vi.fn(),
    } as any;
    const handlers = createToolHandlers(client);

    await handlers.generate_image({ prompt: 'a dog', model_id: 'b2617f7e-1f69-4c8b-a5b1-8f7a2e8e4e0a' });

    expect(client.createGeneration).toHaveBeenCalledWith(expect.objectContaining({ prompt: 'a dog', modelId: 'b2617f7e-1f69-4c8b-a5b1-8f7a2e8e4e0a' }));
    expect(client.createV2Generation).not.toHaveBeenCalled();
  });

  it('generate_image_and_wait routes v2 model IDs correctly', async () => {
    const client = {
      listV2Models: vi.fn(async () => ({ productionApiAvailableModels: [{ id: 'nano-banana-2', name: 'Nano Banana 2' }] })),
      createGeneration: vi.fn(),
      createV2Generation: vi.fn(async () => ({
        data: { generate: { id: 'gen-v2-wait', status: 'PENDING', images: [] } },
      })),
      getGeneration: vi.fn(async () => ({
        data: { generate: { id: 'gen-v2-wait', status: 'COMPLETE', images: [{ id: 'img-1', url: 'https://example.com/1.png' }] } },
      })),
    } as any;
    const handlers = createToolHandlers(client);

    const response = await handlers.generate_image_and_wait({
      prompt: 'a cat',
      model_id: 'nano-banana-2',
      poll_interval_ms: 1,
      timeout_ms: 500,
    });

    expect(client.createV2Generation).toHaveBeenCalled();
    expect(client.createGeneration).not.toHaveBeenCalled();
    expect(client.getGeneration).toHaveBeenCalledWith('gen-v2-wait');
    expect(response.generation_id).toBe('gen-v2-wait');
    expect(response.images).toEqual([{ id: 'img-1', url: 'https://example.com/1.png' }]);
  });

  it('compactGenerationId extracts from v2 GraphQL response', async () => {
    const client = {
      listV2Models: vi.fn(async () => ({ productionApiAvailableModels: [{ id: 'nano-banana-2', name: 'Nano Banana 2' }] })),
      createGeneration: vi.fn(async () => ({ sdGenerationJob: { generationId: 'gen-v1' } })),
      createV2Generation: vi.fn(async () => ({ data: { generate: { id: 'gen-v2-compact', status: 'PENDING' } } })),
    } as any;
    const handlers = createToolHandlers(client);

    const v1Response = await handlers.generate_image({ prompt: 'test', model_id: 'b2617f7e-1f69-4c8b-a5b1-8f7a2e8e4e0a' });
    expect(v1Response.generation_id).toBe('gen-v1');

    const v2Response = await handlers.generate_image({ prompt: 'test', model_id: 'nano-banana-2' });
    expect(v2Response.generation_id).toBe('gen-v2-compact');
  });

  it('generate_image passes reference image params as camelCase', async () => {
    const client = {
      createGeneration: vi.fn(async () => ({ sdGenerationJob: { generationId: 'gen-ref' } })),
    } as any;
    const handlers = createToolHandlers(client);

    await handlers.generate_image({
      prompt: 'cyberpunk',
      init_image_id: 'init-1',
      init_generation_image_id: 'gen-img-1',
      init_strength: 0.7,
      image_prompts: ['a red car', 'a blue sky'],
      image_prompt_weight: 0.5,
    });

    expect(client.createGeneration).toHaveBeenCalledWith({
      prompt: 'cyberpunk',
      init_image_id: 'init-1',
      init_generation_image_id: 'gen-img-1',
      init_strength: 0.7,
      imagePrompts: ['a red car', 'a blue sky'],
      imagePromptWeight: 0.5,
    });
  });

  describe('validateDownloadUrl (SSRF protection)', () => {
    it('allows HTTPS URLs with public DNS resolution', async () => {
      vi.mocked(dns.resolve).mockResolvedValue(['93.184.216.34']);
      await expect(validateDownloadUrl('https://example.com/image.png')).resolves.toBeUndefined();
    });

    it('rejects HTTP URLs', async () => {
      await expect(validateDownloadUrl('http://example.com/image.png')).rejects.toThrow(
        'Blocked URL: only HTTPS scheme is allowed, got "http"',
      );
    });

    it('rejects localhost URLs', async () => {
      vi.mocked(dns.resolve).mockResolvedValue(['127.0.0.1']);
      await expect(validateDownloadUrl('https://localhost/image.png')).rejects.toThrow(
        'Blocked URL: resolved address 127.0.0.1 is a private, loopback, or link-local IP',
      );
    });

    it('rejects private IP URLs', async () => {
      vi.mocked(dns.resolve).mockRejectedValue(new Error('ENOTFOUND'));
      await expect(validateDownloadUrl('https://192.168.1.1/test.png')).rejects.toThrow(
        'Blocked URL: resolved address 192.168.1.1 is a private, loopback, or link-local IP',
      );
    });
  });
});
