export class LeonardoConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LeonardoConfigError';
  }
}

export function getApiKey(env: NodeJS.ProcessEnv = process.env): string {
  const apiKey = env.LEONARDO_AI_API || env.LEONARDO_API_KEY;
  if (!apiKey || apiKey.trim().length === 0) {
    throw new LeonardoConfigError(
      'Leonardo API key is required. Set LEONARDO_AI_API or LEONARDO_API_KEY in the MCP server environment.',
    );
  }
  return apiKey.trim();
}

export function getBaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  return (env.LEONARDO_API_BASE_URL || 'https://cloud.leonardo.ai/api/rest/v1').replace(/\/$/, '');
}
