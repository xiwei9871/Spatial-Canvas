"""Read-only semantic evidence inventory. Native files never imply approved room boundaries."""
import argparse
import hashlib
import json
import math
from pathlib import Path
import re
import xml.etree.ElementTree as ET
import zipfile


def priority(capability):
    return {'explicit_regions': 0, 'candidate_regions': 1, 'geometry_only': 2, 'none': 3}[capability]


def dxf_candidates(text):
    lines = text.splitlines()
    pairs = list(zip(lines[::2], lines[1::2]))
    entities = []
    current = []
    for code, value in pairs:
        if code.strip() == '0':
            if current:
                entities.append(current)
            current = [('0', value.strip())]
        else:
            current.append((code.strip(), value.strip()))
    if current:
        entities.append(current)
    polygons, labels = [], []
    for entity in entities:
        kind = entity[0][1]
        values = dict(entity)
        if kind in ('TEXT', 'MTEXT'):
            labels.append({'label': values.get('1', ''), 'layer': values.get('8', '')})
        if kind != 'LWPOLYLINE' or not (int(values.get('70', '0')) & 1):
            continue
        if any(code == '42' and abs(float(value)) > 1e-10 for code, value in entity):
            continue  # Curved boundaries require a native adapter, not chord approximation.
        polygon = []
        for code, value in entity:
            if code == '10':
                polygon.append([float(value), None])
            elif code == '20' and polygon:
                polygon[-1][1] = float(value)
        if len(polygon) >= 3 and all(p[1] is not None and all(math.isfinite(v) for v in p) for p in polygon):
            polygons.append({'native_id': values.get('5', 'polyline_' + str(len(polygons))),
                             'layer': values.get('8', ''), 'polygon': polygon, 'verification': {'state': 'candidate'}})
    return polygons, labels


def discover(path, resource_id, revision):
    path = Path(path).resolve()
    raw = path.read_bytes()
    suffix = path.suffix.lower()
    types = {'.fcstd': 'freecad', '.ifc': 'ifc', '.dxf': 'cad', '.dwg': 'cad', '.blend': 'blender', '.glb': 'model', '.json': 'authored_json'}
    result = {'resource_id': resource_id, 'revision': revision, 'sha256': hashlib.sha256(raw).hexdigest(),
              'locator': str(path), 'type': types.get(suffix, 'other'), 'semantic_capability': 'none',
              'diagnostics': [], 'regions': [], 'inventory': {}}
    if suffix == '.json':
        data = json.loads(raw)
        if data.get('schema') == 'spatial-canvas.spaces.v1':
            result['semantic_capability'] = 'explicit_regions'
            result['regions'] = data.get('spaces', [])
            result['diagnostics'].append('Normalized Space Registry found; runtime schema/provenance/coverage validation is required before use.')
        else:
            for item in data.get('spaces', []):
                polygon = item.get('polygon_mm') or item.get('polygon')
                if polygon:
                    result['regions'].append({'native_id': item.get('id', item.get('space_id')),
                        'name': item.get('name_zh', item.get('name')), 'polygon': polygon,
                        'unit': 'millimeter' if 'polygon_mm' in item else data.get('meta', {}).get('unit', 'unknown'),
                        'verification': {'state': 'candidate'}, 'evidence': item})
            result['semantic_capability'] = 'candidate_regions' if result['regions'] else 'none'
            result['diagnostics'].append('Legacy polygons are candidates: confirm coordinate alignment, current boundaries, level and vertical range; import a reviewed Space Registry.')
    elif suffix == '.fcstd':
        root = ET.fromstring(zipfile.ZipFile(path).read('Document.xml'))
        objects = [o.attrib for o in root.findall('./Objects/Object')]
        result['inventory'] = {'object_count': len(objects), 'types': sorted({o.get('type', '') for o in objects}),
                               'space_named_objects': [o for o in objects if re.search(r'space|room', o.get('name', ''), re.I)]}
        result['semantic_capability'] = 'geometry_only'
        result['diagnostics'].append('FreeCAD document inventoried read-only; export actual room footprints/placements via a native adapter or supplement normalized boundary JSON. Object names alone are insufficient.')
    elif suffix == '.ifc':
        text = raw.decode('utf-8', errors='replace')
        rows = re.findall(r'#\d+\s*=\s*IFCSPACE\((.*?)\);', text, re.S | re.I)
        result['inventory'] = {'space_objects': len(rows), 'storey_objects': len(re.findall(r'=\s*IFCBUILDINGSTOREY\(', text, re.I))}
        result['semantic_capability'] = 'none' if rows else 'geometry_only'
        result['diagnostics'].append('IFC space records found; boundary geometry, placements, units and verification need a native IFC export to normalized regions. Names/placements without geometry cannot resolve points.')
    elif suffix == '.dxf':
        regions, labels = dxf_candidates(raw.decode('utf-8', errors='replace'))
        result['regions'] = regions
        result['inventory'] = {'closed_linear_polylines': len(regions), 'labels': labels}
        result['semantic_capability'] = 'candidate_regions' if regions else 'geometry_only'
        result['diagnostics'].append('CAD closed linear polylines are review candidates, not automatically rooms. Supply coordinate frame/units, match labels, exclude furniture outlines, and define level/height. Curved/legacy POLYLINE geometry requires native export.')
    else:
        result['semantic_capability'] = 'geometry_only'
        result['diagnostics'].append('No explicit spatial regions extracted. Supply structured IFC/FreeCAD/plan regions or authored boundary JSON; weak geometry does not imply room identity.')
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', action='append', nargs=3, metavar=('RESOURCE_ID', 'REVISION', 'PATH'), required=True)
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    output = Path(args.output).resolve()
    sources = [discover(path, resource, revision) for resource, revision, path in args.source]
    if output.exists() or any(output == Path(s['locator']) for s in sources):
        parser.error('Output must be a new artifact path; input sources and prior inventories are never overwritten.')
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps({'sources': sorted(sources, key=lambda s: priority(s['semantic_capability']))}, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'output': str(output), 'sources': [{k: s[k] for k in ('resource_id', 'semantic_capability', 'diagnostics')} for s in sources]}, ensure_ascii=False))


if __name__ == '__main__':
    main()
