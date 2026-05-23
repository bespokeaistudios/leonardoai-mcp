# Contributing

Thanks for contributing to `leonardoai-mcp`!

## Development Setup

```bash
git clone https://github.com/bespokeaistudios/leonardoai-mcp.git
cd leonardoai-mcp
npm install
npm run build
```

**Requirements:** Node.js 20+, a Leonardo AI API key (for manual testing only — unit tests use mocked clients).

## Scripts

| Command | Purpose |
|---------|---------|
| `npm test` | Run unit tests (vitest) |
| `npm run test:watch` | Watch mode for TDD |
| `npm run typecheck` | TypeScript check without emit |
| `npm run build` | Compile TypeScript → `dist/` |
| `npm run dev` | Run directly via tsx (no build step) |

## Project Structure

```
src/
├── index.ts          # Entry point — starts stdio MCP server
├── server.ts         # McpServer setup + tool registration
├── tools.ts          # Tool schemas (Zod) + handler implementations
├── leonardo-client.ts # Leonardo REST API client
└── config.ts         # Environment variable parsing

tests/                # Vitest unit tests
docs/                 # Tool docs + integration guides
examples/             # MCP client configs (Hermes, Claude Desktop)
scripts/              # Smoke test for MCP protocol compliance
```

## Pull Request Workflow

1. Fork the repo and create a branch from `main`.
2. Make changes, adding or updating tests as needed.
3. Run `npm test` and `npm run typecheck` — both must pass.
4. Run `npm run build` to ensure the project compiles.
5. Open a PR with a clear description of the change and why.

### Test Conventions

- Unit tests go in `tests/` with matching filenames (`src/foo.ts` → `tests/foo.test.ts`).
- Mock the Leonardo client rather than hitting the real API.
- Use temporary directories for file-download tests; clean up in `finally` blocks.
- If adding a new tool, include `inputSchema` validation tests and a handler test.

## Code Style

- TypeScript strict mode.
- Zod schemas for all tool inputs.
- No `any` without a comment explaining why.
- Prefer `async/await` over raw promises.
