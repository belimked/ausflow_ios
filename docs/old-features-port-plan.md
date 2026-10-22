# 老 WasteID 功能移植计划 (Old Features Port Plan)

> 目标：把老 WasteID Hauler App（`GAM_WasteID_user_guide_hauler.pdf`，Rev.2 2019）的司机端功能全部补到 AusFlow iOS。
> 现状清单见 [features.md](features.md)。本计划基于 2026-10-21 对 `ausflow-ios/src`、`web-prototype/server`、`web-prototype/src` 的代码核对。

## 0. 已确认的决定（2026-10-21）

| # | 问题 | 决定 |
|---|---|---|
| 1 | 拖车 / Dog | **App 内先做假数据演示**，不改后端；之后跟客户确认是否真做 |
| 2 | 离线模式 | **要做** |
| 3 | 司机账号需 `ops` 角色才能写 | 可以 |
| 4 | 范围 | **全部老功能都要** |

## 进度

| Phase | 状态 | 备注 |
|---|---|---|
| 0 地基 | ✅ 完成 | 读取扩展表、`load.ts`、命令层 + 在线写入层；单元测试 + Maestro 工作流（6 组功能测试 2026-10-22 全部通过，见 README › Tests） |
| 1 上车 / 收料补齐 | ✅ 完成 | 扫车辆贴纸 / 按车牌上车、换车余量提醒、废物类型、仅服务、首页余量卡片；计划目的设施（后端 `pickups.planned_facility_id`，待 UAT 部署） |
| 2 现场采集 | ✅ 完成 | 照片选择/压缩/上传、问题上报（含照片）、设备页问题列表；清运照片（后端放开 `pickup` 照片，待 UAT 部署） |
| 3 载料闭环 | ✅ 完成 | 卸料（扫设施牌/附近设施、量差 >10% 提醒、距设施 >200m 提醒）、整车转料（超容量确认、仅限本公司车辆）、车载清单、收料去向、History 增加卸料/转料。量差阈值 `UNLOAD_DIFF_WARN` 待客户确认 |
| 4 拖车（假数据） | ✅ 完成 | `FEATURES.trailers = 'mock'`；按公司固定生成演示拖车、挂/摘、收料可选装入拖车（仅本机）、拖车余量随牵引车卸料清零；所有界面标 DEMO |
| 5 离线 | ✅ 完成 | 本机快照（expo-file-system）、离线队列 + 临时编号、按序补发并改写引用、按发生时间防重复提交、冲突转"同步问题"（重试/放弃）、照片随队列上传、网络恢复自动补发（expo-network）、首页/我 页同步状态。冲突策略：不强行写入，保留在本机由司机处理 |
| 6 账号类 | ✅ 完成（待 UAT 部署） | 记住用户名、忘记密码（邮件一次性链接 + web 重置页）、My details（改名/邮箱/密码）、连续 3 次输错锁 15 分钟。后端在 `AusFlow_Test` 的 `feat/hauler-app-support`，已合入 `uat` |
| 7 管理功能 | 🟡 部分 | Service List 到期筛选（7/30 天）✅。增删用户/车辆、编辑公司按建议留在 web，待客户确认 |

## 1. 关键结论

**后端已基本具备，主要是 iOS 客户端的工作。** web 控制台只做审阅，作业记录（收料、转料、卸料、问题、照片）本来就应该由移动端创建。`web-prototype/server` 已有这些表，并已经通过 `/state` + `/sync` 同步：

| 老功能概念 | 后端实体 | 状态 |
|---|---|---|
| 收料 (Collection) | `pickups` | ✅ iOS 已在写 |
| 卸料 / 排放 (Offload/Discharge) | `unloads` {vehicleId, facilityId, waste, volume, at, lat, lng} | ✅ 已有，iOS 未读未写 |
| 车间转料 (Transfer) | `transfers` {fromVehicleId, toVehicleId, volume, at, lat, lng} | ✅ 已有，iOS 未读未写 |
| 处理设施 + QR 牌 | `facilities` {name, address, lat, lng, qr(`FA…`)} | ✅ 已有，iOS 未读 |
| 车辆容量 / 车辆 QR | `vehicles.tank` / `vehicles.qr`(`VH…`) | ✅ 已有 |
| 问题上报 | `reportedIssues` {deviceId, category, description, reportedBy, at, status, source} | ✅ 已有，iOS 未读未写 |
| 照片 | `photos` + `GET/POST/DELETE /photos` | ⚠️ 已有，但**不允许挂到 pickup/unload**（见 §6） |
| 车上余量 / Consignment | 无实体，web 端由 pickups/transfers/unloads 派生（`web-prototype/src/store/db.js:202-339`） | 前端派生 |
| 上车 (Join Vehicle) | 无实体，iOS 本地 `WorkProfile` | 前端 |
| 拖车 / Dog | 无（前后端都没有） | **App 假数据** |

ID 前缀约定（与 web 一致）：`PK` 收料 · `TR` 转料 · `UL` 卸料 · `RI` 问题 · `CL` 变更日志 · `NT` 备注。

## 2. 架构调整（先于功能做）

### 2.1 数据层扩展
- `src/lib/types.ts`：新增 `Facility`、`Transfer`、`Unload`、`ReportedIssue`、`Photo` 类型；`AppData` 增加 `facilities / transfers / unloads / reportedIssues`。
- `src/lib/api.ts` `fetchState`：读取上述表（目前被丢弃）；新增 `listPhotos / uploadPhoto / deletePhoto`。
- `src/lib/store.tsx` `useIndex`：增加 facilities、按车辆分组的 transfers/unloads 索引。
- 新增 `src/lib/load.ts`：移植 `vehicleLoads`、`vehicleCycles`、`traceForward`、`pickupDeliveries`（web `db.js:202-298`），用于车上余量、车载清单和"已卸/未卸"状态。
- 新增 `src/lib/waste.ts`：移植 `WASTE_CODES` + `wasteCodeOf`（web `wasteCodes.js`）。

### 2.2 统一写入层（为离线铺路）
现在 `startJob/finishJob/cancelJob` 各自执行"拉最新 → 校验 → `/sync`"。**新功能不要再复制这套写法**，统一走一个命令层：

```
src/lib/outbox.ts
  submit(command)  // command = { kind, payload, localIds, createdAt }
    在线：立即 flush
    离线：入队持久化，乐观更新本地 state
  flush()          // 拉最新 state → 分配正式 ID → 映射引用 → 校验 → /sync → 上传照片
```

Phase 0 先做"在线直通版"（行为与现在一致），Phase 5 再把传输换成离线队列。这样转料、卸料、问题、照片只需要写一次。

### 2.3 扫码多用途
`scan.tsx` 增加 `mode` 参数：`device | vehicle | facility | any`。按前缀识别：`VH…` 车辆、`FA…` 设施，其余按设备匹配（`findDeviceByCode`）。`any` 模式扫到什么就跳到对应流程（对应老 App 底部的通用 Scan 按钮）。

## 3. 功能清单与实现

量级：S ≤ 1 人日，M 2–3 人日，L ≥ 4 人日。

### Phase 0 — 地基
| 任务 | 文件 | 量级 |
|---|---|---|
| 读取 facilities/transfers/unloads/reportedIssues | `api.ts` `types.ts` `store.tsx` | S |
| 载量与链路派生 | 新 `lib/load.ts` | S |
| 写入层（在线直通） + 把现有 start/finish/cancel 迁移过去 | 新 `lib/outbox.ts`，改 `store.tsx` | M |

**验收**：现有功能行为不变；Me 页能看到设施数、当前车辆余量。

### Phase 1 — 上车与收料补齐
| 老功能 | iOS 实现 | 文件 | 量级 |
|---|---|---|---|
| 扫车辆 QR 上车 / 换车 (Join / Change Vehicle) | 首页"上车"卡片支持扫 `VH…`，自动带出公司；换车前若原车有余量，提示"转料"或"保留"。仍存本地 `WorkProfile`（后端无上车记录） | `scan.tsx` `setup.tsx` `(tabs)/index.tsx` | S |
| 按车牌上车 | Setup 列表增加车牌搜索 | `setup.tsx` | S |
| 收料选废物类型 | 完成表单加废物类型选择，默认取设备 `waste`，显示 EPA 代码（K110 等） | `job/[id].tsx` `lib/waste.ts` | S |
| 计划目的设施（可选） | 完成表单可选设施。**后端 `pickups` 无字段** → 加 `plannedFacilityId` 列（见 §6），或先写入 note | `job/[id].tsx` | S |
| 仅服务不收料 (Service Device) | 设备页增加"仅服务"：生成 volume=0 的 pickup，`waste='Service only'`，同样更新 lastService。**做法待客户确认** | `device/[id].tsx` `store` | S |
| 车上余量显示 | 首页 / Me 显示当前车辆余量和容量进度条（≥90% 标红） | `(tabs)/index.tsx` | S |

### Phase 2 — 现场采集
| 老功能 | iOS 实现 | 文件 | 量级 |
|---|---|---|---|
| 照片（拍照/相册） | 引入 `expo-image-picker`、`expo-image-manipulator`（用 `npx expo install`）；压到 1600px、JPEG 0.82（与 web `EntityPhotos.vue` 一致），保证小于 1.1MB；`POST /photos` | 新 `components/PhotoPicker.tsx`、`api.ts`、`app.json`（相册权限文案） | M |
| 收料备注 + 照片 | 完成后的成功页允许补充备注/照片（对应老 App 的 Add Note），并更新 `pickups.photos` 计数 | `job/[id].tsx` | S |
| 问题上报 (Report Issue / Service Problem) | 设备页"上报问题"：分类 `baffle_damaged / no_washdown_tap / premises_closed / no_access / qr_missing / other` + 描述 + 照片（photo type=`issue`）→ 写 `reportedIssues`（`RI…`，source `App`） | 新 `app/issue/[deviceId].tsx` | M |
| 设备问题历史 | 设备页显示未关闭问题 | `device/[id].tsx` | S |

### Phase 3 — 载料闭环 (Chain of Custody)
| 老功能 | iOS 实现 | 文件 | 量级 |
|---|---|---|---|
| 卸料 (Offload / Deliver Waste) | 车上有余量时首页显示"卸料"。扫设施 `FA…`，或选附近设施（按距离）→ 确认车辆（错了就重新扫车）→ 确认总量（默认 = 当前余量，可调整，相差过大时提示）→ 写 `unloads`（`UL…`），GPS 取设施现场位置 → 成功页显示"车上已清空" | 新 `app/offload.tsx` | M |
| 设施位置警告 | 当前位置距设施超过 200m 时提示（对应老 App 的 Location Warning） | `offload.tsx` | S |
| 车间转料 (Transfer All Waste) | 扫目标车 `VH…` → 显示两车余量和目标车容量 → 确认 → 写 `transfers`（`TR…`）。超过目标车容量时警告（web 有 `transferOverCapacity` 告警） | 新 `app/transfer.tsx` | M |
| 车载清单 (Show onboard consignments) | 车辆页：当前余量、本轮 cycle 的收料与转入、每单"已卸/未卸"状态 | 新 `app/vehicle.tsx`，`lib/load.ts` | M |
| 收料去向 | 清运详情显示"已送达某设施 / 车上待卸"（web `pickupDeliveries`） | `job/[id].tsx` | S |
| 卸料 / 转料历史 | Pickups Tab 增加"卸料 / 转料"分段 | `(tabs)/jobs.tsx` | S |

### Phase 4 — 拖车 / Dog（假数据演示）
按决定 1，**不改后端，也不往服务器写拖车数据**。

| 项 | 实现 |
|---|---|
| 开关 | `src/lib/config.ts` 加 `FEATURES.trailers = 'mock'`，以后一行就能去掉或换成真实实现 |
| 假数据 | `src/lib/mock/trailers.ts`：按公司生成 2–3 个拖车（车牌、容量、`VH`风格 QR） |
| 挂车 / 摘车 | 首页车辆卡片显示已挂拖车（可挂多个），扫拖车 QR 或从列表选；状态只存在本地 |
| 收料到拖车 | 可以把收料目标切到拖车；**服务器上的 pickup 仍记在牵引车 `vehicleId` 上**，拖车分配只在本地显示 |
| 标识 | 拖车相关界面都显示"演示 / Demo"标记，避免被当成真实数据 |

量级：M。等客户确认真做时，需要后端加拖车类型/挂接关系、web 端跟进、`load.ts` 支持多车分仓（估算 L）。

### Phase 5 — 离线模式
| 项 | 实现 | 量级 |
|---|---|---|
| 本地快照 | `/state` 结果持久化到本地（数据量是 MB 级，**不能用 SecureStore**；用 `expo-sqlite` 或 `expo-file-system`，API 按 SDK 58 文档确认）；启动时先读快照再后台刷新 | M |
| 网络检测 | `expo-network` 监听连接状态；首页 / 顶栏显示"离线 / 同步中 / 待上传 N 条" | S |
| 离线队列 | `outbox.ts` 把命令持久化；离线时乐观更新本地 state，所有屏幕照常可用 | M |
| **临时 ID** | 离线创建的记录先用 `local-<uuid>`；flush 时拉最新 state，用 `nextId` 分配正式 `PK/TR/UL/RI/CL`，并改写引用（照片 entityId、changeLog 等）。**不能离线直接生成 `PK0042`**：两台手机会撞号，后端整行 upsert 会互相覆盖 | M |
| 冲突处理 | flush 时重新校验（例如设备已被别人开单、司机已有进行中清运）。现场已经发生的作业**一律保留**，冲突时打标记，并在"同步问题"列表提示，不静默丢弃 | M |
| 离线照片 | 照片文件先存本地，等对应记录拿到正式 ID 后再上传 | S |
| 定位 | GPS 本身不依赖网络；保留现有"5 分钟内最近已知位置"回退。暂不申请 Always 权限（老 App 要求 Always，新方案不需要） | — |
| 会话 | 离线时 token 过期（12h TTL）不能直接登出：保留队列，联网后要求重新登录再 flush | S |

量级合计：L（6–8 人日）。

### Phase 6 — 账号类（老手册 §2）
| 老功能 | 后端 | iOS | 量级 |
|---|---|---|---|
| Remember Me | — | 记住用户名 | S |
| 修改密码 / 资料 (My Details) | **缺**：只有 admin 能 `PATCH /users/:id` → 需要新增 `PATCH /me` | Me 页增加表单 | S（+后端 S） |
| 忘记密码 | **缺**：需要重置邮件接口（后端已有 `mailbox.js` 发信能力） | 登录页链接 | S（+后端 M） |
| 连续输错 3 次锁定 | **缺**：后端登录限流 | 显示提示 | 后端 S |

### Phase 7 — 管理功能（老手册 §5）
公司资料、用户管理、车辆管理、Consignment 复核、Offload 列表、Service List 在 web 控制台都已有完整实现。**建议 App 只做司机相关的只读部分**：

- 我的收料 / 卸料 / 转料历史 → Phase 3 已覆盖
- Service List（到期设备 + 筛选）→ 现有 Devices Tab 已覆盖，可补"到期区间"筛选（S）
- 增删用户 / 车辆、编辑公司 → 留在 web

> 如果客户要求 App 里也能管理，再单独评估（L）。

## 4. 工作量汇总

| Phase | 内容 | 人日 |
|---|---|---|
| 0 | 地基 + 写入层 | 2–3 |
| 1 | 上车 / 收料补齐 | 2–3 |
| 2 | 照片 + 问题上报 | 3–4 |
| 3 | 卸料 / 转料 / 车载清单 | 4–5 |
| 4 | 拖车（假数据） | 1.5–2 |
| 5 | 离线 | 6–8 |
| 6 | 账号类（含后端） | 2–3 |
| 7 | Service List 补筛选 | 0.5 |
| — | 联调、真机测试、Ad Hoc 发布 | 3–4 |
| | **合计** | **约 24–32 人日** |

顺序：0 → 1 → 2 → 3 是主线，每个 Phase 都可以单独发 Ad Hoc 给客户试用。4 可以随时插入（客户演示前做）。5 依赖 0 的写入层，建议放在 3 之后，避免新功能写完一遍再改。

## 5. 风险

| 风险 | 影响 | 对策 |
|---|---|---|
| `/state` 每次全量下发 | 离线快照和刷新都慢，数据大时更明显 | 短期接受；中期后端加 `since` 增量接口 |
| `/sync` 整行覆盖、后写者胜 | 离线 / 并发时可能覆盖别人的数据 | 临时 ID + flush 前拉最新；只 upsert 自己创建的行，避免回写整行设备 |
| 收料完成会回写整行 `devices`（更新 lastService） | 离线时可能用旧快照覆盖设备的其他字段 | flush 时基于最新 device 只改 `lastService` |
| 拖车假数据被误认为真实数据 | 客户混淆 | Demo 标识 + feature flag |
| 照片 base64 存 D1（单行 2MB） | 照片多时数据库膨胀 | 先按 1.1MB 上限；后续迁移到对象存储（R2） |
| 废物类型无主数据表 | 选项不统一 | 先用 EPA 代码表 + 设备现有值；需要的话后端加 wasteTypes 表 |

## 6. 需要的后端改动（`web-prototype/server`）

都很小，可以和 Phase 2 一起做：

1. `app.js:24` `PHOTO_KINDS` 增加 `pickup: ['before', 'after', 'photo']`、`unload: ['photo']`、`transfer: ['photo']`。
2. （可选）`pickups` 加 `planned_facility_id` 列 + migration（`/sync` 通过 `getTableColumns` 自动支持新列）。
3. Phase 6：`PATCH /me`、密码重置邮件、登录失败限流。
4. web `PickupDetail.vue:27-32` 目前用占位 SVG 显示照片，需要改成读取真实 `/photos?type=pickup`（不然 App 传上去 web 看不到）。

## 7. 待客户确认

- [ ] 拖车 / Dog 是否真实使用（决定 Phase 4 要不要做成真的）
- [ ] "仅服务不收料"的记录方式
- [ ] 计划目的设施是否必填 / 是否需要
- [ ] App 是否需要管理功能（Phase 7）
- [ ] 卸料量与车上余量相差多少需要拦截或打标
