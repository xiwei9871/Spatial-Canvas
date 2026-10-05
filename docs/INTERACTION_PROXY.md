# Interaction Boundary Preservation

Interaction Proxy 是 derived 交互表示。几何简化、材质精简和层级扁平化不应无意丢掉人实际需要的选择边界。

## 产品规则

**若权威源存在可独立理解、定位或操作的对象，Proxy 应保留它们的交互边界，除非有明确、可审查的语义合并。**

这不要求每个 Blender mesh、网格碎片或装饰螺丝一对一成为 Entity。导出粒度由任务含义决定：同一实体可包含多个渲染 primitive；连接到同一个 renderer Group 不应自动变为同一个 Entity。

允许合并必须同时满足：

1. 选择后的含义清晰，合并前的重要对象仍可追踪到原生来源。
2. ID 映射稳定且可审查，记录 constituent IDs/native locators 与来源 revision/SHA。
3. 真实工作流不需要成员独立点选、检查、Hide/Ghost、任务定位或执行。
4. 合并不悄悄建立 room、adjacent_to、connected_to、supports 等新事实。

单面墙的遮挡控制需要独立边界，整屋墙壳不适合充当其唯一交互实体。

## C-Type 案例

```text
Blender 原生墙体/后续墙输入：有独立墙段意义
旧交互表示：两个连续墙壳 Entity
后果：点一面墙，Hide/Ghost 同时影响其他墙
修复：98 个独立 derived 墙面 Entity + 919 个保留 ID = 1017
```

核对后确认：这里并非 GLB exporter 将独立对象合并；当前 R4 已用连续墙壳显示最终修正，原墙段输入仍保留但隐藏。修复依据这些原生输入划分**当前墙壳表面**，保留门洞、修正和来源追踪，而非把历史隐藏墙直接重新显示。

每个 derived part 的 `native_object_id` 指向新 review snapshot 中的独立对象，并在 `WALL_PART_INDEX.json` 留下父墙 Entity ID、原墙输入名称、输入文件/hash、面积和 bounds。它们是可交互表面部件，不是各自新建的封闭施工墙实体。

新的身份要求显式新 revision/SHA 和 bindings。两个旧墙壳 ID 从可选实体中退役，但在 index/parent assembly 中可追踪；其他 919 个 ID 不变。旧的整墙 Hide/Ghost preset 不应套到新版本，新 preset 必须显式清理覆盖状态并核对来源。

冻结 R4 保持 byte-for-byte 不变，修复位于独立 HUMAN_REVIEW 副本。图只增加墙 part → 原墙组件的 `part_of`。它不确认空间归属、承重、现场尺寸、相邻或物理连接。

可复现步骤见 [C-Type recipe](../examples/c-type-wall-identity/README.md)，完整验收见 [Issue #13 validation](maintenance/issue13-validation.md)。

## Producer / onboarding 检查清单

- 写清本工程需要独立交互的对象类别，例如墙段、门扇、家具组件。
- 检查 source native 边界与 Proxy Entity 对应；同一 renderer parent/shared material 不等于语义合并。
- 每个渲染 mesh 必须能追溯到稳定 global ID 与当前 native locator；不靠名称猜 ID。
- Full/Task 使用相同协议，交集中的 ID 保持一致；没有导出的对象不能被 UI Show all 补出。
- 在真实页面点选至少两个邻近独立对象，逐个 Hide/Ghost，确认范围符合选择；再 Show all。
- 明确 semantic merge 的原因、映射、影响和限制，禁止为降低 entity_count 隐藏交互意义。
- 冻结源用 sidecar，验证导出前后 bytes/hash/mtime；不可直接 initialize IDs 写入冻结模型。
- 对显式拆出的派生表面验证覆盖/面积和可接受的数值误差，报告未覆盖或歧义，不伪装为 native solid。
- 独立可选墙不等于已有房间/连接语义；只有输入证据支持的关系才进入 ContextPacket。

维护状态下只对实际工作流暴露的边界缺陷修复；不在本轮扩展 entity/relationship vocabulary 或自动重建房间。
