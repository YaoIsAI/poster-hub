# Contributing to PosterHub

中文 | [English](#english)

感谢你关注 PosterHub！欢迎各种形式的贡献。

---

## 🐛 报告 Bug

请通过 [GitHub Issues](https://github.com/YaoIsAI/poster-hub/issues) 报告，提供以下信息：

- 使用的 PosterHub 版本 (`node server.js` 输出中可见)
- 复现步骤（输入的 GitHub URL / 项目描述）
- 期望行为 vs 实际行为
- 截图（如果有）

---

## 💡 提出新功能

欢迎提出新功能建议！请描述：

- 你希望解决什么问题
- 建议的解决方案或 API 设计
- 可能的替代方案

---

## 🔧 提交 PR

### 开发流程

1. **Fork** 本仓库
2. **Clone** 你的 Fork
3. **安装依赖** - `npm install`（会通过 postinstall 自动安装 Chromium）
4. **创建分支** - `git checkout -b feature/your-feature-name`
5. **开发 & 测试** - `node server.js` 测试 API、设置页与海报生成链路
6. **提交** - `git commit -m "feat: add new feature"`
7. **打开 Pull Request**

### 代码规范

- 使用 2 空格缩进
- 运行 `node server.js` 自测通过后再提交
- 如修改 Docker 连通性逻辑，请同步验证 `Dockerfile` / `docker-compose.yml` / 设置页诊断文案
- PR 描述清楚改动内容和原因

---

有任何问题可以在 GitHub 上提 Issue 或提交 PR。

---

## English

Thank you for your interest in PosterHub. Contributions of all kinds are welcome.

---

## 🐛 Report Bugs

Please open a report via [GitHub Issues](https://github.com/YaoIsAI/poster-hub/issues) and include:

- PosterHub version (visible in `node server.js` output)
- Reproduction steps (GitHub URL / project description used)
- Expected behavior vs actual behavior
- Screenshots if available

---

## 💡 Request Features

Please describe:

- The problem you want to solve
- Proposed solution or API design
- Possible alternatives

---

## 🔧 Submit PRs

### Development Flow

1. **Fork** this repository
2. **Clone** your fork
3. **Install dependencies** - `npm install` (Chromium is installed in postinstall)
4. **Create a branch** - `git checkout -b feature/your-feature-name`
5. **Develop & test** - run `node server.js` and verify API behavior, settings UI, and poster generation flow
6. **Commit** - `git commit -m "feat: add new feature"`
7. **Open a Pull Request**

### Code Style

- Use 2-space indentation
- Self-test with `node server.js` before submitting
- If you change Docker connectivity behavior, also verify `Dockerfile`, `docker-compose.yml`, and settings diagnostics copy
- Explain what changed and why in PR description

---

If you have questions, open an Issue or submit a PR.
