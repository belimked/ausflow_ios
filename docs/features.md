# AusFlow iOS — 功能清单 (Feature Inventory)

> 司机端 iOS App，用于记录隔油池（grease trap）清运。本清单**由源码梳理**（`src/`），而非需求文档，随版本更新请同步修订。
>
> 技术栈：Expo SDK 58 · React Native 0.88 · React 19 · Expo Router · TypeScript
> 后端：AusFlow API（当前指向 **UAT** — `src/lib/config.ts`）
> 最后核对：2026-10-21（含移植计划 Phase 0–7；部分功能需要后端 `feat/hauler-app-support` 部署到 UAT）

## 目录

- [0. 平台与基础能力](#0-平台与基础能力)
- [1. 登录与会话](#1-登录与会话)
- [2. 角色与权限](#2-角色与权限)
- [3. 作业身份设置（Setup）](#3-作业身份设置setup)
- [4. Today（首页/仪表盘）](#4-today首页仪表盘)
- [5. 扫码（Scan）](#5-扫码scan)
- [6. 设备详情（Device）](#6-设备详情device)
- [7. 清运作业（开始/完成/取消）](#7-清运作业开始完成取消)
- [8. 清运详情与回执（Job）](#8-清运详情与回执job)
- [9. Pickups（清运历史）](#9-pickups清运历史)
- [10. Devices（设备列表）](#10-devices设备列表)
- [11. Me（我）](#11-me我)
- [12. 数据同步与一致性](#12-数据同步与一致性)
- [13. 定位与 GPS 规则](#13-定位与-gps-规则)
- [14. 暂未实现 / 已砍功能](#14-暂未实现--已砍功能)

---

## 0. 平台与基础能力

| 功能 | 说明 | 代码位置 |
|---|---|---|
| 原生 Tab 导航 | Today / Pickups / Devices / Me 四个底部 Tab，SF Symbols 图标 | `src/app/(tabs)/_layout.tsx` |
| 路由守卫 | 按登录态切换：未登录只到 login；登录后进入 (tabs) 及各栈屏 | `src/app/_layout.tsx` |
| 模态屏 | 扫码为全屏模态，Setup 为普通模态 | `src/app/_layout.tsx` |
| 环境标识 | 登录页/首页显示当前环境标签（UAT） | `src/lib/config.ts` |
| 下拉刷新 | Today / Devices / Pickups 均支持 | 各屏 `RefreshControl` |
| 触感反馈 | 扫码成功/失败、体积步进、完成清运 | `expo-haptics` |

## 1. 登录与会话

| 功能 | 说明 | 代码位置 |
|---|---|---|
| 账号密码登录 | **用户名** + 密码（与 AusFlow web 后台同一账号） | `src/app/login.tsx` |
| 显示/隐藏密码 | 眼睛图标切换 | `login.tsx` |
| 记住用户名 | 开关（默认开）记住用户名，不记密码；存 SecureStore | `login.tsx` |
| 忘记密码 | 输入用户名或邮箱 → 后端向账号邮箱发一次性重置链接（1 小时），在浏览器中重置 | `login.tsx`、`api.ts` `forgotPassword` |
| 输错锁定 | 连续 3 次输错锁 15 分钟（后端），显示后端提示；重置密码或管理员改密码即解锁 | 后端 `/login` |
| My details | 改名字、邮箱、密码；必须输入当前密码 | `src/app/details.tsx`、`store.tsx` `updateDetails` |
| 错误提示 | 空值校验、服务端错误、网络不可达均有文案 | `login.tsx` / `api.ts` |
| 会话持久化 | token + user 存入 `expo-secure-store`，重启自动恢复并拉数据 | `store.tsx` |
| 自动登出 | 任意请求返回 401 → 清会话 + 提示"会话已过期，请重新登录" | `store.tsx` `load()` |
| 手动登出 | Me 页，二次确认 | `profile.tsx` |


## 2. 角色与权限

| 功能 | 说明 | 代码位置 |
|---|---|---|
| 可写角色 | `admin` / `ops` / `authority` 可记录清运 | `store.tsx` `canWrite` |
| 只读角色 | `user` 为只读：扫码/开始清运入口禁用，提示"账号为只读" | `(tabs)/index.tsx`、`device/[id].tsx` |
| 角色展示 | Me 页显示角色徽章（Admin / Operations / View only） | `profile.tsx` |

## 3. 作业身份设置（Setup）

记录清运前必须先选定"以谁/哪台车作业"。

| 功能 | 说明 | 代码位置 |
|---|---|---|
| 三步选择 | 运输公司 → 司机 → 车辆 | `src/app/setup.tsx` |
| 公司过滤 | 仅列出 `active` 且类型含 `transport` 的公司 | `setup.tsx` `isTransport` |
| 司机/车辆过滤 | 仅列出该公司下 `active` 的司机、车辆 | `setup.tsx` |
| 单项自动选中 | 公司下只有一个司机/车辆时自动选中 | `setup.tsx` `pickCompany` |
| 扫车辆贴纸上车 | 扫 `VH…` 车辆 QR（或手动输入）→ 带入车辆所属公司；当前司机属于该公司则保留，公司只有一个在岗司机则自动选 | `scan.tsx` → `setup.tsx`、`lib/profile.ts` `joinVehicle` |
| 按车牌找车 | 搜索全部在用运输公司的在用车辆（忽略空格/大小写），点选即带入公司和车辆 | `setup.tsx`、`lib/profile.ts` `findVehiclesByPlate` |
| 换车提醒 | 原车仍有余量时提示"余量留在原车，直到卸料或转料"，确认后才换 | `setup.tsx` `save` |
| 车辆信息 | 显示车牌、大/小车、罐容量（L） | `setup.tsx` |
| 按用户持久化 | profile 按 `profile_<userId>` 存入 SecureStore | `store.tsx` `setProfile` |
| 空态引导 | 无 active 司机/车辆时提示到 web 后台维护 | `setup.tsx` `EmptyState` |

## 4. Today（首页/仪表盘）

| 功能 | 说明 | 代码位置 |
|---|---|---|
| 问候语 | 按时段 早上/下午/晚上 + 司机名 | `(tabs)/index.tsx` `greeting` |
| 作业身份卡 | 显示当前司机·车牌·公司，点按进入 Setup | `index.tsx` |
| 扫码入口 | 大按钮；未设身份则先去 Setup；只读账号禁用 | `index.tsx` |
| 进行中清运卡 | 若本司机有进行中清运：显示设备、已用时（实时计时）、"完成清运"按钮 | `index.tsx` + `useNow` |
| 车上余量 | 当前车辆余量 / 罐容量进度条，≥90% 标红；点按进入车载清单；有余量时并排显示 "Offload at facility" 和 "Transfer to truck" 两个按钮；扫码提示同时提醒可扫另一台车转料 | `index.tsx` `OnBoard` |
| 统计三联 | 今日完成数、今日收集总量(L)、逾期设备数 | `index.tsx` `Stat` |
| Due next | 即将到期的前 5 台设备（排除进行中） | `index.tsx` |
| Completed today | 今日已完成清运列表 | `index.tsx` |

## 5. 扫码（Scan）

| 功能 | 说明 | 代码位置 |
|---|---|---|
| 相机扫 QR | `expo-camera`，仅识别 QR | `src/app/scan.tsx` |
| 取景框 UI | 四角框 + 遮罩 + 提示文案 | `scan.tsx` |
| 手电筒 | 开关切换 | `scan.tsx` `torch` |
| 手动输入 | 输入 QR / 标签 / 设备 ref（如 DV539135） | `scan.tsx` `ManualEntry` |
| 权限处理 | 未授权时引导：允许相机 / 打开设置 / 改为手动输入 | `scan.tsx` |
| 码解析 | 支持 `http://QR2id.net/?X@<code>` 取 `@` 后编码；匹配 ref / qr / 多标签 | `lib/codes.ts` `findDeviceByCode` |
| 通用识别 | 同一扫码入口识别设备（→设备页）、处理设施牌（→卸料）、车辆贴纸（→上车；自己车上有料时让司机选"换车"或"转料"）；从 Setup / 卸料 / 转料进入时只接受对应类型 | `lib/codes.ts` `resolveCode`、`lib/scan.ts` `scanAction`、`scan.tsx` |
| 防重触发 | 扫中后锁定 1.8s，避免重复跳转 | `scan.tsx` `locked` |
| 未找到反馈 | 错误触感 + Toast"未找到对应设备" | `scan.tsx` |
| 成功跳转 | 命中设备 → 跳设备详情 | `scan.tsx` → `device/[id]` |

## 6. 设备详情（Device）

| 功能 | 说明 | 代码位置 |
|---|---|---|
| 设备头 | 标题（AKA/位置名/ref）、类型、废物类型 | `src/app/device/[id].tsx` |
| 状态胶囊 | 进行中 / 到期徽章、设备状态、距当前位置多少米 | `device/[id].tsx` |
| 服务横幅 | 下次服务日期、上次服务、频率（周），按逾期/将到期配色 | `device/[id].tsx` + `dueState` |
| 关键指标 | 容量 / 频率 / 风险 / 审批类别 四格 | `device/[id].tsx` `Tile` |
| 位置信息 | 位置名+地址、"在哪找到它"、备注、责任运输公司 | `device/[id].tsx` |
| 导航 | 有坐标时"在 Apple Maps 打开" | `device/[id].tsx` `directions` |
| 最近清运 | 该设备最近 5 条已完成清运 | `device/[id].tsx` |
| 动作按钮（上下文相关） | 开始清运 / 完成（本人进行中）/ 他人进行中 / 先完成你当前清运 / 去设置身份 | `device/[id].tsx` `action` |
| 非 Active 设备确认 | 设备非 Active 时开始清运需二次确认 | `device/[id].tsx` `start` |
| 授权设备 | 只能对**本公司负责**的设备作业：扫到其他公司（或未分配公司）的设备时提示 "Not an authorised device"；设备页显示红色提示且无开单按钮；命令层同样拒绝 | `lib/scan.ts`、`device/[id].tsx`、`commands.ts` `readyToWork` |
| 定位预取 | 设备页、完成页、转车页、卸货页打开即在后台定位一次（首次申请权限）。Start pickup、Service only、Transfer、Offload 提交时直接拿手头坐标，不等待，没有则记 No GPS；Finish pickup 直接拿后台坐标，没有时才向 GPS 请求一次，最多等 2s | `geo.ts` `useLocationFix` |
| 问题区块 | 列出该设备未关闭的问题（分类、描述、日期、上报人）；可写账号可"上报问题" | `device/[id].tsx`、`lib/issues.ts` |
| 仅服务不收料 | 记录"已服务但未收料"：生成 0 L、`Service only` 的已完成记录，更新上次服务并写变更日志（记录方式待客户确认） | `device/[id].tsx` `recordService`、`commands.ts` `planServiceOnly` |
| 进场距离预取 | 进入页面静默取最近已知定位，用于显示"多少米外" | `device/[id].tsx` + `quietCoords` |

## 7. 清运作业（开始/完成/取消）

核心业务逻辑集中在 `store.tsx`。

| 功能 | 规则 | 代码位置 |
|---|---|---|
| 开始清运 `startJob` | 需已选身份；设备须存在；该设备无进行中清运；本司机无其他进行中清运；记录开始 GPS、距设备距离、默认废物类型、状态=ongoing | `store.tsx` `startJob` |
| 完成清运 `finishJob` | 录入体积、备注；记录结束 GPS；计算距离与标记；更新设备 `lastService` 并写一条变更日志（ChangeLog）；状态=done | `store.tsx` `finishJob` |
| 取消清运 `cancelJob` | 删除进行中清运（仅限误开场景） | `store.tsx` `cancelJob` |
| 客户端生成 ID | `PK####` 清运、`CL####` 变更日志；用 seq + 已有 ID 取最大防重 | `store.tsx` `nextId` |
| 唯一进行中约束 | 每司机同时只能有一单；每设备同时只能有一单（提交前再校验） | `startJob` |

## 8. 清运详情与回执（Job）

`src/app/job/[id].tsx` 一屏三态：

| 状态 | 功能 |
|---|---|
| **完成表单**（本人进行中且可写） | 废物类型选择（设备类型优先 + 常见类型，显示 EPA 代码）；计划目的设施（可选，离设备最近的 4 个）；照片（可选，以 `pickup/after` 上传，计入照片数）；体积输入：±50 步进、按容量生成 25/50/75/100% 预设；超容量红色警示；备注（≤500 字）；提示完成时记录定位、>200m 会被标记；底部"完成 · N L"按钮；"取消清运"（二次确认，destructive） |
| **成功页** | 大对勾、设备名、体积、在场时长、距设备距离、标记胶囊；"扫下一台" / "回到 Today" |
| **只读详情** | 进行中/已完成状态、体积、标记、时间、司机、车辆、距离、废物类型、备注、跳转设备 |

## 8a. 问题上报（Report a problem）

| 功能 | 说明 | 代码位置 |
|---|---|---|
| 分类 | 挡板损坏 / 无冲洗龙头 / 停业装修 / 无法进入 / QR 缺失 / 其他（与 web 一致） | `src/app/issue/[deviceId].tsx` |
| 描述 | 选"其他"时必填，最多 500 字 | 同上、`commands.ts` `planReportIssue` |
| 照片 | 拍照或相册，最多 5 张；压到 1600px JPEG 0.82，超过 1.1MB 自动降级重试；以 `issue` 类型上传 | `components/PhotoPicker.tsx`、`lib/photo-file.ts`、`lib/photos.ts` |
| 写入 | 写 `reportedIssues`（`RI…`，状态 open，来源 App）；照片上传失败不影响问题本身，会提示失败张数 | `store.tsx` `reportIssue` / `uploadPhotos` |

## 8b. 卸料、转料、车载清单

| 功能 | 说明 | 代码位置 |
|---|---|---|
| 卸料 (Offload) | 扫设施牌或选附近设施（按距离）→ 确认车辆（可换）→ 交付量（默认车上余量，可改；与余量相差 >10% 提醒）→ 废物类型（默认车上占比最大的）→ 写 `unloads`（`UL…`，记录实际 GPS）；成功页显示车上剩余 | `src/app/offload.tsx`、`commands.ts` `planUnload`、`lib/delivery.ts` |
| 设施位置提醒 | 当前位置距设施 >200m 时提醒 | `offload.tsx` |
| 转料 (Transfer All Waste) | 入口：首页余量卡片 / 车载清单的 "Transfer to truck"，或车上有料时扫另一台车的贴纸。页面说明用途（小车倒进大罐车），接收车列表大车优先并标注车型与罐容量；扫目标车贴纸或选本公司其他车 → 显示两车转后载量 → 整车余量全部转出，写 `transfers`（`TR…`）；超过目标车罐容量时警告并二次确认；只能转给本公司车辆 | `src/app/transfer.tsx`、`commands.ts` `planTransfer` |
| 车载清单 (Show) | 当前装载周期内的收料和转入，起始时间；可去卸料 / 转料 | `src/app/vehicle.tsx`、`lib/load.ts` `currentCycle` |
| 收料去向 | 清运详情显示"已送到某设施（时间）"或"仍在某车上" | `job/[id].tsx`、`lib/load.ts` `pickupDelivery` |
| 规则 | 有进行中清运时不能卸料/转料 | `commands.ts` `readyToMoveLoad` |

## 8c. 拖车 / Dog（DEMO，仅本地）

> 后端和 web 都没有拖车概念。按 2026-10-21 的决定先在 App 内做演示，开关 `FEATURES.trailers`（`src/lib/config.ts`），`'off'` 即隐藏。

| 功能 | 说明 | 代码位置 |
|---|---|---|
| 演示拖车 | 按公司固定生成 2–3 个（`TL ###`，8,000/10,000 L） | `lib/mock/trailers.ts` |
| 挂车 / 摘车 | 首页"拖车 DEMO"卡片；可挂多个；摘车时有余量会提示；状态存本机 | `components/Trailers.tsx`、`lib/trailers.tsx` |
| 收料到拖车 | 完成表单"装入"选牵引车或拖车；**服务器上仍记在牵引车**，拖车分配只存本机 | `job/[id].tsx` |
| 拖车余量 | 分配到该拖车且仍在牵引车当前装载周期内的收料之和；牵引车卸料/转料后自动清零 | `lib/mock/trailers.ts` `trailerLoads` |

## 9. Pickups（清运历史）

| 功能 | 说明 | 代码位置 |
|---|---|---|
| 分类 | 收料 / 卸料 / 转料（Tab 名改为 History） | `src/app/(tabs)/jobs.tsx` `Kind` |
| 范围切换 | 我的 / 我司 / 全部 | `src/app/(tabs)/jobs.tsx` `Scope` |
| 按天分组 | 分组标题 + 每日台数与总量(L) | `jobs.tsx` |
| 进行中分区 | 置顶单独一组 | `jobs.tsx` |
| 列表上限 | 已完成取最近 150 条 | `jobs.tsx` |
| 司机标注 | 非"我的"范围时在行内显示司机 | `jobs.tsx` `showDriver` |

## 10. Devices（设备列表）

| 功能 | 说明 | 代码位置 |
|---|---|---|
| 全文搜索 | ref / aka / qr / 标签 / 位置描述 / 位置名 / 地址 | `src/app/(tabs)/devices.tsx` |
| 我司筛选 | 仅本公司设备（有身份时默认开） | `devices.tsx` `mineOnly` |
| 逾期筛选 | 仅逾期设备 | `devices.tsx` `overdueOnly` |
| 到期筛选 | 7 天 / 30 天内到期（含已逾期），对应老 Service List 的 Service Due Before | `devices.tsx` `dueDays`、`format.ts` `dueWithin` |
| 附近排序 | 取当前定位，按距离升序；无定位时提示 | `devices.tsx` `toggleNearby` |
| 默认排序 | 无"附近"时按下次服务日期升序 | `devices.tsx` |
| 快捷扫码 | 顶部扫码按钮（可写时） | `devices.tsx` |

## 11. Me（我）

| 功能 | 说明 | 代码位置 |
|---|---|---|
| 用户卡 | 头像首字母、显示名、@用户名、角色徽章 | `src/app/(tabs)/profile.tsx` |
| 作业身份 | 当前司机/车辆/公司，点按去 Setup；当前车辆余量 | `profile.tsx` |
| 刷新数据 | 手动刷新，显示上次更新时间、设备数、设施数 | `profile.tsx` |
| 环境信息 | 显示环境标签与 API 域名 | `profile.tsx` |
| App 版本 | 读取 `expoConfig.version` | `profile.tsx` |
| 登出 | 二次确认 | `profile.tsx` |

## 12. 数据同步与一致性

| 机制 | 说明 | 代码位置 |
|---|---|---|
| 离线模式 | 启动先读本机快照（离线可打开）；连不上服务器时写操作进本机队列并立即显示（临时编号 `local-…`）；联网/启动/提交后/手动按序补发，补发时基于最新数据重新分配正式编号并改写后续引用；按"发生时间"识别已到达服务器的请求、不重复提交；服务器拒绝的记录转为"同步问题"（含依赖它的记录），可重试或放弃，不静默丢弃；队列和问题按用户存本机，登出/会话过期不丢 | `lib/offline/*`、`lib/outbox.ts`、`store.tsx` |
| 同步状态 | 首页顶部"OFFLINE / WAITING · N / SENDING"；我 → Sync：状态、待发数、立即发送、同步问题列表 | `(tabs)/index.tsx`、`(tabs)/profile.tsx` |
| 全量拉取 | 登录/刷新时 `GET /state`；App 读取 公司/位置/设备/司机/车辆/设施/清运/转料/卸料/问题上报 + 各类 seq 序号 | `api.ts` `fetchState` |
| 命令式写入 | 每个写操作是一个带发生时间的命令（`lib/commands.ts`），经写入层（`lib/outbox.ts`）规划为 `/sync` 内容。在线时只向服务器取 `/state/summary`（编号计数 + 进行中的清运，几 KB）做冲突校验，提交后把结果合并进本机数据，不再前后各下载一次全量数据 | `commands.ts` `outbox.ts` |
| 后台同步 | 写操作完成 1.5 秒后、App 回到前台时、以及每 5 分钟，静默刷新全量数据（不弹刷新转圈） | `store.tsx` `refreshQuietly` |
| 余量与去向 | 车上余量、装载周期、收料去向（已卸/车上）与 web 控制台同一算法 | `lib/load.ts` |
| 增量提交 | `POST /sync`，带 upserts / deletes / seq | `api.ts` `sync` |
| 写前刷新 | 每次写操作先 `fresh()` 拉最新，再做"已占用/已完成"等校验，避免并发冲突 | `store.tsx` `fresh` |
| 内存索引 | 以 Map 建设备/位置/司机/车辆/公司/清运索引，及"按设备的进行中清运"映射 | `store.tsx` `useIndex` |
| 错误分类 | 网络不可达、HTTP 非 2xx、401 过期分别处理 | `api.ts` / `store.tsx` |


## 13. 定位与 GPS 规则

| 规则 | 说明 | 代码位置 |
|---|---|---|
| 权限 | 仅"使用期间"定位（非后台/Always） | `app.json` / `geo.ts` |
| 取点 | 监听 GPS，首个精度 ≤100 m 的样本即返回，最多看 4s 后取已见最好的样本；都没有则回退到 5 分钟内的最近已知位置 | `geo.ts` `currentCoords` |
| 静默取点 | 设备页用 10 分钟内已知位置显示"多少米外"，不弹权限 | `geo.ts` `quietCoords` |
| 距离计算 | Haversine 公式，米 | `geo.ts` `distanceM` |
| 标记 `location` | 完成时距设备 > **200m**（`LOCATION_FLAG_METRES`，与 web 后台一致） | `config.ts` / `store.tsx` |
| 标记 `nolocation` | 完成时取不到定位 | `store.tsx` `finishJob` |
| 标记 `capacity` | 录入体积 > 设备容量 | `store.tsx` `finishJob` |
| 到期判断 | `nextService = lastService + freqWeeks` → 逾期/≤7天将到期/正常/无计划 | `format.ts` `dueState` |

## 14. 暂未实现 / 已砍功能

相对老 WasteID（QR2id App）司机端，以下功能当前**未包含**：

- 拖车/挂车（Trailer/Dog）的真实数据（目前仅本地演示，见 8c）
- App 内管理功能（公司/用户/车辆维护、消费单复核、CSV 导出）——均在 web 后台

---

_本文件由代码梳理生成，若实现变更请同步更新对应条目。_
