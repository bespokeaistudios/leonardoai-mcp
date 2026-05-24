import { z } from 'zod';
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, extname, resolve, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { URL } from 'node:url';
import { promises as dns } from 'node:dns';
import { isIP } from 'node:net';
import type { LeonardoClient, JsonObject } from './leonardo-client.js';

export const generateImageSchema = {
  prompt: z.string().min(1).describe('Positive prompt describing the desired image.'),
  negative_prompt: z.string().optional().describe('Optional negative prompt.'),
  model_id: z.string().optional().describe('Leonardo model ID. If omitted, Leonardo API default/account behavior is used.'),
  width: z.number().int().positive().optional().describe('Image width in pixels.'),
  height: z.number().int().positive().optional().describe('Image height in pixels.'),
  num_images: z.number().int().min(1).max(8).optional().describe('Number of images to generate.'),
  alchemy: z.boolean().optional().describe('Enable Leonardo Alchemy when supported.'),
  preset_style: z.string().optional().describe('Leonardo preset style, if supported by selected model.'),
  photo_real: z.boolean().optional().describe('Enable PhotoReal when supported.'),
  prompt_magic: z.boolean().optional().describe('Enable Prompt Magic when supported.'),
  guidance_scale: z.number().optional().describe('Guidance scale / CFG when supported.'),
  seed: z.number().int().optional().describe('Optional seed for repeatability.'),
  init_image_id: z.string().optional().describe('Init image ID for reference image generation.'),
  init_generation_image_id: z.string().optional().describe('Init generation image ID for reference image generation.'),
  init_strength: z.number().min(0).max(1).optional().describe('Init image influence strength (0-1).'),
  image_prompts: z.array(z.string()).max(5).optional().describe('Array of image prompts for reference generation (max 5).'),
  image_prompt_weight: z.number().min(0).max(1).optional().describe('Weight of image prompts relative to text prompt (0-1).'),
};

export const getGenerationSchema = {
  generation_id: z.string().min(1).describe('Leonardo generation ID.'),
};

export const waitForGenerationSchema = {
  generation_id: z.string().min(1).describe('Leonardo generation ID.'),
  timeout_ms: z.number().int().positive().max(10 * 60 * 1000).optional().describe('Maximum wait time in milliseconds. Default 180000.'),
  poll_interval_ms: z.number().int().positive().max(30_000).optional().describe('Polling interval in milliseconds. Default 5000.'),
};

export const generateImageAndWaitSchema = {
  ...generateImageSchema,
  timeout_ms: z.number().int().positive().max(10 * 60 * 1000).optional().describe('Maximum wait time in milliseconds. Default 180000.'),
  poll_interval_ms: z.number().int().positive().max(30_000).optional().describe('Polling interval in milliseconds. Default 5000.'),
  download: z.boolean().optional().describe('Download completed images to local disk as part of the result. Default false.'),
  output_dir: z.string().optional().describe('Directory for downloaded files when download=true. Defaults to the OS temp directory.'),
};

export const downloadImageSchema = {
  url: z.string().url().describe('Image URL to download.'),
  output_path: z.string().optional().describe('Optional local path for the downloaded file.'),
};

export const downloadGenerationImagesSchema = {
  generation_id: z.string().min(1).describe('Leonardo generation ID.'),
  output_dir: z.string().optional().describe('Directory for downloaded files. Defaults to the OS temp directory.'),
};

export const motionGenerationSchema = {
  image_id: z.string().min(1).describe('The ID of the image to animate.'),
  motion_strength: z.number().int().min(0).max(10).optional().describe('Motion strength (0-10).'),
  is_public: z.boolean().optional().describe('Whether the generation is public.'),
  is_init_image: z.boolean().optional().describe('Whether to use the image as an init image.'),
  is_variation: z.boolean().optional().describe('Whether to create a variation.'),
};

export const uploadInitImageSchema = {
  extension: z.string().min(1).describe('File extension for the init image (e.g. "png", "jpg").'),
};

export const getInitImageSchema = {
  init_image_id: z.string().min(1).describe('Leonardo init image ID.'),
};

export type GenerateImageArgs = z.infer<z.ZodObject<typeof generateImageSchema>>;
export type GetGenerationArgs = z.infer<z.ZodObject<typeof getGenerationSchema>>;
export type WaitForGenerationArgs = z.infer<z.ZodObject<typeof waitForGenerationSchema>>;
export type GenerateImageAndWaitArgs = z.infer<z.ZodObject<typeof generateImageAndWaitSchema>>;
export type DownloadImageArgs = z.infer<z.ZodObject<typeof downloadImageSchema>>;
export type DownloadGenerationImagesArgs = z.infer<z.ZodObject<typeof downloadGenerationImagesSchema>>;
export type MotionGenerationArgs = z.infer<z.ZodObject<typeof motionGenerationSchema>>;
export type UploadInitImageArgs = z.infer<z.ZodObject<typeof uploadInitImageSchema>>;
export type GetInitImageArgs = z.infer<z.ZodObject<typeof getInitImageSchema>>;

type CompactImage = { id?: string; url: string };
type CompactGeneration = { generation_id?: string; status?: string; images: CompactImage[] };
type DownloadedImage = { id?: string; url: string; path: string; bytes: number };

const COMPLETE_STATUSES = new Set(['COMPLETE', 'COMPLETED', 'FINISHED', 'SUCCEEDED', 'SUCCESS', 'DONE']);
const FAILED_STATUSES = new Set(['FAILED', 'ERROR', 'CANCELED', 'CANCELLED']);

function compactGenerationId(raw: JsonObject): string | undefined {
  const job = raw.sdGenerationJob as JsonObject | undefined;
  return (job?.generationId ?? job?.generation_id ?? raw.generationId ?? raw.generation_id) as string | undefined;
}

function compactGeneration(raw: JsonObject): CompactGeneration {
  const root = (raw.generations_by_pk ?? raw.generation ?? raw) as JsonObject;
  const imageList = (root.generated_images ?? root.images ?? []) as Array<JsonObject>;
  const images: CompactImage[] = imageList.flatMap((image) => {
    const url = (image.url ?? image.image_url) as string | undefined;
    if (typeof url !== 'string' || url.length === 0) return [];
    return [{ id: image.id as string | undefined, url }];
  });
  return {
    generation_id: (root.id ?? root.generationId ?? root.generation_id) as string | undefined,
    status: root.status as string | undefined,
    images,
  };
}

function toLeonardoPayload(args: GenerateImageArgs | GenerateImageAndWaitArgs): JsonObject {
  const payload: JsonObject = { prompt: args.prompt };
  const mapping: Array<[keyof GenerateImageArgs, string]> = [
    ['negative_prompt', 'negative_prompt'],
    ['model_id', 'modelId'],
    ['width', 'width'],
    ['height', 'height'],
    ['num_images', 'num_images'],
    ['alchemy', 'alchemy'],
    ['preset_style', 'presetStyle'],
    ['photo_real', 'photoReal'],
    ['prompt_magic', 'promptMagic'],
    ['guidance_scale', 'guidance_scale'],
    ['seed', 'seed'],
    ['init_image_id', 'init_image_id'],
    ['init_generation_image_id', 'init_generation_image_id'],
    ['init_strength', 'init_strength'],
    ['image_prompts', 'imagePrompts'],
    ['image_prompt_weight', 'imagePromptWeight'],
  ];
  for (const [inputKey, apiKey] of mapping) {
    const value = args[inputKey];
    if (value !== undefined) payload[apiKey] = value;
  }
  return payload;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeStatus(status?: string) {
  return status?.toUpperCase();
}

function isComplete(status?: string, imageCount = 0) {
  const normalized = normalizeStatus(status);
  return (normalized !== undefined && COMPLETE_STATUSES.has(normalized)) || imageCount > 0;
}

function isFailed(status?: string) {
  const normalized = normalizeStatus(status);
  return normalized !== undefined && FAILED_STATUSES.has(normalized);
}

function extensionFromUrl(url: string) {
  try {
    const pathname = new URL(url).pathname;
    const ext = extname(pathname);
    return ext || '.png';
  } catch {
    return '.png';
  }
}

const MAX_DOWNLOAD_BYTES = 50 * 1024 * 1024; // 50 MB

function resolveSafe(outputDir: string, outputPath: string): string {
  const resolved = resolve(outputPath);
  const safeBase = resolve(outputDir);
  if (!resolved.startsWith(safeBase + '/') && resolved !== safeBase) {
    throw new Error(`Path traversal blocked: ${resolved} is outside ${safeBase}`);
  }
  return resolved;
}

function isPrivateOrLoopbackIP(ip: string): boolean {
  const version = isIP(ip);

  if (version === 4) {
    const [first, second] = ip.split('.').map(Number);
    if (first === 127) return true;           // 127.0.0.0/8 loopback
    if (first === 10) return true;            // 10.0.0.0/8 private
    if (first === 172 && second >= 16 && second <= 31) return true;  // 172.16.0.0/12 private
    if (first === 192 && second === 168) return true;                 // 192.168.0.0/16 private
    if (first === 169 && second === 254) return true;                 // 169.254.0.0/16 link-local
    return false;
  }

  if (version === 6) {
    const normalized = ip.toLowerCase();
    if (normalized === '::1') return true;    // loopback
    if (/^fc/i.test(normalized) || /^fd/i.test(normalized)) return true;  // fc00::/7 unique-local
    if (/^fe[89ab]/i.test(normalized)) return true;  // fe80::/10 link-local
    return false;
  }

  return false;
}

export async function validateDownloadUrl(urlStr: string): Promise<void> {
  const parsed = new URL(urlStr);

  if (parsed.protocol !== 'https:') {
    throw new Error(`Blocked URL: only HTTPS scheme is allowed, got "${parsed.protocol.replace(/:$/, '')}"`);
  }

  let addresses: string[];
  try {
    addresses = await dns.resolve(parsed.hostname);
  } catch {
    addresses = [parsed.hostname];
  }

  for (const addr of addresses) {
    if (isPrivateOrLoopbackIP(addr)) {
      throw new Error(`Blocked URL: resolved address ${addr} is a private, loopback, or link-local IP`);
    }
  }
}

async function downloadUrl(fetchImpl: typeof fetch, url: string, outputPath?: string) {
  await validateDownloadUrl(url);
  const response = await fetchImpl(url);
  if (!response.ok) {
    throw new Error(`Failed to download image: HTTP ${response.status} ${response.statusText}`);
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.startsWith('image/')) {
    throw new Error(`Unexpected content-type for image download: ${contentType}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  if (arrayBuffer.byteLength > MAX_DOWNLOAD_BYTES) {
    throw new Error(`Image too large: ${arrayBuffer.byteLength} bytes (max ${MAX_DOWNLOAD_BYTES})`);
  }

  const path = outputPath ? resolveSafe(tmpdir(), outputPath) : join(tmpdir(), `leonardo-${randomUUID()}${extensionFromUrl(url)}`);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, Buffer.from(arrayBuffer));
  return { path, bytes: arrayBuffer.byteLength };
}

async function downloadImages(fetchImpl: typeof fetch, images: CompactImage[], outputDir?: string): Promise<DownloadedImage[]> {
  const dir = outputDir ? resolveSafe(tmpdir(), outputDir) : tmpdir();
  const downloaded: DownloadedImage[] = [];
  for (const [index, image] of images.entries()) {
    const ext = extensionFromUrl(image.url);
    const basename = image.id ? `leonardo-${image.id}${ext}` : `leonardo-${index + 1}-${randomUUID()}${ext}`;
    const { path, bytes } = await downloadUrl(fetchImpl, image.url, join(dir, basename));
    downloaded.push({ ...image, path, bytes });
  }
  return downloaded;
}

export function createToolHandlers(client: LeonardoClient, fetchImpl: typeof fetch = fetch) {
  async function waitForGeneration(args: WaitForGenerationArgs) {
    const timeoutMs = args.timeout_ms ?? 180_000;
    const pollIntervalMs = args.poll_interval_ms ?? 5_000;
    const start = Date.now();
    let last: (CompactGeneration & { raw: JsonObject }) | undefined;

    while (Date.now() - start <= timeoutMs) {
      const raw = await client.getGeneration(args.generation_id);
      const compact = compactGeneration(raw);
      last = { ...compact, raw };

      if (isComplete(compact.status, compact.images.length) || isFailed(compact.status)) {
        return { ...last, timed_out: false, elapsed_ms: Date.now() - start };
      }
      await sleep(Math.min(pollIntervalMs, Math.max(0, timeoutMs - (Date.now() - start))));
    }

    return { ...(last ?? { generation_id: args.generation_id, images: [] }), timed_out: true, elapsed_ms: Date.now() - start };
  }

  return {
    async generate_image(args: GenerateImageArgs) {
      const payload = toLeonardoPayload(args);
      const raw = await client.createGeneration(payload);
      return { generation_id: compactGenerationId(raw), raw };
    },

    async get_generation(args: GetGenerationArgs) {
      const raw = await client.getGeneration(args.generation_id);
      return { ...compactGeneration(raw), raw };
    },

    async wait_for_generation(args: WaitForGenerationArgs) {
      return waitForGeneration(args);
    },

    async generate_image_and_wait(args: GenerateImageAndWaitArgs) {
      const payload = toLeonardoPayload(args);
      const raw = await client.createGeneration(payload);
      const generationId = compactGenerationId(raw);
      if (!generationId) {
        throw new Error('Leonardo generation response did not include a generation id.');
      }
      const waited = await waitForGeneration({
        generation_id: generationId,
        timeout_ms: args.timeout_ms,
        poll_interval_ms: args.poll_interval_ms,
      });
      const downloaded = args.download && waited.images.length > 0 ? await downloadImages(fetchImpl, waited.images, args.output_dir) : undefined;
      return { generation_id: generationId, create_raw: raw, ...waited, downloaded };
    },

    async list_models() {
      const raw = await client.listModels();
      const models = (raw.custom_models ?? raw.models ?? raw.platformModels ?? raw.data ?? []) as Array<JsonObject>;
      return {
        models: models.map((model) => ({ id: model.id, name: model.name ?? model.displayName ?? model.display_name })).filter((model) => model.id),
        raw,
      };
    },

    async download_image(args: DownloadImageArgs) {
      return downloadUrl(fetchImpl, args.url, args.output_path);
    },

    async motion_generation(args: MotionGenerationArgs) {
      const payload: JsonObject = { imageId: args.image_id };
      if (args.motion_strength !== undefined) payload.motionStrength = args.motion_strength;
      if (args.is_public !== undefined) payload.isPublic = args.is_public;
      if (args.is_init_image !== undefined) payload.isInitImage = args.is_init_image;
      if (args.is_variation !== undefined) payload.isVariation = args.is_variation;
      const raw = await client.createMotionGeneration(payload);
      return { generation_id: compactGenerationId(raw), raw };
    },

    async upload_init_image(args: UploadInitImageArgs) {
      const raw = await client.createInitImage({ extension: args.extension });
      const initImage = (raw.uploadInitImage ?? raw) as JsonObject;
      return {
        init_image_id: initImage.id ?? initImage.initImageId,
        url: initImage.url,
        fields: initImage.fields,
        raw,
      };
    },

    async get_init_image(args: GetInitImageArgs) {
      const raw = await client.getInitImage(args.init_image_id);
      return { raw };
    },

    async download_generation_images(args: DownloadGenerationImagesArgs) {
      const raw = await client.getGeneration(args.generation_id);
      const compact = compactGeneration(raw);
      const downloaded = await downloadImages(fetchImpl, compact.images, args.output_dir);
      return { ...compact, downloaded, raw };
    },
  };
}
