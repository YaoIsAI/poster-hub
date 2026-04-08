# API Documentation

PosterHub REST API 文档。

**Base URL**: `http://localhost:3008`

---

## POST /api/generate

生成一张项目介绍海报。

### Request

```bash
curl -X POST http://localhost:3008/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "nl": "https://github.com/facebook/react",
    "lang": "zh",
    "theme": "apple"
  }'
```

### Body Parameters

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `nl` | string | ✅ | GitHub URL / 本地路径 / 项目描述 |
| `lang` | string | ❌ | `zh`（默认）或 `en` |
| `theme` | string | ❌ | `apple`（默认）/ `dark` / `cyber` / `cpython` / `inventory` |

### Response

```json
{
  "ok": true,
  "posterId": "1775589210767-xxxxx",
  "title": "React – The library for web and native user interfaces",
  "github": "https://github.com/facebook/react",
  "stars": 225000,
  "language": "JavaScript",
  "warnings": []
}
```

### Errors

| code | 说明 |
|------|------|
| `400` | 参数 nl 为空 |
| `404` | GitHub 项目不存在 |
| `500` | 生成失败（详见 message） |

---

## GET /api/poster/:posterId.png

下载指定海报的 PNG 图片。

```
GET /api/poster/1775589210767-xxxxx.png
```

**Response**: `Content-Type: image/png`

---

## GET /api/list

列出所有已生成的海报元数据。

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
      "language": "JavaScript",
      "date": "2026-04-07T19:00:00.000Z",
      "theme": "apple"
    }
  ]
}
```

---

## GET /api/poster/:posterId

获取指定海报的元数据（不含图片）。

```
GET /api/poster/1775589210767-xxxxx
```

### Response

```json
{
  "ok": true,
  "poster": {
    "id": "1775589210767-xxxxx",
    "title": "React",
    "github": "https://github.com/facebook/react",
    "stars": 225000,
    "language": "JavaScript",
    "date": "2026-04-07T19:00:00.000Z",
    "theme": "apple"
  }
}
```

---

## Error Format

所有错误响应的格式：

```json
{
  "ok": false,
  "error": "错误描述信息",
  "code": 400
}
```
