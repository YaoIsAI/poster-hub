/**
 * 海报截图模块
 * 
 * 使用 puppeteer-core + Chromium 浏览器
 * 
 * Chromium 浏览器优先级（自动检测）：
 *   1. Playwright chrome-headless-shell（推荐，已安装则自动使用）
 *   2. Playwright Google Chrome for Testing
 *   3. @sparticuz/chromium（Linux x86_64，不兼容 macOS）
 *   4. 系统 chromium
 */

const path = require('path');
const { existsSync } = require('fs');
const puppeteer = require('puppeteer-core');

const PAGE_WIDTH = 780; // 海报固定宽度

/**
 * 查找可用的 Chromium 浏览器（自动检测）
 */
async function findChromium() {
  const home = process.env.HOME || '/Users/yao';
  const cache = home + '/Library/Caches/ms-playwright';

  // 1. Playwright chrome-headless-shell（ARM64 macOS）
  const headlessPaths = [
    cache + '/chromium_headless_shell-1217/chrome-headless-shell-mac-arm64/chrome-headless-shell',
    cache + '/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell',
  ];
  for (const p of headlessPaths) {
    if (existsSync(p)) {
      console.log('✅ 使用 Playwright chrome-headless-shell:', p);
      return p;
    }
  }

  // 2. Playwright Google Chrome for Testing
  const chromePaths = [
    cache + '/chromium-1217/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
    cache + '/chromium-1208/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
  ];
  for (const p of chromePaths) {
    if (existsSync(p)) {
      console.log('✅ 使用 Playwright Google Chrome for Testing:', p);
      return p;
    }
  }

  // 3. @sparticuz/chromium（跨平台，但可能是 Linux 二进制）
  try {
    const chromium = require('@sparticuz/chromium');
    const p = await chromium.executablePath();
    if (p && existsSync(p)) {
      // 检查是否是可执行的 Mach-O 文件（不是 Linux ELF）
      const { execSync } = require('child_process');
      try {
        const fileType = execSync(`file "${p}"`).toString();
        if (fileType.includes('Mach-O') || fileType.includes('ELF')) {
          console.log('ℹ️ @sparticuz/chromium:', p, '(' + fileType.trim().split(',')[1] + ')');
          return p;
        }
      } catch (e) { /* file command failed, skip */ }
    }
  } catch (e) { /* @sparticuz/chromium not available */ }

  // 4. 系统 chromium
  const systemPaths = [
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ];
  for (const p of systemPaths) {
    if (existsSync(p)) {
      console.log('✅ 使用系统 Chromium:', p);
      return p;
    }
  }

  throw new Error(
    '❌ 未找到 Chromium 浏览器！\n\n' +
    '请用以下任一方式安装：\n' +
    '  1. npm install -g playwright && npx playwright install chromium\n' +
    '  2. npm install @sparticuz/chromium && npx @sparticuz/chromium install\n' +
    '  3. 安装 Google Chrome: https://www.google.com/chrome/'
  );
}

/**
 * 高清海报截图
 * @param {string} htmlPath - HTML 文件路径
 * @param {string} outputPath - PNG 输出路径
 * @returns {Promise<string>} - 输出文件路径
 */
async function hiresPoster(htmlPath, outputPath) {
  const executablePath = await findChromium();

  const browser = await puppeteer.launch({
    executablePath,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--disable-software-rasterizer',
    ],
    headless: true,
  });

  const page = await browser.newPage();

  // 设置视口：宽度固定 780，高度足够大让内容撑开
  await page.setViewport({
    width: PAGE_WIDTH,
    height: 10000,
    deviceScaleFactor: 1,
  });

  // 加载 HTML 文件
  const fileUrl = 'file://' + path.resolve(htmlPath);
  await page.goto(fileUrl, { waitUntil: 'networkidle0' });

  // 等待字体和图片加载
  await new Promise(r => setTimeout(r, 1500));

  // 获取内容的实际高度
  const contentHeight = await page.evaluate(() => {
    const body = document.body;
    const html = document.documentElement;
    return Math.max(
      body.scrollHeight,
      body.offsetHeight,
      html.clientHeight,
      html.scrollHeight,
      html.offsetHeight
    );
  });

  // 重新设置视口为内容实际高度
  await page.setViewport({
    width: PAGE_WIDTH,
    height: contentHeight,
    deviceScaleFactor: 1,
  });

  // 截图
  await page.screenshot({
    path: outputPath,
    clip: {
      x: 0,
      y: 0,
      width: PAGE_WIDTH,
      height: contentHeight,
    },
    type: 'png',
  });

  await browser.close();
  console.log(`✅ 高清截图完成: ${PAGE_WIDTH}×${contentHeight}`);
  return outputPath;
}

module.exports = { hiresPoster };
