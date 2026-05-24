## Task: Add motion generation MCP tool + init image upload + init image status + reference image params

This is a batch task — do ALL of these in order, verifying at each step.

### Part A: Motion Generation Tool (tools.ts + server.ts + tests)

1. Read src/tools.ts thoroughly — understand the pattern for schemas, types, the createToolHandlers function, and the compactGenerationId / toLeonardoPayload helpers.
2. Read src/server.ts — understand how tools are registered.
3. Read tests/tools.test.ts — understand the mock pattern used.

4. In src/tools.ts:
   - Add motionGenerationSchema Zod schema (after downloadGenerationImagesSchema)
   - Fields: image_id (string, required), motion_strength (int 0-10, optional), is_public (bool, optional), is_init_image (bool, optional), is_variation (bool, optional)
   - Export MotionGenerationArgs type
   - Add motion_generation handler in createToolHandlers that maps snake_case args to camelCase API payload (imageId, motionStrength, isPublic, isInitImage, isVariation), calls client.createMotionGeneration(payload), returns {generation_id: compactGenerationId(raw), raw}

5. In src/server.ts:
   - Import motionGenerationSchema from ./tools.js
   - Register tool named "motion_generation" with title "Generate motion video" and description "Create a motion/video generation from an existing image. Returns a generation_id pollable via get_generation."

6. In tests/tools.test.ts, add a test using createMockClient with createMotionGeneration mock, verify correct payload mapping.

### Part B: Init Image Upload (expose existing client method as tool)

7. In src/tools.ts, add uploadInitImageSchema (extension: string required) and UploadInitImageArgs type.
   - Add upload_init_image handler that calls client.createInitImage({extension: args.extension}), extracts id/url/fields from response, returns {init_image_id, url, fields, raw}

8. Register in server.ts as "upload_init_image" with description about getting presigned S3 upload URL for init images.

### Part C: Init Image Status

9. In src/leonardo-client.ts, add getInitImage(initImageId: string) method after createInitImage() that calls GET /init-image/{id}.

10. In src/tools.ts, add get_init_image schema (init_image_id: string required) and handler that calls client.getInitImage(args.init_image_id).

11. Register in server.ts.

### Part D: Reference Image Params in generate_image

12. In src/tools.ts generateImageSchema, add optional fields: init_image_id, init_generation_image_id, init_strength (0-1), image_prompts (string array, max 5), image_prompt_weight (0-1).

13. In toLeonardoPayload mapping array, add entries for these new params mapping to camelCase API names (initImageId, initGenerationImageId, initStrength, imagePrompts, imagePromptWeight).

### Verification

14. Run: npx vitest run — all tests must pass
15. Run: npm run build && npm run typecheck — no errors
16. If anything fails, fix it before reporting completion.

IMPORTANT: Add tests for ALL new handlers in tests/tools.test.ts following the existing mock pattern. Each test verifies the handler calls the correct client method with the right payload.