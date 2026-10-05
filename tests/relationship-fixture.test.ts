import {readFile} from 'node:fs/promises';import {expect,it} from 'vitest';
import {relationshipGraphSchema} from '../packages/protocol/relationships';
import {getConnected,getParents,getAdjacentSpaces,getTransitionsForSpace} from '../packages/core/relationships';
it('non-C-Type fixture proves hierarchy, contact, boundary, transition and nearby false-positive guard',async()=>{
 const g=relationshipGraphSchema.parse(JSON.parse(await readFile('examples/relationships/generic.relationships.json','utf8')));
 expect(g.design_id).toBe('generic_panel_project');expect(getParents(g,'bottom')[0]!.target_id).toBe('sink');
 expect(getConnected(g,'bottom').map(e=>e.target_id)).toEqual(['wallL','wallR']);expect(getConnected(g,'near')).toHaveLength(0);
 expect(getAdjacentSpaces(g,'boundary_wall')[0]!.target_id).toBe('spaceA');expect(getTransitionsForSpace(g,'spaceB')[0]!.endpoints).toEqual(['spaceA','spaceB']);
});
