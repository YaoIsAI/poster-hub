# PosterHub 修复报告（完整版 v2）

**修复时间**: 2026-04-09 21:25
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

服务运行时的工作目录是 `/Users/yao/.openclaw/workspace`，而不是项目目录。原始代码使用相对路径 `./posters` 导致找不到正确目录。

### 修复方案

使用 `__dirname` 构建绝对路径：

```javascript
const POSTERS_DIR = path.join(__dirname, 'posters');
if (fs.existsSync(POSTERS_DIR)) {
  for (const id of fs.readdirSync(POSTERS_DIR)) {
    const mp = path.join(POSTERS_DIR, id, 'meta.json');
```

---

## 问题2：LLM 连接测试失败（已修复 ✅）

### 现象
- 设置页面 LLM 测试显示"连通正常，但模型未出现在 /models 列表"
- 模型名 `qwen3-coder:30b` 实际存在于 Ollama 中

### 修复方案

1. **添加 `res.text()` 获取响应体**
2. **支持两种 API 格式**: Ollama `{ models: [...] }` 和 OpenAI `{ data: [...] }`
3. **Ollama 自动检测**: 端口 11434 使用 `/api/tags`

---

## trae 审查后的修复（2026-04-09 21:23）

### 高风险：Ollama 流式返回隐患
- **问题**: `/api/chat` 默认流式返回，但 payload 没有 `stream: false`
- **修复**: 添加 `stream: false` 到 Ollama 请求体

### 中风险：参数格式错误
- **问题**: `temperature/max_tokens` 直接放顶层，Ollama 不会识别
- **修复**: 改为 `options: { temperature, num_predict }` 格式

### 低风险：提示文案误导
- **问题**: 报错信息写 `/models 返回`
- **修复**: 改为动态端点名

### 额外改进
- 超时从 60s → 120s

---

## Ollama 自动选择模型功能

当前本地 Ollama 有 13 个模型：

| 模型 | 用途 | 大小 |
|------|------|------|
| qwen3-coder:30b | 代码生成（当前使用） | 18GB |
| llama3.2-coder:latest | 代码辅助 | 2GB |
| llama3.2:latest | 通用 | 2GB |
| deepseek-r1:8b | 推理 | 5GB |

### 自动选择逻辑

```javascript
// 根据任务自动选择模型
const modelMap = {
  code: 'qwen3-coder:30b',      // 代码任务
  creative: 'llama3.2:latest',  // 创意任务
  reasoning: 'deepseek-r1:8b',  // 推理任务
  default: 'llama3.2-coder:latest'  // 默认
};

// 根据 prompt 关键词选择
function selectModel(prompt) {
  if (/代码|编程|函数|代码生成/i.test(prompt)) return modelMap.code;
  if (/推理|思考|分析|原因/i.test(prompt)) return modelMap.reasoning;
  return modelMap.default;
}
```

---

## 修改文件清单

| 文件 | 修改内容 |
|------|----------|
| `server.js` | 路径修复 + LLM API 检测 + 响应体解析 |
| `prompt-generator.js` | Ollama 参数修复 + stream:false + options 格式 |

---

## 总结

| 问题 | 状态 |
|------|------|
| 画廊显示错误 | ✅ 已修复 |
| LLM测试失败 | ✅ 已修复 |
| 流式返回隐患 | ✅ 已修复 |
| 参数格式错误 | ✅ 已修复 |
| 自动选择模型 | ⚠️ 待实现 |

---

**服务状态**: 运行中（端口 3008）
**海报数量**: 185+