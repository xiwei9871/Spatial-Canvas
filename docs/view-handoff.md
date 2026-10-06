# View Handoff / Camera Bookmark (maintenance)

This closes the C-Type view-selection workflow gap within V0.5.1 maintenance. It adds no live bridge or V0.6 scope.

1. Load the matching manifest/GLB pair. Select objects and use **Hide selected**, **Ghost selected** (20% opacity), **Show all**, or **Isolate selection**. These affect the viewer only.
2. Find the composition and choose **Lock view**. Lock stops orbit/pan/zoom and keeps the camera aspect through viewport resizing.
3. Enter a view name, such as `entrance_steps_compare`, and choose **Save View**. The latest named bookmark is persisted locally for that exact design/source/revision/SHA. After reopening the matching proxy, **Restore saved view** restores camera and temporary visibility, then locks it.
4. **Export Camera Preset** exposes two explicit links: camera JSON and reference PNG. Download both. **Copy View Handoff** copies the exact numeric preset; screenshots serve visual confirmation.
5. **Import Camera Preset** restores a saved file only when design/source/revision/SHA and all override entity IDs match the loaded proxy.

Save creates a snapshot. Changing the view or overrides afterward requires Save again. Browser storage restrictions do not prevent file export/import. One latest bookmark is retained per exact source; exported files retain additional named views.

The `spatial-canvas.view-preset.v1` protocol records proxy camera position, XYZW quaternion, vertical FOV, clipping planes, orbit target, viewport ratio, source locator/revision/SHA, sidecar reference, hidden/ghost IDs and optional preview filename. It additionally records a Blender Z-up pose in meters. The world conversion is `[x,y,z] → [x,-z,y]`; rotation is **basis × camera rotation**, because both cameras retain their local `-Z` forward / `+Y` up axes. It is not quaternion conjugation. Only declared Z-up sources currently support the source-space export.

Apply with Blender, starting from the exact source snapshot:

```sh
blender --background --factory-startup --disable-autoexec SOURCE.blend \
  --python-exit-code 1 --python adapters/blender/apply_camera_preset.py -- \
  --preset entrance_steps_compare.view-preset.json \
  --output entrance-render-view.blend --report camera-result.json
```

`--output` is optional and must be a new separate derived .blend. `--render preview.png` optionally renders with EEVEE. `--report` is required. Input source, preset and bindings cannot be overwritten. The adapter checks source hash, sidecar hash, design/revision/frame/units and native identities before applying view state. Editable sources use persisted source metadata; frozen sources use the sidecar. Meter positions and clips convert to native units using source unit scale. Blender uses vertical sensor fit to preserve vertical FOV and the saved aspect ratio.

Ghost materials are copied and linked per object, preserving other linked mesh instances. Neither camera creation nor visibility changes save back into the source. For alternative designs, apply the preset to its pinned base first and make authorized variants in derived render scenes; never bypass provenance to attach it silently to an unrelated/new revision.

Validation: TS protocol and world-axis/projection tests; pure Python camera validation; real Blender scene-scale, stale-request, projection and linked-material tests; C-Type browser export, hidden-raycast, lock, refresh/restore, copy and fresh independent Blender reopen/projection checks. Generated evidence stays in ignored `task-output/view-handoff/`.
