# Workspace 使用说明

以下按功能说明 2026-10-06 核对的真实 UI，当前标题为 **Spatial Canvas V0.5.1**。完整流程见 [WORKFLOW](WORKFLOW.md)。控件可能随“未加载、无选择、immutable、无保存快照”等状态禁用，禁用不表示按钮不存在。

## Proxy / 工程加载

| 控件 | 做什么 / 什么时候用 | 边界 |
| --- | --- | --- |
| **Load full example** | 加载完整的小型演示工程，首次试功能 | 不是你的 Blender 工程，不证明真实项目语义完整 |
| **Load task example** | 加载局部任务 Proxy，试子集选择 | 与 full 使用同协议；不补齐子集以外几何 |
| **Open local export** | 同时选择一个 `*.manifest.json` 和它引用的 GLB，加载真实项目 | 不读 `.blend`、不根据 manifest 去联网获取模型 |
| **Reload proxy** | 导出更新后重新加载；例子直接重载，本地对重新弹文件选择 | 不监听磁盘，也不自动导出新 Proxy |
| 拖放到 viewport | 将同一导出对拖入视口，等同本地导入 | 仍需完整且匹配的对；失败保留旧有效场景 |

**Resource** 显示 resource ID、full/task、derived 和 source revision。源 SHA/locator 在 ContextPacket 中；浏览器验证 manifest/GLB 一致性，不验证本地权威文件的实际字节。

## 选择与镜头导航

| 控件 / 手势 | 做什么 / 什么时候用 | 边界 |
| --- | --- | --- |
| 模型单击 | 选择被 raycast 命中的 Entity，产生精确 hit | 不保证 Entity 是整件家具或一个完整房间；粒度由 Proxy 决定 |
| Shift / Ctrl / ⌘ 单击 | 在视口或 Entity 行追加/移除选择，用于多对象任务 | 不合并对象，hit 仅描述实际点击的 primary entity |
| **Clear selection** / Escape | 清空选择 | 不删除对象，不恢复可见性 |
| **Frame selection** | 将浏览器相机 reposition/zoom 到选中实体周围，使其居中并易查看；类似 Blender Frame Selected | 不移动对象、改变选择、修改 source 或创建 Blender Camera；锁定时无相机移动，先 Unlock view |
| 左键拖拽 | Orbit 镜头，寻找角度 | 不旋转 source 模型；Lock view 后停用 |
| 右键拖拽 | Pan 镜头与 orbit target | 不平移对象；Lock view 后停用 |
| 滚轮 | Zoom 查看距离 | 不缩放 source 对象；Lock view 后停用 |

## 遮挡与临时可见性

| 控件 | 做什么 / 什么时候用 | 边界 |
| --- | --- | --- |
| **Hide selected** | 隐藏选中的 Entity，查看墙后物品、室内或外部机位 | viewer only；不是删除/拆墙；隐藏对象不参与点选，可从 Entities 选回 |
| **Ghost selected** | 选中实体变为 20% 不透明，保持空间轮廓 | viewer only；不是改 source 材质；Ghost 对象仍可被 raycast 点中 |
| **Show all** | 清掉本工作台的 Hide/Ghost/Isolate 覆盖，恢复加载时可见性 | 不启用原 source 未导出的隐藏对象，不清选择，不解锁镜头 |
| **Isolate selection** | 临时隐藏其他 Proxy Entity，只查看已选局部 | 不裁切几何、不删除其他对象；用 Show all 恢复 |

这些动作按 Entity 边界作用。同一 Entity 包含整屋墙壳时，点击任何地方都可能一起处理多面墙。正常的室内 Proxy 应保留有意义的独立墙段；C-Type 已修为 98 个独立墙面实体。不要把 `part_of` 同组件组误认为会一起 Hide。

## 空间语义：Space / Region

| 控件 / 信息 | 做什么 / 什么时候用 | 边界 |
| --- | --- | --- |
| **Import spatial semantics** | 导入 project 与 Space Registry，任务需要房间/区域上下文时使用 | 需要匹配 design、源 revision/SHA 和坐标；不是自动从 mesh 重建房间 |
| **Clear semantics** | 清除空间证据和关联可信结果，重新准备资料时用 | 不改 Proxy 几何或 source；依赖空间节点的关系结果也可能 unavailable |
| Readiness | `READY`、`PARTIAL`、`BLOCKED_FOR_SPATIAL_CONTEXT` 描述资料/审核/覆盖完整度 | 不表示每个对象都已分类，也不保证某个点击点一定可解析 |
| 点击点结果 | `resolved`、`ambiguous`、`unresolved`、`unavailable` 及包含区域 | 独立于 Entity；candidate 区域不是已确认归属 |
| **Semantic diagnostics** | 展开查看候选审核、区域重叠、未覆盖层高、来源不匹配及补充动作 | 不自动批准区域；不能靠对象名称或 `room_id` 覆盖缺口 |

Pointer 选择才提供真实点击点。点击 Entity 列表会清除 hit，不能把 bounds 中心当作用户点击的位置。

## Relationships

| 控件 / 信息 | 做什么 / 什么时候用 | 边界 |
| --- | --- | --- |
| **Import relationship graph** | 导入来源明确的 typed graph，任务需要组件/连接关系时用 | 不按距离自动建立 adjacency/connected_to；空间节点需要匹配 registry |
| **Clear graph** | 清空关系图和信任状态，替换或排查错误资料时用 | 不改变物体或 Space Registry |
| 关系行 | 显示主语、关系类型、对象/端点和 `verified / candidate / rejected` | verified 只确认该条声明，不推出其他关系；rejected 不是可用事实 |
| **Relationship readiness / gaps** | 查看组件层级、物理连接、空间相邻、过渡图各自缺口 | `READY/PARTIAL/BLOCKED` 属于该能力；与空间 readiness 不是一个状态 |
| unavailable / truncated | 当前对象未映射、来源不匹配/资料缺失，或邻域达到上限 | 缺关系不证明没连接；truncated 不能声称列出的关系完整 |

`part_of`、`same_component_group`、`connected_to`、`embedded_in`、`supports`、`adjacent_to`、`opens_to`、`accesses`、`transition_between` 分别表达不同事实。不能从同组件组推断直接连接，也不能从近距离推断邻接。

## Entities 与 Inspector

| 信息 | 用途 | 边界 |
| --- | --- | --- |
| **Entities** search | 按 global ID、native object ID 或 semantic type 搜索；行选择可定位隐藏对象 | 不搜索整个权威 source；显示的是当前 full/task Proxy |
| **Inspector** | 看已选实体身份、版本、authority、mutable、world transform 和 bounds | 回答“哪个对象”，不替代空间解析或关系证据 |
| `global_id` | 稳定实体身份，跨导出追踪 | 不能靠名字相同重建或复用 ID |
| `native_object_id` | 当前绑定源中的精确 locator，如 Blender 对象名 | 不是跨工具的全局身份；派生墙段有其 review snapshot 中的原生对象 |
| `source_resource_id / source_revision` | 核对属于哪个来源和版本 | 新版本必须重新匹配 hash/registry，而不是只改文字 |
| `authority: derived` | Proxy 表示层；`authority_level` 是语义/设计权威词汇 | 不是把源也改为 derived，不授予修改权限 |
| `mutable` | 源策略是否允许 intent 修改 | true 仍不是授权；false 也不妨碍 viewer Hide/Ghost |
| `room_id` | 原始 entity metadata，可能是 unassigned | 不能充当 V0.4 的空间边界或点击点归属 |

例如岛台台面可确定 native ID，但 Space / Region 仍 unresolved，Relationships 也可能 unavailable。这三项并不矛盾。

## Handoff / 输出与 intent

| 控件 | 做什么 / 什么时候用 | 边界 |
| --- | --- | --- |
| **Copy ContextPacket** | 复制结构化 JSON：selection、来源/版本/SHA、实体、当前 camera、hit、空间与关系状态 | 不自动发送给 AI；不含临时 Hide/Ghost ID 列表，不是编辑授权 |
| **Copy AI Handoff** | 复制 ContextPacket 加“按包工作、保留未知状态”等提示，直接交给 AI | 不执行 agent、Blender 或设计修改；具体任务另由你说明 |
| **Export ContextPacket** | 请求下载相同上下文 JSON，用于留档/文件交接 | 下载受浏览器行为影响；没有文件时可 Copy ContextPacket |
| **Copy handoff text** | Clipboard denied 时显示的备用复制控件；也可手动复制可见 fallback 文本 | 只在 fallback 场景出现，不是另一种 AI 功能 |
| **Emit transform intent** | 用 X/Y/Z 输入生成 proxy-world 米单位平移请求 | request-only；网页不移动模型；选到 immutable 实体时禁用 |
| **Download intent** | 在 intent 生成后下载该请求 | 不执行请求；adapter 仍需授权/版本/hash/native ID/mutable 校验 |
| **Download event log** | 导出最近最多 100 个事件，排查选择或交接过程 | 不是永久日志，也不是 source 操作历史 |

## 已有 View Handoff / Camera Bookmark

本轮只核对并说明已实现的 maintenance 功能，没有新增相机系统。

| 控件 | 做什么 / 什么时候用 | 边界 |
| --- | --- | --- |
| **Lock view / Unlock view** | 固定/解除浏览器镜头导航及保存画幅，构图确定后使用 | 不保存书签或创建 Blender Camera |
| View name + **Save View** | 保存当前 camera、来源、hidden/ghost 及 reference preview，命名后交接 | 是快照；再调镜头/可见性后需重存；当前只支持已声明 Blender Z-up source 的 source-space 导出 |
| **Restore saved view** | 恢复精确来源匹配的最近本地书签及覆盖状态，并锁定 | 每个精确来源在本地只保存最新一份；换 revision 不自动套用 |
| **Import Camera Preset** | 导入外部保存的同源 preset JSON | 不匹配的 design/resource/revision/SHA 或未知覆盖 ID 会拒绝 |
| **Copy View Handoff** | 复制已保存数值相机、source-space pose 与覆盖状态 | 不是复制之后未重存的活动镜头；不自动渲染 |
| **Export Camera Preset** | 显示 **Download camera preset JSON** 和 **Download reference preview PNG** 两条链接，分别下载 | 图片用于视觉确认；数值用于复现，二者不代替几何验收 |

详细数据与已有离线 Blender 使用命令见 [view-handoff](view-handoff.md)。正常对象任务用 Copy AI Handoff；要精确机位和可见性，另附 View Handoff。

## 常见问题

- 所有墙一起变透明：检查 selected global ID 是否为整体墙壳；修复导出的交互边界，不能靠 Show all 把它变成独立墙。
- Frame 没效果：确认有选择，并先 Unlock view；Frame 不改变模型。
- 无房间归属：补充匹配、已审核的区域边界/层高；不要猜 `room_id`。
- 关系不可用：看 diagnostics，可能未映射或缺少匹配 Space Registry；不只看“已导入”提示。
- 源更新后预设拒绝：旧 preset 的 SHA 是旧源；不要关闭校验来复用。
- 导入失败：核对文件对与完整来源。Proxy 失败保留旧有效场景；semantics/graph 失败清除旧可信结果。
- 页面按钮不符：确认当前 dev server 的 checkout/commit；版本标题相同不代表所有 maintenance 功能已在 main 合并。

新项目步骤见 [PROJECT_ONBOARDING](PROJECT_ONBOARDING.md)，真实工作流见 [WORKFLOW](WORKFLOW.md)。
