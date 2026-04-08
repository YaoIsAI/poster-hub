# PosterHub Architecture

## 系统概览

```
GitHub URL / 本地路径 / 项目描述
           ↓
     server.js (API 路由)
           ↓
     GitHub API / 本地文件扫描
           ↓
     local-llm.js (AI 分析)
           ↓
    generator.js (HTML 生成)
           ↓
   screenshot.js (Playwright 截图)
           ↓
     PNG 海报输出
```

## 核心模块

| 模块 | 职责 | 入口 |
|------|------|------|
| `server.js` | HTTP API、路由、GitHub API 调用 | `node server.js` |
| `generator.js` | 海报 HTML/CSS 生成、主题系统、i18n | 被 server.js 调用 |
| `local-llm.js` | 调用 OpenAI 兼容 LLM 分析项目 | 被 server.js 调用 |
| `screenshot.js` | Playwright 全页截图输出 PNG | 被 generator.js 调用 |
| `web/index.html` | 生成器 Web 界面 | 浏览器访问 |
| `web/gallery.html` | 历史海报画廊 | 浏览器访问 |

## 海报生成流程

1. **解析输入** → GitHub API / 本地文件扫描
2. **AI 分析** → LLM 提取项目描述、技术栈、功能模块
3. **构建 HTML** → generator.js 生成响应式 HTML
4. **渲染截图** → Playwright 截取完整页面
5. **返回结果** → posterId + 下载链接

## 设计 Token 系统

PosterHub 使用三层 Token 架构，支持任意 DESIGN.md 规范：

```
Design Spec (VoltAgent/awesome-design-md)
    ↓ parseNaturalLanguage()
Primitive Tokens { primaryColor, bgColor, ... }
    ↓ Resolver.resolve()
Semantic Tokens { --hero-bg, --stat-card-bg, ... }
    ↓ Theme Resolver
Poster Components (Hero / Stats / Sections / Cards / Footer)
```

## 主题系统

内置 5 套主题，每套定义完整的 Semantic Token：

- `apple` — Apple 极简主义，纯白 + 彩虹色谱
- `dark` — 深色科技风（#171717）
- `cyber` — 赛博朋克，荧光渐变
- `cpython` — Python 官方风格，蓝黄配色
- `inventory` — 库存管理定制，深蓝企业风

## 存储

- **海报 PNG**: `posters/{posterId}/poster.png`
- **海报 HTML**: `posters/{posterId}/poster.html`
- **元数据**: `posters/{posterId}/meta.json`
- **临时文件**: `tmp/`

## 端口

- `3008` — 默认服务端口（可通过 `PORT` 环境变量修改）
