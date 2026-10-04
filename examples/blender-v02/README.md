# Blender V0.2 E2E fixture

This directory is a recipe location. npm run blender:e2e creates a temporary authoritative .blend, exports full/task proxies, creates a revision-bound intent, applies it through Blender 5.2.1, rejects stale/immutable requests, and removes temporary files. Generated .blend, .glb, manifest, request and result files are ignored.

The generator creates three room objects plus a parent/group case. IDs live on Blender custom properties and are never generated during ordinary export. Use --initialize-ids --editable-source only as an explicit authoring operation on a saved source.
