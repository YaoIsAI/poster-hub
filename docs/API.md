# API Documentation

PosterHub REST API 文档（与当前代码实现对齐）。

中文 | [English](#english)

**Base URL**: `http://localhost:3008`

---

## POST /api/generate

生成项目海报（GitHub URL / 本地路径 / 自然语言描述）。

### Request

```bash
curl -X POST http://localhost:3008/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "nl": "https://github.com/facebook/react",
    "lang": "zh",
    "inputType": "url"
  }'
```

### Body Parameters

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `nl` | string | ✅ | GitHub URL / 本地路径 / 项目描述 |
| `lang` | string | ❌ | `zh`（默认）或 `en` |
| `inputType` | string | ❌ | `url`（默认）/ `browse` |

### Response

```json
{
  "ok": true,
  "posterId": "1775589210767-xxxxx",
  "title": "facebook/react - The library for web and native user interfaces",
  "github": "https://github.com/facebook/react",
  "stars": 225000,
  "hasSkill": false,
  "warnings": []
}
```

---

## POST /api/prompt

生成通用海报（按类型风格生成，支持任意文案描述）。

闭环流程（已实现）：
1. 规划器先输出结构化内容计划（JSON）
2. 生成器按计划生成 HTML/CSS
3. 审查器校验“计划 vs HTML”一致性
4. 若不一致，自动纠偏并重复审查（最多 3 轮）
5. 仅审查通过才导出 PNG

### Request

```bash
curl -X POST http://localhost:3008/api/prompt \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "生成一张微信风格的推广海报，介绍 AI 项目",
    "type": "wechat",
    "lang": "zh",
    "width": 780
  }'
```

### Body Parameters

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `prompt` | string | ✅ | 海报内容描述，不能为空 |
| `type` | string | ❌ | `wechat` / `xiaohongshu` / `performance` / `corporate` / `custom`（默认） |
| `image` | string | ❌ | 图片 URL 或 base64 |
| `lang` | string | ❌ | `zh`（默认）或 `en` |
| `width` | number | ❌ | 海报宽度，默认 `780` |
| `height` | number | ❌ | 海报高度；用于固定比例输出 |
| `customCss` | string | ❌ | 自定义 CSS 补充要求 |

### Response

```json
{
  "ok": true,
  "posterId": "1775589210767-abcde",
  "style": "微信文章卡片",
  "meta": {
    "id": "1775589210767-abcde",
    "title": "生成一张微信风格的推广海报，介绍 AI 项目",
    "type": "wechat",
    "style": "微信文章卡片",
    "lang": "zh",
    "created": "2026-04-09T10:30:00.000Z"
  }
}
```

---

## GET /api/types

获取 `/api/prompt` 支持的海报类型列表。

```bash
curl http://localhost:3008/api/types
```

---

## GET /api/list

列出所有已生成海报（按 `created` 倒序）。

```bash
curl http://localhost:3008/api/list
```

### Response

```json
{
  "ok": true,
  "posters": [
    {
      "id": "1775589210767-xxxxx",
      "title": "React",
      "github": "https://github.com/facebook/react",
      "stars": 225000,
      "lang": "zh",
      "type": "wechat",
      "style": "微信文章卡片",
      "created": "2026-04-09T10:30:00.000Z"
    }
  ]
}
```

---

## GET /api/settings

读取当前设置（敏感字段为掩码）。

---

## POST /api/settings

保存设置到 `.env`（并即时更新进程环境）：

- `llmApiKey`
- `llmBaseUrl`
- `llmModel`
- `githubToken`

---

## POST /api/settings/test

测试 LLM 连通性（不保存配置），返回：

- `reachable` 是否可达
- `modelFound` 模型是否存在
- `modelsPreview` 模型列表预览
- `endpoint` 实际探测端点（如 `/api/tags` 或 `/models`）
- `message` 面向用户的摘要提示
- `details` 底层诊断信息（如 fetch/curl 错误）
- `tried` 已探测过的端点列表
- `suggestedBaseUrl` 自动发现的候选地址（如存在）
- `autoDiscovered` 是否由自动探测得出

示例：

```json
{
  "ok": true,
  "test": {
    "ok": false,
    "reachable": false,
    "message": "无法连接到服务地址",
    "details": "fetch/curl 均失败: curl: (7) Failed to connect ...",
    "endpoint": "http://localhost:11434/api/tags",
    "tried": ["http://localhost:11434/api/tags"],
    "suggestedBaseUrl": "",
    "autoDiscovered": false
  }
}
```

---

## GET /api/models

获取模型列表（用于设置页下拉框），支持 query 覆盖：

- `baseUrl`
- `apiKey`
- `model`

响应字段：

- `ok`
- `models`
- `modelCount`
- `endpoint`
- `reachable`
- `modelFound`
- `message`
- `details`
- `tried`
- `suggestedBaseUrl`
- `autoDiscovered`

---

## GET /api/progress/:progressId

查询任务进度（前端状态同步）：

- `received`
- `fetch_github` / `scan_local`
- `llm_analyzing` / `prompt_llm`
- `planning_content`
- `building_html`
- `auditing_html`
- `repairing_html`
- `rendering_png`
- `done` / `error`

---

## GET /api/poster/:posterId.png

下载指定海报 PNG（新格式，推荐）。

```http
GET /api/poster/1775589210767-xxxxx.png
```

---

## GET /api/poster/:posterId/png

下载指定海报 PNG（旧格式，兼容保留）。

```http
GET /api/poster/1775589210767-xxxxx/png
```

---

## GET /api/poster/:posterId/meta.json

获取指定海报元数据。

```http
GET /api/poster/1775589210767-xxxxx/meta.json
```

---

## GET /api/pick-folder

调起 macOS Finder 文件夹选择器，返回所选文件夹名（取消返回空字符串）。

---

## Error Format

错误响应统一包含 `ok: false` 和 `error` 字段：

```json
{
  "ok": false,
  "error": "错误描述信息"
}
```

---

## English

PosterHub REST API docs aligned with current implementation.

**Base URL**: `http://localhost:3008`

### POST /api/generate
Generate project posters from GitHub URL / local path / plain description.

**Body**
- `nl` (string, required): GitHub URL / local path / project description
- `lang` (string, optional): `zh` (default) or `en`
- `inputType` (string, optional): `url` (default) or `browse`

### POST /api/prompt
Generate generic style-based posters.

Implemented closed-loop pipeline:
planner -> generator -> auditor -> auto-repair (up to 3 rounds) -> PNG export.

**Body**
- `prompt` (string, required): poster content prompt
- `height` (number, optional): fixed poster height for ratio-specific output
- `type` (string, optional): `wechat` / `xiaohongshu` / `performance` / `corporate` / `custom`
- `image` (string, optional): URL or base64 image
- `lang` (string, optional): `zh` (default) or `en`
- `width` (number, optional): default `780`
- `customCss` (string, optional): additional CSS hints

### GET /api/types
List supported prompt poster types.

### GET /api/list
List all generated posters in descending `created` order.

### GET /api/settings
Read current runtime settings (masked secrets).

### POST /api/settings
Save settings (`llmApiKey`, `llmBaseUrl`, `llmModel`, `githubToken`) to `.env`.

### POST /api/settings/test
Test LLM connectivity without saving settings.

Returns:
- `reachable`
- `modelFound`
- `modelsPreview`
- `endpoint`
- `message`
- `details`
- `tried`
- `suggestedBaseUrl`
- `autoDiscovered`

### GET /api/models
Get model list for settings UI selector (supports optional query overrides).

Returns:
- `models`
- `modelCount`
- `endpoint`
- `reachable`
- `modelFound`
- `message`
- `details`
- `tried`
- `suggestedBaseUrl`
- `autoDiscovered`

### GET /api/progress/:progressId
Get live generation progress stage for UI synchronization.

### GET /api/poster/:posterId.png
Download poster PNG (new format, recommended).

### GET /api/poster/:posterId/png
Download poster PNG (legacy format, kept for compatibility).

### GET /api/poster/:posterId/meta.json
Get poster metadata.

### GET /api/pick-folder
Open macOS folder picker and return selected folder name (empty string when canceled).

### Error Format

All error responses include:

```json
{
  "ok": false,
  "error": "error message"
}
```
