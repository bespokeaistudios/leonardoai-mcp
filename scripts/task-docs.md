## Task: Update all docs for leonardoai-mcp v0.2.0

The repo has been upgraded from v0.1.0 (7 tools) to v0.2.0 (10 tools + 5 new params on generate_image). Update these files:

### 1. CHANGELOG.md (CREATE — does not exist)

Create `CHANGELOG.md` with these entries:

```
# Changelog

## [0.2.0] — 2026-05-25

### Added
- `motion_generation` tool — create motion/video from an existing image via `POST /generations-motion-svd`
- `upload_init_image` tool — get presigned S3 URL for init image upload via `POST /init-image`
- `get_init_image` tool — check init image upload status via `GET /init-image/{id}`
- Reference image params on `generate_image`: `init_image_id`, `init_generation_image_id`, `init_strength` (0-1), `image_prompts` (up to 5), `image_prompt_weight` (0-1) — enables image-to-image generation

### Fixed
- Live-tested all new endpoints against Leonardo API, fixed `init_*` params to use snake_case (API spec uses `init_image_id` not `initImageId`)
- Fixed `upload_init_image` handler to read correct response key (`uploadInitImage` not `initImage`)

## [0.1.0] — 2026-05-23

### Added
- Initial public release: 7 MCP tools for Leonardo AI image generation
- `generate_image`, `generate_image_and_wait`, `get_generation`, `wait_for_generation`, `list_models`, `download_image`, `download_generation_images`
- SSRF protection on download tools, API key hygiene, full test suite
```

### 2. README.md — Update these sections:

**"What it does" table** — add two rows after "Fine-tune output":
```
| 🎬 **Create motion video** | Animate a still image into a short video — cinematic motion from any generation |
| 🖌️ **Image-to-image** | Upload a reference image and generate variations, inpainting, or style transfers |
```

**"Available Tools" table** — replace entirely with (showing all 10):

```
| Tool | What it does |
|------|-------------|
| `generate_image_and_wait` | One-call generation — sends a prompt, waits for completion, returns the image (optionally downloads to disk). Supports image-to-image with `init_image_id` and `init_strength`. |
| `generate_image` | Fire-and-forget — starts a generation, returns immediately with an ID. Supports reference images. |
| `motion_generation` | 🆕 Create motion/video from an existing image — cinematic animation |
| `upload_init_image` | 🆕 Get a presigned S3 URL to upload a reference image (for image-to-image) |
| `get_init_image` | 🆕 Check the status of an uploaded init image |
| `get_generation` | Check on a generation by ID — see if it's done and get image URLs |
| `wait_for_generation` | Poll an existing generation until it finishes or times out |
| `list_models` | List all available Leonardo models (47+ at time of writing) |
| `download_image` | Download a single image URL to a local file |
| `download_generation_images` | Fetch a completed generation and download all its images |
```

**"API notes" section** — update endpoint list to include new endpoints:

```
- `POST /generations` (with optional `init_image_id`, `init_strength`, `image_prompts` for image-to-image)
- `GET /generations/{generationId}`
- `GET /platformModels`
- `POST /generations-motion-svd` (motion/video)
- `POST /init-image` (upload init image)
- `GET /init-image/{id}` (check init image status)
```

### 3. docs/tools.md — Add documentation for the 3 new tools:

After `download_generation_images` section, add:

```
## motion_generation

Creates a motion/video generation from an existing image. Returns a generation_id that can be polled with get_generation or wait_for_generation.

Inputs:

- `image_id` required string — The ID of the image to animate (supports generated images, variation images, and init images)
- `motion_strength` optional integer 0-10, default 5
- `is_public` optional boolean
- `is_init_image` optional boolean — set true if source is an init image
- `is_variation` optional boolean — set true if source is a variation

Returns a compact `generation_id` plus raw Leonardo response.

## upload_init_image

Gets a presigned S3 URL for uploading an init image. The returned `init_image_id` can be used as `init_image_id` in `generate_image` for image-to-image generation.

Inputs:

- `extension` required string — File extension (e.g., "png", "jpg")

Returns:

- `init_image_id` — Use this with generate_image's `init_image_id` parameter
- `url` — Presigned S3 upload URL
- `fields` — Form fields required for the S3 upload

## get_init_image

Checks the status of an uploaded init image.

Inputs:

- `init_image_id` required string

Returns the init image record including status and metadata, plus raw Leonardo response.
```

IMPORTANT: Do NOT modify any code files — only docs (CHANGELOG.md, README.md, docs/tools.md). Run `npm test` at the end to verify nothing broke.