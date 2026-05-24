#!/bin/bash
set +e
source ~/.hermes/.env 2>/dev/null
set -e

export ANTHROPIC_BASE_URL="https://api.deepseek.com/anthropic"
export ANTHROPIC_AUTH_TOKEN="$DEEPSEEK_API_KEY"
export ANTHROPIC_MODEL="deepseek-v4-pro[1m]"
export ANTHROPIC_DEFAULT_OPUS_MODEL="deepseek-v4-pro[1m]"
export ANTHROPIC_DEFAULT_SONNET_MODEL="deepseek-v4-pro[1m]"
export ANTHROPIC_DEFAULT_HAIKU_MODEL="deepseek-v4-flash"
export CLAUDE_CODE_SUBAGENT_MODEL="deepseek-v4-flash"
export CLAUDE_CODE_EFFORT_LEVEL="max"
export API_TIMEOUT_MS="600000"
export CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC="1"
export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"

cd /home/kyle/leonardo-mcp

claude -p '## Task: Add motion generation client method

Add a `createMotionGeneration` method to `src/leonardo-client.ts` that calls `POST /generations-motion-svd`.

1. Read `src/leonardo-client.ts` and `tests/leonardo-client.test.ts` to understand existing patterns
2. Add `createMotionGeneration(payload: JsonObject): Promise<JsonObject>` method after `createInitImage()` in the client
3. The method should call `this.request("/generations-motion-svd", { method: "POST", body: payload })`
4. Add a test in `tests/leonardo-client.test.ts` following the existing test patterns — mock fetch, verify POST to correct URL, verify response
5. Run `npx vitest run tests/leonardo-client.test.ts` to verify all tests pass
6. Run `npm run build && npm run typecheck`
7. If any test or build step fails, fix it

Do NOT modify any other files.' \
  --allowedTools "Read,Edit,Write,Bash(npx vitest run *,npm run *)" \
  --max-turns 8 \
  --output-format json
