#!/bin/bash
set +e; source ~/.hermes/.env 2>/dev/null; set -e
export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"

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

PROMPT=$(cat /home/kyle/leonardo-mcp/prompts/security-fixes.txt)
cd /home/kyle/leonardo-mcp

claude -p "$PROMPT" \
  --dangerously-skip-permissions \
  --max-turns 40 \
  --output-format json \
  2>/dev/null
