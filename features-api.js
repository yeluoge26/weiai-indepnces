// ==================== 微爱新功能API模块 ====================
// 此文件包含所有新功能的后端API实现
// 需要在server.js中引入并使用

const crypto = require('crypto');

// 导出初始化函数
module.exports = function(app, pool, authMiddleware) {

  // ==================== 角色市场功能 ====================

  // 上架角色
  app.post('/api/marketplace/list', authMiddleware, async (req, res) => {
    try {
      const { characterId, price, description } = req.body;
      if (!characterId || !price || price < 1) {
        return res.status(400).json({ error: '参数无效' });
      }
      
      const [chars] = await pool.execute(
        'SELECT id FROM aiCharacters WHERE id = ? AND userId = ?',
        [characterId, req.user.id]
      );
      if (chars.length === 0) {
        return res.status(404).json({ error: '角色不存在' });
      }
      
      const [existing] = await pool.execute(
        'SELECT id FROM characterListings WHERE characterId = ? AND sellerId = ? AND status = "active"',
        [characterId, req.user.id]
      );
      if (existing.length > 0) {
        return res.status(400).json({ error: '角色已上架' });
      }
      
      const [result] = await pool.execute(
        'INSERT INTO characterListings (characterId, sellerId, price, description) VALUES (?, ?, ?, ?)',
        [characterId, req.user.id, price, description || '']
      );
      
      res.json({ success: true, listingId: result.insertId });
    } catch (err) {
      console.error('List character error:', err);
      res.status(500).json({ error: { message: '上架失败' } });
    }
  });

  // 获取市场列表
  app.get('/api/marketplace/listings', async (req, res) => {
    try {
      const { sort = 'hot', search = '', page = 1 } = req.query;
      const limit = 20;
      const offset = (page - 1) * limit;
      
      let orderBy = 'cl.createdAt DESC';
      if (sort === 'hot') orderBy = 'cl.salesCount DESC';
      else if (sort === 'rating') orderBy = 'cl.rating DESC';
      else if (sort === 'price-asc') orderBy = 'cl.price ASC';
      else if (sort === 'price-desc') orderBy = 'cl.price DESC';
      
      const searchParam = `%${search}%`;
      const [listings] = await pool.execute(`
        SELECT cl.*, ac.name, ac.avatar, u.nickname as sellerName
        FROM characterListings cl
        JOIN aiCharacters ac ON cl.characterId = ac.id
        JOIN users u ON cl.sellerId = u.id
        WHERE cl.status = 'active' AND (ac.name LIKE ? OR u.nickname LIKE ?)
        ORDER BY ${orderBy}
        LIMIT ${limit} OFFSET ${offset}
      `, [searchParam, searchParam]);
      
      const [[{ total }]] = await pool.execute(
        'SELECT COUNT(*) as total FROM characterListings WHERE status = "active"'
      );
      
      res.json({
        listings,
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit)
      });
    } catch (err) {
      console.error('Get listings error:', err);
      res.status(500).json({ error: { message: '获取列表失败' } });
    }
  });

  // 购买角色
  app.post('/api/marketplace/purchase', authMiddleware, async (req, res) => {
    try {
      const { listingId } = req.body;
      const buyerId = req.user.id;
      
      const [listings] = await pool.execute(
        'SELECT * FROM characterListings WHERE id = ? AND status = "active"',
        [listingId]
      );
      if (listings.length === 0) {
        return res.status(404).json({ error: '上架已下线' });
      }
      
      const listing = listings[0];
      if (listing.sellerId === buyerId) {
        return res.status(400).json({ error: '不能购买自己的角色' });
      }
      
      const [wallets] = await pool.execute(
        'SELECT coins FROM userWallets WHERE userId = ?',
        [buyerId]
      );
      if (!wallets[0] || wallets[0].coins < listing.price) {
        return res.status(400).json({ error: '金币不足' });
      }
      
      const platformFee = Math.floor(listing.price * 0.1);
      const sellerEarnings = listing.price - platformFee;
      
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        
        await conn.execute(
          'UPDATE userWallets SET coins = coins - ? WHERE userId = ?',
          [listing.price, buyerId]
        );
        
        await conn.execute(
          'UPDATE userWallets SET coins = coins + ? WHERE userId = ?',
          [sellerEarnings, listing.sellerId]
        );
        
        await conn.execute(`
          INSERT INTO characterPurchases 
          (listingId, buyerId, characterId, sellerId, price, platformFee, sellerEarnings)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [listingId, buyerId, listing.characterId, listing.sellerId, listing.price, platformFee, sellerEarnings]);
        
        await conn.execute(`
          UPDATE characterListings 
          SET salesCount = salesCount + 1, totalRevenue = totalRevenue + ?
          WHERE id = ?
        `, [sellerEarnings, listingId]);
        
        const [chars] = await conn.execute(
          'SELECT * FROM aiCharacters WHERE id = ?',
          [listing.characterId]
        );
        if (chars.length > 0) {
          const char = chars[0];
          await conn.execute(`
            INSERT INTO aiCharacters (userId, name, avatar, description, personality, type, category)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `, [buyerId, char.name, char.avatar, char.description, char.personality, 'custom', char.category]);
        }
        
        await conn.commit();
        res.json({ success: true, message: '购买成功' });
      } catch (err) {
        await conn.rollback();
        throw err;
      } finally {
        conn.release();
      }
    } catch (err) {
      console.error('Purchase error:', err);
      res.status(500).json({ error: { message: '购买失败' } });
    }
  });

  // 我的上架
  app.get('/api/marketplace/my-listings', authMiddleware, async (req, res) => {
    try {
      const [listings] = await pool.execute(`
        SELECT cl.*, ac.name, ac.avatar
        FROM characterListings cl
        JOIN aiCharacters ac ON cl.characterId = ac.id
        WHERE cl.sellerId = ?
        ORDER BY cl.createdAt DESC
      `, [req.user.id]);
      
      res.json({ listings });
    } catch (err) {
      console.error('Get my listings error:', err);
      res.status(500).json({ error: { message: '获取列表失败' } });
    }
  });

  // 我的购买
  app.get('/api/marketplace/my-purchases', authMiddleware, async (req, res) => {
    try {
      const [purchases] = await pool.execute(`
        SELECT cp.*, ac.name, ac.avatar, u.nickname as sellerName
        FROM characterPurchases cp
        JOIN aiCharacters ac ON cp.characterId = ac.id
        JOIN users u ON cp.sellerId = u.id
        WHERE cp.buyerId = ?
        ORDER BY cp.createdAt DESC
      `, [req.user.id]);
      
      res.json({ purchases });
    } catch (err) {
      console.error('Get my purchases error:', err);
      res.status(500).json({ error: { message: '获取列表失败' } });
    }
  });

  // 卖家收入统计
  app.get('/api/marketplace/earnings', authMiddleware, async (req, res) => {
    try {
      const [[stats]] = await pool.execute(`
        SELECT 
          COUNT(DISTINCT id) as totalSales,
          COALESCE(SUM(sellerEarnings), 0) as totalEarnings,
          COUNT(DISTINCT characterId) as uniqueCharacters
        FROM characterPurchases
        WHERE sellerId = ?
      `, [req.user.id]);
      
      res.json({
        totalSales: stats?.totalSales || 0,
        totalEarnings: stats?.totalEarnings || 0,
        uniqueCharacters: stats?.uniqueCharacters || 0
      });
    } catch (err) {
      console.error('Get earnings error:', err);
      res.status(500).json({ error: { message: '获取统计失败' } });
    }
  });

  // 下架角色
  app.delete('/api/marketplace/listings/:id', authMiddleware, async (req, res) => {
    try {
      const [listings] = await pool.execute(
        'SELECT * FROM characterListings WHERE id = ? AND sellerId = ?',
        [req.params.id, req.user.id]
      );
      if (listings.length === 0) {
        return res.status(404).json({ error: '上架不存在' });
      }
      
      await pool.execute(
        'UPDATE characterListings SET status = "delisted" WHERE id = ?',
        [req.params.id]
      );
      
      res.json({ success: true });
    } catch (err) {
      console.error('Delist error:', err);
      res.status(500).json({ error: { message: '下架失败' } });
    }
  });

  // 编辑上架信息
  app.put('/api/marketplace/listings/:id', authMiddleware, async (req, res) => {
    try {
      const { price, description } = req.body;
      
      const [listings] = await pool.execute(
        'SELECT * FROM characterListings WHERE id = ? AND sellerId = ?',
        [req.params.id, req.user.id]
      );
      if (listings.length === 0) {
        return res.status(404).json({ error: '上架不存在' });
      }
      
      await pool.execute(
        'UPDATE characterListings SET price = ?, description = ? WHERE id = ?',
        [price, description, req.params.id]
      );
      
      res.json({ success: true });
    } catch (err) {
      console.error('Update listing error:', err);
      res.status(500).json({ error: { message: '更新失败' } });
    }
  });

  // 添加评价
  app.post('/api/marketplace/review', authMiddleware, async (req, res) => {
    try {
      const { listingId, rating, comment } = req.body;
      
      if (!listingId || !rating || rating < 1 || rating > 5) {
        return res.status(400).json({ error: '参数无效' });
      }
      
      const [purchases] = await pool.execute(
        'SELECT id FROM characterPurchases WHERE listingId = ? AND buyerId = ?',
        [listingId, req.user.id]
      );
      if (purchases.length === 0) {
        return res.status(400).json({ error: '您未购买此角色' });
      }
      
      const [existing] = await pool.execute(
        'SELECT id FROM characterReviews WHERE listingId = ? AND reviewerId = ?',
        [listingId, req.user.id]
      );
      if (existing.length > 0) {
        return res.status(400).json({ error: '您已评价过此角色' });
      }
      
      await pool.execute(
        'INSERT INTO characterReviews (listingId, reviewerId, rating, comment) VALUES (?, ?, ?, ?)',
        [listingId, req.user.id, rating, comment || '']
      );
      
      const [[stats]] = await pool.execute(`
        SELECT AVG(rating) as avgRating, COUNT(*) as reviewCount
        FROM characterReviews
        WHERE listingId = ?
      `, [listingId]);
      
      await pool.execute(
        'UPDATE characterListings SET rating = ?, reviewCount = ? WHERE id = ?',
        [stats.avgRating || 0, stats.reviewCount || 0, listingId]
      );
      
      res.json({ success: true });
    } catch (err) {
      console.error('Review error:', err);
      res.status(500).json({ error: { message: '评价失败' } });
    }
  });

  // 获取角色评价
  app.get('/api/marketplace/reviews/:listingId', async (req, res) => {
    try {
      const [reviews] = await pool.execute(`
        SELECT cr.*, u.nickname as reviewerName
        FROM characterReviews cr
        JOIN users u ON cr.reviewerId = u.id
        WHERE cr.listingId = ?
        ORDER BY cr.createdAt DESC
      `, [req.params.listingId]);
      
      res.json({ reviews });
    } catch (err) {
      console.error('Get reviews error:', err);
      res.status(500).json({ error: { message: '获取评价失败' } });
    }
  });

  // ==================== 分享和导出功能 ====================

  // 创建分享链接
  app.post('/api/share/create', authMiddleware, async (req, res) => {
    try {
      const { sessionId, format = 'html' } = req.body;
      
      if (!sessionId) {
        return res.status(400).json({ error: '参数无效' });
      }
      
      // 验证会话属于用户
      const [sessions] = await pool.execute(
        'SELECT * FROM chatSessions WHERE id = ? AND userId = ?',
        [sessionId, req.user.id]
      );
      if (sessions.length === 0) {
        return res.status(404).json({ error: '会话不存在' });
      }
      
      // 生成分享ID
      const shareId = crypto.randomBytes(16).toString('hex');
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7天后过期
      
      await pool.execute(`
        INSERT INTO chatShares (shareId, sessionId, userId, format, expiresAt)
        VALUES (?, ?, ?, ?, ?)
      `, [shareId, sessionId, req.user.id, format, expiresAt]);
      
      res.json({
        success: true,
        shareId,
        shareUrl: `/share/${shareId}`,
        expiresAt
      });
    } catch (err) {
      console.error('Create share error:', err);
      res.status(500).json({ error: { message: '创建分享失败' } });
    }
  });

  // 获取分享内容
  app.get('/api/share/:shareId', async (req, res) => {
    try {
      const [shares] = await pool.execute(`
        SELECT cs.*, u.nickname as userName
        FROM chatShares cs
        JOIN users u ON cs.userId = u.id
        WHERE cs.shareId = ? AND cs.expiresAt > NOW()
      `, [req.params.shareId]);
      
      if (shares.length === 0) {
        return res.status(404).json({ error: '分享不存在或已过期' });
      }
      
      const share = shares[0];
      
      // 获取聊天记录
      const [messages] = await pool.execute(`
        SELECT cm.*, ac.name as characterName, ac.avatar as characterAvatar
        FROM chatMessages cm
        LEFT JOIN aiCharacters ac ON cm.characterId = ac.id
        WHERE cm.sessionId = ?
        ORDER BY cm.createdAt ASC
      `, [share.sessionId]);
      
      // 更新查看次数
      await pool.execute(
        'UPDATE chatShares SET viewCount = viewCount + 1 WHERE shareId = ?',
        [req.params.shareId]
      );
      
      res.json({
        share,
        messages,
        format: share.format
      });
    } catch (err) {
      console.error('Get share error:', err);
      res.status(500).json({ error: { message: '获取分享失败' } });
    }
  });

  // 导出聊天记录为HTML
  app.get('/api/chat/export/html/:sessionId', authMiddleware, async (req, res) => {
    try {
      const [sessions] = await pool.execute(
        'SELECT cs.*, ac.name as characterName FROM chatSessions cs LEFT JOIN aiCharacters ac ON cs.characterId = ac.id WHERE cs.id = ? AND cs.userId = ?',
        [req.params.sessionId, req.user.id]
      );
      
      if (sessions.length === 0) {
        return res.status(404).json({ error: '会话不存在' });
      }
      
      const session = sessions[0];
      
      const [messages] = await pool.execute(
        'SELECT * FROM chatMessages WHERE sessionId = ? ORDER BY createdAt ASC',
        [req.params.sessionId]
      );
      
      const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>微爱聊天记录 - ${session.characterName || '未知角色'}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f5f5f5; }
    .header { text-align: center; margin-bottom: 20px; }
    .message { margin: 10px 0; padding: 12px 16px; border-radius: 12px; max-width: 80%; }
    .user { background: #007AFF; color: white; margin-left: auto; }
    .assistant { background: white; color: #333; }
    .time { font-size: 12px; color: #999; text-align: center; margin: 10px 0; }
    .footer { text-align: center; margin-top: 20px; color: #999; font-size: 12px; }
  </style>
</head>
<body>
  <div class="header">
    <h2>与 ${session.characterName || '未知角色'} 的对话</h2>
    <p>导出时间: ${new Date().toLocaleString('zh-CN')}</p>
  </div>
  ${messages.map(m => `
    <div class="message ${m.role}">${m.content}</div>
    <div class="time">${new Date(m.createdAt).toLocaleString('zh-CN')}</div>
  `).join('')}
  <div class="footer">由微爱AI导出</div>
</body>
</html>`;
      
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="chat-${req.params.sessionId}.html"`);
      res.send(html);
    } catch (err) {
      console.error('Export HTML error:', err);
      res.status(500).json({ error: { message: '导出失败' } });
    }
  });

  // 导出聊天记录为XML
  app.get('/api/chat/export/xml/:sessionId', authMiddleware, async (req, res) => {
    try {
      const [sessions] = await pool.execute(
        'SELECT cs.*, ac.name as characterName FROM chatSessions cs LEFT JOIN aiCharacters ac ON cs.characterId = ac.id WHERE cs.id = ? AND cs.userId = ?',
        [req.params.sessionId, req.user.id]
      );
      
      if (sessions.length === 0) {
        return res.status(404).json({ error: '会话不存在' });
      }
      
      const session = sessions[0];
      
      const [messages] = await pool.execute(
        'SELECT * FROM chatMessages WHERE sessionId = ? ORDER BY createdAt ASC',
        [req.params.sessionId]
      );
      
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<chatExport>
  <meta>
    <app>微爱AI</app>
    <exportTime>${new Date().toISOString()}</exportTime>
    <sessionId>${session.id}</sessionId>
    <characterName>${session.characterName || '未知角色'}</characterName>
  </meta>
  <messages>
    ${messages.map(m => `
    <message>
      <id>${m.id}</id>
      <role>${m.role}</role>
      <content><![CDATA[${m.content}]]></content>
      <timestamp>${new Date(m.createdAt).toISOString()}</timestamp>
    </message>`).join('')}
  </messages>
</chatExport>`;
      
      res.setHeader('Content-Type', 'application/xml; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="chat-${req.params.sessionId}.xml"`);
      res.send(xml);
    } catch (err) {
      console.error('Export XML error:', err);
      res.status(500).json({ error: { message: '导出失败' } });
    }
  });

  // 导出聊天记录为JSON
  app.get('/api/chat/export/json/:sessionId', authMiddleware, async (req, res) => {
    try {
      const [sessions] = await pool.execute(
        'SELECT cs.*, ac.name as characterName FROM chatSessions cs LEFT JOIN aiCharacters ac ON cs.characterId = ac.id WHERE cs.id = ? AND cs.userId = ?',
        [req.params.sessionId, req.user.id]
      );
      
      if (sessions.length === 0) {
        return res.status(404).json({ error: '会话不存在' });
      }
      
      const session = sessions[0];
      
      const [messages] = await pool.execute(
        'SELECT * FROM chatMessages WHERE sessionId = ? ORDER BY createdAt ASC',
        [req.params.sessionId]
      );
      
      const exportData = {
        meta: {
          app: '微爱AI',
          exportTime: new Date().toISOString(),
          sessionId: session.id,
          characterName: session.characterName || '未知角色'
        },
        messages: messages.map(m => ({
          id: m.id,
          role: m.role,
          content: m.content,
          timestamp: new Date(m.createdAt).toISOString()
        }))
      };
      
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="chat-${req.params.sessionId}.json"`);
      res.json(exportData);
    } catch (err) {
      console.error('Export JSON error:', err);
      res.status(500).json({ error: { message: '导出失败' } });
    }
  });

  console.log('✅ 角色市场和分享导出API已加载');
};
