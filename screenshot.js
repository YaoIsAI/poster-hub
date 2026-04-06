/**
 * 海报截图模块
 * 支持普通截图 + 高清截图（CSS ×2 + Logo 嵌入）
 */

const path = require('path');
const fs = require('fs');

/**
 * 高清截图：直接用 780px viewport 截图（CSS 已在 generator.js 输出为 780px）
 */
async function hiresPoster(htmlPath, outputPath) {
  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 780, height: 10000 } });
  await page.goto('file://' + path.resolve(htmlPath), { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  const h = await page.evaluate(() => document.body.scrollHeight);
  await page.screenshot({ path: outputPath, clip: { x: 0, y: 0, width: 780, height: h }, type: 'png' });
  await browser.close();
  console.log('✅ 高清截图: 780×' + h);
  return outputPath;
}

/**
 * 普通截图（原始实现，scale参数未使用）
 */
async function screenshotPoster(htmlPath, outputPath, scale = 2) {
  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  
  const tempPage = await browser.newPage({ viewport: { width: 430, height: 3000 } });
  await tempPage.goto('file://' + path.resolve(htmlPath), { waitUntil: 'networkidle' });
  
  const posterBounds = await tempPage.evaluate(() => {
    const poster = document.querySelector('.poster');
    if (!poster) return { width: 390, height: 2000 };
    return {
      width: Math.min(poster.offsetWidth, 430),
      height: Math.max(poster.scrollHeight, poster.offsetHeight),
    };
  });
  await tempPage.close();
  
  const vpWidth = Math.min(posterBounds.width * scale + 4, 780);
  const vpHeight = Math.max(posterBounds.height * scale + 20, 1200);
  
  const page = await browser.newPage({ viewport: { width: vpWidth, height: vpHeight } });
  await page.goto('file://' + path.resolve(htmlPath), { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  
  await page.evaluate(() => {
    document.body.style.cssText = 'width:100%!important;max-width:none!important;margin:0!important;padding:0!important;';
    const poster = document.querySelector('.poster');
    if (poster) poster.style.cssText = 'width:100%!important;max-width:none!important;margin:0!important;';
  });
  await page.waitForTimeout(300);
  
  await page.screenshot({ path: outputPath, fullPage: true, type: 'png' });
  await browser.close();
  return outputPath;
}

module.exports = { screenshotPoster, hiresPoster };
