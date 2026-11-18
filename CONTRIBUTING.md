# Contributing / 参与贡献

StarHarbor is an MIT-licensed plugin for DSH. Use [GitHub Issues](https://github.com/Richology/dsh-starharbor/issues) for bugs and suggestions, and pull requests for proposed changes. Contributions may be written in English or Chinese.

StarHarbor 是采用 MIT 许可证的 DSH 插件。问题和建议请提交到 [GitHub Issues](https://github.com/Richology/dsh-starharbor/issues)，代码或文档修改可通过 Pull Request 提议。中英文均可。

## Local development / 本地开发

Use Node.js 22 or later and DSH `>=0.2.2-rc.1 <0.3.0`. The repository uses native ESM and Node’s built-in test runner. There are no third-party runtime dependencies or installation scripts; React comes from DSH.

使用 Node.js 22 或更高版本，以及 DSH `>=0.2.2-rc.1 <0.3.0`。项目采用原生 ESM 和 Node 内置测试运行器，没有第三方运行依赖或安装脚本，React 由 DSH 提供。

```sh
npm run check
npm test
npm pack --dry-run
```

Install a local checkout in a DSH profile for interface checks:

将本地检出目录装入 DSH 配置，检查真实界面：

```sh
dsh plugin --profile <profile-name> add /absolute/path/to/dsh-starharbor
```

For manual checks, point the plugin’s `dataDir` configuration at a separate absolute test directory, or set `STARHARBOR_DIR` before starting DSH. This avoids mixing test discoveries with your existing collection. Do not commit generated state, collections, caches, credentials, or personal paths.

手动检查时，将插件的 `dataDir` 配置指向单独的绝对测试目录，或在启动 DSH 前设置 `STARHARBOR_DIR`，避免测试推荐混入已有收藏。不要提交生成的状态、收藏、缓存、凭据或个人路径。

## Cloud architecture and maintainer operation / 云端架构与维护

The installed plugin downloads a public feed and selects boards locally. Its default URL is `https://raw.githubusercontent.com/Richology/dsh-starharbor/data/latest.json`; plugin configuration `feedUrl` overrides `STARHARBOR_FEED_URL`, which overrides the default. Local saved state, boards, thresholds, Markdown notes, and credentials must never enter the published data. The low-level `createHarbor` API retains direct collection when `feedUrl` is omitted for legacy callers and tests; the installed plugin does not expose that as a user option.

安装后的插件下载公开数据，在本地选榜。默认 URL 为 `https://raw.githubusercontent.com/Richology/dsh-starharbor/data/latest.json`；插件配置 `feedUrl` 优先于 `STARHARBOR_FEED_URL`，后者优先于默认值。本地收藏状态、榜单、门槛、Markdown 笔记和凭据不得进入公开数据。底层 `createHarbor` API 省略 `feedUrl` 时为旧调用者和测试保留直接采集，但安装后的插件不向用户提供此选项。

The workflow [.github/workflows/collect.yml](.github/workflows/collect.yml), named **Update public candidates**, runs Node.js 22 on a standard `ubuntu-latest` runner without installing dependencies. It uses the workflow’s built-in `GITHUB_TOKEN` with `contents: write`; ordinary plugin users need no token. [scripts/update-cloud.mjs](scripts/update-cloud.mjs) reads the previous public snapshots, calls the collector, and publishes `latest.json` plus `snapshots.json` through the GitHub Git API to the `data` branch. It does not rewrite the source branch or use Actions artifact/cache storage for the public feed. A failed collection must preserve the last published feed.

工作流 [.github/workflows/collect.yml](.github/workflows/collect.yml) 名为 **Update public candidates**，在标准 `ubuntu-latest` runner 上使用 Node.js 22，不安装依赖。它使用工作流内置 `GITHUB_TOKEN` 和 `contents: write` 权限；普通插件用户无需 token。[scripts/update-cloud.mjs](scripts/update-cloud.mjs) 读取上一份公开观测，调用采集器，通过 GitHub Git API 将 `latest.json` 和 `snapshots.json` 发布到 `data` 分支，不重写源码分支，也不使用 Actions artifact/cache 存放公开数据。采集失败必须保留上次已发布的数据。

| UTC cron | Asia/Shanghai / 北京时间 | Purpose / 用途 |
| --- | --- | --- |
| `2 16 * * *` | 00:02 next day / 次日 | Attempt midnight endpoints / 尝试午夜端点采样 |
| `17 0,4,8,12,20 * * *` | 08:17, 12:17, 16:17, 20:17, next-day 04:17 / 次日 04:17 | Refresh public candidates / 更新公开候选 |

Standard hosted runner compute is [free for public repositories](https://docs.github.com/en/billing/concepts/product-billing/github-actions); larger runners and private-repository usage have different billing. [Scheduled runs](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule) run from the default branch, can be delayed or dropped, and can be disabled after 60 days without public-repository activity. The midnight schedule is an attempt, not a guarantee: accept only each repository’s actual observation within midnight ±5 minutes. Inspect Actions failures and the raw feed’s date before concluding that a client sync is broken.

公开仓库的标准托管 runner 计算[免费](https://docs.github.com/en/billing/concepts/product-billing/github-actions)，大型 runner 和私有仓库另有计费规则。[定时任务](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule) 从默认分支运行，可能延迟或丢弃；公开仓库连续 60 天没有活动时可能自动停用。午夜计划不保证准点：只接受各仓库实际处于午夜前后 5 分钟内的观测。判断客户端同步故障前，先检查 Actions 失败记录与公开数据日期。

For the first publication or recovery after a failed schedule, open **Actions → Update public candidates → Run workflow**, or use an authenticated maintainer CLI:

首次发布，或定时任务失败后恢复，可打开 **Actions → Update public candidates → Run workflow**，或在维护者已认证的 CLI 中运行：

```sh
gh workflow run collect.yml --repo Richology/dsh-starharbor
gh run list --workflow collect.yml --repo Richology/dsh-starharbor --limit 5
```

Enable Actions and ensure the workflow is present on the default branch before dispatching. After it succeeds, verify both public `data`-branch JSON files, feed validation, and the feed date/time. Forks are guarded by the workflow’s repository-name condition; maintainers of a fork must explicitly adjust that guard and configure their clients to use their own feed URL.

触发前须启用 Actions，并确保工作流已进入默认分支。成功后检查 `data` 分支两份公开 JSON、数据验证结果和日期时间。工作流以仓库名条件限制 fork 自动运行；fork 维护者须明确修改该条件，并把客户端数据源改为自己的 URL。

To collect into a separate local public-data directory without publishing, use [scripts/collect-feed.mjs](scripts/collect-feed.mjs):

若只需采集到单独的本地公开数据目录而不发布，可运行 [scripts/collect-feed.mjs](scripts/collect-feed.mjs)：

```sh
node scripts/collect-feed.mjs --output public/feed/latest.json --snapshots public/feed/snapshots.json
```

The collector reads and updates the specified public snapshot file and writes a validated feed. It may use `GITHUB_TOKEN` for requests to `api.github.com` only; do not use a local collection or `state.json` as an input. Without a token, GitHub’s anonymous API limits can prevent collection. Do not commit generated local output as source code. Running `scripts/update-cloud.mjs` publishes data and is a separate maintainer action, not a local validation command.

采集器读取并更新指定的公开观测文件，再写入验证后的数据。可通过 `GITHUB_TOKEN` 为 `api.github.com` 请求认证；不得把本地收藏或 `state.json` 当作输入。无 token 时可能受到 GitHub 匿名 API 限额影响。不要把生成的本地输出作为源码提交。运行 `scripts/update-cloud.mjs` 会发布数据，属于单独的维护操作，不是本地验证命令。

## Change and review checks / 修改与检查

- Describe the concrete behavior that changes and how you verified it. Keep English and Chinese product documentation consistent.
- Preserve the distinction between candidate ranking, Trending order, and measured calendar-day net growth. Never label incomplete observations as zero or claim global GitHub leadership from candidate data.
- Keep daily selection stable. Preserve explicit saving, repository-ID duplicate protection, saved-project exclusion, and existing Markdown notes.
- Test storage changes with older JSON state and a Markdown collection containing user notes. A state migration must not silently rewrite that Markdown.
- Keep category IDs independent of display language. Check both DSH language settings, original descriptions in different languages, and empty descriptions. Cloud mode must make no translation requests.
- Verify settings against backend limits, including `preferredMin >= classicMin`. Verify individual-card save progress, completion state, path copying, errors, and empty or partial boards.
- Keep the agent tool’s four actions (`status`, `refresh`, `save`, `settings`) consistent with the sidebar and documentation.
- Use fixture-based tests for ranking, time boundaries, failures, and persistence. Do not rely on live Trending results for deterministic test assertions.
- Verify hourly sync after a completed board, force refresh before the chosen hour, new-day cached selection, and saved exclusions. A stale feed must retain its date; failed or future-invalid responses must preserve the valid cache and never freeze a first empty board.
- Test timeout, body decoding, cancellation, and disposal. Ensure cloud requests carry neither authorization nor local preferences and never fall back to GitHub collection. `status` must remain read-only and make no network request.

- 说明具体行为变化及验证方式，保持中英文产品文档一致。
- 区分候选排名、Trending 顺序和已测量的自然日净增；不把缺失观测写成 0，不凭候选数据宣称全 GitHub 冠军。
- 保持同日榜单稳定，保留主动收藏、数字仓库 ID 去重、已收藏项目排除和已有 Markdown 笔记。
- 存储修改须使用旧 JSON 状态和含用户笔记的 Markdown 验证，状态迁移不得静默重写 Markdown。
- 分类 ID 与显示语言分离，检查 DSH 的中英文设置、不同语言的原文描述与空描述；云端模式不得发送翻译请求。
- 设置须符合后端范围，包括 `preferredMin >= classicMin`；检查单卡收藏进度、完成状态、路径复制、错误、空榜单和不足 5 个的榜单。
- 保持对话工具的四个动作（`status`、`refresh`、`save`、`settings`）与界面及文档一致。
- 对排序、时间边界、失败和持久化使用固定数据测试，不依赖实时 Trending 结果作确定性断言。
- 验证已有榜单后的每小时同步、设定小时前强制刷新、新日期缓存选榜与收藏排除。旧数据必须保留原日期；失败或非法未来响应保留有效缓存，首次失败不得固定空榜单。
- 测试超时、响应体解码、取消与插件退出；云端请求不附认证或本地偏好，不回退 GitHub 直接采集。`status` 必须只读且不联网。

## Screenshots and feedback / 截图与反馈

Capture screenshots from the real DSH interface. For public images, crop out DSH’s sidebar and remove private paths, notes, account details, tokens, and unrelated tabs or panels. Do not use generated images or fabricated UI states as product screenshots. The product documentation reserves `docs/images/today-zh.png` and `docs/images/today-en.png` for the Chinese and English Today pages.

截图须来自真实 DSH 界面。公开图片应裁掉 DSH 侧栏，移除私人路径、笔记、账号资料、token 及无关页面或面板。不要使用生成图或虚构界面状态作为产品截图。产品文档为中英文今日推荐界面分别预留 `docs/images/today-zh.png` 和 `docs/images/today-en.png`。

Bug reports should include DSH and StarHarbor versions, operating system, interface language, reproduction steps, expected and actual behavior, and sanitized errors. Never attach your full local state or collection without reviewing its contents.

问题反馈请包含 DSH 与 StarHarbor 版本、操作系统、界面语言、复现步骤、预期与实际行为，以及已去除私人信息的错误内容。上传本地状态或收藏前，请先检查内容。

## Release checks / 发布核对

1. Run syntax checks and tests; review `npm pack --dry-run`. Keep generated feeds, public snapshots, local state, credentials, and personal collections out of the package unless explicitly intended.
2. Check the installed cloud plugin in both DSH languages with a separate data directory. Verify original descriptions, old-state compatibility, unchanged Markdown notes, feed freshness/errors, and same-day stability.
3. Confirm package version, compatibility range, changelog, install tag, and archive filename agree for v0.3.0. Merge the workflow to the default branch, dispatch it, and verify the public `data` branch before advertising the default cloud feed as operational.
4. Replace the real v0.2.0 screenshots with real, sanitized v0.3.0 captures at both documented paths. Update their captions only after replacement; do not imply old screenshots show the new feed status.
5. Publish and verify the `v0.3.0` tag before describing tag installation as available. If distributing a prepacked release, attach and verify `dsh-starharbor-0.3.0.tgz`. Only then remove the unreleased notices in the READMEs and changelog and record the release date.
6. Describe npm publication and market inclusion only after they actually happen. Current documentation records neither as complete.

1. 运行语法检查与测试，核对 `npm pack --dry-run`；除非明确需要，不把生成数据、公开观测、本地状态、凭据或个人收藏打入包。
2. 使用单独数据目录，在 DSH 中检查两种语言的云端插件，验证原始描述、旧状态兼容、Markdown 笔记不变、新鲜度与错误，以及同日稳定性。
3. 确认 v0.3.0 的包版本、兼容范围、更新说明、安装 tag 和压缩包文件名一致。工作流进入默认分支后手动触发，核实公开 `data` 分支，再说明默认云端数据源已投入运行。
4. 在文档约定的两个路径，以真实且去除私人信息的 v0.3.0 截图替换 v0.2.0 截图；实际替换后再改说明，不把旧图当作已包含新数据状态。
5. 发布并验证 `v0.3.0` tag 后，才能说明 tag 安装可用。若提供预打包 Release，附上并验证 `dsh-starharbor-0.3.0.tgz`。完成后再移除 README 与更新记录中的未发布说明，填写发布日期。
6. npm 发布与市场收录只有实际完成后才可宣称；当前文档均标记为未完成。
