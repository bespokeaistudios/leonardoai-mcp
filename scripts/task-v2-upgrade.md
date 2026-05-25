## Task: v2 API + GraphQL upgrade for leonardoai-mcp

The v2 API at `https://cloud.leonardo.ai/api/rest/v2` uses GraphQL for generations, and REST for model listing. We need to:

### Part A: Add v2 model listing
1. Read `src/leonardo-client.ts` — add a `listV2Models()` method that calls `GET /models` on v2 base URL
2. Read `src/tools.ts` — update `list_models()` handler to merge v1 and v2 models
3. Read `src/server.ts` — no change needed, `list_models` handler handles this
4. The v2 response shape is `{ productionApiAvailableModels: [...] }` with fields: `id`, `name`, `modelType`, `description`
5. Merge both lists, deduplicate by id, return unified compact list with `source` field ("v1" or "v2")

### Part B: Add v2 GraphQL generation support
6. Add a `createV2Generation()` method to `LeonardoClient` that sends a GraphQL mutation to v2 `/generations`
7. The GraphQL mutation format:
```graphql
mutation generate($model: String!, $parameters: GenerateParameters!) {
  generate(model: $model, parameters: $parameters) {
    id
    status
    images { id url }
  }
}
```
8. Parameters likely include: `prompt`, `width`, `height`, `negative_prompt`, `num_images`, `seed`, `guidance_scale`
9. The v2 client should auto-detect v2 model IDs (they differ in format from v1 UUIDs) and route accordingly

### Part C: Update generate_image for v2 routing
10. In `src/tools.ts`, before calling `client.createGeneration()`, check if the model_id is a v2 model (from the merged model list)
11. If v2, call `client.createV2Generation()` with GraphQL payload instead
12. Update `toLeonardoPayload` or create a v2 variant that uses the correct field names
13. The v2 generation response shape differs from v1 — need to normalize it so `compactGenerationId` and `compactGeneration` work

### Part D: Tests + verification
14. Add tests for v2 model listing (mock v2 endpoint)
15. Add tests for v2 generation (mock GraphQL response)
16. Verify: `npm test`, `npm run build`, `npm run typecheck`
17. Live test: generate image with a v2 model (Nano Banana 2)

### Part E: Docs
18. Update `docs/tools.md` to note that `list_models` returns both v1 and v2 models
19. Update `CHANGELOG.md` with v0.3.0 entry
20. Bump version to 0.3.0 in package.json and server.ts

IMPORTANT: Follow existing patterns. Use the same fetch abstraction. Handle errors with LeonardoApiError. Keep the compact/raw response pattern. Add tests following the existing mock pattern in the test files.