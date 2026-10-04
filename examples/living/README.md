# Original synthetic fixture

living.source.json is the authoritative source of this demonstration only. Four original cubes represent sofa/table/chair/immutable wall. No third-party assets, textures or external geometry are included. This is deliberately schematic.

`npm run fixture` creates full/task GLBs, manifests, preview and task report. Two shared entities preserve design/global/native IDs across scopes. GLBs are approximately 3.5 KB and 2.4 KB and reuse embedded cube geometry with simple PBR materials and semantic extras. Manifests hash exact source JSON bytes. IDs persist on source changes; intentionally publishing a new source revision should also update source_revision.

These tiny generated fixtures are explicitly allowlisted in Git; working task artifacts are ignored. The preview is a deterministic top-down footprint image generated from the same source. Load the actual GLB to inspect workspace behavior.
