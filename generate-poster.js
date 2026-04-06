#!/usr/bin/env node
/**
 * 海报墙生成器 — CLI入口 v5
 * 
 * 支持自然语言和配置两种生成方式
 * 
 * 示例：
 *   node generate-poster.js --nl "生成一张技能海报墙，标题叫'我的技能库'"
 *   node generate-poster.js --nl "生成一张产品介绍海报"
 *   node generate-poster.js --title "自定义标题" --badge "Powered by xxx"
 *   node generate-poster.js --config ./my-poster-config.json
 *   node generate-poster.js --gallery
 *   node generate-poster.js --list
 *   node generate-poster.js --themes
 */

const fs = require('fs');
const path = require('path');
const { 
  generateFromNaturalLanguage,
  generateFromConfig,
  THEMES,
} = require('./generator');

const { screenshotPoster, hiresPoster } = require('./screenshot');

const PROJECT_ROOT = __dirname;
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'posters');
const GALLERY_PATH = path.join(PROJECT_ROOT, 'poster-gallery.html');

// ============================================================
// CLI 参数解析
// ============================================================

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--nl') args.nl = argv[++i];
    else if (argv[i] === '--title') args.title = argv[++i];
    else if (argv[i] === '--subtitle') args.subtitle = argv[++i];
    else if (argv[i] === '--badge') args.badge = argv[++i];
    else if (argv[i] === '--theme') args.theme = argv[++i];
    else if (argv[i] === '--footer1') args.footer1 = argv[++i];
    else if (argv[i] === '--footer2') args.footer2 = argv[++i];
    else if (argv[i] === '--config') args.config = argv[++i];
    else if (argv[i] === '--list') args.list = true;
    else if (argv[i] === '--gallery') args.gallery = true;
    else if (argv[i] === '--themes') args.themes = true;
    else if (argv[i] === '--help') args.help = true;
  }
  return args;
}

function sanitizeFolderName(name) {
  return name
    .replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '-')
    .replace(/--+/g, '-').replace(/^-|-$/g, '').slice(0, 30);
}

function formatDate(isoStr) {
  try {
    const d = new Date(isoStr);
    return d.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(/\//g, '-');
  } catch(e) { return isoStr; }
}

// ============================================================
// 列出历史
// ============================================================

function listPosters() {
  if (!fs.existsSync(OUTPUT_DIR)) { console.log('暂无历史海报'); return; }
  const dirs = fs.readdirSync(OUTPUT_DIR)
    .filter(d => { try { return fs.statSync(path.join(OUTPUT_DIR, d)).isDirectory(); } catch(e) { return false; } })
    .sort().reverse();
  if (!dirs.length) { console.log('暂无历史海报'); return; }
  console.log('\n📁 历史海报列表:\n');
  dirs.forEach(dir => {
    const mp = path.join(OUTPUT_DIR, dir, 'meta.json');
    if (fs.existsSync(mp)) {
      try {
        const m = JSON.parse(fs.readFileSync(mp, 'utf8'));
        console.log(`  📌 ${dir}`);
        console.log(`     标题: ${m.title} | ${m.itemCount}项 | ${m.contentType}`);
        console.log(`     主题: ${m.theme} | ${formatDate(m.date)}`);
        console.log('');
      } catch(e) { console.log(`  📌 ${dir}`); }
    } else { console.log(`  📌 ${dir}`); }
  });
  console.log(`共 ${dirs.length} 个海报`);
}

// ============================================================
// 列出主题
// ============================================================

function listThemes() {
  console.log('\n🎨 可用主题:\n');
  Object.entries(THEMES).forEach(([key, t]) => {
    console.log(`  ${key} — ${t.name}`);
    console.log(`    ${t.description}`);
    console.log('');
  });
}

// ============================================================
// 重建画廊
// ============================================================

function generateGalleryPage() {
  const templatePath = path.join(PROJECT_ROOT, 'poster-gallery.html');
  if (!fs.existsSync(templatePath)) return;
  let template = fs.readFileSync(templatePath, 'utf8');
  
  const posters = [];
  if (fs.existsSync(OUTPUT_DIR)) {
    try {
      const dirs = fs.readdirSync(OUTPUT_DIR)
        .filter(d => { try { return fs.statSync(path.join(OUTPUT_DIR, d)).isDirectory(); } catch(e) { return false; } })
        .sort().reverse();
      for (const dir of dirs) {
        const htmlPath = path.join(OUTPUT_DIR, dir, 'poster.html');
        if (!fs.existsSync(htmlPath)) continue;
        const pngPath = path.join(OUTPUT_DIR, dir, 'poster.png');
        const metaPath = path.join(OUTPUT_DIR, dir, 'meta.json');
        let m = { title: dir, date: dir, itemCount: 0, badge: '', contentType: 'custom', theme: 'minimal-light' };
        if (fs.existsSync(metaPath)) { try { m = JSON.parse(fs.readFileSync(metaPath, 'utf8')); } catch(e) {} }
        posters.push({
          dir, title: m.title || dir,
          date: m.date || dir, dateStr: formatDate(m.date || dir),
          itemCount: m.itemCount || 0,
          badge: m.badge || '', contentType: m.contentType || 'custom',
          theme: THEMES[m.theme] ? THEMES[m.theme].name : m.theme,
          htmlUrl: `./posters/${encodeURIComponent(dir)}/poster.html`,
          pngUrl: `./posters/${encodeURIComponent(dir)}/poster.png`,
          hasPng: fs.existsSync(pngPath),
        });
      }
    } catch(e) {}
  }
  
  template = template.replace('<!--GALLERY_DATA-->', JSON.stringify(posters));
  fs.writeFileSync(GALLERY_PATH, template);
  console.log(`✅ 画廊已更新: ${posters.length} 个海报`);
}

// ============================================================
// 主函数
// ============================================================

async function main() {
  const args = parseArgs(process.argv);
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  
  if (args.help) {
    console.log(`
🎨 海报墙生成器 v5

用法:
  # 自然语言模式（推荐）
  node generate-poster.js --nl "生成一张技能海报墙"
  node generate-poster.js --nl "生成一张产品介绍海报，温暖风格"
  node generate-poster.js --nl "标题：我的团队 副标题：共创未来 badge：Powered by us"

  # 配置模式
  node generate-poster.js --title "自定义标题" --badge "xxx" --footer1 "标语1"

  # 其他
  node generate-poster.js --themes     列出所有主题
  node generate-poster.js --list       查看历史海报
  node generate-poster.js --gallery    重建画廊页面
  node generate-poster.js --help       显示帮助
    `);
    return;
  }
  
  if (args.themes) { listThemes(); return; }
  if (args.list) { listPosters(); return; }
  if (args.gallery) { console.log('请启动 server.js 并访问 /web/gallery.html'); return; }
  
  // ---- 生成海报 ----
  
  let result;
  if (args.nl) {
    // 自然语言模式，支持 --theme / --badge / --footer1 / --footer2 / --title 覆盖
    const overrideConfig = {};
    if (args.theme) overrideConfig.theme = args.theme;
    if (args.badge || args.title || args.subtitle) {
      overrideConfig.hero = {
        badge: args.badge || '',
        title: args.title || '',
        subtitle: args.subtitle || '',
      };
    }
    if (args.footer1 || args.footer2 || args.logo) {
      overrideConfig.footer = {
        line1: args.footer1 || '',
        line2: args.footer2 || '',
        logoPath: args.logo || process.env.POSTER_LOGO_PATH || null,
        brandUrl: args.brandUrl || process.env.POSTER_BRAND_NAME || 'PosterHub',
      };
    } else {
      // 默认启用 logo
      overrideConfig.footer = {
        logoPath: process.env.POSTER_LOGO_PATH || null,
        brandUrl: process.env.POSTER_BRAND_NAME || 'PosterHub',
      };
    }
    result = generateFromNaturalLanguage(args.nl, overrideConfig);
  } else {
    // 配置覆盖模式
    const overrideConfig = {};
    if (args.title) overrideConfig.hero = { badge: args.badge || '', title: args.title, subtitle: args.subtitle || '' };
    if (args.footer1) overrideConfig.footer = { line1: args.footer1, line2: args.footer2 || '' };
    if (args.theme) overrideConfig.theme = args.theme;
    result = generateFromNaturalLanguage('生成一张内容海报', overrideConfig);
  }
  
  const { html, config, items, theme } = result;
  
  // 创建版本文件夹
  const now = new Date();
  const dateStr = now.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-');
  const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '-');
  const folderName = sanitizeFolderName(`${dateStr}_${timeStr}_${config.hero.title}`);
  const outputDir = path.join(OUTPUT_DIR, folderName);
  fs.mkdirSync(outputDir, { recursive: true });
  
  // 写入 HTML
  const htmlPath = path.join(outputDir, 'poster.html');
  const pngPath = path.join(outputDir, 'poster.png');
  fs.writeFileSync(htmlPath, html);
  console.log(`✅ HTML生成: ${htmlPath}`);
  
  // 高清截图（780px原生 + CSS×2 + Logo嵌入）
  await hiresPoster(htmlPath, pngPath);
  
  // 写入元数据
  const meta = {
    title: config.hero.title,
    subtitle: config.hero.subtitle,
    badge: config.hero.badge,
    footerLine1: config.footer.line1,
    footerLine2: config.footer.line2,
    theme: config.theme,
    themeName: theme.name,
    contentType: config.contentType,
    date: now.toISOString(),
    itemCount: config.sections.reduce((sum, s) => sum + (s.items?.length || 0), 0),
    sections: config.sections.map(s => ({ label: s.label, count: s.items?.length || 0 })),
  };
  fs.writeFileSync(path.join(outputDir, 'meta.json'), JSON.stringify(meta, null, 2));
  
  // 重建画廊逻辑已废弃，使用 server.js 动态接口
  // generateGalleryPage();
  
  console.log(`
✨ 生成完成！

📁 输出目录: ${outputDir}
📷 海报图片: ${pngPath}
🌐 HTML源码: ${htmlPath}
📋 元数据:   ${path.join(outputDir, 'meta.json')}

📊 本次配置:
   类型: ${config.contentType}
   主题: ${theme.name}
   标题: ${config.hero.title}
   角标: ${config.hero.badge}
   项目: ${config.sections.reduce((sum, s) => sum + (s.items?.length || 0), 0)}项
`);
}

main().catch(console.error);
