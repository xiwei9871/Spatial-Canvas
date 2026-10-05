# Spatial Canvas

Spatial Canvas 是本地项目上下文工作台：你在模型里点选真实对象，把稳定身份、源文件版本、点击位置、空间语义和有证据的关系交给 AI。它让设计协作从“你说的是哪一个？”开始，变成从明确的对象和上下文开始。

当前工作台显示 **V0.5.1**，项目处于 **Stable / Maintenance**。浏览器加载的是 derived Interaction Proxy，权威源仍在 Blender、CAD 等原工具中。网页选择、Frame、Hide/Ghost 和相机书签都不修改权威源；AI 修改任务需要你的明确指令。

## 当前生产工作流

1. 用 **Open local export** 同时选择 `interaction_proxy.manifest.json` 和它引用的 `.glb`。
2. 需要房间上下文时，用 **Import spatial semantics** 导入匹配的 project 和 Space Registry。
3. 需要组件、连接或相邻关系时，用 **Import relationship graph** 导入匹配的图。
4. 在模型上点击对象；在 **Inspector** 核对 `global_id`、`native_object_id` 和 source revision。
5. 必要时 **Frame selection**，让镜头围绕选中对象取景。
6. 选中遮挡视线的独立墙段，用 **Hide selected** 或 **Ghost selected**；用 **Show all** 恢复。
7. 拖动调整视角。需要精确比较机位时，使用已有的 **Lock view / Save View**。
8. 点 **Copy AI Handoff**，把上下文连同具体设计任务粘贴给 Codex 或其他 AI。
9. 精确机位任务另附 **Copy View Handoff**，或导出的相机 JSON 和 PNG 预览。
10. AI 按源版本和对象定位执行明确授权的任务；源有变化后，重新导出并 **Reload proxy**，再次核对。

完整操作和可选步骤见 [WORKFLOW](docs/WORKFLOW.md)，逐项按钮说明见 [USER_GUIDE](docs/USER_GUIDE.md)。

## 核心能力

| 能力 | 实际含义 |
| --- | --- |
| 对象身份 | 稳定/global ID、原生对象 ID、design/source resource |
| 来源追踪 | source locator、revision、SHA-256；冻结源使用外部 bindings |
| 精确点击 | Pointer raycast hit、坐标系和单位；列表选择没有点击位置 |
| 空间语义 | 独立 Space Registry 根据点击点解析区域；不把 `room_id` 当作区域边界 |
| 关系语义 | 有来源的 `part_of`、直接连接、嵌入、相邻和过渡，保留审核状态 |
| 查看与取景 | Frame、独立对象 Hide/Ghost、Show all、Isolate；只影响 viewer |
| AI 交接 | ContextPacket 和 Copy AI Handoff；不自动连接或调用 AI 服务 |
| 精确机位 | 已有相机书签、数值 View Handoff、JSON/PNG 导出和只读 Blender 应用 |
| 项目接入 | 模板、CLI 预检查、readiness 与补充资料清单 |

**Inspector** 回答“这是什么对象”；**Space / Region** 回答“这个点击点在哪个区域”；**Relationships** 回答“它与其他对象/空间/组件是什么关系”。一项已知，并不让其他两项自动成立。

## Quick start

需要 Node.js 22+ 和支持 WebGL2 的浏览器：

```sh
npm ci
npm run dev
```

打开 Vite 打印的本地地址。**Load full example** 可试完整演示，**Load task example** 可试局部子集；它们不是你的真实工程。

真实项目需加载 manifest 和对应 GLB。加载不会读取 `.blend`。本地 **Reload proxy** 会重新要求选择导出文件，不会监听文件变化。无效 Proxy 导入保留上一有效场景。

## 项目接入

```sh
npm run project:init -- --dir /path/to/new-project
npm run project:inspect -- --dir /path/to/new-project
npm run project:validate -- --dir /path/to/new-project
```

初始化会生成模板，拒绝覆盖非空目录。替换 placeholder IDs、源 locator、revision、完整 SHA、单位和坐标系，再做真实导出和工作台验证。CLI 的文件预检查不是完整空间/关系验收；详见 [PROJECT_ONBOARDING](docs/PROJECT_ONBOARDING.md)。

## Interaction Proxy 原则

### Interaction Boundary Preservation

**权威源中有独立交互意义的对象，Proxy 应保留这些边界；只有经过明确设计的语义合并才能改变粒度。**

C-Type 曾把原 Blender 墙体输入的交互意义压缩到两个连续墙壳：点击一面墙后 Hide/Ghost 影响整屋墙体，AI 也丢失局部墙段身份。修复后有 **98 个独立墙面实体 + 919 个保留 ID 的其他实体 = 1017**。这不是每个 Blender Mesh 都必须一对一导出的规定。

语义合并仅适用于选择意义不丢失、ID/原生来源可追溯、当前工作流不需要独立操作的部分。整屋墙壳不满足单墙遮挡控制的需求。冻结源的修复在独立 derived review 中进行，不写入冻结 `.blend`。

规范与检查清单：[INTERACTION_PROXY](docs/INTERACTION_PROXY.md)。本地 C-Type 修复的可复现案例：[wall identity recipe](examples/c-type-wall-identity/README.md)；验收记录：[maintenance validation](docs/maintenance/issue13-validation.md)。

## 架构与维护

`authoritative source → offline producer → derived GLB/manifest → Workspace → source-linked handoff`。

| 目录 | 责任 |
| --- | --- |
| `packages/protocol`, `schemas` | 协议、容器和身份/来源约束 |
| `packages/core` | 选择、上下文、语义解析、关系和 handoff |
| `packages/viewer`, `apps/workspace` | 加载、点选、查看状态、Inspector 和输出 |
| `adapters/blender` | 离线导出、受校验的 intent 执行、已有相机预设应用 |
| `templates/project` | 可复用 onboarding 模板 |

```sh
npm run check
npm run test:adapter
npm run test:bindings
npm run test:camera
npm run test:wall
npm run schemas
npm run fixture
```

`check` 包含 lint、typecheck、Vitest、build。真实 Blender 和本地 C-Type 验收命令见 [maintenance validation](docs/maintenance/issue13-validation.md)。工作文件、模型、Proxy、截图和日志留在本地/产物存储；只有小型 authored fixtures 在 `examples/living/task-output` 中受版本控制。

维护仅处理真实工作流暴露的问题、兼容性和小型可用性缺口。本轮不增加相机系统、语义域、关系词汇、实时同步、自动渲染、云服务或 AI provider SDK；见 [MAINTENANCE](docs/MAINTENANCE.md)。

## 协议与历史

| 阶段 | 文档 |
| --- | --- |
| V0.1 身份、选择、请求 | [Protocol](docs/protocol-v0.1.md) |
| V0.2 离线 Blender 闭环 | [Workflow](docs/blender-workflow-v0.2.md) |
| V0.3 冻结源、bindings、ContextPacket | [Protocol](docs/protocol-v0.3.md) / [Workflow](docs/frozen-workflow-v0.3.md) |
| V0.4 空间语义与 ingestion | [Protocol](docs/protocol-v0.4.md) |
| V0.5 typed relationships | [Protocol](docs/protocol-v0.5.md) |
| V0.5.1 使用与接入冻结 | [USER_GUIDE](docs/USER_GUIDE.md) / [Onboarding](docs/PROJECT_ONBOARDING.md) |
| 已有 maintenance 机位交接 | [View Handoff](docs/view-handoff.md) |
