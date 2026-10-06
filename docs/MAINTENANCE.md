# Stable / Maintenance

V0.5.1 closeout merged as PR #12 (`3b9a666`). Spatial Canvas now has a stable production scope: source-linked object identity, selection/hit, frozen-sidecar ContextPacket, independent Space Semantics, typed relationship context, controlled import failure, onboarding and AI handoff.

Maintenance permits concrete bugs, compatibility/security fixes and small usability gaps exposed by real engineering/design work. Native wall interaction boundaries and the already implemented View Handoff are such gaps. [WORKFLOW](WORKFLOW.md) and [USER_GUIDE](USER_GUIDE.md) describe their current UI; [INTERACTION_PROXY](INTERACTION_PROXY.md) fixes the boundary principle.

Issue #13 packages documentation, source-only wall recipe/regression evidence and the existing maintenance UI into a reviewable Spatial Canvas branch. At this documentation freeze, main is still V0.5.1 closeout; maintenance features described as present on this branch become released only after the maintenance PR merges. No automatic merge is performed.

This task adds no new camera system, Blender camera export, real-time bridge, WebSocket/live synchronization, AI provider SDK, cloud service, graph visualization, semantic domain/vocabulary, relationship type, automatic render pipeline, room reconstruction or C-Type design change.

Future changes must preserve authoritative sources, exact source provenance and current unknown/candidate/rejected states. Large working models, Proxy pairs, screenshots and logs stay in ignored local artifacts. Review descriptions must distinguish local real-project verification from CI/synthetic fixtures; private project assets are not required by default CI.

[Issue #13 validation](maintenance/issue13-validation.md) lists current gates and known numerical/semantic limits. Historical protocol documents remain available, but the README begins with present-day usage.
