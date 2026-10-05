# 真实设计工作流

本流程对应 2026-10-06 核对的 V0.5.1 maintenance Workspace。只说明已经存在的功能；按钮原文见 [USER_GUIDE](USER_GUIDE.md)。

## 准备一次可追溯的工程导出

先确定 authoritative source、design/source resource ID、revision、完整 SHA-256 和坐标系。冻结源使用外部 bindings；可编辑源由离线工具保存身份。导出 Interaction Proxy GLB 和 manifest；需要空间或关系时，另准备匹配此源版本的 project、Space Registry、Relationship Graph。

Proxy 是用于查看和交互的 derived artifact。它可以简化外观和纹理，但应保留实际工作需要的交互边界。不要为接入网页而修改冻结源或把独立墙段合成一个全屋 Entity。参见 [Interaction Boundary Preservation](INTERACTION_PROXY.md)。

## 从加载到 AI 交接

| 顺序 | 你做什么 | 必要性与核对点 |
| --- | --- | --- |
| 1 | **Open local export**，同时选择 manifest 和它引用的 GLB | 必需。Resource 显示当前 resource、scope、revision；不直接打开 `.blend`。 |
| 2 | **Import spatial semantics**，选择 project 和 Space Registry | 房间/空间任务需要；纯对象定位可略过。读 readiness 和 diagnostics。 |
| 3 | **Import relationship graph**，选择关系图 | 组件/连接任务需要；纯对象定位可略过。含 space/level 节点的图通常还需要第 2 步的 registry。 |
| 4 | 在模型中点击对象 | 必需定位步骤。Shift/Ctrl/⌘ 可多选；Entities 行也能选择，但没有 raycast hit。 |
| 5 | **Inspector** 核对对象身份 | 必需。看 global/native ID、源 revision、authority_level、mutable 和空间矩阵/bounds，防止选错对象。 |
| 6 | **Frame selection** | 可选。把浏览器镜头移到选中实体周围；不会移动对象或创建 Blender Camera。锁定时先 Unlock view。 |
| 7 | 选遮挡物，用 **Hide selected / Ghost selected** | 可选。只处理选中的 Entity，恢复动作是 **Show all**；必要时 **Isolate selection**。 |
| 8 | 手动 orbit/pan/zoom，确定构图 | 可选。拖拽、右键拖拽、滚轮。精确机位用现有 Lock view 和命名 Save View。 |
| 9 | **Copy AI Handoff** | 交接时使用。复制当前 ContextPacket 加使用说明，不会自动发给 AI。 |
| 10 | 粘贴给 Codex/agent，并写清任务 | 必需区分“解释”与“修改”。例如只识别对象，或另行明确授权修改派生审阅副本。 |
| 11 | AI 使用给定定位与证据 | 先核对源版本/字节，再按 global/native ID、真实 hit、空间状态和关系类型处理；不反复扫描场景找“那个对象”。 |

即使 semantics/relationships 缺失，对象身份仍可用。空间显示 `unresolved`、`PARTIAL` 或图显示 `unavailable` 时，把缺口如实带给 AI；不能把缺少证据当作已确认事实。

## 三种信息不能相互替代

- **Inspector = 这是哪个对象？** 一个岛台台面的 native ID 可以确定为 `B11_K-ISLAND_ROUNDED_COUNTER`。
- **Space / Region = 点击点在哪？** 结果可能只是 candidate 厨房，也可能没有包含区域。它来自独立区域边界、层高、坐标和证据；不是名称或 `room_id` 的推断。
- **Relationships = 它与谁是什么关系？** 有证据时可为 `part_of` island assembly；对象尚未映射时就是 unavailable。不能凭“这是岛台”补出 connected_to 或 supports。

同一整块 floor mesh 可以在不同点击位置对应 lounge、corridor、landing；不需要为了区域语义切 mesh。墙体需要独立 Hide/Ghost，则需要保留墙段交互边界。这是两个不同问题。

## 临时查看状态与精确视角

Hide、Ghost、Show all、Isolate 只改变浏览器状态；全程不写 source、不会持久保存“拆墙”。Ghost 保留 20% 不透明度，便于读空间；它依然可能被点选。想点它后面的物体可先 Hide，再通过 Entities 列表选回。

ContextPacket / Copy AI Handoff 包含复制时的相机和点击信息，但**不包含 hidden/ghost ID 列表**。需要完整复现可见性时：

1. 调好镜头后 **Lock view**；为视角填写名称并 **Save View**。
2. 附上 **Copy View Handoff**，或 **Export Camera Preset** 后分别下载 JSON 和 reference PNG。
3. PNG 只用于确认构图；数值 ViewPreset 才用于精确相机和可见性复现。
4. 相机或可见性再改变后，重新 Save View；否则 View Handoff 仍是旧快照。

已有书签保存在当前浏览器的本地存储，按精确源 revision/SHA 隔离。重新载入匹配 Proxy 后，**Restore saved view** 恢复镜头/覆盖状态并锁定。导入其他 revision 的预设会被拒绝。生产 quickstart 不保证每个浏览器允许自动下载；导出区保留两个明确下载链接。详见 [View Handoff](view-handoff.md)。

## 设计协作例：从入户视角比较 C / D / E 台阶

**人负责视觉判断与任务范围。**

选择具体遮挡墙段而非整屋墙壳，临时 Hide/Ghost；在浏览器里把入户构图调到满意，命名保存 `entrance_steps_compare`。复制对象的 AI Handoff，另附数值 View Handoff / 相机 JSON 和预览。说明“先做三个概念比较，冻结 R4 不改”，或明确允许的派生模型修改范围。

**AI 负责按确定上下文工作。**

读取对象、来源版本和真实点击位置，检查 preset 来源与坐标系，直接使用其 position/quaternion/FOV/画幅和覆盖状态；不让截图承担反推相机的职责。已有 Blender adapter 可在独立渲染快照中应用相机，具体设计/渲染步骤由外部任务执行，网页没有自动方案生成按钮。

C / D / E 应从同一个被核验的基底和相机比较；不同 revision 的模型必须显式检查对应关系，不能绕过 SHA 校验强套旧预设。Image2 概念图不等于尺寸、级数或几何已经通过模型验收。

## 修改源之后的回到网页确认

离线工具修改可编辑 source 或创建授权的派生审阅副本后，记录新 revision/SHA，重新导出 Proxy、bindings、空间适用声明和关系图。使用 **Reload proxy**：例子会重新加载；本地文件会要求重新选择导出对。

旧的语义来源和相机预设不能自动代表新版本。导入新的匹配证据，再点击同一目标核对 ID、native locator、hit 和结果。无效 Proxy 对保留旧场景；失败/不匹配的语义或关系导入不会继续提供旧的可信结果。

## 谁能改变什么

| 动作 | 影响 |
| --- | --- |
| 选择、Frame、导航、Hide/Ghost/Isolate | viewer only；source 字节不变 |
| Save/Restore view | 本地书签及查看快照；不是 source authoring |
| Copy/Export context 或 View Handoff | 交接数据；不是编辑授权或发送 AI 的动作 |
| Emit transform intent | request-only JSON；网页不执行 |
| 离线 adapter 修改源 | 用户授权 + 可编辑策略 + revision/SHA/native ID/mutable 校验；冻结 sidecar 源禁止 intent 执行 |

异常处理与逐项控件见 [USER_GUIDE](USER_GUIDE.md)。新工程的准备步骤见 [PROJECT_ONBOARDING](PROJECT_ONBOARDING.md)。
