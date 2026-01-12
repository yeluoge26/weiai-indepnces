// ==================== 微爱安全增强API模块 ====================
// 此文件包含验证码、注册限制、速率限制、CORS等安全功能

const crypto = require('crypto');

// 内存存储（生产环境建议使用Redis）
const rateLimitStore = new Map();
const captchaStore = new Map();
const registrationStore = new Map();

// 清理过期数据
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimitStore.entries()) {
    if (value.resetTime < now) rateLimitStore.delete(key);
  }
  for (const [key, value] of captchaStore.entries()) {
    if (value.expiresAt < now) captchaStore.delete(key);
  }
  for (const [key, value] of registrationStore.entries()) {
    if (value.resetTime < now) registrationStore.delete(key);
  }
}, 60000); // 每分钟清理一次

// 生成简单的数学验证码
function generateMathCaptcha() {
  const num1 = Math.floor(Math.random() * 10) + 1;
  const num2 = Math.floor(Math.random() * 10) + 1;
  const operators = ['+', '-', '*'];
  const operator = operators[Math.floor(Math.random() * operators.length)];
  
  let answer;
  let question;
  
  switch (operator) {
    case '+':
      answer = num1 + num2;
      question = `${num1} + ${num2} = ?`;
      break;
    case '-':
      answer = num1 - num2;
      question = `${num1} - ${num2} = ?`;
      break;
    case '*':
      answer = num1 * num2;
      question = `${num1} × ${num2} = ?`;
      break;
  }
  
  return { question, answer: answer.toString() };
}

// 速率限制中间件工厂
function createRateLimiter(options = {}) {
  const {
    windowMs = 60000,      // 时间窗口（毫秒）
    max = 100,             // 最大请求数
    message = '请求过于频繁，请稍后再试',
    keyGenerator = (req) => req.ip || req.connection.remoteAddress
  } = options;
  
  return (req, res, next) => {
    const key = keyGenerator(req);
    const now = Date.now();
    
    let record = rateLimitStore.get(key);
    
    if (!record || record.resetTime < now) {
      record = {
        count: 0,
        resetTime: now + windowMs
      };
    }
    
    record.count++;
    rateLimitStore.set(key, record);
    
    // 设置响应头
    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, max - record.count));
    res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetTime / 1000));
    
    if (record.count > max) {
      return res.status(429).json({
        error: message,
        retryAfter: Math.ceil((record.resetTime - now) / 1000)
      });
    }
    
    next();
  };
}

// 注册限制检查
function checkRegistrationLimit(ip, deviceId) {
  const now = Date.now();
  const hourMs = 60 * 60 * 1000;
  const maxPerHour = 3;
  
  // 检查IP限制
  const ipKey = `reg_ip_${ip}`;
  let ipRecord = registrationStore.get(ipKey);
  
  if (!ipRecord || ipRecord.resetTime < now) {
    ipRecord = { count: 0, resetTime: now + hourMs };
  }
  
  if (ipRecord.count >= maxPerHour) {
    return {
      allowed: false,
      reason: `同一IP每小时最多注册${maxPerHour}次`,
      retryAfter: Math.ceil((ipRecord.resetTime - now) / 1000)
    };
  }
  
  // 检查设备限制
  if (deviceId) {
    const deviceKey = `reg_device_${deviceId}`;
    let deviceRecord = registrationStore.get(deviceKey);
    
    if (!deviceRecord || deviceRecord.resetTime < now) {
      deviceRecord = { count: 0, resetTime: now + hourMs };
    }
    
    if (deviceRecord.count >= maxPerHour) {
      return {
        allowed: false,
        reason: `同一设备每小时最多注册${maxPerHour}次`,
        retryAfter: Math.ceil((deviceRecord.resetTime - now) / 1000)
      };
    }
  }
  
  return { allowed: true };
}

// 记录注册
function recordRegistration(ip, deviceId) {
  const now = Date.now();
  const hourMs = 60 * 60 * 1000;
  
  // 记录IP
  const ipKey = `reg_ip_${ip}`;
  let ipRecord = registrationStore.get(ipKey);
  if (!ipRecord || ipRecord.resetTime < now) {
    ipRecord = { count: 0, resetTime: now + hourMs };
  }
  ipRecord.count++;
  registrationStore.set(ipKey, ipRecord);
  
  // 记录设备
  if (deviceId) {
    const deviceKey = `reg_device_${deviceId}`;
    let deviceRecord = registrationStore.get(deviceKey);
    if (!deviceRecord || deviceRecord.resetTime < now) {
      deviceRecord = { count: 0, resetTime: now + hourMs };
    }
    deviceRecord.count++;
    registrationStore.set(deviceKey, deviceRecord);
  }
}

// 导出初始化函数
module.exports = function(app, pool, authMiddleware) {

  // ==================== 验证码功能 ====================

  // 获取验证码
  app.get('/api/captcha', (req, res) => {
    try {
      const captcha = generateMathCaptcha();
      const captchaId = crypto.randomBytes(16).toString('hex');
      
      // 存储验证码（5分钟有效）
      captchaStore.set(captchaId, {
        answer: captcha.answer,
        expiresAt: Date.now() + 5 * 60 * 1000
      });
      
      res.json({
        captchaId,
        question: captcha.question
      });
    } catch (err) {
      console.error('Generate captcha error:', err);
      res.status(500).json({ error: '生成验证码失败' });
    }
  });

  // 验证验证码
  app.post('/api/captcha/verify', (req, res) => {
    try {
      const { captchaId, answer } = req.body;
      
      if (!captchaId || !answer) {
        return res.status(400).json({ error: '参数无效' });
      }
      
      const stored = captchaStore.get(captchaId);
      
      if (!stored) {
        return res.status(400).json({ error: '验证码不存在或已过期' });
      }
      
      if (stored.expiresAt < Date.now()) {
        captchaStore.delete(captchaId);
        return res.status(400).json({ error: '验证码已过期' });
      }
      
      if (stored.answer !== answer.toString().trim()) {
        return res.status(400).json({ error: '验证码错误' });
      }
      
      // 验证成功后删除
      captchaStore.delete(captchaId);
      
      res.json({ success: true });
    } catch (err) {
      console.error('Verify captcha error:', err);
      res.status(500).json({ error: '验证失败' });
    }
  });

  // ==================== 注册限制 ====================

  // 检查注册限制
  app.post('/api/auth/check-registration', (req, res) => {
    try {
      const ip = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'];
      const deviceId = req.body.deviceId || req.headers['x-device-id'];
      
      const result = checkRegistrationLimit(ip, deviceId);
      
      res.json(result);
    } catch (err) {
      console.error('Check registration error:', err);
      res.status(500).json({ error: '检查失败' });
    }
  });

  // 增强的注册接口（带验证码和限制）
  app.post('/api/auth/register-secure', async (req, res) => {
    try {
      const { username, email, password, captchaId, captchaAnswer, deviceId } = req.body;
      
      // 验证必填字段
      if (!username || !email || !password) {
        return res.status(400).json({ error: '请填写完整信息' });
      }
      
      // 验证验证码
      if (!captchaId || !captchaAnswer) {
        return res.status(400).json({ error: '请输入验证码' });
      }
      
      const storedCaptcha = captchaStore.get(captchaId);
      if (!storedCaptcha || storedCaptcha.expiresAt < Date.now()) {
        return res.status(400).json({ error: '验证码已过期' });
      }
      
      if (storedCaptcha.answer !== captchaAnswer.toString().trim()) {
        return res.status(400).json({ error: '验证码错误' });
      }
      
      // 检查注册限制
      const ip = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'];
      const limitCheck = checkRegistrationLimit(ip, deviceId);
      
      if (!limitCheck.allowed) {
        return res.status(429).json({
          error: limitCheck.reason,
          retryAfter: limitCheck.retryAfter
        });
      }
      
      // 检查用户名是否存在
      const [existingUsers] = await pool.execute(
        'SELECT id FROM users WHERE username = ? OR email = ?',
        [username, email]
      );
      
      if (existingUsers.length > 0) {
        return res.status(400).json({ error: '用户名或邮箱已存在' });
      }
      
      // 创建用户
      const bcrypt = require('bcryptjs');
      const jwt = require('jsonwebtoken');
      const hashedPassword = await bcrypt.hash(password, 10);
      
      const [result] = await pool.execute(
        'INSERT INTO users (username, email, password, nickname) VALUES (?, ?, ?, ?)',
        [username, email, hashedPassword, username]
      );
      
      const userId = result.insertId;
      
      // 初始化钱包
      await pool.execute(
        'INSERT INTO userWallets (userId, points, coins) VALUES (?, 100, 50)',
        [userId]
      );
      
      // 记录注册
      recordRegistration(ip, deviceId);
      
      // 删除已使用的验证码
      captchaStore.delete(captchaId);
      
      // 生成token
      const token = jwt.sign(
        { id: userId, username },
        process.env.JWT_SECRET || 'weiai-secret-key',
        { expiresIn: '7d' }
      );
      
      res.json({
        token,
        user: { id: userId, username, email, nickname: username }
      });
    } catch (err) {
      console.error('Secure register error:', err);
      res.status(500).json({ error: { message: '注册失败' } });
    }
  });

  // ==================== 速率限制 ====================

  // 全局API速率限制
  const globalRateLimiter = createRateLimiter({
    windowMs: 60000,
    max: 100,
    message: '请求过于频繁，请稍后再试'
  });

  // 登录速率限制（更严格）
  const loginRateLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15分钟
    max: 5,
    message: '登录尝试过多，请15分钟后再试',
    keyGenerator: (req) => `login_${req.ip || req.connection.remoteAddress}`
  });

  // 注册速率限制
  const registerRateLimiter = createRateLimiter({
    windowMs: 60 * 60 * 1000, // 1小时
    max: 3,
    message: '注册次数过多，请1小时后再试',
    keyGenerator: (req) => `register_${req.ip || req.connection.remoteAddress}`
  });

  // 聊天速率限制
  const chatRateLimiter = createRateLimiter({
    windowMs: 60000,
    max: 30,
    message: '发送消息过于频繁，请稍后再试'
  });

  // 应用速率限制到特定路由
  app.use('/api/auth/login', loginRateLimiter);
  app.use('/api/auth/register', registerRateLimiter);
  app.use('/api/auth/register-secure', registerRateLimiter);
  app.use('/api/chat/send', chatRateLimiter);

  // ==================== 安全统计 ====================

  // 获取安全统计（管理员）
  app.get('/api/admin/security-stats', authMiddleware, async (req, res) => {
    try {
      // 检查是否是管理员
      const [admins] = await pool.execute(
        'SELECT id FROM admins WHERE userId = ?',
        [req.user.id]
      );
      
      if (admins.length === 0) {
        return res.status(403).json({ error: '无权限' });
      }
      
      res.json({
        rateLimitEntries: rateLimitStore.size,
        captchaEntries: captchaStore.size,
        registrationEntries: registrationStore.size,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      console.error('Get security stats error:', err);
      res.status(500).json({ error: { message: '获取统计失败' } });
    }
  });

  console.log('✅ 安全增强API已加载（验证码、注册限制、速率限制）');

  // 返回中间件供外部使用
  return {
    globalRateLimiter,
    loginRateLimiter,
    registerRateLimiter,
    chatRateLimiter,
    createRateLimiter
  };
};
