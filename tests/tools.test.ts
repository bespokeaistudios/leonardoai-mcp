import { describe, expect, it, vi } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createToolHandlers } from '../src/tools.js';

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
    } as any;
    const handlers = createToolHandlers(client);

    const response = await handlers.list_models();

    expect(response.models).toEqual([
      { id: 'model-1', name: 'Leonardo Vision XL' },
      { id: 'model-2', name: 'Anime Pastel' },
    ]);
    expect(response.raw).toMatchObject({ custom_models: expect.any(Array) });
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
});
