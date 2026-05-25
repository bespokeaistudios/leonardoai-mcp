## Fix: v2 model routing by lookup, not UUID format

The `isV2ModelId` function checks `!UUID_RE.test(modelId)` which means UUID → v1, non-UUID → v2. But v2 models ALL have UUIDs too. Nano Banana 2 = `7418e71f-...` → UUID → routed to v1 → 400 error.

### Fix approach:
1. Remove the UUID regex check entirely
2. In `createToolHandlers`, add a private `v2ModelIds` Set that gets populated lazily
3. Before generating, call `client.listV2Models()` once (or check cached set), match the model_id against known v2 models
4. If the model_id is in the v2 list, route to v2; otherwise route to v1
5. Cache the set so we only call listV2Models once per handler instance

### Files to modify:
- `src/tools.ts`: Replace `isV2ModelId` with lookup-based routing

### Implementation:
```typescript
// In createToolHandlers, before the return:
let v2ModelIds: Set<string> | null = null;

async function ensureV2ModelIds(client: LeonardoClient): Promise<Set<string>> {
  if (v2ModelIds) return v2ModelIds;
  try {
    const raw = await client.listV2Models();
    const models = (raw.productionApiAvailableModels ?? []) as Array<JsonObject>;
    v2ModelIds = new Set(models.map(m => String(m.id)).filter(Boolean));
  } catch {
    v2ModelIds = new Set(); // empty set on failure
  }
  return v2ModelIds;
}

// Replace isV2ModelId with:
async function isV2Model(modelId: string, client: LeonardoClient): Promise<boolean> {
  const ids = await ensureV2ModelIds(client);
  return ids.has(modelId);
}
```

Then update the generate_image and generate_image_and_wait handlers to call `await isV2Model(args.model_id, client)` instead of `isV2ModelId(args.model_id)`.

Also update the `toV2Payload` — the v2 API expects `model` not `model_id`/`modelId`, and `parameters` wrapper.
