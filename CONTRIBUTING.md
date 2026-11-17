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

## Change and review checks / 修改与检查

- Describe the concrete behavior that changes and how you verified it. Keep English and Chinese product documentation consistent.
- Preserve the distinction between candidate ranking, Trending order, and measured calendar-day net growth. Never label incomplete observations as zero or claim global GitHub leadership from candidate data.
- Keep daily selection stable. Preserve explicit saving, repository-ID duplicate protection, saved-project exclusion, and existing Markdown notes.
- Test storage changes with older JSON state and a Markdown collection containing user notes. A state migration must not silently rewrite that Markdown.
- Keep category IDs independent of display language. Check both DSH language settings, untranslated descriptions, empty descriptions, and translation failures.
- Verify settings against backend limits, including `preferredMin >= classicMin`. Verify individual-card save progress, completion state, path copying, errors, and empty or partial boards.
- Keep the agent tool’s four actions (`status`, `refresh`, `save`, `settings`) consistent with the sidebar and documentation.
- Use fixture-based tests for ranking, time boundaries, failures, and persistence. Do not rely on live Trending results for deterministic test assertions.

- 说明具体行为变化及验证方式，保持中英文产品文档一致。
- 区分候选排名、Trending 顺序和已测量的自然日净增；不把缺失观测写成 0，不凭候选数据宣称全 GitHub 冠军。
- 保持同日榜单稳定，保留主动收藏、数字仓库 ID 去重、已收藏项目排除和已有 Markdown 笔记。
- 存储修改须使用旧 JSON 状态和含用户笔记的 Markdown 验证，状态迁移不得静默重写 Markdown。
- 分类 ID 与显示语言分离，检查 DSH 的中英文设置、原文描述、空描述和翻译失败。
- 设置须符合后端范围，包括 `preferredMin >= classicMin`；检查单卡收藏进度、完成状态、路径复制、错误、空榜单和不足 5 个的榜单。
- 保持对话工具的四个动作（`status`、`refresh`、`save`、`settings`）与界面及文档一致。
- 对排序、时间边界、失败和持久化使用固定数据测试，不依赖实时 Trending 结果作确定性断言。

## Screenshots and feedback / 截图与反馈

Capture screenshots from the real DSH interface. For public images, crop out DSH’s sidebar and remove private paths, notes, account details, tokens, and unrelated tabs or panels. Do not use generated images or fabricated UI states as product screenshots. The product documentation reserves `docs/images/today-zh.png` and `docs/images/today-en.png` for the Chinese and English Today pages.

截图须来自真实 DSH 界面。公开图片应裁掉 DSH 侧栏，移除私人路径、笔记、账号资料、token 及无关页面或面板。不要使用生成图或虚构界面状态作为产品截图。产品文档为中英文今日推荐界面分别预留 `docs/images/today-zh.png` 和 `docs/images/today-en.png`。

Bug reports should include DSH and StarHarbor versions, operating system, interface language, reproduction steps, expected and actual behavior, and sanitized errors. Never attach your full local state or collection without reviewing its contents.

问题反馈请包含 DSH 与 StarHarbor 版本、操作系统、界面语言、复现步骤、预期与实际行为，以及已去除私人信息的错误内容。上传本地状态或收藏前，请先检查内容。

## Release checks / 发布核对

1. Run the syntax checks and tests. Review the files listed by `npm pack --dry-run`.
2. Check the installed plugin in both DSH languages, using a separate data directory. Verify old-state migration and preservation of Markdown notes.
3. Confirm package version, compatibility range, changelog, install tag, and archive filename agree.
4. Add the real, sanitized screenshots at both documented paths. Remove the pending-capture text only after those images exist.
5. Publish the GitHub tag before advertising tag installation. If distributing a prepacked release, attach and verify `dsh-starharbor-0.2.0.tgz` before advertising it as available.
6. Describe npm publication and market inclusion only after they actually happen. The current documentation records neither as complete.

1. 运行语法检查与测试，核对 `npm pack --dry-run` 列出的文件。
2. 使用单独数据目录，在 DSH 中检查两种语言，并验证旧状态迁移和 Markdown 笔记保留。
3. 确认包版本、兼容范围、更新说明、安装 tag 和压缩包文件名一致。
4. 在文档约定的两个路径补入真实且去除私人信息的截图，文件存在后再移除待截图说明。
5. 先发布 GitHub tag，再说明 tag 安装可用；若提供预打包 Release，先附上并验证 `dsh-starharbor-0.2.0.tgz`，再说明附包可用。
6. npm 发布与市场收录只有实际完成后才可宣称；当前文档均标记为未完成。
