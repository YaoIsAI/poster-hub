// ============================================================
// 模板匹配解析器
// ============================================================

function parseTemplate(text, lang = 'zh') {
  const isZh = lang === 'zh' || !/^[a-zA-Z]/.test(text.trim());
  
  // 技能墙/插件墙
  if (/技能墙|插件墙|skill.*wall/i.test(text)) {
    return {
      contentType: 'skill-wall',
      theme: 'apple-minimal',
      hero: {
        badge: 'OpenClaw Skills',
        title: 'Skill Poster Wall',
        subtitle: isZh ? '探索AI助手能力的无限边界' : 'Explore the infinite possibilities of AI assistant capabilities',
      },
      stats: [],
      sections: [],
      footer: {
        line1: isZh ? '让每一次展示，都值得被记住' : 'Every display deserves to be remembered',
        line2: 'Powered by Precision',
      },
      workflow: [
        { num: '01', title: isZh ? '发现技能' : 'Discover', desc: isZh ? '浏览技能市场' : 'Browse skill marketplace' },
        { num: '02', title: isZh ? '安装配置' : 'Install', desc: isZh ? '一键启用' : 'One-click enable' },
        { num: '03', title: isZh ? '智能协作' : 'Collaborate', desc: isZh ? 'AI助手帮你完成' : 'AI assistant helps you' },
      ],
    };
  }

  // 同事.skill / 离职技能
  if (/同事\.skill|colleague|skill.*离职|skill.*离别/i.test(text)) {
    return {
      contentType: 'custom',
      theme: 'apple-minimal',
      hero: {
        badge: 'GitHub ⭐ 7.6k',
        title: '同事.skill',
        subtitle: isZh ? '将冰冷的离别转化为温暖的 Skill' : 'Transform cold farewell into warm Skill',
      },
      stats: [],
      sections: [
        { 
          label: isZh ? '💬 数据来源' : '💬 Data Sources', 
          items: [
            { emoji: '📨', title: isZh ? '飞书消息' : 'Feishu Messages', desc: isZh ? '输入姓名全自动 API 采集' : 'Auto API collection by name', badge: '飞书', color: '#4A90E2' },
            { emoji: '💬', title: isZh ? '钉钉 / Slack' : 'DingTalk / Slack', desc: isZh ? '浏览器抓取或 API 方式' : 'Browser crawl or API', badge: '工具', color: '#64D2FF' },
            { emoji: '💭', title: isZh ? '微信聊天记录' : 'WeChat Chats', desc: isZh ? 'WeChatMsg / PyWxDump 导出' : 'Export via WeChatMsg', badge: '工具', color: '#64D2FF' },
            { emoji: '📧', title: isZh ? '邮件 / PDF' : 'Email / PDF', desc: isZh ? '.eml .mbox PDF 直接上传' : 'Direct upload', badge: '工具', color: '#64D2FF' },
            { emoji: '✍️', title: isZh ? '直接粘贴文字' : 'Paste Text', desc: isZh ? '任何格式的文本描述' : 'Any text format', badge: '工具', color: '#64D2FF' },
          ]
        },
        { 
          label: isZh ? '⚙️ Skill 结构' : '⚙️ Skill Structure', 
          items: [
            { emoji: '⚙️', title: 'Work Skill', desc: isZh ? '系统规范 / 工作流程 / 经验知识库' : 'System specs / workflows / knowledge', badge: 'AI', color: '#7E57FF' },
            { emoji: '🎭', title: 'Persona', desc: isZh ? '5层性格：硬规则→身份→表达→决策→人际' : '5-layer personality', badge: 'AI', color: '#7E57FF' },
            { emoji: '🔄', title: isZh ? '增量进化' : 'Incremental', desc: isZh ? '追加文件自动 merge，不覆盖已有结论' : 'Auto merge, no overwrite', badge: 'AI', color: '#7E57FF' },
            { emoji: '✏️', title: isZh ? '对话纠正' : 'Correction', desc: isZh ? '说他不会这样 → 写入 Correction 层' : 'Write to Correction layer', badge: 'AI', color: '#7E57FF' },
            { emoji: '⏪', title: isZh ? '版本回滚' : 'Rollback', desc: '/colleague-rollback {slug} {version}', badge: '工具', color: '#64D2FF' },
          ]
        },
        { 
          label: isZh ? '🎯 性格标签' : '🎯 Personality Tags', 
          items: [
            { emoji: '🏢', title: isZh ? '职级支持' : 'Job Levels', desc: isZh ? '字节 2-1~3-3+ · 阿里 P5~P11 · 华为 13~21级' : 'Bytedance/Alibaba/Huawei', badge: '工具', color: '#64D2FF' },
            { emoji: '💼', title: isZh ? '企业文化' : 'Culture', desc: isZh ? '字节范 · 阿里味 · 腾讯味 · 华为味' : 'Company culture styles', badge: '工具', color: '#64D2FF' },
            { emoji: '🎯', title: isZh ? '个性标签' : 'Traits', desc: isZh ? '甩锅高手 · 完美主义 · PUA · 向上管理' : 'Various personality traits', badge: '工具', color: '#64D2FF' },
          ]
        },
        { 
          label: isZh ? '🛠️ 安装使用' : '🛠️ Installation', 
          items: [
            { emoji: '🔧', title: 'Claude Code', desc: isZh ? '/create-colleague → 输入信息 → 生成' : 'Create via command', badge: 'Git', color: '#FF9F43' },
            { emoji: '🦞', title: 'OpenClaw', desc: isZh ? 'git clone 到 ~/.openclaw/workspace/skills/' : 'Clone to skills folder', badge: 'Git', color: '#FF9F43' },
          ]
        },
      ],
      footer: {
        line1: isZh ? '人走了，Skill 留着' : 'The person left, Skill remains',
        line2: isZh ? 'Powered by OpenClaw + Claude Code' : 'Powered by OpenClaw + Claude Code',
        logoPath: process.env.POSTER_LOGO_PATH || null,
        brandUrl: process.env.POSTER_BRAND_NAME || 'PosterHub',
      },
      workflow: [],
    };
  }

  return null;
}

module.exports = { parseTemplate };