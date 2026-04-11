# PosterHub 修复报告

## 修复时间
2026-04-09 21:02

---

## 发现的问题

### 问题1：画廊错误（显示不出海报）
- **原因**：服务运行时工作目录是 `/Users/yao/.openclaw/workspace`，不是 poster-hub 项目目录
- **影响**：读取到错误的 empty posters 目录（只有2个空目录），导致画廊显示错误

### 问题2：LLM 测试显示"模型未出现在 /models 列表"
- **原因**：代码只检查 `data.models`（Ollama 原生），未正确提取模型名
- **分析**：Ollama `/api/tags` 返回格式是 `{ models: [{ name: "qwen3-coder:30b", ... }] }`

---

## 修复方案

### 1. 修复 __dirname 问题
定义绝对路径常量：
```javascript
const PROJECT_ROOT = path.resolve(__dirname);
const POSTERS_DIR = path.join(PROJECT_ROOT, 'posters');
```

### 2. 修复模型名提取
当前代码已支持 `data.models`，应该是逻辑问题，需要测试验证。

---

## 待执行
1. 重启服务
2. 测试画廊
3. 测试 LLM 连接