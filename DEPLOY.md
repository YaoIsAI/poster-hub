# PosterHub 部署文档

> 本文档记录 PosterHub 项目的部署信息，由 OpenClaw 自动维护。

---

## 🐳 Docker 部署

### 容器信息

| 项目 | 值 |
|------|-----|
| **容器名** | poster-hub-app |
| **镜像名** | poster-hub |
| **外部端口** | 30008 |
| **内部端口** | 3000 |
| **重启策略** | unless-stopped |

### 访问地址

- **本地**: http://192.168.31.85:30008
- **管理页面**: http://192.168.31.85:30008/admin

### 数据目录

| 宿主机 | 容器内 | 用途 |
|--------|--------|------|
| `/home/yao/poster-hub/posters` | `/app/posters` | 海报文件存储 |

---

## 🖥️ NAS 服务器

| 项目 | 值 |
|------|-----|
| **IP** | 192.168.31.85 |
| **SSH 端口** | 2222 |
| **用户名** | yao |
| **密码** | Strike100 |

### 常用命令

```bash
# SSH 连接
ssh -p 2222 yao@192.168.31.85

# 查看容器状态
docker ps | grep poster

# 查看日志
docker logs -f poster-hub-app

# 重启服务
docker restart poster-hub-app

# 重新构建并部署
cd /home/yao/poster-hub
docker build -t poster-hub .
docker stop poster-hub-app && docker rm poster-hub-app
docker run -d --name poster-hub-app -p 30008:3000 -v /home/yao/poster-hub/posters:/app/posters --restart unless-stopped poster-hub
```

---

## 📁 项目结构

```
poster-hub/
├── web/                 # 前端文件
│   └── index.html       # 主页面
├── server.js            # 后端服务
├── parser/              # 海报解析模块（GitHub API + 本地解析）
├── posters/            # 海报存储（运行时生成）
├── Dockerfile          # Docker 镜像构建
├── .dockerignore        # Docker 构建忽略
├── package.json
└── DEPLOY.md           # 本文档
```

---

## 🔧 更新部署流程

### 1. 本地开发更新

```bash
cd ~/Desktop/openclaw/projects/poster-hub

# 提交代码
git add .
git commit -m "your changes"
git push gitea main
```

### 2. NAS 重新部署

```bash
# SSH 到 NAS
ssh -p 2222 yao@192.168.31.85

# 拉取最新代码
cd /home/yao/poster-hub
git pull gitea main

# 重新构建镜像
docker build -t poster-hub .

# 重启容器
docker stop poster-hub-app && docker rm poster-hub-app
docker run -d --name poster-hub-app -p 30008:3000 -v /home/yao/poster-hub/posters:/app/posters --restart unless-stopped poster-hub
```

---

## 🐛 故障排查

### 服务无法访问

```bash
# 1. 检查容器状态
docker ps | grep poster

# 2. 查看日志
docker logs poster-hub-app

# 3. 检查端口监听
ss -tlnp | grep 30008

# 4. 重启服务
docker restart poster-hub-app
```

### 海报无法显示

```bash
# 检查 posters 目录权限
ls -la /home/yao/poster-hub/posters/

# 检查 parser 模块
ls -la /home/yao/poster-hub/parser/
```

---

## 📝 版本历史

| 日期 | 版本 | 说明 |
|------|------|------|
| 2026-04-11 | 1.0 | Docker 部署上线 |
