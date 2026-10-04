from copy import deepcopy
from pathlib import Path
import sys
import unittest

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from bindings import validate_registry
from contracts import ProtocolError

def registry():
    return {"schema":"spatial-canvas.bindings.v1","registry_id":"bindings","registry_revision":"1",
      "design_id":"design","source_resource_id":"source","source_revision":"r4","source_sha256":"a"*64,
      "source_locator":"/source.blend","source_authority":"frozen",
      "source_frame":{"frame_id":"source_world","unit":"meter","up_axis":"Z","meters_per_unit":1},
      "bindings":[{"entity_id":"sofa","adapter":"blender","native_id":"Sofa","semantic_type":"sofa",
                   "room_id":"living","authority_level":"HUMAN_DESIGN_GUIDE"}]}

class Bindings(unittest.TestCase):
    def test_valid_registry(self):
        self.assertEqual(validate_registry(registry())["source_revision"],"r4")
        non_spatial=registry()
        del non_spatial["source_frame"]
        non_spatial["bindings"][0]["adapter"]="web"
        self.assertEqual(validate_registry(non_spatial)["bindings"][0]["adapter"],"web")

    def test_version_provenance_and_duplicates(self):
        for patch in [{"schema":"v2"},{"source_sha256":"short"},{"source_revision":""},{"bindings":[]},
                      {"bindings":registry()["bindings"]*2},{"source_authority":"editable"}]:
            with self.subTest(patch=patch),self.assertRaises(ProtocolError):
                validate_registry({**registry(),**patch})
        value=registry()
        value["bindings"].append({**value["bindings"][0],"entity_id":"another"})
        with self.assertRaises(ProtocolError):validate_registry(value)

    def test_frame_and_authority(self):
        value=registry()
        value["bindings"][0]["authority_level"]="DESIGN_GUIDE"
        with self.assertRaises(ProtocolError):validate_registry(value)
        value=registry()
        value["source_frame"]["meters_per_unit"]=0
        with self.assertRaises(ProtocolError):validate_registry(value)

if __name__=="__main__":unittest.main()
