# leonardoai-mcp

**Give any AI assistant the ability to generate images.**

This is a plugin for AI assistants (Hermes, Claude, Cursor, and other MCP-compatible clients) that connects them to Leonardo AI — one of the leading AI image generation platforms. Once installed, you can ask your AI assistant to draw anything and it will actually create it, right in your chat.

**Repository:** [github.com/bespokeaistudios/leonardoai-mcp](https://github.com/bespokeaistudios/leonardoai-mcp)

---

## What it does

| You want this... | Your AI assistant can now... |
|------------------|------------------------------|
| 🎨 **Generate images** | Create artwork from any text description — characters, landscapes, logos, concepts |
| 🖼️ **Browse art styles** | See what models are available (anime, photorealistic, pixel art, RPG characters, and 40+ more) |
| 📥 **Get images in chat** | Images appear directly in your conversation — no manual downloading or file juggling |
| 🎛️ **Fine-tune output** | Control size, style preset, number of images, and creative parameters |

<div align="center">
  <br>
  <img src="https://cdn.leonardo.ai/users/94c914aa-9496-4dd4-be34-d78725c4ab39/generations/252236d7-cfc1-419d-97c0-c2e90ce7e67a/Default_A_tiny_rubber_duck_floating_in_a_cosmic_nebula_pixar_s_0.jpg" alt="Example generation" width="256">
  <p><em>"A tiny rubber duck floating in a cosmic nebula"</em></p>
</div>

## How it works

```
You: "Draw me a cyberpunk cat in a neon alley"
  ↓
Your AI assistant → sends request to leonardoai-mcp → Leonardo AI generates image → sent back to your chat
```

This server is a **bridge**, not a chatbot itself. Your existing AI assistant does the thinking — this plugin gives it hands.

## Requirements

- **Node.js 20+** (to run the server)
- **A Leonardo AI API key** (get one at [app.leonardo.ai](https://app.leonardo.ai))
- **An MCP-compatible AI assistant** — Hermes Agent, Claude Desktop, Cursor, or any MCP host

## Quickstart

### 1. Clone and build

```bash
git clone https://github.com/bespokeaistudios/leonardoai-mcp.git
cd leonardoai-mcp
npm install
npm run build
```

### 2. Set your API key

```bash
export LEONARDO_AI_API="your-leonardo-api-key"
```

(Or use `LEONARDO_API_KEY` — `LEONARDO_AI_API` takes priority if both are set.)

### 3. Connect to your AI assistant

**Hermes Agent** — add to `~/.hermes/config.yaml`:

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

**Claude Desktop** — add to Claude's MCP config (`claude_desktop_config.json`):

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

### 4. Start creating

Restart your AI assistant, then try:

> *"Generate an image of a steampunk owl wearing goggles, cinematic lighting"*

---

## Available Tools (technical reference)

For those who want to know what's under the hood:

| Tool | What it does |
|------|-------------|
| `generate_image_and_wait` | One-call generation — sends a prompt, waits for completion, returns the image (optionally downloads to disk) |
| `generate_image` | Fire-and-forget — starts a generation, returns immediately with an ID |
| `get_generation` | Check on a generation by ID — see if it's done and get image URLs |
| `wait_for_generation` | Poll an existing generation until it finishes or times out |
| `list_models` | List all available Leonardo models (47 at time of writing) |
| `download_image` | Download a single image URL to a local file |
| `download_generation_images` | Fetch a completed generation and download all its images |

📖 Full tool docs with input parameters and return shapes: [docs/tools.md](docs/tools.md)

🤖 Guide for AI agents self-installing this server: [docs/AGENT_INTEGRATION_GUIDE.md](docs/AGENT_INTEGRATION_GUIDE.md)

## Development

```bash
npm test
npm run typecheck -- --pretty false
npm run build
npm run smoke:mcp
```

`npm run smoke:mcp` builds the server, starts `dist/index.js` with a dummy key when needed, performs MCP `initialize`, and verifies that all expected tools are discoverable via `tools/list`.

## Public packaging checklist

Before publishing or handing this to another MCP host:

1. Run `npm ci` on a clean checkout.
2. Run `npm test`, `npm run typecheck -- --pretty false`, `npm run build`, and `npm run smoke:mcp`.
3. Confirm `LEONARDO_AI_API` or `LEONARDO_API_KEY` is supplied by the MCP client environment, not committed in the repo.
4. Use an absolute path to `dist/index.js` for local stdio MCP clients, or install the package and point the client at the installed `leonardo-mcp` bin.
5. If publishing to npm, add final `repository`, `homepage`, and `bugs` metadata once the public GitHub URL is known.

## Security

- Do not commit `.env` or API keys.
- Keep secrets in the MCP client's environment or secret store.
- Errors are normalized so the Authorization header is not included in exception messages.
- Download tools write only to the requested output path/directory or the OS temp directory.
- This project is safe to publish publicly after local testing.

## API notes

Leonardo's REST API evolves. The default endpoint used here is:

```text
https://cloud.leonardo.ai/api/rest/v1
```

The implementation uses documented/common REST paths:

- `POST /generations`
- `GET /generations/{generationId}`
- `GET /platformModels`

If Leonardo changes payload names or endpoint shapes, adjust `src/leonardo-client.ts` and `src/tools.ts`, then add/extend tests first.
