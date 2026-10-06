import sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[3]/'examples/c-type-wall-identity'))
from wall_surface_partition import partition_box,polygon_area
class SurfacePartition(unittest.TestCase):
 def test_clipped_and_outside_fragments_conserve_surface(self):
  poly=[(0,0,0),(2,0,0),(2,2,0),(0,2,0)]
  inside,outside=partition_box(poly,(0,0,-1),(1,2,1))
  self.assertAlmostEqual(polygon_area(inside),2)
  self.assertAlmostEqual(sum(polygon_area(p) for p in [inside,*outside]),4)
 def test_coplanar_wall_face_and_distant_box(self):
  poly=[(1,0,0),(1,2,0),(1,2,3),(1,0,3)]
  inside,outside=partition_box(poly,(1,0,0),(2,2,3))
  self.assertAlmostEqual(polygon_area(inside),6);self.assertFalse(outside)
  inside,outside=partition_box(poly,(3,0,0),(4,2,3))
  self.assertFalse(inside);self.assertAlmostEqual(sum(map(polygon_area,outside)),6)
if __name__=='__main__':unittest.main()
