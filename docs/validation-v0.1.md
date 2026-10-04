# V0.1 validation record

Validated on 2026-10-04 using Node 24.14.1, npm 11.11.0 and the local Codex browser.

- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm test`: 34 tests passed in 6 files.
- `npm run build`: passed; initial bundle approximately 732 KB, 191 KB gzip. Vite reports the bundle-size advisory and Rollup reports comments in Zod dependencies. Both are non-blocking build warnings.
- `npm run schemas` and `npm run fixture`: regeneration produces no diff in staged generated outputs.
- Git ignore rules ignore working task artifacts and retain the tiny committed example GLBs.

Manual browser acceptance completed:

1. Start with `npm run dev` and load full example.
2. Click sofa geometry in the viewport: inspector resolves ent_sofa_001, LIVING_SOFA and semantic/source metadata; selection source is pointer.
3. Modifier-select table: resulting-state JSON contains both stable IDs and mode add; both have visible bounds highlights.
4. Generate transform request: exact JSON contains both stable/native ID pairs, source revision/hash, request_only authority and world-frame meter translation. Inspector matrices/bounds remain unchanged.
5. Load task example and reload it: overlapping IDs remain selected and events use the new proxy resource ID with source reload.
6. Import local full manifest/GLB via paired file chooser: same validated identity/selection behavior.
7. Import manifest without its GLB: explicit error; current valid resource, scene, selection and event remain intact.
8. Clear selection: empty entity_ids with clear mode.
9. Select immutable wall: transform request button disabled.

Browser checks are manual evidence, not an automated UI test suite. No Blender live bridge or actual source mutation was tested because both are outside V0.1.
