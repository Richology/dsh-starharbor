# StarHarbor 独立核心审计报告

审计日期：2026-11-18（Asia/Shanghai）

对象：当前工作区 StarHarbor v0.3.0。测试先基于原源码建立失败证据，父 Agent 修复源码后复跑。独立测试 Agent 仅新增本报告及 `test/qa-audit.test.js`，未修改产品源码、既有测试或真实个人数据。正式安装包及真实 GUI 的验证由父 Agent 负责。

## 最终结果

- 原有测试：首次运行 68/68 通过。
- 新增独立审计：24 项顶层测试，含 2 项日/周子测试，共 26 项计数测试。
- 首轮新测试：17 项顶层测试中 14 通过、3 失败；三项均确认 fixture 有效并立即报告父 Agent。
- 扩展并修复后首次全套：`node --test`，89/89 通过。
- 根据父 Agent 后续要求，补充旧 feed 跨日回退、跨实例并发和分类一致性回归，再执行 `npm test`：92/92 通过。
- 父 Agent 随后提供真实界面分类问题，独立新增 QA-04 分类与旧数据只读投影回归。修复后最终执行 `npm test`：94/94 通过，0 失败、0 跳过，耗时约 352 ms；再次执行 `npm run check` 通过。
- `npm run check` 通过。
- 审计测试文件冻结，不由此 Agent 继续修改。报告记录当前通过状态，不承诺绝对无缺陷。

## 已复现并由父 Agent 修复的问题

### QA-01：旧分类修正后，新收藏仍写入旧分类（P2）

原始位置：`domain.js:38-43`、修复前 `core.js:474`。

复现：临时 state 中已有推荐 `{id:51, categoryId:'ai', category:'人工智能', description:'Agent-ready design system'}`；读取后 `categoryId` 已投影为 `web`，随后首次 `save(51)`。

预期：新的收藏条目放入 `## 前端与 Web`；已有 `## 人工智能` 和手写笔记保留。

实际：新条目仍插入 `## 人工智能`。读取投影不修改类别文本，保存逻辑直接使用该旧文本作为标题。

修复核验：当前 `core.js:468` 在新保存时依据用途 ID 选择标题，并保留 general 对应的自定义分类。新增回归验证正确标题、旧笔记保留及读取不写 state，现通过。

### QA-02：合法历史净增超过当前 Star 时，整次公开采集失败（P2）

原始位置：修复前 `feed.js:61`；由 `scripts/collect-feed.mjs:163` 调用验证时抛错。

复现：11 月 17 日午夜 10 Star，11 月 18 日午夜 10010 Star；18 日上午 09:00 因取消 Star 变成 9999。昨日净增仍为 10000。所有计数非负，时间和区间均合法。周净增也构造独立连续 8 端点情况，日净增为零、周净增 10000，以分别覆盖两条分支。

预期：保留历史日/周净增，当前累计显示 9999。

实际：抛出 `Invalid public feed: dailyGain exceeds current stars`（周分支对应 weeklyGain），可能阻断该次云端更新。历史净增与稍后的当前累计不能直接比较。

修复核验：当前 `feed.js:61` 移除该错误关系约束，保留安全整数、自然日区间及时间验证。日、周两个子测试均通过。

### QA-03：HTTP/tool 设置接口接受显式非法假值（P3）

原始位置：`index.js:43` 的 `input.settings || {}`。

复现：POST `{action:'settings',settings:false}`，以及 `null`、`0`、空字符串。工具入口调用相同输入。

预期：HTTP 400、`invalid_settings`，工具入口也拒绝；真正省略 settings 时可用空对象。

实际：非法值被转换成空对象，HTTP 200，工具也接受。

修复核验：当前 `index.js:43` 仅在属性真正缺失时使用空对象。四种显式非法值的 HTTP 和工具断言均通过。

### QA-04：内部 curated patterns 抢占真实安全工具用途（P3，已修复并复测）

原始位置：`domain.js:15` 的裸 `curated` 词优先匹配。

父 Agent 在隔离真实界面发现 `elementalsouls/Claude-BugHunter` 被分类为资源合集。独立判断并补测：描述明确为执行 bug hunting 和 external red-team work 的 Claude Code skill bundle；`patterns curated across 24 core vulnerability classes` 中 curated 修饰内部模式，不表示仓库是资源清单。

最小复现：`node --test --test-name-pattern='QA a working bug-hunting' test/qa-audit.test.js`，实际 `resources`，预期 `devtools`。同一回归另包含真正 curated list of bug hunting/red-team tools 和 curated list of security testing tools 两个资源合集保护案例。

建议把裸 curated 收窄到 curated list/collection/resources，并在已有 devtools 安全用途词中仅添加 bug hunting/red-team。只移除 curated 会因 Claude 回落到 ai，仍不符合用途。

父 Agent 已修复 `domain.js:16` 的 curated 短语以及 `domain.js:7,19` 的安全工具用途规则，并在 `domain.js:40-41` 为旧 resources 且新推断为安全工具的记录增加有限只读投影。独立 Agent 未改源码。

最终核验：真实工具描述正确得到 devtools；真正 curated list 仍为 resources。额外将旧 resources 记录放入 today、history、saved 及 leader，确认均只读投影为 devtools，旧 category 文本、summary 保持；不含 securityPurpose 的其他旧 resources 工具不被泛化迁移；state 和 Markdown 字节完全不变。新增两项回归及最终全套 94/94 均通过。

## 新增独立覆盖

- Feed：身份/安全整数、非法仓库名、控制字符、不可信字段剔除、GitHub URL 重建、返回值与输入隔离。
- 日周榜：各自累计 Star 下限的精确边界、保留真实来源榜首、负净增排序与未知区别、日周去重。
- 经典候选：不同用途分类优先、分类不足后允许真实同类候选。
- 收藏/冷却：永久按 ID 排除收藏、29/30 天边界、未来历史不误冷却、改名仍按 ID 去重。
- 固定与恢复：重启及设置变化后同日固定、过期缓存、网络失败保留榜单和笔记、后续成功恢复并生成新日期历史；下载到已有历史的旧 feed 日期或更早且无历史的日期，均保留较新的 today 和全部 history。
- 请求并发：两个独立 createHarbor 实例共享同一数据根目录时合并同一刷新 Promise，只发一次请求；刷新期间排队的 settings 写入在刷新后执行，榜单、history 和设置更新均保留。
- 超时：响应 body 忽略取消时仍超时、请求信号被 abort、迟到结果不落盘、锁释放后可成功刷新。
- Markdown：并发同 ID 保存不重复、手写内容保留、模拟 MD 已写但 saved 尚未写入时恢复状态、旧分类新保存回归。
- 后端：设置边界与未知字段拒绝、失败不改文件字节、非法动作/ID、超大请求、UI transport 和工具一致。
- 采集真实性：私有元数据拒绝、fork/归档剔除、可选元数据名称不符不能冒充榜首。
- 午夜：前后 5 分钟含边界、边界外 1 ms 拒绝；周净增需要连续 8 个独立仓库端点，aggregate 时间不补造缺失端点。
- 旧数据：读取自定义分类、旧警告和旧错误时不联网、不修改持久化文件。

## 隔离与范围

所有新建临时状态及 Markdown 均通过 `fs.mkdtemp(path.join(os.tmpdir(), 'starharbor-qa-audit-'))` 创建。清理前断言其父目录为系统临时目录、名称为固定前缀。网络完全由 fixture 注入；Host 测试只注册 HTTP/tool，不启用调度器。

未读取或写入真实个人数据目录，未执行真实 `save`，未操作父 Agent 使用的浏览器 tab。此 Agent 未做 UI 截图；父 Agent 的界面检查与部署后的验证需要另计。

这些结果表示所列源码路径和测试场景当前未再复现已发现缺陷；它们不替代真实安装包、线上 GitHub Actions 或真实 GUI 的验收，也不能证明任意外部仓库的数据真实性。
