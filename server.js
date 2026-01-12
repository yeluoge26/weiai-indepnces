/**
 * 微愛獨立版後端服務
 * 完全獨立運行，不依賴Manus服務
 */

const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(express.json());

// 配置
const config = {
  port: process.env.PORT || 8080,
  jwtSecret: process.env.JWT_SECRET || 'weiai-secret-key-2024',
  db: {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'weiai',
    password: process.env.DB_PASSWORD || 'weiai2024',
    database: process.env.DB_NAME || 'weiai'
  }
};

// 數據庫連接池
let pool;

async function initDatabase() {
  pool = mysql.createPool({
    host: config.db.host,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });
  
  // 創建所有必要的表
  await createTables();
  console.log('Database initialized');
}

async function createTables() {
  const conn = await pool.getConnection();
  try {
    // 用戶表
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) UNIQUE,
        email VARCHAR(320) UNIQUE,
        passwordHash VARCHAR(255) NOT NULL,
        nickname VARCHAR(100),
        avatar TEXT,
        role ENUM('user', 'admin') DEFAULT 'user',
        vipLevel INT DEFAULT 0,
        vipExpireAt TIMESTAMP NULL,
        isBanned BOOLEAN DEFAULT FALSE,
        banReason TEXT,
        points INT DEFAULT 0,
        coins INT DEFAULT 0,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        lastSignedIn TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 管理員表
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS adminUsers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) NOT NULL UNIQUE,
        passwordHash VARCHAR(255) NOT NULL,
        nickname VARCHAR(100),
        adminRole ENUM('super_admin', 'admin', 'operator') DEFAULT 'operator',
        lastLoginAt TIMESTAMP NULL,
        lastLoginIp VARCHAR(45),
        isActive BOOLEAN DEFAULT TRUE,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // AI角色表
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS aiCharacters (
        id INT AUTO_INCREMENT PRIMARY KEY,
        characterId VARCHAR(32) NOT NULL UNIQUE,
        userId INT,
        name VARCHAR(100) NOT NULL,
        avatar TEXT,
        description TEXT,
        personality TEXT NOT NULL,
        type ENUM('system', 'custom') DEFAULT 'custom',
        category ENUM('assistant', 'rpg', 'companion') DEFAULT 'assistant',
        gender ENUM('male', 'female'),
        isPublic BOOLEAN DEFAULT FALSE,
        isInMarketplace BOOLEAN DEFAULT FALSE,
        tags JSON,
        usageCount INT DEFAULT 0,
        likeCount INT DEFAULT 0,
        isPaid BOOLEAN DEFAULT FALSE,
        price INT DEFAULT 0,
        status ENUM('active', 'pending', 'rejected', 'offline') DEFAULT 'active',
        allowNsfw BOOLEAN DEFAULT FALSE,
        allowVoice BOOLEAN DEFAULT TRUE,
        defaultVoiceId INT,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // 聊天會話表
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS chatSessions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        sessionId VARCHAR(32) NOT NULL UNIQUE,
        userId INT NOT NULL,
        characterId INT NOT NULL,
        title VARCHAR(200),
        lastMessage TEXT,
        lastActiveAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        unreadCount INT DEFAULT 0,
        isPinned BOOLEAN DEFAULT FALSE,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // 聊天消息表
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS chatMessages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        messageId VARCHAR(32) NOT NULL UNIQUE,
        sessionId INT NOT NULL,
        role ENUM('user', 'assistant') NOT NULL,
        content TEXT NOT NULL,
        metadata JSON,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 朋友圈動態表
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS moments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        momentId VARCHAR(32) NOT NULL UNIQUE,
        authorType ENUM('user', 'ai') NOT NULL,
        userId INT,
        characterId INT,
        content TEXT NOT NULL,
        images JSON,
        location VARCHAR(200),
        visibility ENUM('public', 'friends', 'private') DEFAULT 'public',
        likeCount INT DEFAULT 0,
        commentCount INT DEFAULT 0,
        isDeleted BOOLEAN DEFAULT FALSE,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // 朋友圈評論表
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS momentComments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        commentId VARCHAR(32) NOT NULL UNIQUE,
        momentId INT NOT NULL,
        commenterType ENUM('user', 'ai') NOT NULL,
        userId INT,
        characterId INT,
        content TEXT NOT NULL,
        replyToId INT,
        isDeleted BOOLEAN DEFAULT FALSE,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // API配置表（LLM）
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS apiConfigs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        provider ENUM('openai', 'grok', 'claude', 'deepseek', 'qwen', 'gemini', 'xai', 'zhipu', 'baidu', 'custom') NOT NULL,
        serviceType ENUM('chat', 'tts', 'image') DEFAULT 'chat',
        baseUrl TEXT NOT NULL,
        apiKey TEXT NOT NULL,
        defaultModel VARCHAR(100),
        temperature DECIMAL(3,2) DEFAULT 0.70,
        maxTokens INT DEFAULT 2048,
        topP DECIMAL(3,2) DEFAULT 0.95,
        frequencyPenalty DECIMAL(3,2) DEFAULT 0.00,
        presencePenalty DECIMAL(3,2) DEFAULT 0.00,
        isActive BOOLEAN DEFAULT TRUE,
        priority INT DEFAULT 100,
        rateLimit INT DEFAULT 60,
        totalCalls INT DEFAULT 0,
        totalFailures INT DEFAULT 0,
        lastCalledAt TIMESTAMP NULL,
        lastError TEXT,
        notes TEXT,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // TTS服務配置表
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS ttsServiceConfigs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        serviceType VARCHAR(50) NOT NULL,
        apiBaseUrl VARCHAR(500) NOT NULL,
        apiKey TEXT,
        defaultVoice VARCHAR(100),
        isEnabled BOOLEAN DEFAULT TRUE,
        isDefault BOOLEAN DEFAULT FALSE,
        extraConfig TEXT,
        callCount INT DEFAULT 0,
        lastCalledAt TIMESTAMP NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // 系統音色表
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS systemVoices (
        id INT AUTO_INCREMENT PRIMARY KEY,
        voiceId VARCHAR(64) NOT NULL UNIQUE,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        previewUrl TEXT,
        provider ENUM('system', 'third_party') DEFAULT 'system',
        gender ENUM('male', 'female', 'neutral') DEFAULT 'neutral',
        styleTags JSON,
        language VARCHAR(20) DEFAULT 'zh-CN',
        requiredVipLevel INT DEFAULT 0,
        isActive BOOLEAN DEFAULT TRUE,
        sortOrder INT DEFAULT 0,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // 用戶錢包表
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS userWallets (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId INT NOT NULL UNIQUE,
        points INT DEFAULT 0,
        coins INT DEFAULT 0,
        totalPointsEarned INT DEFAULT 0,
        totalCoinsEarned INT DEFAULT 0,
        totalCoinsSpent INT DEFAULT 0,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // 簽到記錄表
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS checkInRecords (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId INT NOT NULL,
        checkInDate VARCHAR(10) NOT NULL,
        consecutiveDays INT DEFAULT 1,
        pointsEarned INT DEFAULT 0,
        ipAddress VARCHAR(45),
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 系統配置表
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS systemConfig (
        id INT AUTO_INCREMENT PRIMARY KEY,
        configKey VARCHAR(100) NOT NULL UNIQUE,
        configValue TEXT NOT NULL,
        description TEXT,
        valueType ENUM('string', 'number', 'boolean', 'json') DEFAULT 'string',
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // 操作日誌表
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS adminLogs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        adminId INT NOT NULL,
        action VARCHAR(100) NOT NULL,
        targetType VARCHAR(50),
        targetId INT,
        details JSON,
        ipAddress VARCHAR(45),
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // VIP等級配置表
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS vipLevelConfigs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        level INT NOT NULL UNIQUE,
        name VARCHAR(50) NOT NULL,
        description TEXT,
        badgeUrl TEXT,
        dailyTextMessages INT DEFAULT 50,
        dailyVoiceMessages INT DEFAULT 0,
        maxCharacters INT DEFAULT 3,
        canUseSystemVoice BOOLEAN DEFAULT FALSE,
        canUseVoiceClone BOOLEAN DEFAULT FALSE,
        memoryCapacity INT DEFAULT 50,
        contextLength INT DEFAULT 10,
        priorityResponse BOOLEAN DEFAULT FALSE,
        adFree BOOLEAN DEFAULT FALSE,
        isActive BOOLEAN DEFAULT TRUE,
        sortOrder INT DEFAULT 0,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // 邀請碼表
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS userInviteCodes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId INT NOT NULL UNIQUE,
        inviteCode VARCHAR(16) NOT NULL UNIQUE,
        inviteCount INT DEFAULT 0,
        totalRewardPoints INT DEFAULT 0,
        isActive BOOLEAN DEFAULT TRUE,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // 邀請記錄表
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS userInviteRecords (
        id INT AUTO_INCREMENT PRIMARY KEY,
        inviterUserId INT NOT NULL,
        inviteeUserId INT NOT NULL UNIQUE,
        inviteCode VARCHAR(16) NOT NULL,
        rewardPoints INT DEFAULT 0,
        rewardClaimed BOOLEAN DEFAULT FALSE,
        ipAddress VARCHAR(45),
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 角色市場上架表
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS characterListings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        characterId INT NOT NULL,
        sellerId INT NOT NULL,
        price INT NOT NULL,
        description TEXT,
        status ENUM('active', 'sold', 'delisted') DEFAULT 'active',
        salesCount INT DEFAULT 0,
        totalRevenue INT DEFAULT 0,
        rating DECIMAL(3,2) DEFAULT 0,
        reviewCount INT DEFAULT 0,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_listing (characterId, sellerId)
      )
    `);

    // 角色購買記錄表
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS characterPurchases (
        id INT AUTO_INCREMENT PRIMARY KEY,
        listingId INT NOT NULL,
        buyerId INT NOT NULL,
        characterId INT NOT NULL,
        sellerId INT NOT NULL,
        price INT NOT NULL,
        platformFee INT NOT NULL,
        sellerEarnings INT NOT NULL,
        status ENUM('completed', 'refunded') DEFAULT 'completed',
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (listingId) REFERENCES characterListings(id)
      )
    `);

    // 角色評價表
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS characterReviews (
        id INT AUTO_INCREMENT PRIMARY KEY,
        listingId INT NOT NULL,
        reviewerId INT NOT NULL,
        rating INT NOT NULL,
        comment TEXT,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (listingId) REFERENCES characterListings(id),
        UNIQUE KEY unique_review (listingId, reviewerId)
      )
    `);

    // 分享記錄表
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS shareRecords (
        id INT AUTO_INCREMENT PRIMARY KEY,
        shareId VARCHAR(32) NOT NULL UNIQUE,
        userId INT NOT NULL,
        sessionId INT NOT NULL,
        format ENUM('html', 'xml', 'json') DEFAULT 'html',
        content LONGTEXT NOT NULL,
        viewCount INT DEFAULT 0,
        expiresAt TIMESTAMP NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 推送訂閱表
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS userSubscriptions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId INT NOT NULL,
        endpoint VARCHAR(500) NOT NULL,
        auth VARCHAR(255) NOT NULL,
        p256dh VARCHAR(255) NOT NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_subscription (userId, endpoint)
      )
    `);

    // 通知表
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS notifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId INT NOT NULL,
        type VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        relatedId INT,
        isRead BOOLEAN DEFAULT FALSE,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user_read (userId, isRead)
      )
    `);

    // 註冊嘗試記錄表
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS registrationAttempts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        ipAddress VARCHAR(45) NOT NULL,
        deviceFingerprint VARCHAR(255),
        email VARCHAR(320),
        attemptTime TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_ip_time (ipAddress, attemptTime),
        INDEX idx_device_time (deviceFingerprint, attemptTime)
      )
    `);

    // 用戶主題偏好表
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS userThemePreferences (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId INT NOT NULL UNIQUE,
        theme ENUM('light', 'dark', 'auto') DEFAULT 'auto',
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // ==================== 新功能数据表 ====================

    // 角色市场上架表
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS characterListings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        characterId INT NOT NULL,
        sellerId INT NOT NULL,
        price INT NOT NULL,
        description TEXT,
        status ENUM('active', 'sold', 'delisted') DEFAULT 'active',
        salesCount INT DEFAULT 0,
        totalRevenue INT DEFAULT 0,
        rating DECIMAL(3,2) DEFAULT 0,
        reviewCount INT DEFAULT 0,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_seller (sellerId),
        INDEX idx_status (status),
        INDEX idx_rating (rating)
      )
    `);

    // 角色购买记录表
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS characterPurchases (
        id INT AUTO_INCREMENT PRIMARY KEY,
        listingId INT NOT NULL,
        buyerId INT NOT NULL,
        characterId INT NOT NULL,
        sellerId INT NOT NULL,
        price INT NOT NULL,
        platformFee INT DEFAULT 0,
        sellerEarnings INT DEFAULT 0,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_buyer (buyerId),
        INDEX idx_seller (sellerId)
      )
    `);

    // 角色评价表
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS characterReviews (
        id INT AUTO_INCREMENT PRIMARY KEY,
        listingId INT NOT NULL,
        reviewerId INT NOT NULL,
        rating INT NOT NULL,
        comment TEXT,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_listing (listingId),
        UNIQUE KEY unique_review (listingId, reviewerId)
      )
    `);

    // 聊天分享表
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS chatShares (
        id INT AUTO_INCREMENT PRIMARY KEY,
        shareId VARCHAR(64) NOT NULL UNIQUE,
        sessionId INT NOT NULL,
        userId INT NOT NULL,
        format ENUM('html', 'xml', 'json') DEFAULT 'html',
        viewCount INT DEFAULT 0,
        expiresAt TIMESTAMP NOT NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_share (shareId),
        INDEX idx_user (userId)
      )
    `);

    // 推送订阅表
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS pushSubscriptions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        subscriptionId VARCHAR(64) NOT NULL UNIQUE,
        userId INT NOT NULL,
        subscription TEXT NOT NULL,
        deviceType VARCHAR(50) DEFAULT 'web',
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_user (userId)
      )
    `);

    // 推送设置表
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS pushSettings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId INT NOT NULL UNIQUE,
        enabled BOOLEAN DEFAULT TRUE,
        newMessage BOOLEAN DEFAULT TRUE,
        newGift BOOLEAN DEFAULT TRUE,
        newFollower BOOLEAN DEFAULT TRUE,
        systemNotice BOOLEAN DEFAULT TRUE,
        quietHoursStart VARCHAR(5),
        quietHoursEnd VARCHAR(5),
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // 推送通知记录表
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS pushNotifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId INT NOT NULL,
        title VARCHAR(255) NOT NULL,
        body TEXT,
        data TEXT,
        status ENUM('pending', 'sent', 'read', 'failed') DEFAULT 'pending',
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user (userId),
        INDEX idx_status (status)
      )
    `);

    // 礼物表
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS gifts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        icon VARCHAR(50),
        price INT NOT NULL DEFAULT 1,
        description TEXT,
        isActive BOOLEAN DEFAULT TRUE,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 礼物记录表
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS giftRecords (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId INT NOT NULL,
        characterId INT NOT NULL,
        giftId INT NOT NULL,
        quantity INT DEFAULT 1,
        totalCoins INT NOT NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user (userId),
        INDEX idx_character (characterId)
      )
    `);

    // 红包记录表
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS redPacketRecords (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId INT NOT NULL,
        characterId INT NOT NULL,
        amount INT NOT NULL,
        message TEXT,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user (userId),
        INDEX idx_character (characterId)
      )
    `);

    // VIP购买记录表
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS vipPurchaseRecords (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId INT NOT NULL,
        level INT NOT NULL,
        duration VARCHAR(20) NOT NULL,
        price INT NOT NULL,
        expireAt TIMESTAMP NOT NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user (userId)
      )
    `);

    // 用户API配置表
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS userApiConfigs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId INT NOT NULL UNIQUE,
        apiType ENUM('default', 'custom') DEFAULT 'default',
        customApiUrl TEXT,
        customApiKey TEXT,
        customModel VARCHAR(100),
        ttsType ENUM('default', 'cosyvoice', 'custom') DEFAULT 'default',
        cosyVoiceUrl TEXT,
        cosyVoiceKey TEXT,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // 初始化默认礼物
    const [existingGifts] = await conn.execute('SELECT COUNT(*) as count FROM gifts');
    if (existingGifts[0].count === 0) {
      await conn.execute(`
        INSERT INTO gifts (name, icon, price, description) VALUES
        ('小红心', '❤️', 1, '表达喜欢'),
        ('玫瑰花', '🌹', 10, '浪漫的玫瑰'),
        ('巧克力', '🍫', 20, '甜蜜的巧克力'),
        ('钻石', '💎', 50, '珍贵的钻石'),
        ('皇冠', '👑', 100, '尊贵的皇冠'),
        ('火箭', '🚀', 500, '冲向星空'),
        ('城堡', '🏰', 1000, '梦幻城堡'),
        ('星球', '🌍', 5000, '送你一个星球')
      `);
      console.log('Default gifts created');
    }

    console.log('All tables created successfully');
  } finally {
    conn.release();
  }
}

// 生成隨機ID
function generateId(length = 16) {
  return crypto.randomBytes(length).toString('hex').substring(0, length);
}

// JWT中間件
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: { message: '未授權' } });
  }
  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: { message: 'Token無效' } });
  }
}

// 管理員中間件
function adminMiddleware(req, res, next) {
  if (req.user.role !== 'admin' && req.user.adminRole === undefined) {
    return res.status(403).json({ error: { message: '需要管理員權限' } });
  }
  next();
}

// ==================== 健康檢查 ====================
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ==================== 用戶認證 ====================

// 用戶註冊
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password, nickname, inviteCode } = req.body;
    
    if (!password || password.length < 6) {
      return res.status(400).json({ error: { message: '密碼至少需要6個字符' } });
    }
    
    if (!username && !email) {
      return res.status(400).json({ error: { message: '用戶名或郵箱必須提供其一' } });
    }
    
    const passwordHash = await bcrypt.hash(password, 10);
    const [result] = await pool.execute(
      'INSERT INTO users (username, email, passwordHash, nickname) VALUES (?, ?, ?, ?)',
      [username || null, email || null, passwordHash, nickname || username || email?.split('@')[0]]
    );
    
    const userId = result.insertId;
    
    // 創建錢包
    await pool.execute('INSERT INTO userWallets (userId, points, coins) VALUES (?, 100, 50)', [userId]);
    
    // 創建邀請碼
    const userInviteCode = generateId(8).toUpperCase();
    await pool.execute('INSERT INTO userInviteCodes (userId, inviteCode) VALUES (?, ?)', [userId, userInviteCode]);
    
    // 處理邀請碼
    if (inviteCode) {
      const [inviter] = await pool.execute('SELECT userId FROM userInviteCodes WHERE inviteCode = ? AND isActive = TRUE', [inviteCode]);
      if (inviter.length > 0) {
        const inviterId = inviter[0].userId;
        await pool.execute('INSERT INTO userInviteRecords (inviterUserId, inviteeUserId, inviteCode, rewardPoints) VALUES (?, ?, ?, 50)', [inviterId, userId, inviteCode]);
        await pool.execute('UPDATE userInviteCodes SET inviteCount = inviteCount + 1 WHERE inviteCode = ?', [inviteCode]);
        await pool.execute('UPDATE userWallets SET points = points + 50 WHERE userId = ?', [inviterId]);
        await pool.execute('UPDATE userWallets SET points = points + 30 WHERE userId = ?', [userId]);
      }
    }
    
    const token = jwt.sign({ id: userId, username, email, role: 'user' }, config.jwtSecret, { expiresIn: '30d' });
    
    res.json({
      token,
      user: {
        id: userId,
        username,
        email,
        nickname: nickname || username || email?.split('@')[0],
        role: 'user',
        vipLevel: 0,
        points: inviteCode ? 130 : 100,
        coins: 50
      }
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: { message: '用戶名或郵箱已存在' } });
    }
    console.error('Register error:', err);
    res.status(500).json({ error: { message: '註冊失敗' } });
  }
});

// 用戶登入
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    let query = 'SELECT * FROM users WHERE ';
    let params = [];
    
    if (email) {
      query += 'email = ?';
      params.push(email);
    } else if (username) {
      query += 'username = ?';
      params.push(username);
    } else {
      return res.status(400).json({ error: { message: '請提供用戶名或郵箱' } });
    }
    
    const [users] = await pool.execute(query, params);
    
    if (users.length === 0) {
      return res.status(401).json({ error: { message: '用戶不存在' } });
    }
    
    const user = users[0];
    
    if (user.isBanned) {
      return res.status(403).json({ error: { message: '帳號已被封禁：' + (user.banReason || '違規操作') } });
    }
    
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ error: { message: '密碼錯誤' } });
    }
    
    // 獲取錢包信息
    const [wallets] = await pool.execute('SELECT * FROM userWallets WHERE userId = ?', [user.id]);
    const wallet = wallets[0] || { points: 0, coins: 0 };
    
    await pool.execute('UPDATE users SET lastSignedIn = NOW() WHERE id = ?', [user.id]);
    
    const token = jwt.sign({ 
      id: user.id, 
      username: user.username, 
      email: user.email, 
      role: user.role 
    }, config.jwtSecret, { expiresIn: '30d' });
    
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        nickname: user.nickname,
        avatar: user.avatar,
        role: user.role,
        vipLevel: user.vipLevel,
        vipExpireAt: user.vipExpireAt,
        points: wallet.points,
        coins: wallet.coins,
        isAdmin: user.role === 'admin'
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: { message: '登入失敗' } });
  }
});

// 獲取當前用戶信息
app.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    const [users] = await pool.execute('SELECT * FROM users WHERE id = ?', [req.user.id]);
    if (users.length === 0) {
      return res.status(404).json({ error: { message: '用戶不存在' } });
    }
    
    const user = users[0];
    const [wallets] = await pool.execute('SELECT * FROM userWallets WHERE userId = ?', [user.id]);
    const wallet = wallets[0] || { points: 0, coins: 0 };
    
    res.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        nickname: user.nickname,
        avatar: user.avatar,
        role: user.role,
        vipLevel: user.vipLevel,
        vipExpireAt: user.vipExpireAt,
        points: wallet.points,
        coins: wallet.coins,
        isAdmin: user.role === 'admin'
      }
    });
  } catch (err) {
    console.error('Get me error:', err);
    res.status(500).json({ error: { message: '獲取用戶信息失敗' } });
  }
});

// ==================== 管理員認證 ====================

// 管理員登入
app.post('/api/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    const [admins] = await pool.execute('SELECT * FROM adminUsers WHERE username = ? AND isActive = TRUE', [username]);
    
    if (admins.length === 0) {
      return res.status(401).json({ error: { message: '管理員不存在' } });
    }
    
    const admin = admins[0];
    const isValid = await bcrypt.compare(password, admin.passwordHash);
    
    if (!isValid) {
      return res.status(401).json({ error: { message: '密碼錯誤' } });
    }
    
    const ip = req.ip || req.connection.remoteAddress;
    await pool.execute('UPDATE adminUsers SET lastLoginAt = NOW(), lastLoginIp = ? WHERE id = ?', [ip, admin.id]);
    
    const token = jwt.sign({ 
      id: admin.id, 
      username: admin.username, 
      adminRole: admin.adminRole,
      isAdmin: true
    }, config.jwtSecret, { expiresIn: '24h' });
    
    res.json({
      token,
      admin: {
        id: admin.id,
        username: admin.username,
        nickname: admin.nickname,
        adminRole: admin.adminRole
      }
    });
  } catch (err) {
    console.error('Admin login error:', err);
    res.status(500).json({ error: { message: '登入失敗' } });
  }
});

// ==================== AI角色管理 ====================

// 獲取角色列表
app.get('/api/characters', async (req, res) => {
  try {
    const { category, type, search, page = 1, limit = 20 } = req.query;
    let query = 'SELECT * FROM aiCharacters WHERE status = "active"';
    const params = [];
    
    if (category) {
      query += ' AND category = ?';
      params.push(category);
    }
    if (type) {
      query += ' AND type = ?';
      params.push(type);
    }
    if (search) {
      query += ' AND (name LIKE ? OR description LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    
    const limitNum = parseInt(limit) || 20;
    const offsetNum = ((parseInt(page) || 1) - 1) * limitNum;
    query += ` ORDER BY usageCount DESC LIMIT ${limitNum} OFFSET ${offsetNum}`;
    
    const [characters] = await pool.execute(query, params);
    
    res.json({ characters });
  } catch (err) {
    console.error('Get characters error:', err);
    res.status(500).json({ error: { message: '獲取角色列表失敗' } });
  }
});

// 獲取單個角色
app.get('/api/characters/:id', async (req, res) => {
  try {
    const [characters] = await pool.execute('SELECT * FROM aiCharacters WHERE id = ?', [req.params.id]);
    if (characters.length === 0) {
      return res.status(404).json({ error: { message: '角色不存在' } });
    }
    res.json({ character: characters[0] });
  } catch (err) {
    console.error('Get character error:', err);
    res.status(500).json({ error: { message: '獲取角色失敗' } });
  }
});

// 創建角色
app.post('/api/characters', authMiddleware, async (req, res) => {
  try {
    const { name, avatar, description, personality, category, gender, isPublic, tags } = req.body;
    const characterId = generateId(16);
    
    const [result] = await pool.execute(
      `INSERT INTO aiCharacters (characterId, userId, name, avatar, description, personality, category, gender, isPublic, tags, type) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'custom')`,
      [characterId, req.user.id, name, avatar, description, personality, category || 'companion', gender, isPublic || false, JSON.stringify(tags || [])]
    );
    
    res.json({ 
      character: { 
        id: result.insertId, 
        characterId, 
        name, 
        avatar, 
        description, 
        personality, 
        category, 
        gender 
      } 
    });
  } catch (err) {
    console.error('Create character error:', err);
    res.status(500).json({ error: { message: '創建角色失敗' } });
  }
});

// 更新角色
app.put('/api/characters/:id', authMiddleware, async (req, res) => {
  try {
    const { name, avatar, description, personality, category, gender, isPublic, tags, status } = req.body;
    
    // 檢查權限
    const [characters] = await pool.execute('SELECT * FROM aiCharacters WHERE id = ?', [req.params.id]);
    if (characters.length === 0) {
      return res.status(404).json({ error: { message: '角色不存在' } });
    }
    
    const character = characters[0];
    if (character.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: { message: '無權限修改此角色' } });
    }
    
    await pool.execute(
      `UPDATE aiCharacters SET name = ?, avatar = ?, description = ?, personality = ?, 
       category = ?, gender = ?, isPublic = ?, tags = ?, status = ? WHERE id = ?`,
      [name, avatar, description, personality, category, gender, isPublic, JSON.stringify(tags || []), status || 'active', req.params.id]
    );
    
    res.json({ success: true });
  } catch (err) {
    console.error('Update character error:', err);
    res.status(500).json({ error: { message: '更新角色失敗' } });
  }
});

// 刪除角色
app.delete('/api/characters/:id', authMiddleware, async (req, res) => {
  try {
    const [characters] = await pool.execute('SELECT * FROM aiCharacters WHERE id = ?', [req.params.id]);
    if (characters.length === 0) {
      return res.status(404).json({ error: { message: '角色不存在' } });
    }
    
    const character = characters[0];
    if (character.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: { message: '無權限刪除此角色' } });
    }
    
    await pool.execute('UPDATE aiCharacters SET status = "offline" WHERE id = ?', [req.params.id]);
    
    res.json({ success: true });
  } catch (err) {
    console.error('Delete character error:', err);
    res.status(500).json({ error: { message: '刪除角色失敗' } });
  }
});

// ==================== 聊天功能 ====================

// 創建聊天會話
app.post('/api/chat/sessions', authMiddleware, async (req, res) => {
  try {
    const { characterId } = req.body;
    const sessionId = generateId(16);
    
    const [characters] = await pool.execute('SELECT * FROM aiCharacters WHERE id = ?', [characterId]);
    if (characters.length === 0) {
      return res.status(404).json({ error: { message: '角色不存在' } });
    }
    
    const character = characters[0];
    
    const [result] = await pool.execute(
      'INSERT INTO chatSessions (sessionId, userId, characterId, title) VALUES (?, ?, ?, ?)',
      [sessionId, req.user.id, characterId, `與${character.name}的對話`]
    );
    
    // 更新角色使用次數
    await pool.execute('UPDATE aiCharacters SET usageCount = usageCount + 1 WHERE id = ?', [characterId]);
    
    res.json({ 
      session: { 
        id: result.insertId, 
        sessionId, 
        characterId, 
        character,
        title: `與${character.name}的對話` 
      } 
    });
  } catch (err) {
    console.error('Create session error:', err);
    res.status(500).json({ error: { message: '創建會話失敗' } });
  }
});

// 獲取用戶的聊天會話列表
app.get('/api/chat/sessions', authMiddleware, async (req, res) => {
  try {
    const [sessions] = await pool.execute(
      `SELECT s.*, c.name as characterName, c.avatar as characterAvatar 
       FROM chatSessions s 
       LEFT JOIN aiCharacters c ON s.characterId = c.id 
       WHERE s.userId = ? 
       ORDER BY s.isPinned DESC, s.lastActiveAt DESC`,
      [req.user.id]
    );
    
    res.json({ sessions });
  } catch (err) {
    console.error('Get sessions error:', err);
    res.status(500).json({ error: { message: '獲取會話列表失敗' } });
  }
});

// 獲取會話消息
app.get('/api/chat/sessions/:sessionId/messages', authMiddleware, async (req, res) => {
  try {
    const [sessions] = await pool.execute('SELECT * FROM chatSessions WHERE sessionId = ? AND userId = ?', [req.params.sessionId, req.user.id]);
    if (sessions.length === 0) {
      return res.status(404).json({ error: { message: '會話不存在' } });
    }
    
    const [messages] = await pool.execute(
      'SELECT * FROM chatMessages WHERE sessionId = ? ORDER BY createdAt ASC',
      [sessions[0].id]
    );
    
    res.json({ messages });
  } catch (err) {
    console.error('Get messages error:', err);
    res.status(500).json({ error: { message: '獲取消息失敗' } });
  }
});

// 發送消息
app.post('/api/chat/sessions/:sessionId/messages', authMiddleware, async (req, res) => {
  try {
    const { content } = req.body;
    
    const [sessions] = await pool.execute(
      `SELECT s.*, c.personality, c.name as characterName 
       FROM chatSessions s 
       LEFT JOIN aiCharacters c ON s.characterId = c.id 
       WHERE s.sessionId = ? AND s.userId = ?`,
      [req.params.sessionId, req.user.id]
    );
    
    if (sessions.length === 0) {
      return res.status(404).json({ error: { message: '會話不存在' } });
    }
    
    const session = sessions[0];
    const userMessageId = generateId(16);
    
    // 保存用戶消息
    await pool.execute(
      'INSERT INTO chatMessages (messageId, sessionId, role, content) VALUES (?, ?, "user", ?)',
      [userMessageId, session.id, content]
    );
    
    // 獲取AI回復（使用配置的API）
    let aiReply = '';
    try {
      aiReply = await getAIResponse(content, session.personality, session.characterName);
    } catch (err) {
      console.error('AI response error:', err);
      aiReply = '抱歉，我現在有點累了，稍後再聊好嗎？';
    }
    
    const aiMessageId = generateId(16);
    await pool.execute(
      'INSERT INTO chatMessages (messageId, sessionId, role, content) VALUES (?, ?, "assistant", ?)',
      [aiMessageId, session.id, aiReply]
    );
    
    // 更新會話
    await pool.execute(
      'UPDATE chatSessions SET lastMessage = ?, lastActiveAt = NOW() WHERE id = ?',
      [aiReply.substring(0, 100), session.id]
    );
    
    res.json({
      userMessage: { messageId: userMessageId, role: 'user', content },
      aiMessage: { messageId: aiMessageId, role: 'assistant', content: aiReply }
    });
  } catch (err) {
    console.error('Send message error:', err);
    res.status(500).json({ error: { message: '發送消息失敗' } });
  }
});

// AI回復函數
async function getAIResponse(userMessage, personality, characterName) {
  // 獲取活躍的API配置
  const [configs] = await pool.execute(
    'SELECT * FROM apiConfigs WHERE isActive = TRUE AND serviceType = "chat" ORDER BY priority ASC LIMIT 1'
  );
  
  if (configs.length === 0) {
    return `（${characterName}微微一笑）你好呀，很高興見到你！`;
  }
  
  const config = configs[0];
  
  try {
    const response = await fetch(config.baseUrl + '/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: config.defaultModel || 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: personality || `你是${characterName}，一個友善的AI角色。` },
          { role: 'user', content: userMessage }
        ],
        temperature: parseFloat(config.temperature) || 0.7,
        max_tokens: config.maxTokens || 1024
      })
    });
    
    const data = await response.json();
    
    // 更新調用統計
    await pool.execute(
      'UPDATE apiConfigs SET totalCalls = totalCalls + 1, lastCalledAt = NOW() WHERE id = ?',
      [config.id]
    );
    
    return data.choices?.[0]?.message?.content || `（${characterName}思考中...）`;
  } catch (err) {
    // 記錄錯誤
    await pool.execute(
      'UPDATE apiConfigs SET totalFailures = totalFailures + 1, lastError = ? WHERE id = ?',
      [err.message, config.id]
    );
    throw err;
  }
}

// ==================== 朋友圈 ====================

// 獲取動態列表
app.get('/api/moments', async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    
    const limitNum = parseInt(limit) || 20;
    const offsetNum = ((parseInt(page) || 1) - 1) * limitNum;
    const [moments] = await pool.execute(
      `SELECT m.*, 
        CASE WHEN m.authorType = 'user' THEN u.nickname ELSE c.name END as authorName,
        CASE WHEN m.authorType = 'user' THEN u.avatar ELSE c.avatar END as authorAvatar
       FROM moments m
       LEFT JOIN users u ON m.userId = u.id
       LEFT JOIN aiCharacters c ON m.characterId = c.id
       WHERE m.isDeleted = FALSE AND m.visibility = 'public'
       ORDER BY m.createdAt DESC
       LIMIT ${limitNum} OFFSET ${offsetNum}`,
      []
    );
    
    res.json({ moments });
  } catch (err) {
    console.error('Get moments error:', err);
    res.status(500).json({ error: { message: '獲取動態失敗' } });
  }
});

// 發布動態
app.post('/api/moments', authMiddleware, async (req, res) => {
  try {
    const { content, images, location, visibility } = req.body;
    const momentId = generateId(16);
    
    const [result] = await pool.execute(
      'INSERT INTO moments (momentId, authorType, userId, content, images, location, visibility) VALUES (?, "user", ?, ?, ?, ?, ?)',
      [momentId, req.user.id, content, JSON.stringify(images || []), location, visibility || 'public']
    );
    
    res.json({ moment: { id: result.insertId, momentId, content } });
  } catch (err) {
    console.error('Create moment error:', err);
    res.status(500).json({ error: { message: '發布動態失敗' } });
  }
});

// ==================== 錢包功能 ====================

// 獲取錢包信息
app.get("/api/wallet/info", authMiddleware, async (req, res) => {  try {    const [wallets] = await pool.execute("SELECT * FROM userWallets WHERE userId = ?", [req.user.id]);    if (wallets.length === 0) {      await pool.execute("INSERT INTO userWallets (userId) VALUES (?)", [req.user.id]);      return res.json({ coins: 0, points: 0 });    }    res.json(wallets[0]);  } catch (err) {    console.error("Get wallet error:", err);    res.status(500).json({ error: { message: "获取钱包失败" } });  }});
app.get('/api/wallet', authMiddleware, async (req, res) => {
  try {
    const [wallets] = await pool.execute('SELECT * FROM userWallets WHERE userId = ?', [req.user.id]);
    
    if (wallets.length === 0) {
      await pool.execute('INSERT INTO userWallets (userId) VALUES (?)', [req.user.id]);
      return res.json({ wallet: { points: 0, coins: 0 } });
    }
    
    res.json({ wallet: wallets[0] });
  } catch (err) {
    console.error('Get wallet error:', err);
    res.status(500).json({ error: { message: '獲取錢包失敗' } });
  }
});

// 簽到
app.post('/api/wallet/checkin', authMiddleware, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    // 檢查今日是否已簽到
    const [records] = await pool.execute(
      'SELECT * FROM checkInRecords WHERE userId = ? AND checkInDate = ?',
      [req.user.id, today]
    );
    
    if (records.length > 0) {
      return res.status(400).json({ error: { message: '今日已簽到' } });
    }
    
    // 計算連續簽到天數
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const [yesterdayRecords] = await pool.execute(
      'SELECT consecutiveDays FROM checkInRecords WHERE userId = ? AND checkInDate = ?',
      [req.user.id, yesterday]
    );
    
    const consecutiveDays = yesterdayRecords.length > 0 ? yesterdayRecords[0].consecutiveDays + 1 : 1;
    
    // 計算獎勵積分（連續簽到獎勵）
    let pointsEarned = 10;
    if (consecutiveDays >= 7) pointsEarned = 30;
    else if (consecutiveDays >= 3) pointsEarned = 20;
    
    const ip = req.ip || req.connection.remoteAddress;
    
    await pool.execute(
      'INSERT INTO checkInRecords (userId, checkInDate, consecutiveDays, pointsEarned, ipAddress) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, today, consecutiveDays, pointsEarned, ip]
    );
    
    await pool.execute(
      'UPDATE userWallets SET points = points + ?, totalPointsEarned = totalPointsEarned + ? WHERE userId = ?',
      [pointsEarned, pointsEarned, req.user.id]
    );
    
    res.json({
      success: true,
      consecutiveDays,
      pointsEarned,
      message: `簽到成功！連續簽到${consecutiveDays}天，獲得${pointsEarned}積分`
    });
  } catch (err) {
    console.error('Checkin error:', err);
    res.status(500).json({ error: { message: '簽到失敗' } });
  }
});

// 積分兌換金幣
app.post('/api/wallet/exchange', authMiddleware, async (req, res) => {
  try {
    const { points } = req.body;
    
    if (!points || points < 100) {
      return res.status(400).json({ error: { message: '最少需要100積分兌換' } });
    }
    
    const [wallets] = await pool.execute('SELECT * FROM userWallets WHERE userId = ?', [req.user.id]);
    
    if (wallets.length === 0 || wallets[0].points < points) {
      return res.status(400).json({ error: { message: '積分不足' } });
    }
    
    const coins = Math.floor(points / 10); // 10積分 = 1金幣
    
    await pool.execute(
      'UPDATE userWallets SET points = points - ?, coins = coins + ?, totalCoinsEarned = totalCoinsEarned + ? WHERE userId = ?',
      [points, coins, coins, req.user.id]
    );
    
    res.json({ success: true, pointsSpent: points, coinsEarned: coins });
  } catch (err) {
    console.error('Exchange error:', err);
    res.status(500).json({ error: { message: '兌換失敗' } });
  }
});

// 獲取用戶邀請碼
app.get('/api/user/invite-code', authMiddleware, async (req, res) => {
  try {
    // 生成基於用戶ID的邀請碼
    const inviteCode = 'WA' + req.user.id.toString().padStart(6, '0');
    res.json({ inviteCode });
  } catch (err) {
    console.error('Get invite code error:', err);
    res.status(500).json({ error: { message: '獲取邀請碼失敗' } });
  }
});

// 獲取用戶信息
app.get('/api/user/profile', authMiddleware, async (req, res) => {
  try {
    const [users] = await pool.execute(
      'SELECT id, username, email, name, avatar, vipLevel, vipExpireAt, isAdmin, createdAt FROM users WHERE id = ?',
      [req.user.id]
    );
    
    if (users.length === 0) {
      return res.status(404).json({ error: { message: '用戶不存在' } });
    }
    
    const [wallets] = await pool.execute('SELECT * FROM userWallets WHERE userId = ?', [req.user.id]);
    
    const user = users[0];
    user.coins = wallets.length > 0 ? wallets[0].coins : 0;
    user.points = wallets.length > 0 ? wallets[0].points : 0;
    
    res.json({ user });
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({ error: { message: '獲取用戶信息失敗' } });
  }
});

// ==================== 管理後台API ====================

// 獲取統計數據
app.get('/api/admin/stats', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    const [[{ totalUsers }]] = await pool.execute('SELECT COUNT(*) as totalUsers FROM users');
    const [[{ todayNewUsers }]] = await pool.execute('SELECT COUNT(*) as todayNewUsers FROM users WHERE DATE(createdAt) = ?', [today]);
    const [[{ totalCharacters }]] = await pool.execute('SELECT COUNT(*) as totalCharacters FROM aiCharacters WHERE status = "active"');
    const [[{ totalMessages }]] = await pool.execute('SELECT COUNT(*) as totalMessages FROM chatMessages');
    const [[{ todayMessages }]] = await pool.execute('SELECT COUNT(*) as todayMessages FROM chatMessages WHERE DATE(createdAt) = ?', [today]);
    const [[{ totalMoments }]] = await pool.execute('SELECT COUNT(*) as totalMoments FROM moments WHERE isDeleted = FALSE');
    
    // 近7日活躍用戶
    const [[{ activeUsers }]] = await pool.execute(
      'SELECT COUNT(DISTINCT userId) as activeUsers FROM chatSessions WHERE lastActiveAt >= DATE_SUB(NOW(), INTERVAL 7 DAY)'
    );
    
    res.json({
      stats: {
        totalUsers,
        todayNewUsers,
        totalCharacters,
        totalMessages,
        todayMessages,
        totalMoments,
        activeUsers
      }
    });
  } catch (err) {
    console.error('Get stats error:', err);
    res.status(500).json({ error: { message: '獲取統計失敗' } });
  }
});

// 獲取用戶列表
app.get('/api/admin/users', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { search, page = 1, limit = 20 } = req.query;
    
    let query = `SELECT u.*, w.points, w.coins 
                 FROM users u 
                 LEFT JOIN userWallets w ON u.id = w.userId`;
    const params = [];
    
    if (search) {
      query += ' WHERE u.username LIKE ? OR u.email LIKE ? OR u.nickname LIKE ?';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    
    const limitNum = parseInt(limit) || 20;
    const offsetNum = ((parseInt(page) || 1) - 1) * limitNum;
    query += ` ORDER BY u.createdAt DESC LIMIT ${limitNum} OFFSET ${offsetNum}`;
    
    const [users] = await pool.execute(query, params);
    
    // 移除敏感信息
    const safeUsers = users.map(u => ({
      id: u.id,
      username: u.username,
      email: u.email,
      nickname: u.nickname,
      avatar: u.avatar,
      role: u.role,
      vipLevel: u.vipLevel,
      vipExpireAt: u.vipExpireAt,
      isBanned: u.isBanned,
      banReason: u.banReason,
      points: u.points || 0,
      coins: u.coins || 0,
      createdAt: u.createdAt,
      lastSignedIn: u.lastSignedIn
    }));
    
    res.json({ users: safeUsers });
  } catch (err) {
    console.error('Get users error:', err);
    res.status(500).json({ error: { message: '獲取用戶列表失敗' } });
  }
});

// 更新用戶
app.put('/api/admin/users/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { role, vipLevel, isBanned, banReason, points, coins } = req.body;
    
    await pool.execute(
      'UPDATE users SET role = ?, vipLevel = ?, isBanned = ?, banReason = ? WHERE id = ?',
      [role, vipLevel, isBanned, banReason, req.params.id]
    );
    
    if (points !== undefined || coins !== undefined) {
      const [wallets] = await pool.execute('SELECT * FROM userWallets WHERE userId = ?', [req.params.id]);
      if (wallets.length > 0) {
        await pool.execute(
          'UPDATE userWallets SET points = ?, coins = ? WHERE userId = ?',
          [points ?? wallets[0].points, coins ?? wallets[0].coins, req.params.id]
        );
      }
    }
    
    // 記錄操作日誌
    await pool.execute(
      'INSERT INTO adminLogs (adminId, action, targetType, targetId, details, ipAddress) VALUES (?, ?, ?, ?, ?, ?)',
      [req.user.id, 'update_user', 'user', req.params.id, JSON.stringify(req.body), req.ip]
    );
    
    res.json({ success: true });
  } catch (err) {
    console.error('Update user error:', err);
    res.status(500).json({ error: { message: '更新用戶失敗' } });
  }
});

// 封禁用戶
app.post('/api/admin/users/:id/ban', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { reason } = req.body;
    
    await pool.execute(
      'UPDATE users SET isBanned = TRUE, banReason = ? WHERE id = ?',
      [reason || '違規操作', req.params.id]
    );
    
    await pool.execute(
      'INSERT INTO adminLogs (adminId, action, targetType, targetId, details, ipAddress) VALUES (?, ?, ?, ?, ?, ?)',
      [req.user.id, 'ban_user', 'user', req.params.id, JSON.stringify({ reason }), req.ip]
    );
    
    res.json({ success: true });
  } catch (err) {
    console.error('Ban user error:', err);
    res.status(500).json({ error: { message: '封禁用戶失敗' } });
  }
});

// 解封用戶
app.post('/api/admin/users/:id/unban', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    await pool.execute('UPDATE users SET isBanned = FALSE, banReason = NULL WHERE id = ?', [req.params.id]);
    
    await pool.execute(
      'INSERT INTO adminLogs (adminId, action, targetType, targetId, ipAddress) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, 'unban_user', 'user', req.params.id, req.ip]
    );
    
    res.json({ success: true });
  } catch (err) {
    console.error('Unban user error:', err);
    res.status(500).json({ error: { message: '解封用戶失敗' } });
  }
});

// 獲取角色列表（管理員）
app.get('/api/admin/characters', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;
    
    let query = 'SELECT c.*, u.nickname as creatorName FROM aiCharacters c LEFT JOIN users u ON c.userId = u.id';
    const params = [];
    const conditions = [];
    
    if (status) {
      conditions.push('c.status = ?');
      params.push(status);
    }
    if (search) {
      conditions.push('(c.name LIKE ? OR c.description LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    const limitNum3 = parseInt(limit) || 20;
    const offsetNum3 = ((parseInt(page) || 1) - 1) * limitNum3;
    query += ` ORDER BY c.createdAt DESC LIMIT ${limitNum3} OFFSET ${offsetNum3}`;
    
    const [characters] = await pool.execute(query, params);
    
    res.json({ characters });
  } catch (err) {
    console.error('Get admin characters error:', err);
    res.status(500).json({ error: { message: '獲取角色列表失敗' } });
  }
});

// 審核角色
app.post('/api/admin/characters/:id/review', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { status, reviewNote } = req.body;
    
    await pool.execute(
      'UPDATE aiCharacters SET status = ?, reviewNote = ? WHERE id = ?',
      [status, reviewNote, req.params.id]
    );
    
    await pool.execute(
      'INSERT INTO adminLogs (adminId, action, targetType, targetId, details, ipAddress) VALUES (?, ?, ?, ?, ?, ?)',
      [req.user.id, 'review_character', 'character', req.params.id, JSON.stringify({ status, reviewNote }), req.ip]
    );
    
    res.json({ success: true });
  } catch (err) {
    console.error('Review character error:', err);
    res.status(500).json({ error: { message: '審核角色失敗' } });
  }
});

// 獲取動態列表（管理員）
app.get('/api/admin/moments', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    
    const limitNum4 = parseInt(limit) || 20;
    const offsetNum4 = ((parseInt(page) || 1) - 1) * limitNum4;
    const [moments] = await pool.execute(
      `SELECT m.*, 
        CASE WHEN m.authorType = 'user' THEN u.nickname ELSE c.name END as authorName
       FROM moments m
       LEFT JOIN users u ON m.userId = u.id
       LEFT JOIN aiCharacters c ON m.characterId = c.id
       ORDER BY m.createdAt DESC
       LIMIT ${limitNum4} OFFSET ${offsetNum4}`,
      []
    );
    
    res.json({ moments });
  } catch (err) {
    console.error('Get admin moments error:', err);
    res.status(500).json({ error: { message: '獲取動態列表失敗' } });
  }
});

// 刪除動態
app.delete('/api/admin/moments/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    await pool.execute('UPDATE moments SET isDeleted = TRUE WHERE id = ?', [req.params.id]);
    
    await pool.execute(
      'INSERT INTO adminLogs (adminId, action, targetType, targetId, ipAddress) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, 'delete_moment', 'moment', req.params.id, req.ip]
    );
    
    res.json({ success: true });
  } catch (err) {
    console.error('Delete moment error:', err);
    res.status(500).json({ error: { message: '刪除動態失敗' } });
  }
});

// ==================== API配置管理 ====================

// 獲取API配置列表
app.get('/api/admin/api-configs', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { serviceType } = req.query;
    
    let query = 'SELECT * FROM apiConfigs';
    const params = [];
    
    if (serviceType) {
      query += ' WHERE serviceType = ?';
      params.push(serviceType);
    }
    
    query += ' ORDER BY priority ASC';
    
    const [configs] = await pool.execute(query, params);
    
    // 隱藏API密鑰
    const safeConfigs = configs.map(c => ({
      ...c,
      apiKey: c.apiKey ? '***' + c.apiKey.slice(-4) : null
    }));
    
    res.json({ configs: safeConfigs });
  } catch (err) {
    console.error('Get API configs error:', err);
    res.status(500).json({ error: { message: '獲取API配置失敗' } });
  }
});

// 創建API配置
app.post('/api/admin/api-configs', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { 
      name, provider, serviceType, baseUrl, apiKey, defaultModel,
      temperature, maxTokens, topP, frequencyPenalty, presencePenalty,
      isActive, priority, rateLimit, notes 
    } = req.body;
    
    const [result] = await pool.execute(
      `INSERT INTO apiConfigs (name, provider, serviceType, baseUrl, apiKey, defaultModel, 
        temperature, maxTokens, topP, frequencyPenalty, presencePenalty, isActive, priority, rateLimit, notes) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, provider, serviceType || 'chat', baseUrl, apiKey, defaultModel,
       temperature || 0.7, maxTokens || 2048, topP || 0.95, frequencyPenalty || 0, presencePenalty || 0,
       isActive !== false, priority || 100, rateLimit || 60, notes]
    );
    
    await pool.execute(
      'INSERT INTO adminLogs (adminId, action, targetType, targetId, details, ipAddress) VALUES (?, ?, ?, ?, ?, ?)',
      [req.user.id, 'create_api_config', 'api_config', result.insertId, JSON.stringify({ name, provider, serviceType }), req.ip]
    );
    
    res.json({ success: true, id: result.insertId });
  } catch (err) {
    console.error('Create API config error:', err);
    res.status(500).json({ error: { message: '創建API配置失敗' } });
  }
});

// 更新API配置
app.put('/api/admin/api-configs/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { 
      name, provider, serviceType, baseUrl, apiKey, defaultModel,
      temperature, maxTokens, topP, frequencyPenalty, presencePenalty,
      isActive, priority, rateLimit, notes 
    } = req.body;
    
    // 如果apiKey是***開頭，表示沒有修改，保留原值
    let updateApiKey = apiKey;
    if (apiKey && apiKey.startsWith('***')) {
      const [existing] = await pool.execute('SELECT apiKey FROM apiConfigs WHERE id = ?', [req.params.id]);
      if (existing.length > 0) {
        updateApiKey = existing[0].apiKey;
      }
    }
    
    await pool.execute(
      `UPDATE apiConfigs SET name = ?, provider = ?, serviceType = ?, baseUrl = ?, apiKey = ?, defaultModel = ?,
        temperature = ?, maxTokens = ?, topP = ?, frequencyPenalty = ?, presencePenalty = ?,
        isActive = ?, priority = ?, rateLimit = ?, notes = ? WHERE id = ?`,
      [name, provider, serviceType, baseUrl, updateApiKey, defaultModel,
       temperature, maxTokens, topP, frequencyPenalty, presencePenalty,
       isActive, priority, rateLimit, notes, req.params.id]
    );
    
    await pool.execute(
      'INSERT INTO adminLogs (adminId, action, targetType, targetId, ipAddress) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, 'update_api_config', 'api_config', req.params.id, req.ip]
    );
    
    res.json({ success: true });
  } catch (err) {
    console.error('Update API config error:', err);
    res.status(500).json({ error: { message: '更新API配置失敗' } });
  }
});

// 刪除API配置
app.delete('/api/admin/api-configs/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    await pool.execute('DELETE FROM apiConfigs WHERE id = ?', [req.params.id]);
    
    await pool.execute(
      'INSERT INTO adminLogs (adminId, action, targetType, targetId, ipAddress) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, 'delete_api_config', 'api_config', req.params.id, req.ip]
    );
    
    res.json({ success: true });
  } catch (err) {
    console.error('Delete API config error:', err);
    res.status(500).json({ error: { message: '刪除API配置失敗' } });
  }
});

// 測試API配置
app.post('/api/admin/api-configs/:id/test', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const [configs] = await pool.execute('SELECT * FROM apiConfigs WHERE id = ?', [req.params.id]);
    
    if (configs.length === 0) {
      return res.status(404).json({ error: { message: 'API配置不存在' } });
    }
    
    const config = configs[0];
    
    const response = await fetch(config.baseUrl + '/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: config.defaultModel || 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'Hello, this is a test message. Please respond with "OK".' }],
        max_tokens: 10
      })
    });
    
    const data = await response.json();
    
    if (data.error) {
      return res.json({ success: false, error: data.error.message });
    }
    
    res.json({ success: true, response: data.choices?.[0]?.message?.content });
  } catch (err) {
    console.error('Test API config error:', err);
    res.json({ success: false, error: err.message });
  }
});

// ==================== TTS服務配置管理 ====================

// 獲取TTS配置列表
app.get('/api/admin/tts-configs', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const [configs] = await pool.execute('SELECT * FROM ttsServiceConfigs ORDER BY isDefault DESC, id ASC');
    
    const safeConfigs = configs.map(c => ({
      ...c,
      apiKey: c.apiKey ? '***' + c.apiKey.slice(-4) : null
    }));
    
    res.json({ configs: safeConfigs });
  } catch (err) {
    console.error('Get TTS configs error:', err);
    res.status(500).json({ error: { message: '獲取TTS配置失敗' } });
  }
});

// 創建TTS配置
app.post('/api/admin/tts-configs', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { name, serviceType, apiBaseUrl, apiKey, defaultVoice, isEnabled, isDefault, extraConfig } = req.body;
    
    // 如果設為默認，先取消其他默認
    if (isDefault) {
      await pool.execute('UPDATE ttsServiceConfigs SET isDefault = FALSE');
    }
    
    const [result] = await pool.execute(
      'INSERT INTO ttsServiceConfigs (name, serviceType, apiBaseUrl, apiKey, defaultVoice, isEnabled, isDefault, extraConfig) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [name, serviceType, apiBaseUrl, apiKey, defaultVoice, isEnabled !== false, isDefault || false, extraConfig]
    );
    
    res.json({ success: true, id: result.insertId });
  } catch (err) {
    console.error('Create TTS config error:', err);
    res.status(500).json({ error: { message: '創建TTS配置失敗' } });
  }
});

// 更新TTS配置
app.put('/api/admin/tts-configs/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { name, serviceType, apiBaseUrl, apiKey, defaultVoice, isEnabled, isDefault, extraConfig } = req.body;
    
    if (isDefault) {
      await pool.execute('UPDATE ttsServiceConfigs SET isDefault = FALSE');
    }
    
    let updateApiKey = apiKey;
    if (apiKey && apiKey.startsWith('***')) {
      const [existing] = await pool.execute('SELECT apiKey FROM ttsServiceConfigs WHERE id = ?', [req.params.id]);
      if (existing.length > 0) {
        updateApiKey = existing[0].apiKey;
      }
    }
    
    await pool.execute(
      'UPDATE ttsServiceConfigs SET name = ?, serviceType = ?, apiBaseUrl = ?, apiKey = ?, defaultVoice = ?, isEnabled = ?, isDefault = ?, extraConfig = ? WHERE id = ?',
      [name, serviceType, apiBaseUrl, updateApiKey, defaultVoice, isEnabled, isDefault, extraConfig, req.params.id]
    );
    
    res.json({ success: true });
  } catch (err) {
    console.error('Update TTS config error:', err);
    res.status(500).json({ error: { message: '更新TTS配置失敗' } });
  }
});

// 刪除TTS配置
app.delete('/api/admin/tts-configs/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    await pool.execute('DELETE FROM ttsServiceConfigs WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete TTS config error:', err);
    res.status(500).json({ error: { message: '刪除TTS配置失敗' } });
  }
});

// ==================== 系統音色管理 ====================

// 獲取系統音色列表
app.get('/api/admin/voices', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const [voices] = await pool.execute('SELECT * FROM systemVoices ORDER BY sortOrder ASC');
    res.json({ voices });
  } catch (err) {
    console.error('Get voices error:', err);
    res.status(500).json({ error: { message: '獲取音色列表失敗' } });
  }
});

// 創建系統音色
app.post('/api/admin/voices', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { voiceId, name, description, previewUrl, provider, gender, styleTags, language, requiredVipLevel, sortOrder } = req.body;
    
    const [result] = await pool.execute(
      'INSERT INTO systemVoices (voiceId, name, description, previewUrl, provider, gender, styleTags, language, requiredVipLevel, sortOrder) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [voiceId || generateId(16), name, description, previewUrl, provider || 'system', gender || 'neutral', JSON.stringify(styleTags || []), language || 'zh-CN', requiredVipLevel || 0, sortOrder || 0]
    );
    
    res.json({ success: true, id: result.insertId });
  } catch (err) {
    console.error('Create voice error:', err);
    res.status(500).json({ error: { message: '創建音色失敗' } });
  }
});

// ==================== 系統配置管理 ====================

// 獲取系統配置
app.get('/api/admin/system-config', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const [configs] = await pool.execute('SELECT * FROM systemConfig ORDER BY configKey ASC');
    res.json({ configs });
  } catch (err) {
    console.error('Get system config error:', err);
    res.status(500).json({ error: { message: '獲取系統配置失敗' } });
  }
});

// 更新系統配置
app.put('/api/admin/system-config/:key', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { value, description, valueType } = req.body;
    
    await pool.execute(
      `INSERT INTO systemConfig (configKey, configValue, description, valueType) VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE configValue = ?, description = ?, valueType = ?`,
      [req.params.key, value, description, valueType || 'string', value, description, valueType || 'string']
    );
    
    res.json({ success: true });
  } catch (err) {
    console.error('Update system config error:', err);
    res.status(500).json({ error: { message: '更新系統配置失敗' } });
  }
});

// ==================== VIP配置管理 ====================

// 獲取VIP等級配置
app.get('/api/admin/vip-configs', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const [configs] = await pool.execute('SELECT * FROM vipLevelConfigs ORDER BY level ASC');
    res.json({ configs });
  } catch (err) {
    console.error('Get VIP configs error:', err);
    res.status(500).json({ error: { message: '獲取VIP配置失敗' } });
  }
});

// 更新VIP等級配置
app.put('/api/admin/vip-configs/:level', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { name, description, dailyTextMessages, dailyVoiceMessages, maxCharacters, canUseSystemVoice, canUseVoiceClone, memoryCapacity, contextLength, priorityResponse, adFree } = req.body;
    
    await pool.execute(
      `INSERT INTO vipLevelConfigs (level, name, description, dailyTextMessages, dailyVoiceMessages, maxCharacters, canUseSystemVoice, canUseVoiceClone, memoryCapacity, contextLength, priorityResponse, adFree) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE name = ?, description = ?, dailyTextMessages = ?, dailyVoiceMessages = ?, maxCharacters = ?, canUseSystemVoice = ?, canUseVoiceClone = ?, memoryCapacity = ?, contextLength = ?, priorityResponse = ?, adFree = ?`,
      [req.params.level, name, description, dailyTextMessages, dailyVoiceMessages, maxCharacters, canUseSystemVoice, canUseVoiceClone, memoryCapacity, contextLength, priorityResponse, adFree,
       name, description, dailyTextMessages, dailyVoiceMessages, maxCharacters, canUseSystemVoice, canUseVoiceClone, memoryCapacity, contextLength, priorityResponse, adFree]
    );
    
    res.json({ success: true });
  } catch (err) {
    console.error('Update VIP config error:', err);
    res.status(500).json({ error: { message: '更新VIP配置失敗' } });
  }
});

// ==================== 操作日誌 ====================

// 獲取操作日誌
app.get('/api/admin/logs', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    
    const limitNum5 = parseInt(limit) || 50;
    const offsetNum5 = ((parseInt(page) || 1) - 1) * limitNum5;
    const [logs] = await pool.execute(
      `SELECT l.*, a.username as adminUsername 
       FROM adminLogs l 
       LEFT JOIN adminUsers a ON l.adminId = a.id 
       ORDER BY l.createdAt DESC 
       LIMIT ${limitNum5} OFFSET ${offsetNum5}`,
      []
    );
    
    res.json({ logs });
  } catch (err) {
    console.error('Get logs error:', err);
    res.status(500).json({ error: { message: '獲取操作日誌失敗' } });
  }
});

// ==================== 管理員管理 ====================

// 獲取管理員列表
app.get('/api/admin/admins', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    // 只有超級管理員可以查看
    if (req.user.adminRole !== 'super_admin' && req.user.role !== 'admin') {
      return res.status(403).json({ error: { message: '需要超級管理員權限' } });
    }
    
    const [admins] = await pool.execute(
      'SELECT id, username, nickname, adminRole, lastLoginAt, lastLoginIp, isActive, createdAt FROM adminUsers ORDER BY createdAt ASC'
    );
    
    res.json({ admins });
  } catch (err) {
    console.error('Get admins error:', err);
    res.status(500).json({ error: { message: '獲取管理員列表失敗' } });
  }
});

// 創建管理員
app.post('/api/admin/admins', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    if (req.user.adminRole !== 'super_admin' && req.user.role !== 'admin') {
      return res.status(403).json({ error: { message: '需要超級管理員權限' } });
    }
    
    const { username, password, nickname, adminRole } = req.body;
    const passwordHash = await bcrypt.hash(password, 10);
    
    const [result] = await pool.execute(
      'INSERT INTO adminUsers (username, passwordHash, nickname, adminRole) VALUES (?, ?, ?, ?)',
      [username, passwordHash, nickname, adminRole || 'operator']
    );
    
    res.json({ success: true, id: result.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: { message: '用戶名已存在' } });
    }
    console.error('Create admin error:', err);
    res.status(500).json({ error: { message: '創建管理員失敗' } });
  }
});

// 更新管理員
app.put('/api/admin/admins/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    if (req.user.adminRole !== 'super_admin' && req.user.role !== 'admin') {
      return res.status(403).json({ error: { message: '需要超級管理員權限' } });
    }
    
    const { nickname, adminRole, isActive, password } = req.body;
    
    if (password) {
      const passwordHash = await bcrypt.hash(password, 10);
      await pool.execute(
        'UPDATE adminUsers SET nickname = ?, adminRole = ?, isActive = ?, passwordHash = ? WHERE id = ?',
        [nickname, adminRole, isActive, passwordHash, req.params.id]
      );
    } else {
      await pool.execute(
        'UPDATE adminUsers SET nickname = ?, adminRole = ?, isActive = ? WHERE id = ?',
        [nickname, adminRole, isActive, req.params.id]
      );
    }
    
    res.json({ success: true });
  } catch (err) {
    console.error('Update admin error:', err);
    res.status(500).json({ error: { message: '更新管理員失敗' } });
  }
});

// 刪除管理員
app.delete('/api/admin/admins/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    if (req.user.adminRole !== 'super_admin' && req.user.role !== 'admin') {
      return res.status(403).json({ error: { message: '需要超級管理員權限' } });
    }
    
    await pool.execute('DELETE FROM adminUsers WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete admin error:', err);
    res.status(500).json({ error: { message: '刪除管理員失敗' } });
  }
});

// 啓動服務器

// 加载新功能模块
let featuresApi, securityApi, pushMonitorApi, fixesApi;
try {
  featuresApi = require('./features-api');
  securityApi = require('./security-api');
  pushMonitorApi = require('./push-monitor-api');
  fixesApi = require('./fixes-api');
  console.log('✅ 新功能模块加载成功');
} catch (err) {
  console.log('⚠️ 新功能模块加载失败:', err.message);
}

async function start() {
  try {
    await initDatabase();
    
    // 創建默認超級管理員
    const [admins] = await pool.execute('SELECT * FROM adminUsers WHERE adminRole = "super_admin"');
    if (admins.length === 0) {
      const passwordHash = await bcrypt.hash('Admin@2024', 10);
      await pool.execute(
        'INSERT INTO adminUsers (username, passwordHash, nickname, adminRole) VALUES (?, ?, ?, ?)',
        ['admin', passwordHash, '超級管理員', 'super_admin']
      );
      console.log('Created default super admin: admin / Admin@2024');
    }
    
    // 創建默認VIP配置
    const [vipConfigs] = await pool.execute('SELECT * FROM vipLevelConfigs');
    if (vipConfigs.length === 0) {
      await pool.execute(`INSERT INTO vipLevelConfigs (level, name, dailyTextMessages, dailyVoiceMessages, maxCharacters, canUseSystemVoice, canUseVoiceClone, memoryCapacity, contextLength) VALUES 
        (0, '普通用戶', 20, 0, 3, FALSE, FALSE, 20, 5),
        (1, 'VIP會員', 100, 10, 10, TRUE, FALSE, 50, 10),
        (2, 'SVIP會員', 500, 50, 30, TRUE, TRUE, 100, 20),
        (3, 'SSVIP會員', -1, -1, -1, TRUE, TRUE, 200, 50)`);
      console.log('Created default VIP configs');
    }
    
    // 初始化新功能模块
    if (featuresApi) {
      featuresApi(app, pool, authMiddleware);
    }
    if (securityApi) {
      securityApi(app, pool, authMiddleware);
    }
    if (pushMonitorApi) {
      pushMonitorApi(app, pool, authMiddleware);
    }
    if (fixesApi) {
      fixesApi(app, pool, authMiddleware);
    }
    
    app.listen(config.port, () => {
      console.log(`Server running on http://localhost:${config.port}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

// 虚拟充值 API
app.post('/api/wallet/recharge', authMiddleware, async (req, res) => {
  try {
    const { amount } = req.body;
    const userId = req.user.id;
    
    if (!amount || amount < 1) {
      return res.status(400).json({ error: '充值金额无效' });
    }
    
    // 充值金额对应金币（1元 = 10金币）
    const coins = amount * 10;
    
    await pool.execute(
      'UPDATE userWallets SET coins = coins + ? WHERE userId = ?',
      [coins, userId]
    );
    
    // 获取更新后的金币数
    const [wallets] = await pool.execute(
      'SELECT coins FROM userWallets WHERE userId = ?',
      [userId]
    );
    
    res.json({ 
      success: true, 
      message: `充值成功！获得${coins}金币`,
      coinsAdded: coins,
      totalCoins: wallets[0]?.coins || coins
    });
    
  } catch (error) {
    console.error('Recharge error:', error);
    res.status(500).json({ error: '充值失败' });
  }
});

// ==================== 主题功能 ====================

// 获取用户主题偏好
app.get('/api/user/theme', authMiddleware, async (req, res) => {
  try {
    const [themes] = await pool.execute(
      'SELECT theme FROM userThemePreferences WHERE userId = ?',
      [req.user.id]
    );
    res.json({ theme: themes[0]?.theme || 'auto' });
  } catch (err) {
    console.error('Get theme error:', err);
    res.status(500).json({ error: { message: '获取主题失败' } });
  }
});

// 设置用户主题偏好
app.post('/api/user/theme', authMiddleware, async (req, res) => {
  try {
    const { theme } = req.body;
    if (!['light', 'dark', 'auto'].includes(theme)) {
      return res.status(400).json({ error: '主题无效' });
    }
    
    await pool.execute(
      'INSERT INTO userThemePreferences (userId, theme) VALUES (?, ?) ON DUPLICATE KEY UPDATE theme = ?',
      [req.user.id, theme, theme]
    );
    res.json({ success: true, theme });
  } catch (err) {
    console.error('Set theme error:', err);
    res.status(500).json({ error: { message: '设置主题失败' } });
  }
});

// TTS API - 文字转语音
// ==================== 角色市场功能 ====================

// 上架角色
app.post('/api/marketplace/list', authMiddleware, async (req, res) => {
  try {
    const { characterId, price, description } = req.body;
    if (!characterId || !price || price < 1) {
      return res.status(400).json({ error: '参数无效' });
    }
    
    // 检查角色是否存在且属于用户
    const [chars] = await pool.execute(
      'SELECT id FROM aiCharacters WHERE id = ? AND userId = ?',
      [characterId, req.user.id]
    );
    if (chars.length === 0) {
      return res.status(404).json({ error: '角色不存在' });
    }
    
    // 检查是否已上架
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
    
    const [listings] = await pool.execute(`
      SELECT cl.*, ac.name, ac.avatar, u.nickname as sellerName
      FROM characterListings cl
      JOIN aiCharacters ac ON cl.characterId = ac.id
      JOIN users u ON cl.sellerId = u.id
      WHERE cl.status = 'active' AND (ac.name LIKE ? OR u.nickname LIKE ?)
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?
    `, [`%${search}%`, `%${search}%`, limit, offset]);
    
    const [[{ total }]] = await pool.execute(
      'SELECT COUNT(*) as total FROM characterListings WHERE status = "active"'
    );
    
    res.json({
      listings,
      total,
      page,
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
    
    // 获取上架信息
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
    
    // 检查买家金币
    const [wallets] = await pool.execute(
      'SELECT coins FROM userWallets WHERE userId = ?',
      [buyerId]
    );
    if (!wallets[0] || wallets[0].coins < listing.price) {
      return res.status(400).json({ error: '金币不足' });
    }
    
    // 计算费用
    const platformFee = Math.floor(listing.price * 0.1);
    const sellerEarnings = listing.price - platformFee;
    
    // 开始事务
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      
      // 扣除买家金币
      await conn.execute(
        'UPDATE userWallets SET coins = coins - ? WHERE userId = ?',
        [listing.price, buyerId]
      );
      
      // 增加卖家金币
      await conn.execute(
        'UPDATE userWallets SET coins = coins + ? WHERE userId = ?',
        [sellerEarnings, listing.sellerId]
      );
      
      // 记录购买
      await conn.execute(`
        INSERT INTO characterPurchases 
        (listingId, buyerId, characterId, sellerId, price, platformFee, sellerEarnings)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [listingId, buyerId, listing.characterId, listing.sellerId, listing.price, platformFee, sellerEarnings]);
      
      // 更新上架信息
      await conn.execute(`
        UPDATE characterListings 
        SET status = 'sold', salesCount = salesCount + 1, totalRevenue = totalRevenue + ?
        WHERE id = ?
      `, [sellerEarnings, listingId]);
      
      // 复制角色给买家
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
        SUM(sellerEarnings) as totalEarnings,
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
    
    // 检查是否已购买
    const [purchases] = await pool.execute(
      'SELECT id FROM characterPurchases WHERE listingId = ? AND buyerId = ?',
      [listingId, req.user.id]
    );
    if (purchases.length === 0) {
      return res.status(400).json({ error: '您未购买此角色' });
    }
    
    // 检查是否已评价
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
    
    // 更新上架的评分
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
app.post('/api/tts/synthesize', authMiddleware, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ error: '文本不能为空' });
    }
    
    // 返回模拟音频URL
    const audioUrl = 'data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEAQB8AAAB9AAACABAAZGF0YQIAAAAAAA==';
    
    res.json({
      success: true,
      audioUrl: audioUrl,
      message: '音频生成成功'
    });
  } catch (error) {
    console.error('TTS error:', error);
    res.status(500).json({ error: '音频生成失败' });
  }
});
start();
