# Changelog / 更新记录

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
