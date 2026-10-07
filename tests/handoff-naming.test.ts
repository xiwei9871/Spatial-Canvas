import {expect,it} from 'vitest';
import {buildAiHandoff,contextExportFilename,handoffExportFilename} from '../packages/core/handoff';
import {contextPacketSchema} from '../packages/protocol/context';
import {packet} from './context-data';

it('copy starts with selected object so pasted handoffs have distinct identifying titles',()=>{
 const sofa=contextPacketSchema.parse(packet);
 const wall={...sofa,entities:[{...sofa.entities[0]!,native_object_id:'Wall north',semantic_type:'wall'}]};
 expect(buildAiHandoff(sofa).split('\n')[0]).toContain('Sofa');
 expect(buildAiHandoff(wall).split('\n')[0]).toContain('Wall north');
 expect(buildAiHandoff(sofa).split('\n')[0]).not.toBe(buildAiHandoff(wall).split('\n')[0]);
 expect(JSON.parse(buildAiHandoff(wall).split('<ContextPacket>\n')[1]!.split('\n</ContextPacket>')[0]!)).toEqual(wall);
});
it('download uses object,stable ID,revision and timestamp instead of one generic filename',()=>{
 const p=contextPacketSchema.parse(packet);
 const name=contextExportFilename(p);
 expect(name).toContain('Sofa');
 expect(name).toContain('ent_sofa');
 expect(name).toContain('r4');
 expect(name).toContain('20261004T080000000Z');
 expect(name).toMatch(/\.json$/);
 expect(handoffExportFilename(p)).toBe(name.replace('.context--','.handoff--').replace(/\.json$/,'.txt'));
 expect(buildAiHandoff(p)).toContain('Suggested filename: '+handoffExportFilename(p));
 const other={...p,entities:[{...p.entities[0]!,native_object_id:'Wall north'}]};
 expect(contextExportFilename(other)).not.toBe(name);
});
it('multi-selection names its primary object and count while no selection identifies the source',()=>{
 const p=contextPacketSchema.parse(packet);
 const primary={...p.entities[0]!,global_id:'ent_door',native_object_id:'Door 107'};
 const group={...p,selection:{...p.selection,entity_ids:['ent_sofa','ent_door'],primary_entity_id:'ent_door'},entities:[p.entities[0]!,primary]};
 expect(buildAiHandoff(group).split('\n')[0]).toContain('Door 107');
 expect(buildAiHandoff(group).split('\n')[0]).toContain('2 objects');
 expect(contextExportFilename(group)).toContain('Door-107');
 expect(contextExportFilename(group)).toContain('2-objects');
 const empty={...p,selection:{...p.selection,entity_ids:[],primary_entity_id:null},entities:[]};
 expect(buildAiHandoff(empty).split('\n')[0]).toContain('source_test');
 expect(contextExportFilename(empty)).toContain('source_test');
});
it('unsafe names are one line and portable,without mutating packet identity or JSON',()=>{
 const p=contextPacketSchema.parse(packet);
 const original={...p,entities:[{...p.entities[0]!,native_object_id:'橱柜/北\\侧:\n*?<门>|"'}]};
 const before=JSON.stringify(original);
 const name=contextExportFilename(original);
 expect(name).toContain('橱柜');
 expect(name).not.toMatch(/[\\/<>:"|?*]/);
 expect([...name].every(c=>c.codePointAt(0)!>=32)).toBe(true);
 expect(name.length).toBeLessThan(240);
 expect(JSON.stringify(original)).toBe(before);
 expect(buildAiHandoff(original).split('\n')[0]).toContain('橱柜');
 const long={...p,entities:[{...p.entities[0]!,native_object_id:'墙'.repeat(1000)}]};
 expect(new TextEncoder().encode(contextExportFilename(long)).length).toBeLessThan(255);
});
