// ==================== 微爱推送和性能监控API模块 ====================
// 此文件包含推送通知、性能监控、自动化测试等功能

const crypto = require('crypto');

// 性能监控数据存储
const performanceMetrics = {
  requests: {
    total: 0,
    success: 0,
    error: 0,
    byEndpoint: new Map()
  },
  response: {
    times: [],
    avgTime: 0
  },
  memory: {
    samples: []
  },
  startTime: Date.now()
};

// 推送订阅存储（生产环境使用数据库）
const pushSubscriptions = new Map();

// 性能监控中间件
function performanceMiddleware(req, res, next) {
  const startTime = Date.now();
  
  // 记录请求
  performanceMetrics.requests.total++;
  
  const endpoint = `${req.method} ${req.path}`;
  const endpointStats = performanceMetrics.requests.byEndpoint.get(endpoint) || { count: 0, errors: 0 };
  endpointStats.count++;
  performanceMetrics.requests.byEndpoint.set(endpoint, endpointStats);
  
  // 监听响应完成
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    
    // 记录响应时间
    performanceMetrics.response.times.push(duration);
    if (performanceMetrics.response.times.length > 1000) {
      performanceMetrics.response.times.shift();
    }
    
    // 计算平均响应时间
    const sum = performanceMetrics.response.times.reduce((a, b) => a + b, 0);
    performanceMetrics.response.avgTime = Math.round(sum / performanceMetrics.response.times.length);
    
    // 记录成功/错误
    if (res.statusCode >= 400) {
      performanceMetrics.requests.error++;
      endpointStats.errors++;
    } else {
      performanceMetrics.requests.success++;
    }
  });
  
  next();
}

// 定期记录内存使用
setInterval(() => {
  const memUsage = process.memoryUsage();
  performanceMetrics.memory.samples.push({
    timestamp: Date.now(),
    heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
    heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
    rss: Math.round(memUsage.rss / 1024 / 1024)
  });
  
  // 只保留最近100个样本
  if (performanceMetrics.memory.samples.length > 100) {
    performanceMetrics.memory.samples.shift();
  }
}, 60000); // 每分钟记录一次

// 导出初始化函数
module.exports = function(app, pool, authMiddleware) {

  // 应用性能监控中间件
  app.use(performanceMiddleware);

  // ==================== 推送通知功能 ====================

  // 注册推送订阅
  app.post('/api/push/subscribe', authMiddleware, async (req, res) => {
    try {
      const { subscription, deviceType = 'web' } = req.body;
      
      if (!subscription) {
        return res.status(400).json({ error: '订阅信息无效' });
      }
      
      const subscriptionId = crypto.randomBytes(16).toString('hex');
      
      // 存储订阅
      await pool.execute(`
        INSERT INTO pushSubscriptions (subscriptionId, userId, subscription, deviceType)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE subscription = ?, updatedAt = NOW()
      `, [subscriptionId, req.user.id, JSON.stringify(subscription), deviceType, JSON.stringify(subscription)]);
      
      // 内存缓存
      pushSubscriptions.set(req.user.id, {
        subscriptionId,
        subscription,
        deviceType
      });
      
      res.json({ success: true, subscriptionId });
    } catch (err) {
      console.error('Push subscribe error:', err);
      res.status(500).json({ error: { message: '订阅失败' } });
    }
  });

  // 取消推送订阅
  app.delete('/api/push/unsubscribe', authMiddleware, async (req, res) => {
    try {
      await pool.execute(
        'DELETE FROM pushSubscriptions WHERE userId = ?',
        [req.user.id]
      );
      
      pushSubscriptions.delete(req.user.id);
      
      res.json({ success: true });
    } catch (err) {
      console.error('Push unsubscribe error:', err);
      res.status(500).json({ error: { message: '取消订阅失败' } });
    }
  });

  // 获取推送设置
  app.get('/api/push/settings', authMiddleware, async (req, res) => {
    try {
      const [settings] = await pool.execute(`
        SELECT * FROM pushSettings WHERE userId = ?
      `, [req.user.id]);
      
      if (settings.length === 0) {
        // 返回默认设置
        return res.json({
          enabled: true,
          newMessage: true,
          newGift: true,
          newFollower: true,
          systemNotice: true,
          quietHoursStart: null,
          quietHoursEnd: null
        });
      }
      
      res.json(settings[0]);
    } catch (err) {
      console.error('Get push settings error:', err);
      res.status(500).json({ error: { message: '获取设置失败' } });
    }
  });

  // 更新推送设置
  app.put('/api/push/settings', authMiddleware, async (req, res) => {
    try {
      const {
        enabled = true,
        newMessage = true,
        newGift = true,
        newFollower = true,
        systemNotice = true,
        quietHoursStart = null,
        quietHoursEnd = null
      } = req.body;
      
      await pool.execute(`
        INSERT INTO pushSettings (userId, enabled, newMessage, newGift, newFollower, systemNotice, quietHoursStart, quietHoursEnd)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE 
          enabled = ?, newMessage = ?, newGift = ?, newFollower = ?, 
          systemNotice = ?, quietHoursStart = ?, quietHoursEnd = ?, updatedAt = NOW()
      `, [
        req.user.id, enabled, newMessage, newGift, newFollower, systemNotice, quietHoursStart, quietHoursEnd,
        enabled, newMessage, newGift, newFollower, systemNotice, quietHoursStart, quietHoursEnd
      ]);
      
      res.json({ success: true });
    } catch (err) {
      console.error('Update push settings error:', err);
      res.status(500).json({ error: { message: '更新设置失败' } });
    }
  });

  // 发送推送通知（内部函数）
  async function sendPushNotification(userId, notification) {
    try {
      // 检查用户推送设置
      const [settings] = await pool.execute(
        'SELECT * FROM pushSettings WHERE userId = ?',
        [userId]
      );
      
      if (settings.length > 0 && !settings[0].enabled) {
        return { sent: false, reason: '用户已禁用推送' };
      }
      
      // 检查静默时间
      if (settings.length > 0 && settings[0].quietHoursStart && settings[0].quietHoursEnd) {
        const now = new Date();
        const currentHour = now.getHours();
        const start = parseInt(settings[0].quietHoursStart);
        const end = parseInt(settings[0].quietHoursEnd);
        
        if (start <= currentHour && currentHour < end) {
          return { sent: false, reason: '静默时间' };
        }
      }
      
      // 获取订阅信息
      const [subscriptions] = await pool.execute(
        'SELECT * FROM pushSubscriptions WHERE userId = ?',
        [userId]
      );
      
      if (subscriptions.length === 0) {
        return { sent: false, reason: '用户未订阅推送' };
      }
      
      // 记录通知
      await pool.execute(`
        INSERT INTO pushNotifications (userId, title, body, data, status)
        VALUES (?, ?, ?, ?, 'pending')
      `, [userId, notification.title, notification.body, JSON.stringify(notification.data || {})]);
      
      // 这里可以集成实际的推送服务（如FCM、APNs等）
      // 目前只记录到数据库
      
      return { sent: true };
    } catch (err) {
      console.error('Send push notification error:', err);
      return { sent: false, reason: err.message };
    }
  }

  // 获取通知历史
  app.get('/api/push/notifications', authMiddleware, async (req, res) => {
    try {
      const { page = 1, limit = 20 } = req.query;
      const offset = (page - 1) * limit;
      
      const [notifications] = await pool.execute(`
        SELECT * FROM pushNotifications 
        WHERE userId = ?
        ORDER BY createdAt DESC
        LIMIT ? OFFSET ?
      `, [req.user.id, parseInt(limit), offset]);
      
      const [[{ total }]] = await pool.execute(
        'SELECT COUNT(*) as total FROM pushNotifications WHERE userId = ?',
        [req.user.id]
      );
      
      res.json({
        notifications,
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit)
      });
    } catch (err) {
      console.error('Get notifications error:', err);
      res.status(500).json({ error: { message: '获取通知失败' } });
    }
  });

  // 标记通知为已读
  app.put('/api/push/notifications/:id/read', authMiddleware, async (req, res) => {
    try {
      await pool.execute(
        'UPDATE pushNotifications SET status = "read" WHERE id = ? AND userId = ?',
        [req.params.id, req.user.id]
      );
      
      res.json({ success: true });
    } catch (err) {
      console.error('Mark notification read error:', err);
      res.status(500).json({ error: { message: '操作失败' } });
    }
  });

  // ==================== 性能监控功能 ====================

  // 获取性能指标
  app.get('/api/monitor/metrics', authMiddleware, async (req, res) => {
    try {
      // 检查是否是管理员
      const [admins] = await pool.execute(
        'SELECT id FROM admins WHERE userId = ?',
        [req.user.id]
      );
      
      if (admins.length === 0) {
        return res.status(403).json({ error: '无权限' });
      }
      
      const uptime = Date.now() - performanceMetrics.startTime;
      const memUsage = process.memoryUsage();
      
      // 获取热门端点
      const topEndpoints = Array.from(performanceMetrics.requests.byEndpoint.entries())
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 10)
        .map(([endpoint, stats]) => ({
          endpoint,
          count: stats.count,
          errors: stats.errors,
          errorRate: stats.count > 0 ? (stats.errors / stats.count * 100).toFixed(2) + '%' : '0%'
        }));
      
      res.json({
        uptime: {
          ms: uptime,
          formatted: formatUptime(uptime)
        },
        requests: {
          total: performanceMetrics.requests.total,
          success: performanceMetrics.requests.success,
          error: performanceMetrics.requests.error,
          successRate: performanceMetrics.requests.total > 0 
            ? (performanceMetrics.requests.success / performanceMetrics.requests.total * 100).toFixed(2) + '%'
            : '0%'
        },
        response: {
          avgTime: performanceMetrics.response.avgTime + 'ms',
          samples: performanceMetrics.response.times.length
        },
        memory: {
          current: {
            heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + 'MB',
            heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + 'MB',
            rss: Math.round(memUsage.rss / 1024 / 1024) + 'MB'
          },
          history: performanceMetrics.memory.samples.slice(-10)
        },
        topEndpoints,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      console.error('Get metrics error:', err);
      res.status(500).json({ error: { message: '获取指标失败' } });
    }
  });

  // 获取数据库统计
  app.get('/api/monitor/database', authMiddleware, async (req, res) => {
    try {
      // 检查是否是管理员
      const [admins] = await pool.execute(
        'SELECT id FROM admins WHERE userId = ?',
        [req.user.id]
      );
      
      if (admins.length === 0) {
        return res.status(403).json({ error: '无权限' });
      }
      
      // 获取各表行数
      const tables = [
        'users', 'aiCharacters', 'chatSessions', 'chatMessages',
        'userWallets', 'gifts', 'moments', 'userContacts'
      ];
      
      const stats = {};
      for (const table of tables) {
        try {
          const [[{ count }]] = await pool.execute(`SELECT COUNT(*) as count FROM ${table}`);
          stats[table] = count;
        } catch (e) {
          stats[table] = 'N/A';
        }
      }
      
      res.json({
        tables: stats,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      console.error('Get database stats error:', err);
      res.status(500).json({ error: { message: '获取统计失败' } });
    }
  });

  // 健康检查
  app.get('/api/health', async (req, res) => {
    try {
      // 检查数据库连接
      await pool.execute('SELECT 1');
      
      res.json({
        status: 'healthy',
        database: 'connected',
        uptime: formatUptime(Date.now() - performanceMetrics.startTime),
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      res.status(503).json({
        status: 'unhealthy',
        database: 'disconnected',
        error: err.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  // 格式化运行时间
  function formatUptime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}天${hours % 24}小时`;
    if (hours > 0) return `${hours}小时${minutes % 60}分钟`;
    if (minutes > 0) return `${minutes}分钟${seconds % 60}秒`;
    return `${seconds}秒`;
  }

  // ==================== 自动化测试端点 ====================

  // 测试API连通性
  app.get('/api/test/ping', (req, res) => {
    res.json({ pong: true, timestamp: Date.now() });
  });

  // 测试数据库连接
  app.get('/api/test/database', async (req, res) => {
    try {
      const start = Date.now();
      await pool.execute('SELECT 1');
      const duration = Date.now() - start;
      
      res.json({
        connected: true,
        responseTime: duration + 'ms'
      });
    } catch (err) {
      res.status(500).json({
        connected: false,
        error: err.message
      });
    }
  });

  // 测试认证
  app.get('/api/test/auth', authMiddleware, (req, res) => {
    res.json({
      authenticated: true,
      user: {
        id: req.user.id,
        username: req.user.username
      }
    });
  });

  console.log('✅ 推送通知和性能监控API已加载');

  // 返回推送函数供外部使用
  return {
    sendPushNotification,
    performanceMetrics
  };
};
