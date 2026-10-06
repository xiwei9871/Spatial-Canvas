# Finalized / Stable / Maintenance

V0.5.1 closeout merged as PR #12 (`3b9a666`), and production-workflow/native-wall maintenance merged as PR #14 (`ad47ce40f98d295cf3dd8ed7f5a2333381591238`). Spatial Canvas now has a stable production scope: source-linked object identity, selection/hit, frozen-sidecar ContextPacket, independent Space Semantics, typed relationship context, controlled import failure, onboarding and AI handoff.

Spatial Canvas is functionally complete for the current product goal. Future changes are driven only by concrete production workflow blockers, bugs, compatibility issues or small usability improvements. Maintenance permits bug/security fixes, compatibility fixes, source-adapter corrections, performance fixes required by actual use, small usability improvements and documentation corrections. Native wall interaction boundaries and the already implemented View Handoff are such gaps. [WORKFLOW](WORKFLOW.md) and [USER_GUIDE](USER_GUIDE.md) describe their current UI; [INTERACTION_PROXY](INTERACTION_PROXY.md) fixes the boundary principle.

Issue #13 is complete and its maintenance UI, production docs and source-only wall recipe are merged into main through PR #14. Issue #15 is the final planned closeout: final status wording, release notes and validation only. No automatic merge is performed.

The release candidate is [v0.5.1-stable](releases/v0.5.1-stable.md). Its final tag/release is pending user merge of the finalization PR. Only that PR’s actual merge commit is the tag target, not PR #14’s baseline or the finalization branch head.

There is no speculative V0.6 roadmap. Reject V0.6 for its own sake, WebSocket architecture, cloud/collaboration platforms, graph databases/visualization, automatic BIM/room/plumbing/electrical authoring, AI-provider orchestration, prompt-management platforms and plugin marketplaces. Live synchronization may be reconsidered only in a separately authorized task if an actual blocker proves it necessary; it is not current maintenance scope.

This task adds no new camera system, Blender camera export, real-time bridge, WebSocket/live synchronization, AI provider SDK, cloud service, graph visualization, semantic domain/vocabulary, relationship type, automatic render pipeline, room reconstruction or C-Type design change.

Future changes must preserve authoritative sources, exact source provenance and current unknown/candidate/rejected states. Large working models, Proxy pairs, screenshots and logs stay in ignored local artifacts. Review descriptions must distinguish local real-project verification from CI/synthetic fixtures; private project assets are not required by default CI.

[Issue #13 validation](maintenance/issue13-validation.md) lists current gates and known numerical/semantic limits. Historical protocol documents remain available, but the README begins with present-day usage.
