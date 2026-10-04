# Proxy display colors

Colors help human selection and do not make the proxy authoritative. Frozen sources are read-only.

Blender producer color modes:

- source-flat (default): preserve directly readable source Base Color or material display RGB using temporary opaque, rough, nonmetallic materials. Keep source face material regions. Do not copy textures, shader graphs, transparency or reflection settings. Missing colors use a stable presentation palette.
- zoning-flat: display floors gray, furniture beige and architecture/walls white. Hints come from existing semantic labels, native names and collections for presentation only. This does not classify authoritative entities or change their sidecar/native IDs.
- none: the earlier monochrome proxy.

All modes preserve geometry, transforms, stable identity and source SHA. Flat-color materials are deduplicated by RGB and removed with temporary scene data after export. Generated glTF contains simple PBR colors only, no image, texture or extension dependencies.

CLI: add --color-mode zoning-flat to the normal export command. The Workspace uses restrained preview lighting and ACES tone mapping to reduce white clipping. Original .blend and earlier proxy artifacts remain unchanged.

R4 usability validation on 2026-10-04: the open-ceiling zoning proxy retains 978 entities and exactly three flat colors. Presentation hints assigned 6 floor slots, 390 furniture slots and 582 wall/default-architecture slots. Source bytes and mtime were identical before/after export, source SHA remained d109c7efcfa2b2b2565e4c073ee0cdf5282b23c01122bc9c1bbe7b8791ac3afb, and the browser loaded the file successfully.

17 bpy tests pass, including source color/face-region preservation, no textures/extensions, temporary data cleanup and presentation-only zoning. Existing lint/typecheck/Vitest/build pass. Real screenshots/proxies/manifests remain in ignored task-output/v03-c-type/open-ceiling-zoning/.
