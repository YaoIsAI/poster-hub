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
 */

const path = require('path');
const { existsSync } = require('fs');
const { execSync } = require('child_process');
const puppeteer = require('puppeteer-core');

const PAGE_WIDTH = 780; // 默认海报宽度
const MAX_HEIGHT = 5000; // 安全上限

/**
 * 查找 macOS Chrome
 */
function findMacChrome() {
  const candidates = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return null;
}

/**
 * 查找 Linux Chrome
 */
function findLinuxChrome() {
  const candidates = ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'];
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

  // 1. Playwright chrome-headless-shell
  const headlessPaths = [
    cache + '/chromium_headless_shell-1217/chrome-headless-shell-mac-arm64/chrome-headless-shell',
    cache + '/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell',
    cache + '/chromium_headless_shell-1217/chrome-headless-shell-linux64/chrome-headless-shell',
    cache + '/chromium_headless_shell-1208/chrome-headless-shell-linux64/chrome-headless-shell',
  ];
  for (const p of headlessPaths) {
    if (existsSync(p)) { console.log('✅ Playwright headless-shell:', p); return p; }
  }

  // 2. Playwright Google Chrome for Testing
  const chromePaths = [
    cache + '/chromium-1217/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
    cache + '/chromium-1208/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
    cache + '/chromium-1217/chrome-linux64/Google Chrome for Testing',
    cache + '/chromium-1208/chrome-linux64/Google Chrome for Testing',
  ];
  for (const p of chromePaths) {
    if (existsSync(p)) { console.log('✅ Playwright Chrome for Testing:', p); return p; }
  }

  // 3. 系统 Chrome
  const platform = process.platform;
  let sysChrome = null;
  if (platform === 'darwin') sysChrome = findMacChrome();
  else if (platform === 'linux') sysChrome = findLinuxChrome();
  else if (platform === 'win32') sysChrome = findWindowsChrome();
  if (sysChrome && existsSync(sysChrome)) { console.log('✅ 系统 Chrome:', sysChrome); return sysChrome; }

  // 4. @sparticuz/chromium
  try {
    const chromium = require('@sparticuz/chromium');
    const p = await chromium.executablePath();
    if (p && existsSync(p)) { console.log('✅ @sparticuz/chromium:', p); return p; }
  } catch (e) { /* not available */ }

  // 5. 环境变量
  if (process.env.PLAYWRIGHT_CHROMIUM_PATH && existsSync(process.env.PLAYWRIGHT_CHROMIUM_PATH)) {
    console.log('✅ PLAYWRIGHT_CHROMIUM_PATH:', process.env.PLAYWRIGHT_CHROMIUM_PATH);
    return process.env.PLAYWRIGHT_CHROMIUM_PATH;
  }

  throw new Error(
    '❌ 未找到 Chromium 浏览器！\n\n' +
    '  🍎 macOS: 安装 Google Chrome https://www.google.com/chrome/\n' +
    '  🪟 Windows: 安装 Google Chrome https://www.google.com/chrome/\n' +
    '  🐧 Linux: sudo apt install chromium-browser\n' +
    '  📦 或: npm install -g playwright && npx playwright install chromium\n'
  );
}

/**
 * 测量海报内容的真实高度
 * 策略：用小视口加载（避免 CSS media query），然后滚动获取自然高度
 */
async function measurePosterHeight(page) {
  const info = await page.evaluate(() => {
    const poster = document.querySelector('.poster');
    if (!poster) return { error: 'no-poster', height: 0 };
    
    // poster 的 offsetHeight 已经是渲染后的实际高度
    // 在 flexbox 中，即使视口很小，poster 仍会按内容高度撑开
    const height = poster.offsetHeight;
    const width = poster.offsetWidth;
    
    // 检查关键内容是否存在
    const hasTitle = !!poster.querySelector('.hero-title')?.textContent?.trim();
    const hasContent = poster.querySelector('.hero') !== null;
    
    return { height, width, hasTitle, hasContent, posterHeight: height };
  });
  
  console.log(`📐 内容测量: ${info.width}×${info.height}px | 有标题:${info.hasTitle} | 有内容:${info.hasContent}`);
  
  if (info.error === 'no-poster') {
    throw new Error('HTML 中未找到 .poster 元素，请检查海报生成逻辑');
  }
  
  if (!info.hasContent) {
    throw new Error('海报内容为空（.hero 不存在），请检查 HTML 生成逻辑');
  }
  
  if (info.height < 100) {
    console.warn('\u26A0 警告：海报高度异常低 (' + info.height + 'px)，可能是 CSS 未加载');
  }
  
  return Math.min(Math.max(info.height, 200), MAX_HEIGHT);
}

/**
 * 高清海报截图
 * @param {string} htmlPath - HTML 文件路径
 * @param {string} outputPath - PNG 输出路径
 * @returns {Promise<string>} - 输出文件路径
 */
async function hiresPoster(htmlPath, outputPath, options = {}) {
  const targetWidth = Math.max(320, Number(options.width) || PAGE_WIDTH);
  const fixedHeight = options.height ? Math.min(Math.max(200, Number(options.height)), MAX_HEIGHT) : null;
  const executablePath = await findChromium();

  const browser = await puppeteer.launch({
    executablePath,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--disable-web-security',
      '--allow-file-access-from-files',
    ],
    headless: true,
  });

  const page = await browser.newPage();

  // 设置固定宽度（与海报 max-width 一致），高度设大一些让内容自然撑开
  await page.setViewport({
    width: targetWidth,
    height: fixedHeight || 2000,
    deviceScaleFactor: 1,
  });

  const fileUrl = 'file://' + path.resolve(htmlPath);
  await page.goto(fileUrl, { waitUntil: 'networkidle0' });

  // 等待字体和外部资源加载
  // 使用 document.fonts.ready 确保所有字体（包括 Google Fonts）已加载
  try {
    await page.evaluate(() => document.fonts.ready);
    console.log('✅ 字体加载完成');
  } catch (e) {
    // 如果字体 API 不可用，回退到固定等待
    console.log('ℹ️ 字体 API 不可用，使用固定等待');
    await new Promise(r => setTimeout(r, 3000));
  }

  // 再等一小段时间确保渲染稳定
  await new Promise(r => setTimeout(r, 500));

  let contentHeight = fixedHeight;
  if (!contentHeight) {
    // 自适应高度（历史行为）
    contentHeight = await measurePosterHeight(page);
    console.log(`📐 最终截图高度: ${contentHeight}px`);

    // 重新设置视口（高度=内容高度，避免底部留白）
    await page.setViewport({
      width: targetWidth,
      height: contentHeight,
      deviceScaleFactor: 1,
    });
  } else {
    console.log(`📐 固定尺寸截图: ${targetWidth}×${contentHeight}px`);
  }

  // 等渲染稳定
  await new Promise(r => setTimeout(r, 300));

  // 截图
  await page.screenshot({
    path: outputPath,
    clip: {
      x: 0,
      y: 0,
      width: targetWidth,
      height: contentHeight,
    },
    type: 'png',
  });

  await browser.close();
  console.log(`✅ 高清截图: ${targetWidth}×${contentHeight} → ${path.basename(outputPath)}`);
  return outputPath;
}

module.exports = { hiresPoster };
