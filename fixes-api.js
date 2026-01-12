/**
 * 微爱修复API - 修复所有缺失的功能
 * 包含：礼物、红包、VIP购买、自定义API、CosyVoice TTS等
 */

module.exports = function(app, pool, authMiddleware) {
  
  // ==================== 礼物系统 ====================
  
  // 获取礼物列表
  app.get('/api/gifts', async (req, res) => {
    try {
      const [gifts] = await pool.execute(
        'SELECT * FROM gifts WHERE isActive = TRUE ORDER BY price ASC'
      );
      
      // 如果没有礼物，返回默认礼物
      if (gifts.length === 0) {
        const defaultGifts = [
          { id: 1, name: '小红心', icon: '❤️', price: 1, description: '表达喜欢' },
          { id: 2, name: '玫瑰花', icon: '🌹', price: 10, description: '浪漫的玫瑰' },
          { id: 3, name: '巧克力', icon: '🍫', price: 20, description: '甜蜜的巧克力' },
          { id: 4, name: '钻石', icon: '💎', price: 50, description: '珍贵的钻石' },
          { id: 5, name: '皇冠', icon: '👑', price: 100, description: '尊贵的皇冠' },
          { id: 6, name: '火箭', icon: '🚀', price: 500, description: '冲向星空' },
          { id: 7, name: '城堡', icon: '🏰', price: 1000, description: '梦幻城堡' },
          { id: 8, name: '星球', icon: '🌍', price: 5000, description: '送你一个星球' }
        ];
        return res.json(defaultGifts);
      }
      
      res.json(gifts);
    } catch (err) {
      console.error('Get gifts error:', err);
      res.status(500).json({ error: { message: '获取礼物列表失败' } });
    }
  });
  
  // 发送礼物
  app.post('/api/gifts/send', authMiddleware, async (req, res) => {
    try {
      const { characterId, giftId, quantity = 1 } = req.body;
      
      if (!characterId || !giftId) {
        return res.status(400).json({ error: { message: '参数不完整' } });
      }
      
      // 获取礼物信息
      const [gifts] = await pool.execute('SELECT * FROM gifts WHERE id = ?', [giftId]);
      let gift;
      
      if (gifts.length === 0) {
        // 使用默认礼物价格
        const defaultPrices = { 1: 1, 2: 10, 3: 20, 4: 50, 5: 100, 6: 500, 7: 1000, 8: 5000 };
        gift = { id: giftId, price: defaultPrices[giftId] || 10 };
      } else {
        gift = gifts[0];
      }
      
      const totalCost = gift.price * quantity;
      
      // 检查用户金币
      const [wallets] = await pool.execute('SELECT * FROM wallets WHERE userId = ?', [req.user.id]);
      if (wallets.length === 0 || wallets[0].coins < totalCost) {
        return res.status(400).json({ error: { message: '金币不足' } });
      }
      
      // 扣除金币
      await pool.execute(
        'UPDATE wallets SET coins = coins - ?, totalCoinsSpent = totalCoinsSpent + ? WHERE userId = ?',
        [totalCost, totalCost, req.user.id]
      );
      
      // 记录礼物发送
      await pool.execute(
        'INSERT INTO giftRecords (userId, characterId, giftId, quantity, totalCoins) VALUES (?, ?, ?, ?, ?)',
        [req.user.id, characterId, giftId, quantity, totalCost]
      );
      
      // 增加好感度
      const affinityGain = Math.floor(totalCost / 10);
      await pool.execute(
        `INSERT INTO characterAffinity (userId, characterId, affinityPoints) 
         VALUES (?, ?, ?) 
         ON DUPLICATE KEY UPDATE affinityPoints = affinityPoints + ?`,
        [req.user.id, characterId, affinityGain, affinityGain]
      );
      
      res.json({ 
        success: true, 
        message: '礼物发送成功',
        coinsSpent: totalCost,
        affinityGained: affinityGain
      });
    } catch (err) {
      console.error('Send gift error:', err);
      res.status(500).json({ error: { message: '发送礼物失败' } });
    }
  });
  
  // 获取礼物记录
  app.get('/api/gifts/records', authMiddleware, async (req, res) => {
    try {
      const [records] = await pool.execute(
        `SELECT gr.*, g.name as giftName, g.icon as giftIcon, c.name as characterName
         FROM giftRecords gr
         LEFT JOIN gifts g ON gr.giftId = g.id
         LEFT JOIN aiCharacters c ON gr.characterId = c.id
         WHERE gr.userId = ?
         ORDER BY gr.createdAt DESC
         LIMIT 50`,
        [req.user.id]
      );
      res.json(records);
    } catch (err) {
      console.error('Get gift records error:', err);
      res.status(500).json({ error: { message: '获取礼物记录失败' } });
    }
  });
  
  // ==================== 红包系统 ====================
  
  // 发送红包
  app.post('/api/redpackets/send', authMiddleware, async (req, res) => {
    try {
      const { characterId, amount, message = '' } = req.body;
      
      if (!characterId || !amount || amount < 1) {
        return res.status(400).json({ error: { message: '参数不完整' } });
      }
      
      // 检查用户金币
      const [wallets] = await pool.execute('SELECT * FROM wallets WHERE userId = ?', [req.user.id]);
      if (wallets.length === 0 || wallets[0].coins < amount) {
        return res.status(400).json({ error: { message: '金币不足' } });
      }
      
      // 扣除金币
      await pool.execute(
        'UPDATE wallets SET coins = coins - ?, totalCoinsSpent = totalCoinsSpent + ? WHERE userId = ?',
        [amount, amount, req.user.id]
      );
      
      // 记录红包
      await pool.execute(
        'INSERT INTO redPacketRecords (userId, characterId, amount, message) VALUES (?, ?, ?, ?)',
        [req.user.id, characterId, amount, message]
      );
      
      // 增加好感度（红包给更多好感度）
      const affinityGain = Math.floor(amount / 5);
      await pool.execute(
        `INSERT INTO characterAffinity (userId, characterId, affinityPoints) 
         VALUES (?, ?, ?) 
         ON DUPLICATE KEY UPDATE affinityPoints = affinityPoints + ?`,
        [req.user.id, characterId, affinityGain, affinityGain]
      );
      
      res.json({ 
        success: true, 
        message: '红包发送成功',
        coinsSpent: amount,
        affinityGained: affinityGain
      });
    } catch (err) {
      console.error('Send red packet error:', err);
      res.status(500).json({ error: { message: '发送红包失败' } });
    }
  });
  
  // 获取红包记录
  app.get('/api/redpackets/records', authMiddleware, async (req, res) => {
    try {
      const [records] = await pool.execute(
        `SELECT rp.*, c.name as characterName
         FROM redPacketRecords rp
         LEFT JOIN aiCharacters c ON rp.characterId = c.id
         WHERE rp.userId = ?
         ORDER BY rp.createdAt DESC
         LIMIT 50`,
        [req.user.id]
      );
      res.json(records);
    } catch (err) {
      console.error('Get red packet records error:', err);
      res.status(500).json({ error: { message: '获取红包记录失败' } });
    }
  });
  
  // ==================== VIP购买系统 ====================
  
  // 获取VIP套餐
  app.get('/api/vip/packages', async (req, res) => {
    try {
      const [configs] = await pool.execute('SELECT * FROM vipLevelConfigs ORDER BY level ASC');
      
      // 添加价格信息
      const packages = configs.map(c => ({
        ...c,
        monthlyPrice: c.level === 0 ? 0 : c.level === 1 ? 30 : c.level === 2 ? 68 : 128,
        quarterlyPrice: c.level === 0 ? 0 : c.level === 1 ? 80 : c.level === 2 ? 180 : 350,
        yearlyPrice: c.level === 0 ? 0 : c.level === 1 ? 298 : c.level === 2 ? 680 : 1280
      }));
      
      res.json(packages);
    } catch (err) {
      console.error('Get VIP packages error:', err);
      res.status(500).json({ error: { message: '获取VIP套餐失败' } });
    }
  });
  
  // 购买VIP（使用金币）
  app.post('/api/vip/purchase', authMiddleware, async (req, res) => {
    try {
      const { level, duration = 'monthly' } = req.body;
      
      if (!level || level < 1 || level > 3) {
        return res.status(400).json({ error: { message: '无效的VIP等级' } });
      }
      
      // 计算价格（金币）
      const prices = {
        1: { monthly: 300, quarterly: 800, yearly: 2980 },
        2: { monthly: 680, quarterly: 1800, yearly: 6800 },
        3: { monthly: 1280, quarterly: 3500, yearly: 12800 }
      };
      
      const price = prices[level][duration] || prices[level].monthly;
      
      // 检查金币
      const [wallets] = await pool.execute('SELECT * FROM wallets WHERE userId = ?', [req.user.id]);
      if (wallets.length === 0 || wallets[0].coins < price) {
        return res.status(400).json({ error: { message: '金币不足，请先充值' } });
      }
      
      // 计算过期时间
      const now = new Date();
      let expireAt;
      switch (duration) {
        case 'quarterly':
          expireAt = new Date(now.setMonth(now.getMonth() + 3));
          break;
        case 'yearly':
          expireAt = new Date(now.setFullYear(now.getFullYear() + 1));
          break;
        default:
          expireAt = new Date(now.setMonth(now.getMonth() + 1));
      }
      
      // 扣除金币
      await pool.execute(
        'UPDATE wallets SET coins = coins - ?, totalCoinsSpent = totalCoinsSpent + ? WHERE userId = ?',
        [price, price, req.user.id]
      );
      
      // 更新VIP状态
      await pool.execute(
        'UPDATE users SET vipLevel = ?, vipExpireAt = ? WHERE id = ?',
        [level, expireAt, req.user.id]
      );
      
      // 记录购买
      await pool.execute(
        'INSERT INTO vipPurchaseRecords (userId, level, duration, price, expireAt) VALUES (?, ?, ?, ?, ?)',
        [req.user.id, level, duration, price, expireAt]
      );
      
      res.json({ 
        success: true, 
        message: 'VIP开通成功',
        vipLevel: level,
        expireAt: expireAt
      });
    } catch (err) {
      console.error('Purchase VIP error:', err);
      res.status(500).json({ error: { message: 'VIP购买失败' } });
    }
  });
  
  // ==================== 自定义API配置 ====================
  
  // 获取用户API配置
  app.get('/api/user/api-config', authMiddleware, async (req, res) => {
    try {
      const [configs] = await pool.execute(
        'SELECT * FROM userApiConfigs WHERE userId = ?',
        [req.user.id]
      );
      
      if (configs.length === 0) {
        return res.json({
          apiType: 'default',
          customApiUrl: '',
          customApiKey: '',
          customModel: '',
          ttsType: 'default',
          cosyVoiceUrl: '',
          cosyVoiceKey: ''
        });
      }
      
      res.json(configs[0]);
    } catch (err) {
      console.error('Get API config error:', err);
      res.status(500).json({ error: { message: '获取API配置失败' } });
    }
  });
  
  // 保存用户API配置
  app.post('/api/user/api-config', authMiddleware, async (req, res) => {
    try {
      const { 
        apiType, 
        customApiUrl, 
        customApiKey, 
        customModel,
        ttsType,
        cosyVoiceUrl,
        cosyVoiceKey
      } = req.body;
      
      // 检查是否已有配置
      const [existing] = await pool.execute(
        'SELECT id FROM userApiConfigs WHERE userId = ?',
        [req.user.id]
      );
      
      if (existing.length > 0) {
        await pool.execute(
          `UPDATE userApiConfigs SET 
           apiType = ?, customApiUrl = ?, customApiKey = ?, customModel = ?,
           ttsType = ?, cosyVoiceUrl = ?, cosyVoiceKey = ?, updatedAt = NOW()
           WHERE userId = ?`,
          [apiType, customApiUrl, customApiKey, customModel, ttsType, cosyVoiceUrl, cosyVoiceKey, req.user.id]
        );
      } else {
        await pool.execute(
          `INSERT INTO userApiConfigs 
           (userId, apiType, customApiUrl, customApiKey, customModel, ttsType, cosyVoiceUrl, cosyVoiceKey) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [req.user.id, apiType, customApiUrl, customApiKey, customModel, ttsType, cosyVoiceUrl, cosyVoiceKey]
        );
      }
      
      res.json({ success: true, message: 'API配置已保存' });
    } catch (err) {
      console.error('Save API config error:', err);
      res.status(500).json({ error: { message: '保存API配置失败' } });
    }
  });
  
  // ==================== CosyVoice TTS ====================
  
  // CosyVoice语音合成
  app.post('/api/tts/cosyvoice', authMiddleware, async (req, res) => {
    try {
      const { text, voice = 'default', speed = 1.0 } = req.body;
      
      if (!text) {
        return res.status(400).json({ error: { message: '请提供文本' } });
      }
      
      // 获取用户的CosyVoice配置
      const [configs] = await pool.execute(
        'SELECT cosyVoiceUrl, cosyVoiceKey FROM userApiConfigs WHERE userId = ?',
        [req.user.id]
      );
      
      if (configs.length === 0 || !configs[0].cosyVoiceUrl) {
        return res.status(400).json({ error: { message: '请先配置CosyVoice API' } });
      }
      
      const { cosyVoiceUrl, cosyVoiceKey } = configs[0];
      
      // 调用CosyVoice API
      // 参考: https://github.com/FunAudioLLM/CosyVoice
      const response = await fetch(`${cosyVoiceUrl}/inference_sft`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': cosyVoiceKey ? `Bearer ${cosyVoiceKey}` : ''
        },
        body: JSON.stringify({
          tts_text: text,
          spk_id: voice,
          speed: speed
        })
      });
      
      if (!response.ok) {
        throw new Error('CosyVoice API调用失败');
      }
      
      const audioBuffer = await response.arrayBuffer();
      res.set('Content-Type', 'audio/wav');
      res.send(Buffer.from(audioBuffer));
    } catch (err) {
      console.error('CosyVoice TTS error:', err);
      res.status(500).json({ error: { message: 'CosyVoice语音合成失败: ' + err.message } });
    }
  });
  
  // 获取CosyVoice可用音色
  app.get('/api/tts/cosyvoice/voices', authMiddleware, async (req, res) => {
    try {
      // 获取用户的CosyVoice配置
      const [configs] = await pool.execute(
        'SELECT cosyVoiceUrl, cosyVoiceKey FROM userApiConfigs WHERE userId = ?',
        [req.user.id]
      );
      
      if (configs.length === 0 || !configs[0].cosyVoiceUrl) {
        // 返回默认音色列表
        return res.json([
          { id: 'default', name: '默认音色' },
          { id: 'female_1', name: '温柔女声' },
          { id: 'female_2', name: '甜美女声' },
          { id: 'male_1', name: '成熟男声' },
          { id: 'male_2', name: '阳光男声' }
        ]);
      }
      
      const { cosyVoiceUrl, cosyVoiceKey } = configs[0];
      
      // 调用CosyVoice获取音色列表
      const response = await fetch(`${cosyVoiceUrl}/speakers`, {
        headers: {
          'Authorization': cosyVoiceKey ? `Bearer ${cosyVoiceKey}` : ''
        }
      });
      
      if (!response.ok) {
        throw new Error('获取音色列表失败');
      }
      
      const voices = await response.json();
      res.json(voices);
    } catch (err) {
      console.error('Get CosyVoice voices error:', err);
      // 返回默认音色
      res.json([
        { id: 'default', name: '默认音色' },
        { id: 'female_1', name: '温柔女声' },
        { id: 'female_2', name: '甜美女声' },
        { id: 'male_1', name: '成熟男声' },
        { id: 'male_2', name: '阳光男声' }
      ]);
    }
  });
  
  // ==================== 动态数据生成 ====================
  
  // 生成AI动态
  app.post('/api/admin/generate-moments', authMiddleware, async (req, res) => {
    try {
      // 检查管理员权限
      if (req.user.role !== 'admin') {
        return res.status(403).json({ error: { message: '无权限' } });
      }
      
      const count = req.body.count || 10;
      
      // 获取一些角色
      const [characters] = await pool.execute(
        'SELECT id, name, avatar FROM aiCharacters WHERE isPublic = TRUE LIMIT 10'
      );
      
      if (characters.length === 0) {
        return res.status(400).json({ error: { message: '没有可用的公开角色' } });
      }
      
      // 预设动态内容
      const momentContents = [
        '今天天气真好，想出去走走~',
        '刚刚看了一部很感人的电影，眼泪都流下来了...',
        '学会了一道新菜，虽然卖相不太好，但味道还不错！',
        '最近在追一部新剧，太好看了，根本停不下来！',
        '今天收到了一份意外的礼物，好开心~',
        '周末打算去爬山，有人一起吗？',
        '最近在学习新技能，感觉自己又进步了一点点',
        '今天的晚霞好美，忍不住拍了好多照片',
        '终于把拖延了很久的事情做完了，感觉轻松多了',
        '刚刚和朋友聊了很久，心情变好了',
        '今天尝试了一家新的咖啡店，味道超赞！',
        '最近在看一本很有意思的书，推荐给大家',
        '今天的工作效率特别高，给自己点个赞',
        '周末的懒觉真是太舒服了~',
        '刚刚做了一个很奇怪的梦，醒来还记得很清楚'
      ];
      
      const insertedMoments = [];
      
      for (let i = 0; i < count; i++) {
        const character = characters[Math.floor(Math.random() * characters.length)];
        const content = momentContents[Math.floor(Math.random() * momentContents.length)];
        
        const [result] = await pool.execute(
          `INSERT INTO moments (authorId, authorType, authorName, authorAvatar, content, likeCount, commentCount) 
           VALUES (?, 'character', ?, ?, ?, ?, ?)`,
          [
            character.id, 
            character.name, 
            character.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${character.name}`,
            content,
            Math.floor(Math.random() * 100),
            Math.floor(Math.random() * 20)
          ]
        );
        
        insertedMoments.push({
          id: result.insertId,
          authorName: character.name,
          content: content
        });
      }
      
      res.json({ 
        success: true, 
        message: `成功生成 ${count} 条动态`,
        moments: insertedMoments
      });
    } catch (err) {
      console.error('Generate moments error:', err);
      res.status(500).json({ error: { message: '生成动态失败' } });
    }
  });
  
  // ==================== 预设头像 ====================
  
  // 获取预设头像列表
  app.get('/api/avatars/presets', async (req, res) => {
    const presets = [
      'https://api.dicebear.com/7.x/bottts/svg?seed=custom1&backgroundColor=b6e3f4',
      'https://api.dicebear.com/7.x/bottts/svg?seed=custom2&backgroundColor=c0aede',
      'https://api.dicebear.com/7.x/bottts/svg?seed=custom3&backgroundColor=ffd5dc',
      'https://api.dicebear.com/7.x/bottts/svg?seed=custom4&backgroundColor=d1d4f9',
      'https://api.dicebear.com/7.x/bottts/svg?seed=custom5&backgroundColor=c9f7d6',
      'https://api.dicebear.com/7.x/bottts/svg?seed=custom6&backgroundColor=ffeaa7',
      'https://api.dicebear.com/7.x/adventurer/svg?seed=girl1&backgroundColor=ffd5dc',
      'https://api.dicebear.com/7.x/adventurer/svg?seed=girl2&backgroundColor=c0aede',
      'https://api.dicebear.com/7.x/adventurer/svg?seed=boy1&backgroundColor=b6e3f4',
      'https://api.dicebear.com/7.x/adventurer/svg?seed=boy2&backgroundColor=d1d4f9',
      'https://api.dicebear.com/7.x/lorelei/svg?seed=anime1&backgroundColor=ffd5dc',
      'https://api.dicebear.com/7.x/lorelei/svg?seed=anime2&backgroundColor=c0aede'
    ];
    res.json(presets);
  });
  
  // 生成随机头像
  app.get('/api/avatars/random', async (req, res) => {
    const styles = ['bottts', 'adventurer', 'lorelei', 'avataaars', 'big-ears'];
    const colors = ['b6e3f4', 'c0aede', 'ffd5dc', 'd1d4f9', 'c9f7d6', 'ffeaa7'];
    
    const style = styles[Math.floor(Math.random() * styles.length)];
    const color = colors[Math.floor(Math.random() * colors.length)];
    const seed = Math.random().toString(36).substring(7);
    
    const url = `https://api.dicebear.com/7.x/${style}/svg?seed=${seed}&backgroundColor=${color}`;
    res.json({ url });
  });
  
  console.log('Fixes API loaded: gifts, redpackets, VIP, custom API, CosyVoice, avatars');
};
