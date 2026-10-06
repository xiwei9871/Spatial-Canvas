"""Real Blender camera-preset gates, including linked materials and scene scale."""
import json,sys,tempfile,unittest,hashlib,math
from pathlib import Path
import bpy
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from apply_camera_preset import apply_camera_preset
from contracts import ProtocolError
from common import set_scene_metadata
class CameraBlenderTests(unittest.TestCase):
 def test_pose_projection_scale_shared_ghost_and_stale_rejection(self):
  with tempfile.TemporaryDirectory() as folder:
   bpy.ops.wm.read_factory_settings(use_empty=True)
   set_scene_metadata(bpy.context.scene,design_id='d',source_resource_id='r',source_revision='rev-00001',coordinate_frame='source',source_unit_scale=.01)
   bpy.ops.mesh.primitive_cube_add();a=bpy.context.object;a.name='Ghost';a['spatial_canvas_global_id']='ghost'
   m=bpy.data.materials.new('Shared');m.diffuse_color=(1,1,1,1);a.data.materials.append(m)
   b=a.copy();b.data=a.data;b.name='Untouched';b['spatial_canvas_global_id']='other';bpy.context.scene.collection.objects.link(b)
   source=Path(folder)/'source.blend';bpy.ops.wm.save_as_mainfile(filepath=str(source));raw=source.read_bytes();mtime=source.stat().st_mtime_ns
   p={'schema':'spatial-canvas.view-preset.v1','preset_id':'v','design_id':'d','source_resource_id':'r','source_revision':'rev-00001','source_sha256':hashlib.sha256(raw).hexdigest(),'projection':'perspective','fov_degrees':45,'position':[1,2,3],'quaternion':[0,0,0,1],'orbit_target':[1,2,0],'viewport':{'width':800,'height':600,'pixel_ratio':1},'frame_id':'proxy','unit':'meter','up_axis':'Y','source_camera':{'position':[1,-3,2],'quaternion':[math.sqrt(.5),0,0,math.sqrt(.5)],'frame_id':'source','unit':'meter','up_axis':'Z'},'hidden_entity_ids':[],'ghost_entity_ids':['ghost']}
   apply_camera_preset(p,source);scene=bpy.context.scene;c=scene.camera
   self.assertLess((c.location-Vector([100,-300,200])).length,1e-5)
   self.assertAlmostEqual(c.data.angle_y,math.radians(45),places=5)
   q=c.rotation_quaternion;world=c.location+q@Vector((0,0,-500));projected=world_to_camera_view(scene,c,world)
   self.assertAlmostEqual(projected.x,.5,places=5);self.assertAlmostEqual(projected.y,.5,places=5)
   self.assertAlmostEqual(bpy.data.objects['Ghost'].material_slots[0].material.diffuse_color[3],.2,places=5)
   self.assertAlmostEqual(bpy.data.objects['Untouched'].material_slots[0].material.diffuse_color[3],1,places=5)
   with self.assertRaises(ProtocolError):apply_camera_preset({**p,'source_revision':'old'},source)
   with self.assertRaises(ProtocolError):apply_camera_preset({**p,'source_sha256':'a'*64},source)
   self.assertEqual(source.read_bytes(),raw);self.assertEqual(source.stat().st_mtime_ns,mtime)
if __name__=='__main__':
 if not unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromTestCase(CameraBlenderTests)).wasSuccessful():raise SystemExit(1)
