# Leonardo MCP v2 — Tier 1 Upgrade: Motion, Init Images, Reference Images

> **For Hermes:** Orchestrate via `claude -p` print mode (DeepSeek backend) task by task.

**Goal:** Add motion/video generation, init image management, and image-to-image reference support to the MCP server.

**Architecture:** Extend the existing `tools.ts` schemas/handlers, add new API methods to `leonardo-client.ts`, register new tools in `server.ts`. Follow TDD — write tests first, then implement.

**Tech Stack:** TypeScript, MCP SDK, Zod, Vitest

---

### Prerequisites: Verify Environment

```bash
cd /home/kyle/leonardo-mcp
npm test          # All 42 tests must pass before starting
npm run build     # Clean build
npm run typecheck # No type errors
```

---

### Task 1: Add Motion Generation Client Method

**Objective:** Add `createMotionGeneration()` to LeonardoClient for `POST /generations-motion-svd`

**Files:**
- Modify: `src/leonardo-client.ts` (add method after `createInitImage`)

**Step 1: Write failing test**

In `tests/leonardo-client.test.ts`, add a test that calls `client.createMotionGeneration()` and expects it to hit the right endpoint. Mock fetch to verify URL and method.

```typescript
// tests/leonardo-client.test.ts — new test
it('POSTs motion generation to /generations-motion-svd', async () => {
  const mockFetch = vi.fn().mockResolvedValue(okJson({ sdGenerationJob: { generationId: 'motion-123' } }));
  const client = new LeonardoClient({ apiKey: 'test-key', fetch: mockFetch as unknown as typeof fetch });
  const result = await client.createMotionGeneration({ imageId: 'img-1', motionStrength: 5 });
  expect(mockFetch).toHaveBeenCalledWith(
    'https://cloud.leonardo.ai/api/rest/v1/generations-motion-svd',
    expect.objectContaining({ method: 'POST' })
  );
  expect(result.sdGenerationJob.generationId).toBe('motion-123');
});
```

**Step 2: Run test to verify failure**

```bash
npx vitest run tests/leonardo-client.test.ts -t 'motion'
# Expected: FAIL — "createMotionGeneration is not a function"
```

**Step 3: Implement**

```typescript
// src/leonardo-client.ts — add after createInitImage():
async createMotionGeneration(payload: JsonObject): Promise<JsonObject> {
  return this.request('/generations-motion-svd', { method: 'POST', body: payload });
}
```

**Step 4: Run test to verify pass**

```bash
npx vitest run tests/leonardo-client.test.ts -t 'motion'
# Expected: PASS
```

**Step 5: Build check**

```bash
npm run build && npm run typecheck
```

---

### Task 2: Add Motion Generation MCP Tool

**Objective:** Register `motion_generation` tool with Zod schema

**Files:**
- Modify: `src/tools.ts` (add schema, type, handler)
- Modify: `src/server.ts` (register tool)
- Create/Modify: `tests/tools.test.ts` (add test)

**Step 1: Add Zod schema and type**

```typescript
// src/tools.ts — after downloadGenerationImagesSchema
export const motionGenerationSchema = {
  image_id: z.string().min(1).describe('The ID of the image to animate. Supports generated images, variation images, and init images.'),
  motion_strength: z.number().int().min(0).max(10).optional().describe('Motion intensity. 0-10. Default: 5.'),
  is_public: z.boolean().optional().describe('Whether the generated video should be public.'),
  is_init_image: z.boolean().optional().describe('Whether the source image is an init image.'),
  is_variation: z.boolean().optional().describe('Whether the source image is a variation.'),
};

export type MotionGenerationArgs = z.infer<z.ZodObject<typeof motionGenerationSchema>>;
```

**Step 2: Add handler**

```typescript
// src/tools.ts — in createToolHandlers return object, add:
async motion_generation(args: MotionGenerationArgs) {
  const payload: JsonObject = { imageId: args.image_id };
  if (args.motion_strength !== undefined) payload.motionStrength = args.motion_strength;
  if (args.is_public !== undefined) payload.isPublic = args.is_public;
  if (args.is_init_image !== undefined) payload.isInitImage = args.is_init_image;
  if (args.is_variation !== undefined) payload.isVariation = args.is_variation;
  const raw = await client.createMotionGeneration(payload);
  return { generation_id: compactGenerationId(raw), raw };
},
```

**Step 3: Register in server.ts**

```typescript
// src/server.ts — after generate_image_and_wait registration
server.registerTool(
  'motion_generation',
  {
    title: 'Generate motion video',
    description: 'Create a motion/video generation from an existing image. Returns a generation_id that can be polled with get_generation or wait_for_generation.',
    inputSchema: motionGenerationSchema,
  },
  async (args) => jsonText(await handlers.motion_generation(args)),
);
```

Also add the import: `motionGenerationSchema,` and `MotionGenerationArgs` to the imports.

**Step 4: Add test**

```typescript
// tests/tools.test.ts — add test
it('motion_generation sends correct payload', async () => {
  const mockClient = createMockClient({
    createMotionGeneration: vi.fn().mockResolvedValue({ sdGenerationJob: { generationId: 'm-1' } }),
  });
  const handlers = createToolHandlers(mockClient as unknown as LeonardoClient);
  const result = await handlers.motion_generation({ image_id: 'img-1', motion_strength: 7 });
  expect(mockClient.createMotionGeneration).toHaveBeenCalledWith({
    imageId: 'img-1',
    motionStrength: 7,
  });
  expect(result.generation_id).toBe('m-1');
});
```

**Step 5: Run tests, build, typecheck**

```bash
npx vitest run && npm run build && npm run typecheck
```

---

### Task 3: Expose Init Image Upload as MCP Tool

**Objective:** The `createInitImage` method already exists in the client but is NOT registered as a tool. Add the MCP tool wrapper.

**Files:**
- Modify: `src/tools.ts` (add schema, type, handler)
- Modify: `src/server.ts` (register tool)
- Modify: `tests/tools.test.ts` (add test)

**Step 1: Add schema**

```typescript
// src/tools.ts — after motionGenerationSchema
export const uploadInitImageSchema = {
  extension: z.string().min(1).describe('File extension of the init image (e.g., "png", "jpg").'),
};
export type UploadInitImageArgs = z.infer<z.ZodObject<typeof uploadInitImageSchema>>;
```

**Step 2: Add handler**

```typescript
// src/tools.ts — in createToolHandlers return:
async upload_init_image(args: UploadInitImageArgs) {
  const raw = await client.createInitImage({ extension: args.extension });
  const uploadInitImage = (raw.uploadInitImage ?? raw) as JsonObject;
  return {
    init_image_id: uploadInitImage.id ?? uploadInitImage.initImageId,
    upload_url: uploadInitImage.url ?? uploadInitImage.uploadUrl,
    fields: uploadInitImage.fields,
    raw,
  };
},
```

**Step 3: Register in server.ts**

```typescript
server.registerTool(
  'upload_init_image',
  {
    title: 'Upload init image',
    description: 'Get a presigned S3 URL to upload an init image. Returns upload URL and fields. The returned init_image_id can be used as init_image_id in generate_image for image-to-image generation.',
    inputSchema: uploadInitImageSchema,
  },
  async (args) => jsonText(await handlers.upload_init_image(args)),
);
```

Add imports for `uploadInitImageSchema` and `UploadInitImageArgs`.

**Step 4: Run tests, build**

```bash
npx vitest run && npm run build && npm run typecheck
```

---

### Task 4: Add Init Image Status Tool

**Objective:** Add `GET /init-image/{id}` to check upload status

**Files:**
- Modify: `src/leonardo-client.ts` (add `getInitImage` method)
- Modify: `src/tools.ts` (schema, handler)
- Modify: `src/server.ts` (register tool)

**Step 1: Add client method**

```typescript
// src/leonardo-client.ts — after createInitImage():
async getInitImage(initImageId: string): Promise<JsonObject> {
  return this.request(`/init-image/${encodeURIComponent(initImageId)}`, { method: 'GET' });
}
```

**Step 2: Add tool schema, handler, and registration** (same pattern as Task 2/3 — schema with `init_image_id: z.string().min(1)`, handler that calls `client.getInitImage()`, server registration as `get_init_image`)

**Step 3: Tests**

```bash
npx vitest run && npm run build && npm run typecheck
```

---

### Task 5: Add Reference Image Params to generate_image

**Objective:** Extend the existing `generateImageSchema` with init_image_id, init_generation_image_id, init_strength, and imagePrompts params for image-to-image generation.

**Files:**
- Modify: `src/tools.ts` (extend generateImageSchema, update toLeonardoPayload)

**Step 1: Add params to schema**

```typescript
// src/tools.ts — add to generateImageSchema:
init_image_id: z.string().optional().describe('The ID of an init image to use as a reference for image-to-image generation.'),
init_generation_image_id: z.string().optional().describe('The ID of a previously generated image to use as reference.'),
init_strength: z.number().min(0).max(1).optional().describe('How strongly the generation should reflect the reference image. 0 = ignore reference, 1 = fully follow reference. Default varies by model.'),
image_prompts: z.array(z.string()).max(5).optional().describe('Array of init image IDs to use as image prompts (up to 5).'),
image_prompt_weight: z.number().min(0).max(1).optional().describe('Global weight for image prompts (0-1).'),
```

**Step 2: Update toLeonardoPayload mapping**

Add to the mapping array:
```typescript
['init_image_id', 'initImageId'],
['init_generation_image_id', 'initGenerationImageId'],
['init_strength', 'initStrength'],
['image_prompts', 'imagePrompts'],
['image_prompt_weight', 'imagePromptWeight'],
```

**Step 3: Tests — verify the mapping**

Add test in tools.test.ts that verifies `toLeonardoPayload` maps the new params correctly.

**Step 4: Run tests, build**

```bash
npx vitest run && npm run build && npm run typecheck
```

---

### Task 6: Bump Version & Final Verification

**Objective:** Update package.json version, run full test suite, smoke test

**Files:**
- Modify: `package.json` (version → 0.2.0)
- Modify: `src/server.ts` (version → 0.2.0)

```bash
# Full verification
npm test
npm run build
npm run typecheck
npm pack --dry-run
```

---

### Execution Order

1. Task 1 → Client method for motion
2. Task 2 → MCP tool for motion  
3. Task 3 → Init image upload tool
4. Task 4 → Init image status tool
5. Task 5 → Reference image params
6. Task 6 → Bump version & verify
