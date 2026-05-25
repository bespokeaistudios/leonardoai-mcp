# Changelog

## [0.3.0] — 2026-05-25

### Added
- v2 API support: `list_models` now merges v1 and v2 platform models with `source` field and `v2_model_id` (kebab-case identifier for use in generation requests)
- v2 REST generation: `generate_image` and `generate_image_and_wait` auto-detect v2 models (non-UUID format) and route to the v2 REST endpoint `POST /api/rest/v2/generations`
- New `LeonardoClient` methods: `listV2Models()`, `createV2Generation()`, and `v2Request()` helper

### Fixed
- v2 generation payload corrected from GraphQL to REST format (`{ model, parameters, public }` instead of `{ query, variables }`)
- Model routing: non-UUID model IDs → v2 REST, UUID model IDs → v1 REST
- Response parsing updated for v2 REST creation response shape (`generate.generationId`)

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
