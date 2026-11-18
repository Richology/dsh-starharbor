# Changelog / 更新记录

## v0.4.3 — 2026-11-18

- New Markdown saves include an explicit `GitHub：https://github.com/owner/repo` paragraph, alongside the clickable repository heading. Preserve manual notes and idempotent saves. Existing user files are not automatically rewritten on installation.
- 新增收藏时，在可点击仓库名之外单独显示完整 GitHub 地址。保留手写笔记和重复收藏保护；升级本身不会自动重写已有文档。

## v0.4.2 — 2026-11-18

- Add a copy-link button in the upper-right corner of every repository card in Today, History and Collection. Copy the repository URL with per-card feedback and a selectable URL if clipboard access fails.
- 每张仓库卡片右上角新增复制链接按钮，适用于今日推荐、往日发现和收藏；复制成功显示「已复制」，失败时提供可手动复制的地址。

## v0.4.1 — 2026-11-18

- Add **Open containing folder** at the top of Collection and beside the collection path. Opens the configured collection directory in the host computer’s file manager; shows an error with a copy-path fallback if opening fails.
- 「已收藏」页面顶部及收藏路径旁新增「打开所在文件夹」，点击后使用电脑的文件管理器打开收藏目录；失败时提示复制路径手动打开。

## v0.4.0 — 2026-11-18

- Configure 1–10 daily recommendations, default 5. Count changes take effect the next Asia/Shanghai calendar day, including before the first board. Preserve today’s selection and show active/pending counts in Settings.
- Add boundary, midnight, restart, repeated-edit and saved-exclusion regressions. All 150 automated checks pass, including an independent audit that caught and verified the fix for a future-dated feed applying tomorrow’s count before midnight. Existing settings and collections remain compatible.
- 每日推荐数量可设为 1–10 个，默认 5 个。修改严格于北京时间次日生效，今天未生成榜单时也不提前应用；设置页显示当前数量和生效日期。
- 补充数量边界、跨午夜、重启、多次修改和收藏排除回归，兼容旧设置与收藏。

## v0.3.2 — 2026-11-18

- Fix repeated local feed timeouts when macOS uses a system HTTP/HTTPS proxy but Node requests connect directly. Use a scoped Undici dispatcher honoring explicit proxy/NO_PROXY environment first, then manual macOS system proxy and bypass rules. Never change the global dispatcher or bypass a selected proxy on failure.
- Cancel proxy discovery with the request and destroy scoped agents on unload, including a shutdown/discovery race covered by regression.
- Add 38 independent transport checks; all 132 automated checks pass. The installed DSH panel successfully synchronized the live feed and cleared the previous timeout alert while preserving the fixed daily board and personal collection.
- 修复系统代理已启用、Node 请求仍直连导致的反复超时。遵循显式代理与 NO_PROXY 环境变量；macOS 无显式环境代理时读取手动 HTTP/HTTPS 系统代理和绕过规则。不改全局代理，不在代理失败时偷偷直连。
- 修复卸载期间代理发现完成后可能泄漏连接资源的竞态；新增 38 项独立传输测试，全量 132 项通过，并在真实 DSH 中成功同步、清除超时提示，保留原推荐和收藏。

## v0.3.1 — 2026-11-18

### Independent QA fixes / 独立测试修复

- Save new Markdown entries using the corrected purpose category, while keeping existing entries and handwritten notes intact.
- Accept valid historical daily/weekly gains that exceed a later current Star count after same-day unstars; keep interval and integer validation.
- Reject explicitly malformed settings values consistently in HTTP and tool calls.
- Synchronize settings changed in another window without marking untouched old values as unsaved or overwriting fields currently being edited.
- Classify working bug-hunting/red-team tools by purpose instead of incidental “curated patterns”; genuine curated lists remain resources.
- Add 26 independent audit checks; the full suite now passes 94 tests. See [the audit report](qa-audit-report.md) for reproduction steps, coverage and limits.

- 新收藏按修正后的用途分类写入 Markdown，保留旧条目和手写笔记。
- 修正历史日/周净增与稍后当前累计 Star 的错误比较，取消 Star 不再导致合法云端数据被拒绝。
- HTTP 与工具接口统一拒绝显式非法设置值。
- 外部设置变化时更新未编辑字段，并保留正在编辑的草稿。
- 安全测试工具不再因内部 curated patterns 误归为资源合集，真正资源列表保持原分类。
- 新增 26 项独立审计检查，全量 94 项测试通过；复现、覆盖和限制见[审计报告](qa-audit-report.md)。

## v0.3.0 — 2026-11-18

### Cloud collection and local selection / 云端采集与本地选榜

- Move public GitHub candidate collection and midnight observations to GitHub Actions. Publish validated `latest.json` and public `snapshots.json` to the `data` branch; local collections, history, and preferences are never uploaded.
- Download the public feed without a GitHub token or cookies. Default cloud mode makes no direct GitHub API, Trending, translation, or README-summary requests and has no direct-collection fallback.
- Keep local threshold, saved-project exclusion, repeat cooldown, and category rules. Select at the configured Shanghai hour (default 09:00), with startup/panel-open checks and hourly synchronization while DSH runs. Manual force bypasses the sync interval and can select early; existing same-date boards remain fixed.
- Show feed date, generation time, freshness, and sync errors. Freshness requires the current Shanghai date and an age of no more than 36 hours. Preserve valid cached data and existing boards on failure; never relabel an old feed as today or freeze an empty board after a first failure.
- Preserve older collections and history without rewriting handwritten Markdown. Continue using repository IDs for duplicate-safe saving. Keep `status` read-only and retain the four tool actions.
- Bound feed requests to 20 seconds and refreshes to 120 seconds; cancel on plugin disposal. Reject invalid or excessively future-dated feed data without overwriting the valid cache.
- Keep original repository descriptions in both languages. A description already containing Chinese may populate the Chinese summary field directly. There are no default cloud translation requests.
- Add deterministic tests for actual feed validation and selection, cloud sync stability, stale dates, timeouts, cancellation, privacy, cache recovery, and new-day saved exclusions.

- 将公开 GitHub 候选采集与午夜观测移至 GitHub Actions，将验证后的 `latest.json` 和公开 `snapshots.json` 发布到 `data` 分支；不上传本地收藏、历史或偏好。
- 下载公开数据源不携带 GitHub token 或 Cookie。默认云端模式不直接访问 GitHub API 或 Trending，不请求翻译或 README 摘要，也不回退到本机采集。
- 保留本地门槛、收藏排除、冷却期与用途分类规则。默认北京时间 09:00 选榜；启动、面板打开时检查，DSH 运行期间每小时同步。手动强制更新可跳过间隔、提前选榜，但同一日期已有榜单固定。
- 显示数据日期、生成时间、新鲜度和同步错误。新鲜要求上海当日且生成距今不超过 36 小时。失败时保留有效缓存与已有榜单，不把旧日期冒充今天，也不在首次失败后固定空榜单。
- 兼容旧收藏和历史，不重写手写 Markdown；继续按数字仓库 ID 去重。`status` 保持只读，四个工具动作不变。
- 下载超时最多 20 秒，刷新总预算最多 120 秒；插件退出时取消。格式无效或超出允许未来时间的数据不会覆盖有效缓存。
- 中英文界面均保留仓库原始描述；原文含中文时可直接填入中文摘要字段。默认云端模式不发送翻译请求。
- 新增固定数据测试，覆盖真实数据验证和选榜、同日稳定性、过期日期、超时、取消、隐私、缓存恢复与新日期收藏排除。

### Operation and release status / 运行与发布状态

The public workflow is scheduled at 00:02 and 04:17/08:17/12:17/16:17/20:17 Asia/Shanghai. Standard hosted Linux runner compute is free for public repositories; scheduled execution may be delayed or dropped. Only actual per-repository samples within midnight ±5 minutes qualify as endpoints. The maintainer can dispatch the workflow manually; details are in [CONTRIBUTING.md](CONTRIBUTING.md).

公开工作流计划于北京时间 00:02，以及 04:17、08:17、12:17、16:17、20:17 运行。公开仓库的标准托管 Linux runner 计算免费，定时执行可能延迟或丢弃。只有各仓库实际落在午夜前后 5 分钟内的观测才算端点。维护者可手动触发，详见 [CONTRIBUTING.md](CONTRIBUTING.md)。

The first cloud workflow published 319 validated public candidates, and the installed plugin synchronized them successfully. README screenshots show the real v0.3.0 cloud interface. npm publication and community market inclusion remain pending. DSH compatibility remains `>=0.2.2-rc.1 <0.3.0`; Node.js remains `>=22`.

首次云端工作流已发布 319 个通过验证的公开候选，本机插件已成功同步。README 截图已更新为真实 v0.3.0 云端界面。npm 发布和社区市场收录仍未完成。DSH 兼容范围仍为 `>=0.2.2-rc.1 <0.3.0`，Node.js 仍要求 `>=22`。

## v0.2.0 — 2026-11-18

### Changes / 变化

- Use stable purpose category IDs instead of programming-language fallback categories. Keep category identity independent of the interface language.
- Follow DSH’s Chinese or English language setting throughout the interface. Chinese descriptions use available translations with original-text fallback; English displays the repository’s original description.
- Translate only the public GitHub `description`. Stop appending the first two README sentences as a project summary.
- Show saving progress on the individual repository card and a check mark after completion.
- Display and copy the resolved Markdown collection path.
- Apply the same integer ranges and threshold relationships in the settings form and backend.
- Add separate English and Simplified Chinese product documentation, including installation status, ranking boundaries, data handling, and contribution guidance.

- 以稳定的用途分类 ID 替代按编程语言兜底的分类，分类身份不随界面语言变化。
- 界面完整跟随 DSH 的中英文设置；中文描述翻译失败保留原文，英文显示仓库原始描述。
- 仅翻译 GitHub 公开的 `description`，不再追加 README 前两句话作为项目总结。
- 收藏时在单张卡片显示处理状态，完成后显示勾选标记。
- 显示并支持复制解析后的 Markdown 收藏文件路径。
- 设置表单与后端使用一致的整数范围和门槛关系约束。
- 分别提供英文与简体中文产品文档，说明安装状态、排名边界、数据处理和贡献方式。

### Existing data and behavior / 已有数据与规则

Older JSON state remains readable through compatible migration. Existing Markdown collection headings and user notes are preserved without a bulk rewrite. The default directory remains under DSH’s default working directory; switching a chat workspace does not move it.

The recommendation target remains one daily pick, one weekly pick, and three classics, with fewer picks allowed when candidates are insufficient. Rankings cover collected candidates. Net growth requires complete midnight endpoints within the ±5-minute sampling window. Daily selection stays stable, saved projects remain excluded, and unsaved recommendations default to a 30-day cooldown. The default generation hour remains 09:00 Asia/Shanghai; DSH does not collect while closed. The tool actions remain `status`, `refresh`, `save`, and `settings`.

旧 JSON 状态通过兼容迁移继续读取，不批量重写已有 Markdown 分类标题或用户笔记。默认目录仍位于 DSH 默认工作目录下，不跟随聊天工作区切换。

推荐目标仍为日推荐 1 个、周推荐 1 个、经典 3 个，候选不足时允许少于 5 个。排名仅覆盖已采集候选。净增要求午夜前后 5 分钟窗口内的完整端点。同日推荐固定，已收藏项目长期排除，未收藏项目默认冷却 30 天。默认北京时间 09:00 生成，DSH 关闭时不采集。工具动作仍为 `status`、`refresh`、`save`、`settings`。

### Release status / 发布状态

- DSH compatibility: `>=0.2.2-rc.1 <0.3.0`; Node.js: `>=22`.
- The npm package is not published, and community market inclusion is pending.
- The GitHub release includes the `v0.2.0` source tag and a prepacked `dsh-starharbor-0.2.0.tgz` attachment.
- Chinese and English screenshots come from the installed interface and are cropped to exclude private information.

- DSH 兼容范围为 `>=0.2.2-rc.1 <0.3.0`，Node.js 要求为 `>=22`。
- npm 包尚未发布，社区市场尚未收录。
- GitHub Release 提供 `v0.2.0` 源码 tag 和预打包附件 `dsh-starharbor-0.2.0.tgz`。
- 中英文截图来自已安装的真实界面，已裁掉私人信息。
