# Agent Integration Guide

How any AI agent (Hermes, Claude, Cursor, LangChain agent, custom agent) can self-install and use `leonardoai-mcp` for image generation.

---

## The 30-Second Pitch for Agents

> **I am an MCP server.** Pull my repo, set one env var with your Leonardo API key, connect me over stdio, and call my tools. I handle image generation, polling, model discovery, and local file download. I produce compact, agent-friendly JSON. No network listener. No config file. No chat provider — your model does the reasoning, I do the pixel work.

---

## Quickstart (for an AI agent to follow)

### 1. Clone the repo

```bash
git clone https://github.com/bespokeaistudios/leonardoai-mcp.git
cd leonardoai-mcp
npm install
npm run build
```

### 2. Set your API key

```bash
export LEONARDO_AI_API="sk-..."   # or LEONARDO_API_KEY
```

### 3. Configure your MCP client

**Hermes (`~/.hermes/config.yaml`):**

```yaml
mcp_servers:
  leonardo:
    command: "node"
    args: ["/absolute/path/to/leonardoai-mcp/dist/index.js"]
    env:
      LEONARDO_AI_API: "${LEONARDO_AI_API}"
    timeout: 300
    connect_timeout: 60
```

**Claude Desktop (`claude_desktop_config.json`):**

```json
{
  "mcpServers": {
    "leonardo": {
      "command": "node",
      "args": ["/absolute/path/to/leonardoai-mcp/dist/index.js"],
      "env": {
        "LEONARDO_AI_API": "your-api-key-here"
      }
    }
  }
}
```

**⚠️ Secure your config file:**
```bash
chmod 600 ~/Library/Application\ Support/Claude/claude_desktop_config.json  # macOS
chmod 600 ~/.config/Claude/claude_desktop_config.json  # Linux
```
Do NOT commit this file to version control — add it to your global `.gitignore`.
Exclude your MCP config from iCloud/Dropbox/BackBlaze sync if it contains API keys.

### 4. Use the tools

Your agent model generates tool calls. The server responds with JSON. No polling loops needed — use `generate_image_and_wait` for the full create → poll → download flow in one tool call.

---

## Tool Selection Guide for Agents

| You want to... | Use this tool |
|---------------|--------------|
| Generate an image and get it back in one call | `generate_image_and_wait` (set `download: true`) |
| Generate an image, poll yourself | `generate_image` → `wait_for_generation` |
| Check on a previously created generation | `get_generation` |
| See available Leonardo models | `list_models` |
| Download an image URL to a local file | `download_image` |
| Download all images from a completed generation | `download_generation_images` |

**Recommended for most agent workflows:** `generate_image_and_wait` with `download: true`. One call, full result.

---

## Tool Reference (compact)

### `generate_image`

| Input | Type | Required | Notes |
|-------|------|----------|-------|
| `prompt` | string | ✅ | The image description |
| `negative_prompt` | string | | Things to avoid |
| `model_id` | string | | From `list_models` output |
| `width` | integer | | Default: Leonardo default |
| `height` | integer | | Default: Leonardo default |
| `num_images` | integer (1-8) | | Default: 1 |
| `alchemy` | boolean | | Enable Alchemy pipeline |
| `preset_style` | string | | Style preset name |
| `photo_real` | boolean | | Enable PhotoReal |
| `prompt_magic` | boolean | | Enable Prompt Magic |
| `guidance_scale` | number | | CFG strength |
| `seed` | integer | | For reproducibility |

Returns: `{ generation_id: string, raw: {...} }`

### `generate_image_and_wait`

All `generate_image` inputs, plus:

| Input | Type | Default | Notes |
|-------|------|---------|-------|
| `timeout_ms` | integer (≤600000) | 180000 | Max poll time |
| `poll_interval_ms` | integer (≤30000) | 5000 | Time between polls |
| `download` | boolean | false | Download images to disk |
| `output_dir` | string | OS temp dir | Only when download=true |

Returns: `{ generation_id, create_raw, status, images: [{id?, url}], timed_out, elapsed_ms, downloaded?: [{id?, url, path, bytes}], raw }`

### `download_image`

| Input | Type | Required | Notes |
|-------|------|----------|-------|
| `url` | URL string | ✅ | Image URL |
| `output_path` | string | | Saved to tempdir if omitted |

Returns: `{ path: string, bytes: number }`

### `download_generation_images`

| Input | Type | Required | Notes |
|-------|------|----------|-------|
| `generation_id` | string | ✅ | From any generation tool |
| `output_dir` | string | | Defaults to OS tempdir |

Returns: `{ generation_id, status, downloaded: [{id?, url, path, bytes}], raw }`

### `get_generation`

| Input | Type | Required |
|-------|------|----------|
| `generation_id` | string | ✅ |

Returns: `{ generation_id, status, images: [{id?, url}], raw }`

### `wait_for_generation`

| Input | Type | Default | Notes |
|-------|------|---------|-------|
| `generation_id` | string | ✅ | |
| `timeout_ms` | integer | 180000 | Max 600000 |
| `poll_interval_ms` | integer | 5000 | Max 30000 |

Returns: `{ generation_id, status, images, timed_out, elapsed_ms, raw }`

### `list_models`

No inputs. Returns: `{ models: [{id, name?}], raw }`

---

## Multiple Agents, One Server

The server is stateless — each tool call is independent. Multiple agents can share one installation by pointing their MCP client config at the same `dist/index.js` path. Each agent uses its own API key via environment variables.

---

## Troubleshooting for Agents

| Problem | Likely cause | Fix |
|---------|-------------|-----|
| Server won't start | API key not set | `export LEONARDO_AI_API="..."` |
| Tool not found after restart | MCP client cache | Restart the MCP client / agent process |
| `generate_image_and_wait` times out | Model is slow or queue is backed up | Increase `timeout_ms` (max 600000) |
| Downloaded images are 0 bytes | Bad URL or generation not complete | Check `status` field before downloading |
| "Path traversal blocked" | `output_dir` escaped tempdir | Use a path under `tmpdir()` or omit for default |
