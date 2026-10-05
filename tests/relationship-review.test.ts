import {expect,it} from 'vitest';
import {reviewRelationship} from '../packages/core/relationship-review';
import {relationshipGraphSchema} from '../packages/protocol/relationships';
import {graph} from './relationship-data';
it('approves/rejects with new revision and stable IDs while preserving evidence and input',()=>{const g=relationshipGraphSchema.parse(graph),before=JSON.stringify(g);const next=reviewRelationship(g,'e6','rejected',{reviewer:'owner',timestamp:'2026-10-05T04:00:00.000Z',note:'No direct boundary evidence'},'2');expect(next.edges[5]!.edge_id).toBe('e6');expect(next.edges[5]!.provenance).toEqual(g.edges[5]!.provenance);expect(next.revision).toBe('2');expect(JSON.stringify(g)).toBe(before);expect(()=>reviewRelationship(g,'e6','verified',{reviewer:'owner',timestamp:'2026-10-05T04:00:00.000Z',note:'approved'},'1')).toThrow(/revision/);});
