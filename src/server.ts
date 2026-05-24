import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { getApiKey, getBaseUrl } from './config.js';
import { LeonardoClient } from './leonardo-client.js';
import {
  createToolHandlers,
  downloadGenerationImagesSchema,
  downloadImageSchema,
  generateImageAndWaitSchema,
  generateImageSchema,
  getGenerationSchema,
  getInitImageSchema,
  motionGenerationSchema,
  uploadInitImageSchema,
  waitForGenerationSchema,
} from './tools.js';

function jsonText(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

export function createServer(env: NodeJS.ProcessEnv = process.env): McpServer {
  const client = new LeonardoClient({ apiKey: getApiKey(env), baseUrl: getBaseUrl(env) });
  const handlers = createToolHandlers(client);
  const server = new McpServer({ name: 'leonardoai-mcp', version: '0.2.0' });

  server.registerTool(
    'generate_image',
    {
      title: 'Generate image',
      description: 'Create a Leonardo AI image generation job. Poll get_generation or wait_for_generation with the returned generation_id for results.',
      inputSchema: generateImageSchema,
    },
    async (args) => jsonText(await handlers.generate_image(args)),
  );

  server.registerTool(
    'get_generation',
    {
      title: 'Get generation',
      description: 'Fetch status and generated image URLs for a Leonardo generation ID.',
      inputSchema: getGenerationSchema,
    },
    async (args) => jsonText(await handlers.get_generation(args)),
  );

  server.registerTool(
    'wait_for_generation',
    {
      title: 'Wait for generation',
      description: 'Poll a Leonardo generation until it completes, fails, or times out.',
      inputSchema: waitForGenerationSchema,
    },
    async (args) => jsonText(await handlers.wait_for_generation(args)),
  );

  server.registerTool(
    'generate_image_and_wait',
    {
      title: 'Generate image and wait',
      description: 'Create a Leonardo generation job, poll until completion, and optionally download completed images.',
      inputSchema: generateImageAndWaitSchema,
    },
    async (args) => jsonText(await handlers.generate_image_and_wait(args)),
  );

  server.registerTool(
    'list_models',
    {
      title: 'List Leonardo models',
      description: 'List Leonardo platform models available through the API.',
      inputSchema: {},
    },
    async () => jsonText(await handlers.list_models()),
  );

  server.registerTool(
    'download_image',
    {
      title: 'Download image',
      description: 'Download a generated image URL to a local file path so gateway clients can send it natively.',
      inputSchema: downloadImageSchema,
    },
    async (args) => jsonText(await handlers.download_image(args)),
  );

  server.registerTool(
    'download_generation_images',
    {
      title: 'Download generation images',
      description: 'Fetch a completed generation and download all generated image URLs to local files.',
      inputSchema: downloadGenerationImagesSchema,
    },
    async (args) => jsonText(await handlers.download_generation_images(args)),
  );

  server.registerTool(
    'motion_generation',
    {
      title: 'Generate motion video',
      description: 'Create a motion/video generation from an existing image. Returns a generation_id pollable via get_generation.',
      inputSchema: motionGenerationSchema,
    },
    async (args) => jsonText(await handlers.motion_generation(args)),
  );

  server.registerTool(
    'upload_init_image',
    {
      title: 'Upload init image',
      description: 'Request a presigned S3 upload URL for an init image. Returns URL and form fields for direct upload to S3.',
      inputSchema: uploadInitImageSchema,
    },
    async (args) => jsonText(await handlers.upload_init_image(args)),
  );

  server.registerTool(
    'get_init_image',
    {
      title: 'Get init image',
      description: 'Fetch the status and details of an uploaded init image by its ID.',
      inputSchema: getInitImageSchema,
    },
    async (args) => jsonText(await handlers.get_init_image(args)),
  );

  return server;
}

export async function runStdioServer() {
  const server = createServer();
  await server.connect(new StdioServerTransport());
}
