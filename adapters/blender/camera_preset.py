"""Pure preset validation. Camera quaternion order is XYZW; local camera axes stay -Z forward, +Y up."""
import math, re
from contracts import ProtocolError, identifier, vector

def rotation(value):
 if not isinstance(value,list) or len(value)!=4 or any(isinstance(v,bool) or not isinstance(v,(int,float)) or not math.isfinite(v) for v in value):
  raise ProtocolError("Invalid quaternion")
 if abs(math.sqrt(sum(v*v for v in value))-1)>1e-5:raise ProtocolError("Quaternion must be normalized")
 return value
def source_rotation(q):
 x,y,z,w=rotation(q);a=math.sqrt(.5)
 return [a*(w+x),a*(y-z),a*(y+z),a*(w-x)]
def positive(value):
 if isinstance(value,bool) or not isinstance(value,(int,float)) or not math.isfinite(value) or value<=0:raise ProtocolError("Expected positive finite number")
 return value
def validate_camera_preset(p):
 if not isinstance(p,dict) or p.get('schema')!='spatial-canvas.view-preset.v1':raise ProtocolError('Unsupported view preset')
 for field in ['preset_id','design_id','source_resource_id','source_revision','source_sha256','frame_id']:identifier(p.get(field),field)
 if not re.fullmatch('[a-f0-9]{64}',p['source_sha256']):raise ProtocolError('Invalid source SHA')
 if p.get('projection')!='perspective' or p.get('unit')!='meter' or p.get('up_axis')!='Y':raise ProtocolError('Unsupported camera frame')
 if positive(p.get('fov_degrees'))>=180:raise ProtocolError('Invalid FOV')
 vector(p.get('position'));vector(p.get('orbit_target'));rotation(p.get('quaternion'))
 viewport=p.get('viewport',{})
 for field in ['width','height','pixel_ratio']:positive(viewport.get(field))
 if p.get('near') is not None:positive(p['near'])
 if p.get('far') is not None:positive(p['far'])
 if p.get('near') is not None and p.get('far') is not None and p['far']<=p['near']:raise ProtocolError('Invalid clipping range')
 src=p.get('source_camera',{})
 if src.get('unit')!='meter' or src.get('up_axis')!='Z':raise ProtocolError('Unsupported source camera frame')
 identifier(src.get('frame_id'),'source camera frame');vector(src.get('position'));rotation(src.get('quaternion'))
 x,y,z=p['position']
 if any(abs(a-b)>1e-7 for a,b in zip(src['position'],[x,-z,y])):raise ProtocolError('Source camera position disagrees with proxy')
 expected=source_rotation(p['quaternion'])
 if min(max(abs(a-b) for a,b in zip(expected,src['quaternion'])),max(abs(a+b) for a,b in zip(expected,src['quaternion'])))>1e-5:raise ProtocolError('Source camera rotation disagrees with proxy')
 for field in ['hidden_entity_ids','ghost_entity_ids']:
  ids=p.get(field)
  if not isinstance(ids,list):raise ProtocolError('Override IDs must be arrays')
  for item in ids:identifier(item,field)
  if len(ids)!=len(set(ids)):raise ProtocolError('Duplicate override identity')
 if set(p['hidden_entity_ids'])&set(p['ghost_entity_ids']):raise ProtocolError('Conflicting visibility overrides')
 return p
