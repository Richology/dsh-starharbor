# StarHarbor 星港

A DSH sidebar plugin for discovering five high-star GitHub repositories every day and collecting useful projects in local Markdown.

每天在 DSH 侧边栏发现 5 个高 Star GitHub 仓库；看过以后，自行决定是否收藏。收藏文件包含 GitHub 链接、功能简介、分类、Star 数和推荐依据。

## 安装 / Install

需要 DSH `>=0.2.2-rc.1 <0.3.0` 和 Node.js 22+。插件没有第三方运行依赖，也不运行安装脚本。

在 DSH 的插件管理中安装 GitHub 仓库 `https://github.com/Richology/dsh-starharbor`，或使用：

```sh
dsh plugin --profile <你的配置名> add github:Richology/dsh-starharbor#v0.1.1
```

本地开发版本：

```sh
dsh plugin --profile <你的配置名> add /absolute/path/to/dsh-starharbor
```

安装后，在侧边栏点击星形港湾图标，打开「StarHarbor 星港」。如果 DSH 提示重启，需要重启后生效。

## 每天如何选 5 个

| 名额 | 默认门槛 | 选择依据 |
| --- | --- | --- |
| 日榜 1 个 | 累计至少 5,000 Star | 有完整观测时按候选昨日净增排序；冷启动使用 GitHub Trending 近1日顺序 |
| 周榜 1 个 | 累计至少 10,000 Star | 有完整观测时按候选最近7个完整自然日净增排序；冷启动使用 Trending 近7日顺序 |
| 经典 3 个 | 累计至少 30,000，优先 50,000 Star | 累计 Star 降序，优先不同分类 |

- 每天默认北京时间 09:00 生成。DSH 运行时定时检查，关闭后暂停；下次打开时补当日推荐。
- 同日推荐固定，点击「更新数据」不会重新洗牌。新门槛从下一次生成开始生效。
- 排除 fork、归档仓库、已收藏项目；默认 30 天内不重复推荐。同一天不重复仓库。
- 候选来自 GitHub Trending 近1日/近7日和累计高星搜索；每轮最多核实20个额外 Trending 仓库，以降低匿名限流风险。
- 门槛、重复间隔和生成时间可在设置修改。极少数时候候选不足会显示实际数量及原因。
- 功能简介取自仓库描述和 README 摘录。DSH 有匿名翻译服务时翻译为中文；失败时保留仓库原文。分类基于描述、topics 和语言的本地规则，可能需要人工判断。

## Star 数据的边界

**这里展示的是采集候选中的排名，不能证明是全 GitHub 第一。** GitHub Trending 的排序不等于特定自然日的涨星数。刚安装时使用趋势榜推荐，并明确显示趋势来源，不声称昨日或周净增冠军。

插件在北京时间午夜附近采集累计 Star 快照。只有完整端点存在才计算自然日净增（含取消 Star）；最近7天要求连续每日端点存在。当前采样窗口为午夜前后5分钟，属于近似边界采样，并非零误差的午夜交易记录。关机、网络故障、限流、未被采集到的仓库会导致增长数据缺失。界面统一提示观测数据尚不完整，并省略缺失的净增数值，不以零替代。不会购买历史数据或抓取用户的 Star 列表。

## 收藏与本地数据

点击「收藏到 Markdown」才保存，不自动收藏。默认数据目录：DSH 默认工作目录下的 `StarHarbor/`，包含：

- `GitHub收藏.md`：按分类整理的收藏。每个仓库带稳定的 GitHub 数字 ID 标记，重命名也不会重复收录。允许在文件中写自己的笔记；程序保留已有内容。
- `state.json`：设置、每日推荐历史、收藏状态、快照和错误信息。请勿在 DSH 运行时手动编辑。

可以通过启动 DSH 前设置 `STARHARBOR_DIR`，或插件的 `dataDir` 配置，指定绝对数据目录。目录按插件实例共享，不随当前聊天临时切换。

匿名 GitHub REST API 通常只有每 IP 每小时60次。需要更多额度时，可在启动 DSH 的环境中设置 `GITHUB_TOKEN`；插件只在请求 GitHub API 时使用，不写入状态或收藏。不要把 token 放进仓库。插件还会访问 GitHub Trending 页面，以及 DSH 配置的匿名 Google/Bing 翻译服务。翻译只发送公开仓库描述和 README 摘录。

## 在对话中操作

插件同时提供 `starharbor` 工具：`status` 查看、`refresh` 更新、`save` 按仓库数字 ID 收藏、`settings` 修改门槛。它与界面调用同一套本地逻辑。

## 分享与市场

项目以 MIT 许可证公开。可直接通过 GitHub 安装；仓库使用 `dsh-plugin` topic 便于搜索。

DSH 的实验性插件市场支持自定义索引，但没有默认统一索引。本仓库发布后可提交第三方社区市场审核；创建 GitHub 仓库并不意味着已被市场收录。

参考：[DSH 插件发布](https://deepseek-harness.github.io/deepseek-harness/en/develop/basic/publish)、[自定义插件索引](https://deepseek-harness.github.io/deepseek-harness/en/guide/plugin-market)、[GitHub Trending](https://github.com/trending)。

## Development

```sh
npm run check
npm test
npm pack --dry-run
```

Native ESM, React supplied by DSH, no bundled framework. The Host exposes an authenticated connection endpoint shared by the sidebar and agent tool. Test fixtures cover ordering, cooldown, boundary snapshots, persistence, failure recovery, and collection idempotency.
