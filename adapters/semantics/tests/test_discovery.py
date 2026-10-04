import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
import zipfile

spec=importlib.util.spec_from_file_location('discovery',Path(__file__).parents[1]/'discover.py')
discovery=importlib.util.module_from_spec(spec)
spec.loader.exec_module(discovery)

class DiscoveryTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        self.root=Path(self.temp.name)
    def tearDown(self):
        self.temp.cleanup()
    def test_geometry_only_and_approximate_json_are_not_verified(self):
        p=self.root/'geometry.json';p.write_text(json.dumps({'spaces':[{'id':'room','name_zh':'Room','polygon_mm':[[0,0],[1000,0],[1000,1000]]}]}))
        before=p.read_bytes();stat=p.stat()
        r=discovery.discover(p,'plan','p1')
        self.assertEqual(r['semantic_capability'],'candidate_regions')
        self.assertEqual(r['regions'][0]['verification']['state'],'candidate')
        self.assertEqual(p.read_bytes(),before);self.assertEqual(p.stat().st_mtime_ns,stat.st_mtime_ns)
        q=self.root/'source.blend';q.write_bytes(b'fixture')
        self.assertEqual(discovery.discover(q,'model','r1')['semantic_capability'],'geometry_only')
    def test_ifc_names_without_region_geometry_request_supplement(self):
        p=self.root/'model.ifc';p.write_text("#1=IFCSPACE('guid',$,'Room',$,$,#2,$,$,$,$,$);\n#2=IFCLOCALPLACEMENT($,#3);")
        r=discovery.discover(p,'ifc','v1')
        self.assertEqual(r['semantic_capability'],'none');self.assertEqual(r['inventory']['space_objects'],1)
        self.assertTrue(any('boundary' in d for d in r['diagnostics']))
    def test_freecad_inventory_does_not_invent_shape_semantics(self):
        p=self.root/'model.FCStd'
        with zipfile.ZipFile(p,'w') as z:z.writestr('Document.xml','<Document><Objects><Object name="Space" type="Part::Feature"/></Objects></Document>')
        r=discovery.discover(p,'fc','r1');self.assertEqual(r['inventory']['object_count'],1)
        self.assertNotEqual(r['semantic_capability'],'explicit_regions')
    def test_normalized_registry_and_discovery_priority(self):
        p=self.root/'rooms.json';p.write_text(json.dumps({'schema':'spatial-canvas.spaces.v1','spaces':[{'space_id':'a'}]}))
        self.assertEqual(discovery.discover(p,'rooms','v1')['semantic_capability'],'explicit_regions')
        self.assertLess(discovery.priority('explicit_regions'),discovery.priority('candidate_regions'))
    def test_closed_dxf_polyline_is_review_candidate(self):
        p=self.root/'plan.dxf'
        p.write_text('0\nSECTION\n2\nENTITIES\n0\nLWPOLYLINE\n8\nROOM\n70\n1\n10\n0\n20\n0\n10\n2\n20\n0\n10\n2\n20\n2\n10\n0\n20\n2\n0\nENDSEC\n0\nEOF\n')
        r=discovery.discover(p,'cad','v1');self.assertEqual(r['semantic_capability'],'candidate_regions')
        self.assertEqual(r['regions'][0]['polygon'],[[0.,0.],[2.,0.],[2.,2.],[0.,2.]])

if __name__=='__main__':unittest.main()
