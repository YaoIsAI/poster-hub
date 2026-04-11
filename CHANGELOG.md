# Changelog

格式遵循 [Keep a Changelog](https://keepachangelog.com/)。

English follows each Chinese section below.

---

## [1.0.0] - 2026-04-07

### Added
- 初始版本发布
- GitHub URL 自动解析（stars、语言、描述）
- 本地项目路径支持
- 纯文字描述生成海报
- 多主题支持：Apple 极简 / 深色科技 / 赛博朋克 / Python 官方 / 库存管理
- 中英双语界面和海报
- Playwright 高清截图输出
- Web 界面（生成器 + 画廊）
- REST API（/api/generate, /api/poster/:id.png, /api/list）
- OpenClaw AI 助手技能集成（SKILL.md）
- 命令行工具
- 本地 LLM 分析支持

### Added (English)
- Initial release
- GitHub URL auto parsing (stars, language, description)
- Local project path support
- Poster generation from plain-text description
- Multi-theme support: Apple Minimal / Dark Tech / Cyberpunk / Python Official / Inventory style
- Bilingual UI and poster output
- HD screenshot export via Playwright
- Web UI (generator + gallery)
- REST API (`/api/generate`, `/api/poster/:id.png`, `/api/list`)
- OpenClaw AI assistant integration via `SKILL.md`
- CLI support
- Local LLM project analysis support

---

## [Unreleased]

### Changed
- 前端类型选择联动生成链路：默认类型走 `/api/generate`，非默认类型走 `/api/prompt`
- 画廊布局改为横向顺序降序（左到右为最新到较旧）
- 生成器背景改为海报从底部向上缓慢流动的无缝动画
- 模块拆分：GitHub 获取逻辑迁移到 `github-utils.js`，海报内容验证迁移到 `poster-validator.js`
- GitHub 项目生成链路新增 `analyzeReadmeWithLLM()`：优先分析 README / README_EN，再构建结构化海报内容
- 修复画廊回归问题：`/api/list` 统一使用 `__dirname/posters`，避免 cwd 变化导致空列表
- 修复海报图片路由：`/api/poster/:id.png` 正确解析 ID 并以 inline 方式返回 PNG
- 新增设置能力：`/api/settings`、`/api/settings/test`、`/api/models` 与 `web/settings.html` 模型下拉刷新
- 设置诊断增强：`/api/models` / `/api/settings/test` 现返回 `reachable`、`message`、`details`、`tried`、`suggestedBaseUrl`
- Harness 校验优化：区分硬错误与软偏差，软偏差保留结果并以 warning 呈现
- 优化本地 LLM 可观测性：LLM 失败原因写入 `warnings`，便于定位回退原因
- OpenClaw 最简学习话术升级为 GitHub `SKILL.md` URL 方式，避免依赖本地固定目录
- `/api/prompt` 升级为闭环审查：规划(JSON) -> 生成(HTML) -> 审查 -> 自动纠偏(最多3轮) -> 导出PNG
- 新增真实进度接口：`GET /api/progress/:progressId`（用于前端状态与后端阶段同步）
- Docker 镜像补充 `curl`，确保容器中的连通性测试 fallback 可用
- 文档对齐当前实现：`README.md`、`README_EN.md`、`docs/API.md`、`docs/ARCHITECTURE.md`、`SKILL.md`、`CONTRIBUTING.md`

### Changed (English)
- Front-end type selection now routes generation chain correctly:
  default type -> `/api/generate`, non-default types -> `/api/prompt`
- Gallery layout changed to horizontal descending order (newest on the left)
- Generator background updated to a seamless bottom-to-top poster flow animation
- Module split: GitHub fetching moved to `github-utils.js`, poster content validation moved to `poster-validator.js`
- GitHub project flow now adds `analyzeReadmeWithLLM()`: README / README_EN are analyzed first to build structured poster content
- Fixed gallery regression: `/api/list` now reads from `__dirname/posters`, independent of process cwd
- Fixed poster image route: `/api/poster/:id.png` now parses ID correctly and returns inline PNG
- Added settings capabilities: `/api/settings`, `/api/settings/test`, `/api/models`, plus model refresh in `web/settings.html`
- Settings diagnostics now return `reachable`, `message`, `details`, `tried`, and `suggestedBaseUrl`
- Harness validation now distinguishes blocking issues from soft deviations; soft deviations are surfaced as warnings while keeping output
- Improved local LLM observability: fallback reasons are returned in `warnings`
- Updated OpenClaw minimal learning prompt to GitHub `SKILL.md` URL, removing local-path dependency
- Upgraded `/api/prompt` to closed-loop auditing: plan(JSON) -> generate(HTML) -> audit -> auto-repair (up to 3 rounds) -> PNG
- Added live progress endpoint: `GET /api/progress/:progressId` for frontend-backend stage synchronization
- Docker image now includes `curl` so connectivity-test fallback also works inside containers
- Documentation aligned with current implementation:
  `README.md`, `README_EN.md`, `docs/API.md`, `docs/ARCHITECTURE.md`, `SKILL.md`, `CONTRIBUTING.md`

### Planned
- [ ] 自动化测试用例
- [ ] Docker 支持
- [ ] 更多海报主题
- [ ] 批量生成功能

### Planned (English)
- [ ] Automated tests
- [ ] Docker support
- [ ] More poster themes
- [ ] Batch generation
