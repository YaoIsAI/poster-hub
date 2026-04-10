# PosterHub Dockerfile
# AI-powered project poster generator

FROM node:22-bookworm

# 安装系统依赖（Playwright 需要）
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

# 设置工作目录
WORKDIR /app

# 复制 package 文件
COPY package*.json ./

# 安装依赖
RUN npm install

# 安装 Playwright 浏览器
RUN npx playwright install chromium --with-deps

# 复制源代码
COPY . .

# 暴露端口
EXPOSE 3008

# 环境变量（运行时配置）
ENV PORT=3008
ENV NODE_ENV=production

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3008/api/health || exit 1

# 启动命令
CMD ["node", "server.js"]
