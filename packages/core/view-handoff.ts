import type {ViewPreset} from '../protocol/view-preset';
export function buildViewHandoff(preset:ViewPreset):string {
 return `Apply this exact camera preset before rendering or inspecting the source. Do not rediscover the view from a screenshot.

View preset provenance, camera pose and temporary viewer overrides are authoritative for this handoff. The source remains read-only; hidden and ghosted entities are viewer state only.

<ViewPreset>
${JSON.stringify(preset,null,2)}
</ViewPreset>`;
}
