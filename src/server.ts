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
  waitForGenerationSchema,
} from './tools.js';

function jsonText(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

export function createServer(env: NodeJS.ProcessEnv = process.env): McpServer {
  const client = new LeonardoClient({ apiKey: getApiKey(env), baseUrl: getBaseUrl(env) });
  const handlers = createToolHandlers(client);
  const server = new McpServer({ name: 'leonardoai-mcp', version: '0.1.0' });

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

  return server;
}

export async function runStdioServer() {
  const server = createServer();
  await server.connect(new StdioServerTransport());
}
