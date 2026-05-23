# Tools

All tools return JSON as MCP text content. Leonardo raw responses are included where useful so clients can inspect fields that are not normalized yet.

## generate_image

Creates a Leonardo image generation job and returns immediately.

Inputs:

- `prompt` required string
- `negative_prompt` optional string
- `model_id` optional string
- `width` optional integer
- `height` optional integer
- `num_images` optional integer 1-8
- `alchemy` optional boolean
- `preset_style` optional string
- `photo_real` optional boolean
- `prompt_magic` optional boolean
- `guidance_scale` optional number
- `seed` optional integer

Returns a compact `generation_id` plus raw Leonardo response.

## get_generation

Fetches a generation by ID and extracts status/image URLs from common Leonardo response shapes.

Inputs:

- `generation_id` required string

Returns:

- `generation_id`
- `status`
- `images`: array of `{ id?, url }`
- `raw`: unmodified Leonardo response

## wait_for_generation

Polls an existing generation until it completes, fails, or times out.

Inputs:

- `generation_id` required string
- `timeout_ms` optional positive integer, max 600000, default 180000
- `poll_interval_ms` optional positive integer, max 30000, default 5000

Returns the compact generation fields plus:

- `timed_out`: boolean
- `elapsed_ms`: number
- `raw`: most recent Leonardo response, when available

Completion detection treats known completed statuses as final and also treats a generation with image URLs as complete. Known failed/cancelled statuses also stop polling.

## generate_image_and_wait

Creates a Leonardo image generation job, polls it, and optionally downloads images.

Inputs: all `generate_image` inputs plus:

- `timeout_ms` optional positive integer, max 600000, default 180000
- `poll_interval_ms` optional positive integer, max 30000, default 5000
- `download` optional boolean, default false
- `output_dir` optional string, used only when `download=true`

Returns:

- `generation_id`
- `create_raw`: raw creation response
- compact generation fields from `wait_for_generation`
- `downloaded`: when requested, array of `{ id?, url, path, bytes }`

This is the preferred tool for agent/chat use because the user receives a complete result without manual polling.

## list_models

Lists Leonardo platform models.

Returns:

- `models`: compact array of `{ id, name? }` when the response shape is recognized
- `raw`: unmodified Leonardo response

## download_image

Downloads a single image URL to local disk. Useful for clients that can send native media files from paths.

Inputs:

- `url` required URL string
- `output_path` optional string

Returns:

- `path`: local file path
- `bytes`: downloaded byte count

## download_generation_images

Fetches a completed generation and downloads all generated image URLs.

Inputs:

- `generation_id` required string
- `output_dir` optional string, defaults to OS temp directory

Returns compact generation fields plus:

- `downloaded`: array of `{ id?, url, path, bytes }`
- `raw`: unmodified Leonardo response
