/**
 * 海报截图模块
 * 
 * 使用 puppeteer-core + Chromium 浏览器
 * 
 * Chromium 浏览器自动检测（优先级从高到低）：
 *   1. Playwright chrome-headless-shell（macOS/Linux 已安装则用）
 *   2. Playwright Google Chrome for Testing
 *   3. 系统 Chrome/Chromium
 *   4. 环境变量 PLAYWRIGHT_CHROMIUM_PATH
 * 
 * 如果都找不到：打印友好的安装提示
 */

const path = require('path');
const { existsSync } = require('fs');
const { execSync } = require('child_process');
const puppeteer = require('puppeteer-core');

const PAGE_WIDTH = 780; // 海报固定宽度

/**
 * 递归查找文件（跨平台 Windows/macOS/Linux）
 */
function findFile(startPath, patterns) {
  if (!existsSync(startPath)) return null;
  try {
    const { stdout } = execSync(
      `find "${startPath}" -maxdepth 6 -name "${patterns[0]}" -type f 2>/dev/null | head -5`,
      { timeout: 10000 }
    );
    const lines = stdout.trim().split('\n').filter(Boolean);
    // 返回存在的最小路径（最浅）
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && existsSync(trimmed)) return trimmed;
    }
  } catch (e) { /* find failed, continue */ }
  return null;
}

/**
 * 查找 macOS Chrome
 */
function findMacChrome() {
  const base = '/Applications';
  const candidates = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  
  // 搜索 Applications
  const found = findFile(base, ['Google Chrome', 'Chromium']);
  if (found) {
    const appName = found.split('/').pop().replace('.app', '');
    return found.replace('.app/Contents/MacOS/' + appName, '.app/Contents/MacOS/' + found.split('/').pop().split(' ').join('\\ '));
  }
  return null;
}

/**
 * 查找 Linux Chrome
 */
function findLinuxChrome() {
  const candidates = [
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/snap/bin/chromium',
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return null;
}

/**
 * 查找 Windows Chrome
 */
function findWindowsChrome() {
  const base = process.env.PROGRAMFILES || 'C:\\Program Files';
  const baseX86 = process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)';
  const localApp = process.env.LOCALAPPDATA || '';
  
  const candidates = [
    base + '\\Google\\Chrome\\Application\\chrome.exe',
    baseX86 + '\\Google\\Chrome\\Application\\chrome.exe',
    localApp + '\\Google\\Chrome\\Application\\chrome.exe',
    base + '\\Chromium\\Application\\chrome.exe',
    baseX86 + '\\Chromium\\Application\\chrome.exe',
    localApp + '\\Chromium\\Application\\chrome.exe',
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return null;
}

/**
 * 查找系统中可用的 Chromium
 */
async function findChromium() {
  const home = process.env.HOME || '';
  const cache = home + '/Library/Caches/ms-playwright';
  
  // 1. Playwright chrome-headless-shell（macOS ARM64）
  const headlessPaths = [
    cache + '/chromium_headless_shell-1217/chrome-headless-shell-mac-arm64/chrome-headless-shell',
    cache + '/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell',
    cache + '/chromium_headless_shell-1217/chrome-headless-shell-linux64/chrome-headless-shell',
    cache + '/chromium_headless_shell-1208/chrome-headless-shell-linux64/chrome-headless-shell',
  ];
  for (const p of headlessPaths) {
    if (existsSync(p)) {
      console.log('✅ Playwright headless-shell:', p);
      return p;
    }
  }

  // 2. Playwright Google Chrome for Testing
  const chromePaths = [
    cache + '/chromium-1217/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
    cache + '/chromium-1208/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
    cache + '/chromium-1217/chrome-linux64/Google Chrome for Testing',
    cache + '/chromium-1208/chrome-linux64/Google Chrome for Testing',
  ];
  for (const p of chromePaths) {
    if (existsSync(p)) {
      console.log('✅ Playwright Chrome for Testing:', p);
      return p;
    }
  }

  // 3. 系统 Chrome（按平台）
  const platform = process.platform;
  let sysChrome = null;
  if (platform === 'darwin') sysChrome = findMacChrome();
  else if (platform === 'linux') sysChrome = findLinuxChrome();
  else if (platform === 'win32') sysChrome = findWindowsChrome();
  
  if (sysChrome && existsSync(sysChrome)) {
    console.log('✅ 系统 Chrome:', sysChrome);
    return sysChrome;
  }

  // 4. @sparticuz/chromium（服务器环境）
  try {
    const chromium = require('@sparticuz/chromium');
    const p = await chromium.executablePath();
    if (p && existsSync(p)) {
      console.log('✅ @sparticuz/chromium:', p);
      return p;
    }
  } catch (e) { /* not available */ }

  // 5. 环境变量
  if (process.env.PLAYWRIGHT_CHROMIUM_PATH && existsSync(process.env.PLAYWRIGHT_CHROMIUM_PATH)) {
    console.log('✅ PLAYWRIGHT_CHROMIUM_PATH:', process.env.PLAYWRIGHT_CHROMIUM_PATH);
    return process.env.PLAYWRIGHT_CHROMIUM_PATH;
  }

  throw new Error(
    '❌ 未找到 Chromium 浏览器！\n\n' +
    '请选择以下任一方式安装：\n\n' +
    '  🍎 macOS:\n' +
    '     方式1: 安装 Google Chrome https://www.google.com/chrome/\n' +
    '     方式2: npm install -g playwright && npx playwright install chromium\n\n' +
    '  🪟 Windows:\n' +
    '     方式1: 安装 Google Chrome https://www.google.com/chrome/\n' +
    '     方式2: npm install -g playwright && npx playwright install chromium\n\n' +
    '  🐧 Linux:\n' +
    '     sudo apt install chromium-browser  # Ubuntu/Debian\n' +
    '     sudo dnf install chromium          # Fedora\n' +
    '     或: npm install -g playwright && npx playwright install chromium\n\n' +
    '  📦 或手动指定路径:\n' +
    '     PLAYWRIGHT_CHROMIUM_PATH=/path/to/chromium node server.js\n'
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
      '--disable-web-security',
      '--allow-file-access-from-files',
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

  // 等待字体和外部资源加载
  await new Promise(r => setTimeout(r, 2000));

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
  console.log(`✅ 高清截图完成: ${PAGE_WIDTH}×${contentHeight} → ${outputPath}`);
  return outputPath;
}

module.exports = { hiresPoster };
