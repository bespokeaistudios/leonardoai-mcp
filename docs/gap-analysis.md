# Public MCP readiness gap analysis

This document records the practical gaps found while turning the Leonardo MCP server into a reusable public integration after an agent returned a prompt/placeholder instead of using the configured Leonardo MCP image tools.

## Public MCP requirements used for this review

A public-ready image-generation MCP should cover the whole path from installation to agent delivery:

1. **Installability** — clear Node version, deterministic install, package metadata, publishable `files`, and no committed secrets.
2. **MCP protocol correctness** — stdio server starts cleanly, initializes through JSON-RPC, and exposes the expected tool list.
3. **Agent ergonomics** — one-call image generation is available so agents do not skip polling or downloads.
4. **Provider functionality** — generation creation, status lookup, model discovery, completion polling, and local downloads for chat gateways.
5. **Normalized results** — compact IDs/status/image URLs for agents, while retaining raw provider payloads for debugging.
6. **Security hygiene** — secrets come from environment variables, Authorization is not leaked in errors, and generated files are ignored.
7. **Tests/CI** — unit tests, typechecking, build, and MCP smoke discovery can run on every PR.
8. **Integration docs** — Hermes and other MCP-client examples explain env vars, absolute paths, timeouts, and agent usage guidance.

## Baseline found

- Stdio MCP server existed and loaded in Hermes.
- Core Leonardo REST client existed for generation creation, generation lookup, and model listing.
- Download helper existed for a single generated image URL.
- Unit tests covered config, basic client auth/error behavior, and minimal tool normalization.
- Docs included initial Hermes setup and security notes.

## Gaps and fixes

### End-to-end image generation flow

- Gap: Agents had to manually call `generate_image`, poll `get_generation`, then optionally call `download_image`. This is easy for an agent to skip, leading to prompt-only answers instead of actual Leonardo output.
- Fix: Added `generate_image_and_wait` for create + poll + optional download.
- Fix: Added `wait_for_generation` for explicit polling of existing jobs.

### Native media delivery

- Gap: Only single-URL download was supported. A normal Leonardo generation can produce multiple images.
- Fix: Added `download_generation_images` to fetch a generation and download all generated image URLs.

### Public-agent ergonomics

- Gap: Docs did not tell agents when to use the Leonardo MCP instead of a generic image tool or a text-only answer.
- Fix: Added Hermes-prefixed tool guidance and a default agent workflow to `README.md`.

### Tool documentation

- Gap: `docs/tools.md` only documented four tools and omitted return shapes/defaults.
- Fix: Expanded tool docs with every current tool, input defaults, and output fields.

### Compact result shape

- Gap: Model listing returned only raw API output.
- Fix: `list_models` now also returns a compact `{ id, name? }` list when the response shape is recognized, while preserving `raw`.
- Fix: Added a unit test for compact model extraction.

### Packaging and public distribution

- Gap: `package.json` publish files omitted `docs/` and `examples/`, which are important for public MCP consumers.
- Fix: Included `docs`, `examples`, and the smoke script in package `files`.
- Gap: There was no explicit public publish setting.
- Fix: Added `publishConfig.access=public` and broadened package keywords.

### CI and protocol smoke testing

- Gap: Tests validated handlers but did not prove that the built stdio MCP server initializes and advertises the expected tools.
- Fix: Added `scripts/smoke-mcp.mjs`, which starts `dist/index.js`, performs MCP `initialize`, sends `notifications/initialized`, calls `tools/list`, and checks all expected tools are registered.
- Gap: No GitHub Actions workflow existed for public contributors.
- Fix: Added `.github/workflows/ci.yml` to run install, tests, typecheck, build, and MCP smoke discovery.

### Tests

- Gap: No tests covered polling, end-to-end generation, multi-image downloads, or model compaction.
- Fix: Added tests for `wait_for_generation`, `generate_image_and_wait`, `download_generation_images`, and compact `list_models` output.

## Remaining optional enhancements

These are not blockers for public use, but would be useful future work:

- Add image-to-image / init-image upload support once the exact Leonardo signed-upload flow is verified against the live API.
- Add upscale, variation, and prompt-enhancement tools if the account/API plan exposes stable endpoints.
- Add repository, homepage, and bugs metadata once the public GitHub URL is final.
- Add release automation after the package name and publication target are confirmed.

## Security fixes applied (2026-05-23)

- **Dependencies pinned** — replaced `"latest"` with `^1.29.0` etc. from installed versions.
- **Error response body redacted** — `LeonardoApiError` now logs full body to stderr only; the `.message` property contains only status + statusText, never raw Leonardo response data.
- **Path traversal blocked** — `downloadUrl` and `downloadImages` validate `outputPath` / `outputDir` with `resolveSafe()`, rejecting paths outside `tmpdir()`.
- **Content-type validation** — downloads reject responses without an `image/*` Content-Type.
- **File size limit** — downloads cap at 50 MB (`MAX_DOWNLOAD_BYTES`).
- **Smoke test key isolation** — smoke test always uses a dummy key, never the user's real `LEONARDO_AI_API`.
