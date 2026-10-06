"""Partition convex surface polygons using authored source boxes; never adds cap geometry."""
import math
def polygon_area(poly):
 if len(poly)<3:return 0.0
 p=poly[0];area=0.0
 for a,b in zip(poly[1:-1],poly[2:]):
  u=[a[i]-p[i] for i in range(3)];v=[b[i]-p[i] for i in range(3)]
  area+=.5*math.sqrt(sum(x*x for x in [u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]]))
 return area
def split_plane(poly,axis,value,sign):
 inside,outside=[],[]
 if not poly:return inside,outside
 for a,b in zip(poly,poly[1:]+poly[:1]):
  da=sign*(a[axis]-value);db=sign*(b[axis]-value)
  (inside if da>=0 else outside).append(a)
  if (da<0)!=(db<0):
   t=da/(da-db);point=tuple(a[i]+t*(b[i]-a[i]) for i in range(3))
   inside.append(point);outside.append(point)
 def clean(points):
  result=[]
  for p in points:
   if not result or sum((p[i]-result[-1][i])**2 for i in range(3))>1e-24:result.append(p)
  if len(result)>1 and sum((result[0][i]-result[-1][i])**2 for i in range(3))<1e-24:result.pop()
  return result if polygon_area(result)>1e-16 else []
 return clean(inside),clean(outside)
def partition_box(poly,lo,hi):
 remaining=list(poly);outside=[]
 for i in range(3):
  for value,sign in [(lo[i],1),(hi[i],-1)]:
   remaining,part=split_plane(remaining,i,value,sign)
   if part:outside.append(part)
   if not remaining:return [],outside
 return remaining,outside
