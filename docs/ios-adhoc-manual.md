# AusFlow iOS 测试版手册 · AusFlow iOS Test Build Manual

> Ad Hoc distribution: from getting an iPhone's UDID to installing the app.
> Ad Hoc 分发：从获取 iPhone 的 UDID 到安装 App 的完整流程。

| | |
| --- | --- |
| App | AusFlow (UAT) |
| Bundle ID | `com.ausflow` |
| Apple Team ID | `8J42Q87M5P` |
| GitHub repo | `belimked/ausflow_ios` |
| Workflow | **iOS Ad Hoc** (`.github/workflows/ios-adhoc.yml`) |
| Install page · 安装页 | <https://belimked.github.io/ausflow_ios/> |
| Requirement · 系统要求 | iOS 16.4 or later · iOS 16.4 及以上 |

---

## 0. Overview · 流程总览

An Ad Hoc build only installs on iPhones whose UDID is listed in the provisioning profile used to sign it. Adding a new tester therefore always means: get UDID → register it → update the profile → rebuild → install.

Ad Hoc 版本只能安装在签名所用的描述文件（provisioning profile）里登记过 UDID 的 iPhone 上。所以每加一位测试人员，都要走一遍：获取 UDID → 注册设备 → 更新描述文件 → 重新构建 → 安装。

| Step · 步骤 | Who · 谁来做 | Where · 在哪里 |
| --- | --- | --- |
| 1. Get UDID · 获取 UDID | Tester · 测试人员 | iPhone + Mac/PC |
| 2. Register device · 注册设备 | Admin · 管理员 | developer.apple.com |
| 3. Update profile · 更新描述文件 | Admin · 管理员 | developer.apple.com |
| 4. Update GitHub secret · 更新 GitHub 密钥 | Admin · 管理员 | GitHub |
| 5. Rebuild · 重新构建 | Admin · 管理员 | GitHub Actions |
| 6. Install · 安装 | Tester · 测试人员 | iPhone Safari |

---

## 1. Get the iPhone UDID · 获取 iPhone 的 UDID

The UDID is **not** shown in the iPhone Settings app, and it is **not** the serial number or IMEI. Get it on the iPhone itself at **https://udid.tech** — no computer needed.

UDID **不会**显示在 iPhone 的「设置」里，也**不是**序列号或 IMEI。直接在 iPhone 上打开 **https://udid.tech** 获取，无需电脑。

What a UDID looks like · UDID 格式：

- iPhone XS / XR and later: 25 characters with one hyphen, e.g. `00008110-001A2B3C4D5E801E`
  iPhone XS / XR 及以后：25 位，中间一个连字符，如 `00008110-001A2B3C4D5E801E`
- Older models: 40 hex characters · 更早的机型：40 位十六进制字符

### Steps · 步骤

1. On the iPhone, open <https://udid.tech> in **Safari** (not Chrome / WeChat).
   在 iPhone 上用 **Safari** 打开 <https://udid.tech>（不要用 Chrome / 微信内置浏览器）。
2. Tap **Get My UDID**, then **Allow** to download the configuration profile, then **Close**.
   点「Get My UDID」，弹窗中点「允许」下载描述文件，再点「关闭」。
3. Open **Settings** and tap **Profile Downloaded** near the top. (If it is not there: **Settings → General → VPN & Device Management**.)
   打开「设置」，点顶部的「已下载描述文件」。（如果没有，进入「设置 → 通用 → VPN 与设备管理」。）
4. Tap **Install** (top right), enter the passcode, tap **Install** again.
   点右上角「安装」，输入锁屏密码，再点一次「安装」。
5. Safari opens udid.tech again and shows the **UDID**. Tap it / use the copy button to copy it.
   Safari 自动回到 udid.tech 并显示 **UDID**，点击或用复制按钮复制。

> The page shows ads for signing certificates and third-party app stores — do **not** tap them; they are unrelated to AusFlow. The profile only reads the UDID, model and iOS version and is removed after use; if it is still listed under **VPN & Device Management**, delete it there.
> 页面上有签名证书、第三方应用商店等广告，**不要点**，与 AusFlow 无关。该描述文件只读取 UDID、型号和 iOS 版本，用完会自动移除；如仍在「VPN 与设备管理」中列出，可手动删除。

### Send to the admin · 发给管理员

Send the UDID **as copied text** (not a screenshot) together with a device name, e.g. `John – iPhone 15`.

把 UDID **以文字形式**（不要截图）连同设备名称一起发给管理员，例如 `John – iPhone 15`。

---

## 2. Register the device · 在 Apple 开发者后台注册设备

1. Sign in to <https://developer.apple.com/account> with the team `8J42Q87M5P` account.
   用团队 `8J42Q87M5P` 的账号登录 Apple 开发者后台。
2. **Certificates, Identifiers & Profiles → Devices → ＋**.
   进入「Certificates, Identifiers & Profiles → Devices」，点「＋」。
3. Platform **iOS**, Device Name e.g. `John – iPhone 15`, Device ID = the UDID → **Continue → Register**.
   平台选 **iOS**，设备名填如 `John – iPhone 15`，Device ID 填 UDID →「Continue → Register」。

To add many devices at once, use **Register Multiple Devices** and upload a tab-separated file:

批量添加可用「Register Multiple Devices」上传制表符分隔的文件：

```
Device ID	Device Name	Device Platform
00008110-001A2B3C4D5E801E	John – iPhone 15	ios
```

> Limit: 100 iPhones per membership year. A disabled device still counts until the membership renews.
> 限额：每个会员年度最多 100 台 iPhone。停用的设备在会员续费前仍占用名额。

---

## 3. Update the Ad Hoc profile · 更新 Ad Hoc 描述文件

Registering a device does **not** add it to existing profiles automatically.

注册设备**不会**自动加入已有的描述文件，必须手动编辑。

1. **Profiles** → open the Ad Hoc profile for `com.ausflow` → **Edit**.
   进入「Profiles」→ 打开 `com.ausflow` 的 Ad Hoc 描述文件 →「Edit」。
2. Tick the new device(s) (or **Select All**) → **Save**.
   勾选新设备（或「Select All」）→「Save」。
3. **Download** the new `.mobileprovision` file.
   「Download」下载新的 `.mobileprovision` 文件。

Optional check — list the UDIDs inside the profile:

可选检查：查看描述文件里包含的 UDID：

```bash
# macOS
security cms -D -i AusFlow_AdHoc.mobileprovision | plutil -extract ProvisionedDevices json -o - -
# Linux
openssl smime -inform der -verify -noverify -in AusFlow_AdHoc.mobileprovision 2>/dev/null | grep -A200 ProvisionedDevices
```

---

## 4. Update the GitHub secret · 更新 GitHub 密钥

The workflow reads the profile from the repository secret `IOS_ADHOC_PROFILE_BASE64`.

构建流程从仓库密钥 `IOS_ADHOC_PROFILE_BASE64` 读取描述文件。

**Option 1 — GitHub CLI · 方式一：GitHub 命令行**

```bash
# Linux
base64 -w0 AusFlow_AdHoc.mobileprovision | gh secret set IOS_ADHOC_PROFILE_BASE64 -R belimked/ausflow_ios
# macOS
base64 -i AusFlow_AdHoc.mobileprovision | gh secret set IOS_ADHOC_PROFILE_BASE64 -R belimked/ausflow_ios
```

**Option 2 — Web · 方式二：网页**

1. Encode the file: `base64 -w0 AusFlow_AdHoc.mobileprovision` (macOS: `base64 -i …`) and copy the output.
   先编码：`base64 -w0 AusFlow_AdHoc.mobileprovision`（macOS 用 `base64 -i …`），复制输出内容。
2. Repo → **Settings → Secrets and variables → Actions** → `IOS_ADHOC_PROFILE_BASE64` → **Update** → paste → save.
   仓库 →「Settings → Secrets and variables → Actions」→ `IOS_ADHOC_PROFILE_BASE64` →「Update」→ 粘贴并保存。

Do not commit the `.mobileprovision` file — it is in `.gitignore`.

不要把 `.mobileprovision` 文件提交到仓库，它已在 `.gitignore` 中。

---

## 5. Rebuild · 重新构建

The IPA must be rebuilt so it is signed with the new profile. Older builds will still refuse to install on the new iPhone.

必须重新构建，新 IPA 才会使用新的描述文件签名。旧版本在新手机上仍然无法安装。

- Web: repo → **Actions → iOS Ad Hoc → Run workflow** (branch `main`).
  网页：仓库 →「Actions → iOS Ad Hoc → Run workflow」（分支 `main`）。
- CLI · 命令行：`gh workflow run ios-adhoc.yml -R belimked/ausflow_ios --ref main`
- Any push to `main` also triggers a build.
  向 `main` 推送代码也会自动触发构建。

A build takes about 15–25 minutes. In the **Install signing certificate and profile** step the log prints e.g. `Profile … · 5 device(s) · expires …` — confirm the device count went up. When the **deploy** job finishes, the install page is updated.

构建约需 15–25 分钟。在「Install signing certificate and profile」步骤的日志中会打印如 `Profile … · 5 device(s) · expires …`，确认设备数已增加。**deploy** 任务完成后，安装页即更新。

The IPA is also kept as a workflow artifact for 30 days.

IPA 同时作为构建产物（artifact）保留 30 天。

---

## 6. Install on the iPhone · 在 iPhone 上安装

Send the tester the install page link: <https://belimked.github.io/ausflow_ios/>

把安装页链接发给测试人员：<https://belimked.github.io/ausflow_ios/>

1. Open the link in **Safari** (not Chrome / WeChat). Tap **Install AusFlow**, then **Install** in the pop-up. Wait on the home screen until the icon finishes loading.
   用 **Safari** 打开链接（不要用 Chrome / 微信内置浏览器），点「Install AusFlow」，弹窗中点「安装」，回到主屏幕等待图标下载完成。
2. Tap the AusFlow icon once. iOS says Developer Mode is required — tap **OK**.
   点一次 AusFlow 图标，系统提示需要开发者模式，点「好」。
3. **Settings → Privacy & Security → Developer Mode** → turn on → restart. After the restart tap **Turn On** and enter the passcode.
   「设置 → 隐私与安全性 → 开发者模式」→ 开启 → 重启手机；重启后点「打开」并输入密码。
4. Open AusFlow and sign in with your AusFlow web console account. Allow **Camera** (QR scanning) and **Location** (pickup position).
   打开 AusFlow，用 Web 后台账号登录。允许「相机」（扫二维码）和「定位」（记录收运位置）权限。

The Developer Mode switch only appears after step 2 has been done once.

「开发者模式」开关只有在完成第 2 步之后才会出现。

**Updating · 更新**：open the install page again and tap **Install AusFlow**. Sign-in is kept.
再次打开安装页点击安装即可覆盖更新，登录状态保留。

---

## 7. Troubleshooting · 常见问题

| Symptom · 现象 | Cause / fix · 原因 / 处理 |
| --- | --- |
| "Unable to install AusFlow" · 「无法安装 AusFlow」 | UDID not in the profile, or the build was made before the profile was updated. Check steps 2–5 and the device count in the build log. · UDID 不在描述文件中，或构建早于描述文件更新。检查第 2–5 步及构建日志中的设备数。 |
| Install button does nothing · 点安装没反应 | Not opened in Safari. · 没有用 Safari 打开。 |
| No Developer Mode switch · 找不到开发者模式开关 | Tap the AusFlow icon once first (step 6.2). · 先点一次 AusFlow 图标（第 6 步第 2 点）。 |
| App closes immediately after opening · 打开即闪退 | Developer Mode not enabled, or the profile / distribution certificate has expired — renew it, update the secrets and rebuild. · 未开启开发者模式，或描述文件 / 发布证书已过期——续期后更新密钥并重新构建。 |
| Build fails: `Missing signing secret` · 构建失败：`Missing signing secret` | One of `IOS_DIST_P12_BASE64`, `IOS_DIST_P12_PASSWORD`, `IOS_ADHOC_PROFILE_BASE64` is empty. · 三个签名密钥之一为空。 |
| Build fails at Archive/Export with a profile error · 构建在 Archive/Export 步骤报描述文件错误 | The profile is not for `com.ausflow`, not Ad Hoc type, or does not include the current distribution certificate. Regenerate it. · 描述文件不是 `com.ausflow`、不是 Ad Hoc 类型，或未包含当前发布证书，重新生成即可。 |
| iPhone running iOS below 16.4 · iOS 低于 16.4 | Update iOS. · 升级 iOS。 |

---

## 8. Yearly renewal · 年度续期

The Ad Hoc profile and the Apple Distribution certificate are valid for one year. Before they expire:

Ad Hoc 描述文件和 Apple Distribution 证书有效期为一年，到期前需要：

1. Certificate expiring: create a new Apple Distribution certificate, export it as `.p12`, update `IOS_DIST_P12_BASE64` (`base64 -w0 dist.p12`) and `IOS_DIST_P12_PASSWORD`.
   证书到期：新建 Apple Distribution 证书，导出 `.p12`，更新 `IOS_DIST_P12_BASE64`（`base64 -w0 dist.p12`）和 `IOS_DIST_P12_PASSWORD`。
2. Edit the Ad Hoc profile (select the new certificate if it changed), download it and update `IOS_ADHOC_PROFILE_BASE64` (step 4).
   编辑 Ad Hoc 描述文件（证书变更时选新证书），下载并更新 `IOS_ADHOC_PROFILE_BASE64`（第 4 步）。
3. Rebuild (step 5); testers reinstall from the install page.
   重新构建（第 5 步），测试人员从安装页重新安装。

The expiry date is printed in every build log (`expires …`).

到期日期会在每次构建日志中打印（`expires …`）。
