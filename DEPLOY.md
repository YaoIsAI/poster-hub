# PosterHub 部署文档

> 当前部署说明与仓库内 `Dockerfile`、`docker-compose.yml` 和运行时行为保持一致。

---

## 🐳 Docker Compose

### 默认配置

| 项目 | 值 |
|------|-----|
| 容器名 | `posterhub-app` |
| 容器内部端口 | `3008` |
| 宿主机映射端口 | `30008` |
| 重启策略 | `unless-stopped` |
| 健康检查 | `GET /api/health` |

### 默认环境变量

`docker-compose.yml` 当前示例默认使用局域网 Ollama：

```yaml
environment:
  - PORT=3008
  - NODE_ENV=production
  - GITHUB_TOKEN=${GITHUB_TOKEN:-}
  - LLM_API_KEY=ollama
  - LLM_BASE_URL=http://YOUR_OLLAMA_IP:11434/v1
  - LLM_MODEL=deepseek-r1:8b
```

### 启动

```bash
docker compose up -d --build
```

### 查看状态

```bash
docker compose ps
docker compose logs -f
curl http://localhost:30008/api/health
```

---

## 📁 数据挂载

| 宿主机 | 容器内 | 用途 |
|--------|--------|------|
| `./posters` | `/app/posters` | 海报 HTML / PNG / 元数据 |
| `./.env` | `/app/.env` | 运行时配置 |

---

## 🔄 更新部署流程

```bash
# 1. 拉取最新代码
git pull

# 2. 重新构建镜像并启动
docker compose up -d --build

# 3. 检查日志
docker compose logs -f
```

如果仅修改了 `.env`，也建议重启容器以确保运行态一致：

```bash
docker compose restart
```

---

## 🧪 LLM 诊断

部署后建议打开：

`http://<host>:30008/web/settings.html`

检查：

1. `LLM_BASE_URL`
2. `LLM_MODEL`
3. “测试 LLM 连通性”
4. “刷新”模型列表

当前实现支持：

- Ollama：`/api/tags`、`/v1/models`、`/models`
- 通用 OpenAI 兼容接口：`/models`、`/v1/models`、`/model/list`
- 诊断字段：`message`、`details`、`tried`、`suggestedBaseUrl`

说明：

- Docker 镜像已包含 `curl`，因此容器内连通性测试在 `fetch` 失败时仍可回退
- 如果宿主机能访问 Ollama，但容器内不通，请优先排查容器网络策略

---

## 🐛 故障排查

### 服务无法访问

```bash
docker compose ps
docker compose logs posterhub
ss -tlnp | grep 30008
```

### 设置页提示无法连接 LLM

```bash
# 进入容器
docker exec -it posterhub-app bash

# 检查容器内是否能访问 Ollama
curl http://YOUR_OLLAMA_IP:11434/api/tags
```

如果这里失败，说明问题在容器到 Ollama 的网络链路，不在前端页面。

### 海报无法显示

```bash
ls -la ./posters
docker compose logs -f
```

---

## 📝 备注

- 本项目没有 `/admin` 页面
- Docker 默认内部服务端口是 `3008`，不是 `3000`
- 推荐优先使用 `docker compose` 而不是手写 `docker run`，避免端口和挂载参数漂移
