# Changelog

## 0.1.0 — Initial Release

### Tools
- `generate_image` — create a Leonardo image generation job
- `get_generation` — fetch generation status and image URLs
- `wait_for_generation` — poll a generation until completion or timeout
- `generate_image_and_wait` — create, poll, and optionally download images in one call
- `list_models` — list available Leonardo platform models (compact + raw)
- `download_image` — download a single generated image URL to local disk
- `download_generation_images` — fetch a completed generation and download all images

### Features
- Stdio MCP transport for Claude Desktop, Hermes, Cursor, and other MCP clients
- Zod-validated tool schemas with full input descriptions
- Compact result shapes with raw API payloads preserved for debugging
- Path traversal protection, content-type validation, and 50 MB file size cap on downloads
- Error response body redaction — Leonardo API errors logged to stderr only
- Pinned npm dependencies for reproducible installs

### Security
- API key from environment variables only (`LEONARDO_AI_API` or `LEONARDO_API_KEY`)
- Authorization header never leaked in error messages
- `SECURITY.md` with vulnerability reporting process
