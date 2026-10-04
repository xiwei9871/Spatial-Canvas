"""Create the small authoritative Blender scene used by V0.2 E2E validation."""

from __future__ import annotations

import argparse
from pathlib import Path
import sys

import bpy

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import ENTITY_KEYS, set_scene_metadata


def arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', required=True)
    parser.add_argument('--unit-scale', type=float, default=1.0, help='Meters per Blender unit')
    return parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])


def add_box(name: str, location: tuple[float, float, float], scale: tuple[float, float, float], global_id: str,
            semantic_type: str, mutable: bool) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    obj[ENTITY_KEYS['global_id']] = global_id
    obj[ENTITY_KEYS['semantic_type']] = semantic_type
    obj[ENTITY_KEYS['room_id']] = 'living'
    obj[ENTITY_KEYS['authority_level']] = 'HUMAN_DESIGN_GUIDE'
    obj[ENTITY_KEYS['mutable']] = mutable
    return obj


def main() -> None:
    args = arguments()
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    scene = bpy.context.scene
    set_scene_metadata(scene, design_id='design_blender_living', source_resource_id='src_blender_living', source_revision='rev-00001', coordinate_frame='blender_world_z_up', source_unit_scale=args.unit_scale)
    add_box('Sofa_Main', (-1.5, 0.0, 0.45), (0.9, 0.4, 0.4), 'ent_sofa_001', 'sofa', True)
    add_box('Coffee_Table', (0.0, 0.4, 0.3), (0.45, 0.3, 0.35), 'ent_table_001', 'table', True)
    add_box('Wall_Back', (0.0, 1.5, 0.85), (2.4, 0.075, 0.85), 'ent_wall_001', 'wall', False)
    # This parent case verifies that a semantic object can have multiple geometry descendants.
    bpy.ops.object.empty_add(type='PLAIN_AXES', location=(1.35, 0.0, 0.0))
    group = bpy.context.object
    group.name = 'Chair_Group'
    group[ENTITY_KEYS['global_id']] = 'ent_chair_group'
    group[ENTITY_KEYS['semantic_type']] = 'chair'
    group[ENTITY_KEYS['room_id']] = 'living'
    group[ENTITY_KEYS['authority_level']] = 'HUMAN_DESIGN_GUIDE'
    group[ENTITY_KEYS['mutable']] = True
    group.rotation_euler.z = .3
    for name, location, scale, gid in [('Chair_Seat', (1.35, 0, .5), (.375, .5, .125), 'ent_chair_seat_001'),
                                     ('Chair_Back', (1.35, .4, 1), (.375, .1, .5), 'ent_chair_back_001')]:
        obj = add_box(name, location, scale, gid, 'chair_part', True)
        bpy.context.view_layer.update()
        world = obj.matrix_world.copy()
        obj.parent = group
        obj.matrix_world = world
    bpy.context.view_layer.update()
    Path(args.output).parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=args.output)
    print('Created authoritative fixture:', args.output)


if __name__ == '__main__':
    main()
