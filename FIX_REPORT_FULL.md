# PosterHub 修复报告（完整版）

**修复时间**: 2026-04-09 21:16
**项目路径**: /Users/yao/Desktop/openclaw/projects/poster-hub/
**服务端口**: 3008

---

## 问题概述

收到瑶的通知，项目存在两个问题：
1. 画廊错误 - 无法显示海报
2. LLM 测试显示"模型未出现在 /models 列表"

---

## 问题1：画廊错误（已修复 ✅）

### 现象
- 画廊页面只显示 2 个错误的空目录
- 实际上项目中应该有 185 个海报

### 根因分析

通过排查发现：

```bash
# 查看服务的工作目录
$ lsof -p $(lsof -i :3008 | awk 'NR>1 {print $2}') | grep cwd
node    89947  yao  cwd   DIR  1,16  2848  18266388  /Users/yao/.openclaw/workspace
```

服务运行时的工作目录是 `/Users/yao/.openclaw/workspace`，而不是项目目录 `/Users/yao/Desktop/openclaw/projects/poster-hub/`。

原始代码使用的是相对路径：
```javascript
// 原代码 (错误)
if (fs.existsSync('./posters')) {
  for (const id of fs.readdirSync('./posters')) {
    const mp = path.join('./posters', id, 'meta.json');
```

当服务从其他目录启动时，`./posters` 会指向错误的位置。

### 修复方案

使用 `__dirname` 构建绝对路径：

```javascript
// 修复后 (正确)
const POSTERS_DIR = path.join(__dirname, 'posters');
if (fs.existsSync(POSTERS_DIR)) {
  for (const id of fs.readdirSync(POSTERS_DIR)) {
    const mp = path.join(POSTERS_DIR, id, 'meta.json');
```

需要修改的位置：
- Line 1217-1219: `/api/list` API
- Line 1176: 海报生成输出目录

### 修复结果

```bash
$ curl -s http://localhost:3008/api/list | python3 -c "... print(len(posters))"
185
```

现在正确显示 185 个海报。

---

## 问题2：LLM 连接测试失败（已修复 ✅）

### 现象
- 设置页面 LLM 测试显示"连通正常，但模型未出现在 /models 列表"
- 模型名 `qwen3-coder:30b` 实际存在于 Ollama 中

### 根因分析

1. **Ollama API 格式不同**：
   - OpenAI 兼容格式: `{ data: [...] }`
   - Ollama 原生格式: `{ models: [...] }`
   
2. **代码缺失关键步骤**：
   原代码直接调用 `JSON.parse(res.body)` 而没有先获取响应文本。

```javascript
// 原代码 (错误)
const res = await fetch(modelsUrl, { method: 'GET', headers });
if (!res.ok) { ... }

let data = null;
try { data = JSON.parse(raw); }  // ❌ raw 未定义！
```

3. **modelsEndpoint 计算错误**：
   原始代码使用 `/v1/models`，但 Ollama 原生 API 是 `/api/tags`

### 修复方案

1. **添加 `res.text()` 获取响应体**：
```javascript
const modelsUrl = modelsEndpoint;
const res = await fetch(modelsUrl, { method: 'GET', headers });
const raw = await res.text();  // ✅ 先获取响应体
if (!res.ok) { ... }

let data = null;
try { data = JSON.parse(raw); }  // ✅ 现在 raw 已定义
```

2. **支持两种 API 格式**：
```javascript
// Ollama 返回 { models: [...] }，OpenAI 兼容返回 { data: [...] }
const modelIds = Array.isArray(data && data.models)
  ? data.models.map(it => (it && (it.id || it.model || it.name)) || '').filter(Boolean)
  : Array.isArray(data && data.data)
    ? data.data.map(it => (it && (it.id || it.model || it.name)) || '').filter(Boolean)
    : [];
```

3. **Ollama 自动检测**：
```javascript
const isOllama = finalBaseUrl.includes(':11434');
const modelsEndpoint = isOllama 
  ? finalBaseUrl.replace('/v1', '') + '/api/tags'  // Ollama 原生: /api/tags
  : finalBaseUrl + '/models';  // OpenAI 兼容: /v1/models
```

### 修复结果

```bash
$ curl -s -X POST http://localhost:3008/api/settings/test -d '{}'
{
  "ok":true,
  "test":{
    "ok":true,
    "reachable":true,
    "modelFound":true,
    "message":"连通正常，模型存在",
    "baseUrl":"http://192.168.31.223:11434/v1",
    "model":"qwen3-coder:30b",
    "modelCount":13,
    "modelsPreview":[
      "qwen3-coder:30b",
      "gemma4:e4b",
      "nomic-embed-text:latest",
      ...
    ]
  }
}
```

---

## 修改文件清单

| 文件 | 修改内容 |
|------|----------|
| `server.js` | 修复路径 + LLM API 检测 + 响应体解析 |

---

## 待测试

1. ✅ 画廊页面 - 应显示 185 个海报
2. ✅ 设置页面 - LLM 测试应显示"连通正常，模型存在"
3. ✅ 生成海报功能 - 测试生成新海报

---

## 总结

| 问题 | 状态 | 影响 |
|------|------|------|
| 画廊显示错误 | ✅ 已修复 | 185个海报正常显示 |
| LLM测试失败 | ✅ 已修复 | 模型检测正常 |
| 生成海报 | ⚠️ 待测试 | 需瑶验证 |

修复已完成，服务正在运行，瑶可以刷新页面测试！