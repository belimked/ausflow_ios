# AusFlow iOS 1.1.0 · 真机测试清单 / Device test checklist

安装页 / Install page: <https://belimked.github.io/ausflow_ios/> · 连接 **UAT**，数据不会进生产 / talks to **UAT**, nothing reaches production.

测试账号由管理员提供（UAT 账号，不是生产账号）。/ Ask the admin for a UAT test account.

每一项：能完成就打 ✅，不能就记下 **手机型号、时间、做了什么、看到了什么**（截图最好）。
For each item tick ✅ or note **phone model, time, what you did, what you saw** (screenshot if possible).

## 1. 登录 / Sign in
- [ ] 用户名 + 密码登录；"记住用户名"开关有效 / Sign in; "Remember my username" works
- [ ] 故意输错密码 3 次 → 提示账号锁定 15 分钟 / 3 wrong passwords → locked for 15 min message
- [ ] "Forgot password?" → 账号邮箱收到重置链接，在浏览器里改密码后能用新密码登录 / reset link by email, new password works

## 2. 上车 / Join a vehicle
- [ ] 首页 "Choose driver & vehicle" → **扫车辆贴纸**（VH… 码）自动带出公司和车辆 / scan the vehicle sticker
- [ ] 按**车牌搜索**找车 / find the vehicle by registration
- [ ] 首页出现 "ON BOARD · 车牌" 余量卡片 / Today shows the on-board card

## 3. 收料 / Pickup
- [ ] 扫设备 QR（或手输设备码）→ 设备页 → "Start pickup" / scan device QR → Start pickup
- [ ] 完成：填体积、选废物类型、选计划目的设施、**拍 1 张照片**、填备注 → Complete / finish with volume, waste type, destination, 1 photo, note
- [ ] 完成后 web 后台（UAT）该清运记录能看到这张照片和计划目的设施 / the photo and destination show in the UAT web console
- [ ] 首页余量增加；车载清单（点余量卡片）里有这单 / on-board volume goes up; the pickup is in the on-board list
- [ ] "Service only · no waste collected" 能记录一次 0 L 服务 / service-only records a 0 L visit

## 4. 问题上报 / Report a problem
- [ ] 设备页 "Report a problem" → 选分类、写描述、**拍照** → 提交 / category, description, photo → submit
- [ ] web 后台该设备下能看到问题和照片 / problem and photo appear in the web console

## 5. 卸料与转料 / Offload and transfer
- [ ] 首页 "Offload waste" → 扫设施牌或选附近设施 → 确认量 → Deliver → 余量归零 / offload at a facility, on-board goes to 0
- [ ] 再收一单，然后 "Transfer to another vehicle" 转给本公司另一台车 / transfer the whole load to another company vehicle
- [ ] History 页的 Offloads / Transfers 分类能看到这两条 / both appear under History

## 6. 离线 / Offline
- [ ] 开飞行模式 → 扫码开单、完成（带照片）→ 首页顶部显示 OFFLINE · N / airplane mode → start and finish a pickup → "OFFLINE · N"
- [ ] 关飞行模式 → 自动变成 SENDING → 消失；"我" → Sync 显示 Up to date；web 后台能看到这单和照片 / back online → sent automatically, console shows it
- [ ] 离线时杀掉 App 重开，待发记录还在 / kill and reopen the app while offline, the queued pickup is still there

## 7. 拖车（演示）/ Trailers (demo)
- [ ] 首页 "TRAILERS · DEMO" 能挂一台拖车，收料时可选装入拖车 / attach a demo trailer, collect into it
- [ ] **确认**：这只是演示数据，不上传服务器；请反馈现场是否真的用拖车 / demo only — tell us whether trailers are really used

## 8. 账号 / Account
- [ ] "我" → "My details" 改名字 / 改密码（需当前密码）/ change name or password with the current password
- [ ] 登出后再登录 / sign out and back in

## 已知限制 / Known limits
- 拖车数据不上传服务器 / trailer data stays on the phone
- 离线时第一次打开需要之前联网登录过一次 / first launch needs one online sign-in
