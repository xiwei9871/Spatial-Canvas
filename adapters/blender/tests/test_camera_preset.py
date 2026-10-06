import sys, unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from camera_preset import validate_camera_preset
from contracts import ProtocolError

def preset():
 return {'schema':'spatial-canvas.view-preset.v1','preset_id':'entrance','design_id':'d','source_resource_id':'r','source_revision':'rev','source_sha256':'a'*64,
  'projection':'perspective','fov_degrees':45,'position':[1,2,3],'quaternion':[0,0,0,1],'orbit_target':[2,3,4],
  'viewport':{'width':873,'height':664,'pixel_ratio':1},'frame_id':'proxy','unit':'meter','up_axis':'Y',
  'source_camera':{'position':[1,-3,2],'quaternion':[2**-.5,0,0,2**-.5],'frame_id':'source','unit':'meter','up_axis':'Z'},
  'hidden_entity_ids':['wall'],'ghost_entity_ids':['ceiling']}
class CameraPresetTests(unittest.TestCase):
 def test_valid_and_reject_inconsistent_source_pose(self):
  self.assertEqual(validate_camera_preset(preset())['preset_id'],'entrance')
  p=preset();p['source_camera']['position']=[1,3,2]
  with self.assertRaises(ProtocolError):validate_camera_preset(p)
 def test_reject_invalid_rotation_fov_and_override_overlap(self):
  for change in [{'fov_degrees':180},{'quaternion':[0,0,0,0]},{'hidden_entity_ids':['wall','wall']},{'ghost_entity_ids':['wall']}]:
   with self.subTest(change=change),self.assertRaises(ProtocolError):validate_camera_preset({**preset(),**change})
if __name__=='__main__':unittest.main()
