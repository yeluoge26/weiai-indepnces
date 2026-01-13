/**
 * 微愛獨立版後端服務 v2.0
 * 完全獨立運行，不依賴Manus服務
 * 包含完整功能：禮物、紅包、好感度、通訊錄、用戶API配置等
 */

const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const crypto = require('crypto');
const fetch = require('node-fetch');

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
  
  await createTables();
  await initDefaultData();
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
        backgroundStory TEXT,
        type ENUM('system', 'custom') DEFAULT 'custom',
        category ENUM('assistant', 'rpg', 'companion') DEFAULT 'assistant',
        rpgSubCategory VARCHAR(50),
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

    // 用戶通訊錄表
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS userContacts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId INT NOT NULL,
        characterId INT NOT NULL,
        addedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        isPinned BOOLEAN DEFAULT FALSE,
        pinnedAt TIMESTAMP NULL,
        nickname VARCHAR(100),
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_user_character (userId, characterId)
      )
    `);

    // 好感度表
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS userCharacterAffinity (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId INT NOT NULL,
        characterId INT NOT NULL,
        affinityValue INT DEFAULT 0,
        affinityLevel ENUM('stranger', 'acquaintance', 'friend', 'close', 'intimate', 'soulmate') DEFAULT 'stranger',
        totalInteractions INT DEFAULT 0,
        dailyInteractions INT DEFAULT 0,
        lastInteractionDate VARCHAR(10),
        consecutiveDays INT DEFAULT 0,
        nsfwUnlocked BOOLEAN DEFAULT FALSE,
        firstInteractionAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_user_character (userId, characterId)
      )
    `);

    // 好感度變化記錄表
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS affinityLogs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId INT NOT NULL,
        characterId INT NOT NULL,
        changeType ENUM('chat', 'gift', 'script', 'daily', 'special') NOT NULL,
        changeValue INT NOT NULL,
        beforeValue INT NOT NULL,
        afterValue INT NOT NULL,
        reason VARCHAR(200),
        metadata TEXT,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 禮物配置表
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS giftConfigs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        giftId VARCHAR(32) NOT NULL UNIQUE,
        name VARCHAR(100) NOT NULL,
        icon TEXT,
        description TEXT,
        price INT DEFAULT 0,
        affinityPoints INT DEFAULT 10,
        rarity ENUM('common', 'rare', 'epic', 'legendary') DEFAULT 'common',
        category ENUM('flower', 'food', 'accessory', 'special', 'luxury', 'xianxia', 'urban', 'scifi', 'interstellar', 'cultivation', 'otome') DEFAULT 'flower',
        isActive BOOLEAN DEFAULT TRUE,
        sortOrder INT DEFAULT 0,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 禮物贈送記錄表
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS giftRecords (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId INT NOT NULL,
        characterId INT NOT NULL,
        giftId VARCHAR(32) NOT NULL,
        giftName VARCHAR(100) NOT NULL,
        coinSpent INT DEFAULT 0,
        affinityGained INT DEFAULT 0,
        message TEXT,
        sentAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 紅包表
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS redPackets (
        id INT AUTO_INCREMENT PRIMARY KEY,
        packetId VARCHAR(32) NOT NULL UNIQUE,
        userId INT NOT NULL,
        characterId INT NOT NULL,
        amount INT NOT NULL,
        message VARCHAR(200),
        affinityGained INT DEFAULT 0,
        sentAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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

    // 朋友圈點讚表
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS momentLikes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        momentId INT NOT NULL,
        likerType ENUM('user', 'ai') NOT NULL,
        userId INT,
        characterId INT,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_like (momentId, likerType, userId, characterId)
      )
    `);

    // 用戶API配置表
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS userApiConfigs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId INT NOT NULL UNIQUE,
        enabled BOOLEAN DEFAULT FALSE,
        provider ENUM('openai', 'claude', 'custom') DEFAULT 'openai',
        baseUrl VARCHAR(500),
        apiKey TEXT,
        modelName VARCHAR(100),
        maxContextLength INT DEFAULT 4096,
        temperature DECIMAL(3,2) DEFAULT 0.70,
        isVerified BOOLEAN DEFAULT FALSE,
        lastVerifiedAt TIMESTAMP NULL,
        notes TEXT,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // API配置表（系統LLM）
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

    console.log('All tables created successfully');
  } finally {
    conn.release();
  }
}

// 初始化默認數據
async function initDefaultData() {
  const conn = await pool.getConnection();
  try {
    // 檢查是否已有管理員
    const [admins] = await conn.execute('SELECT COUNT(*) as count FROM adminUsers');
    if (admins[0].count === 0) {
      const passwordHash = await bcrypt.hash('Admin@2024', 10);
      await conn.execute(
        'INSERT INTO adminUsers (username, passwordHash, nickname, adminRole) VALUES (?, ?, ?, ?)',
        ['admin', passwordHash, '超級管理員', 'super_admin']
      );
      console.log('Default admin created');
    }

    // 檢查是否已有VIP配置
    const [vips] = await conn.execute('SELECT COUNT(*) as count FROM vipLevelConfigs');
    if (vips[0].count === 0) {
      await conn.execute(`
        INSERT INTO vipLevelConfigs (level, name, description, dailyTextMessages, dailyVoiceMessages, maxCharacters, canUseSystemVoice, canUseVoiceClone, memoryCapacity, contextLength, priorityResponse, adFree, sortOrder) VALUES
        (0, '普通用戶', '基礎功能', 50, 0, 3, FALSE, FALSE, 50, 10, FALSE, FALSE, 0),
        (1, 'VIP1', '初級會員', 200, 10, 10, TRUE, FALSE, 100, 20, FALSE, TRUE, 1),
        (2, 'VIP2', '高級會員', 500, 50, 30, TRUE, TRUE, 200, 50, TRUE, TRUE, 2),
        (3, 'VIP3', '至尊會員', 9999, 999, 100, TRUE, TRUE, 500, 100, TRUE, TRUE, 3)
      `);
      console.log('Default VIP configs created');
    }

    // 檢查是否已有禮物配置
    const [gifts] = await conn.execute('SELECT COUNT(*) as count FROM giftConfigs');
    if (gifts[0].count === 0) {
      await conn.execute(`
        INSERT INTO giftConfigs (giftId, name, icon, description, price, affinityPoints, rarity, category, sortOrder) VALUES
        ('rose', '玫瑰花', '🌹', '一朵美麗的玫瑰', 10, 5, 'common', 'flower', 1),
        ('tulip', '鬱金香', '🌷', '優雅的鬱金香', 20, 10, 'common', 'flower', 2),
        ('sunflower', '向日葵', '🌻', '陽光般的向日葵', 30, 15, 'rare', 'flower', 3),
        ('bouquet', '花束', '💐', '精美的花束', 100, 50, 'epic', 'flower', 4),
        ('cake', '蛋糕', '🎂', '甜蜜的蛋糕', 50, 25, 'rare', 'food', 5),
        ('chocolate', '巧克力', '🍫', '絲滑的巧克力', 30, 15, 'common', 'food', 6),
        ('coffee', '咖啡', '☕', '香濃的咖啡', 20, 10, 'common', 'food', 7),
        ('ring', '戒指', '💍', '閃耀的戒指', 500, 200, 'legendary', 'accessory', 8),
        ('necklace', '項鏈', '📿', '精美的項鏈', 200, 100, 'epic', 'accessory', 9),
        ('crown', '皇冠', '👑', '尊貴的皇冠', 1000, 500, 'legendary', 'luxury', 10),
        ('star', '星星', '⭐', '閃亮的星星', 50, 25, 'rare', 'special', 11),
        ('heart', '愛心', '❤️', '真摯的愛心', 100, 50, 'epic', 'special', 12),
        ('lingshi', '靈石', '💎', '蘊含靈氣的寶石', 200, 100, 'epic', 'xianxia', 13),
        ('danyao', '丹藥', '💊', '珍貴的丹藥', 300, 150, 'legendary', 'xianxia', 14),
        ('sportscar', '跑車', '🏎️', '豪華跑車', 500, 200, 'legendary', 'urban', 15),
        ('mansion', '豪宅', '🏰', '奢華豪宅', 1000, 500, 'legendary', 'urban', 16),
        ('spaceship', '飛船', '🚀', '星際飛船', 800, 400, 'legendary', 'scifi', 17),
        ('robot', '機器人', '🤖', '智能機器人', 300, 150, 'epic', 'scifi', 18)
      `);
      console.log('Default gift configs created');
    }

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

// 計算好感度等級
function calculateAffinityLevel(value) {
  if (value >= 900) return 'soulmate';
  if (value >= 700) return 'intimate';
  if (value >= 500) return 'close';
  if (value >= 300) return 'friend';
  if (value >= 100) return 'acquaintance';
  return 'stranger';
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
    
    if (!username || !password) {
      return res.status(400).json({ error: { message: '用戶名和密碼為必填項' } });
    }
    
    const passwordHash = await bcrypt.hash(password, 10);
    const conn = await pool.getConnection();
    
    try {
      // 檢查用戶名是否已存在
      const [existing] = await conn.execute(
        'SELECT id FROM users WHERE username = ? OR email = ?',
        [username, email || null]
      );
      
      if (existing.length > 0) {
        return res.status(400).json({ error: { message: '用戶名或郵箱已存在' } });
      }
      
      // 創建用戶
      const [result] = await conn.execute(
        'INSERT INTO users (username, email, passwordHash, nickname, points, coins) VALUES (?, ?, ?, ?, ?, ?)',
        [username, email || null, passwordHash, nickname || username, 100, 10000]
      );
      
      const userId = result.insertId;
      
      // 創建錢包
      await conn.execute(
        'INSERT INTO userWallets (userId, points, coins, totalPointsEarned, totalCoinsEarned) VALUES (?, ?, ?, ?, ?)',
        [userId, 100, 10000, 100, 10000]
      );
      
      // 生成邀請碼
      const userInviteCode = generateId(8).toUpperCase();
      await conn.execute(
        'INSERT INTO userInviteCodes (userId, inviteCode) VALUES (?, ?)',
        [userId, userInviteCode]
      );
      
      // 處理邀請碼
      if (inviteCode) {
        const [inviter] = await conn.execute(
          'SELECT userId FROM userInviteCodes WHERE inviteCode = ? AND isActive = TRUE',
          [inviteCode]
        );
        if (inviter.length > 0) {
          await conn.execute(
            'INSERT INTO userInviteRecords (inviterUserId, inviteeUserId, inviteCode, rewardPoints) VALUES (?, ?, ?, ?)',
            [inviter[0].userId, userId, inviteCode, 50]
          );
          await conn.execute(
            'UPDATE userInviteCodes SET inviteCount = inviteCount + 1, totalRewardPoints = totalRewardPoints + 50 WHERE inviteCode = ?',
            [inviteCode]
          );
          // 給邀請人獎勵
          await conn.execute(
            'UPDATE userWallets SET points = points + 50, totalPointsEarned = totalPointsEarned + 50 WHERE userId = ?',
            [inviter[0].userId]
          );
        }
      }
      
      const token = jwt.sign({ id: userId, username, role: 'user' }, config.jwtSecret, { expiresIn: '7d' });
      
      res.json({
        user: { id: userId, username, nickname: nickname || username },
        token
      });
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: { message: '註冊失敗' } });
  }
});

// 用戶登入
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const loginId = username || email;
    
    if (!loginId || !password) {
      return res.status(400).json({ error: { message: '請輸入用戶名/郵箱和密碼' } });
    }
    
    const [users] = await pool.execute(
      'SELECT * FROM users WHERE username = ? OR email = ?',
      [loginId, loginId]
    );
    
    if (users.length === 0) {
      return res.status(401).json({ error: { message: '用戶不存在' } });
    }
    
    const user = users[0];
    
    if (user.isBanned) {
      return res.status(403).json({ error: { message: '帳號已被封禁: ' + (user.banReason || '') } });
    }
    
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: { message: '密碼錯誤' } });
    }
    
    await pool.execute('UPDATE users SET lastSignedIn = NOW() WHERE id = ?', [user.id]);
    
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, config.jwtSecret, { expiresIn: '7d' });
    
    res.json({
      user: {
        id: user.id,
        username: user.username,
        nickname: user.nickname,
        avatar: user.avatar,
        role: user.role,
        vipLevel: user.vipLevel
      },
      token
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: { message: '登入失敗' } });
  }
});

// 獲取當前用戶信息
app.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    const [users] = await pool.execute(
      'SELECT id, username, email, nickname, avatar, role, vipLevel, vipExpireAt, points, coins, createdAt FROM users WHERE id = ?',
      [req.user.id]
    );
    
    if (users.length === 0) {
      return res.status(404).json({ error: { message: '用戶不存在' } });
    }
    
    res.json(users[0]);
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({ error: { message: '獲取用戶信息失敗' } });
  }
});

// ==================== 角色API ====================

// 獲取角色列表
app.get('/api/characters', async (req, res) => {
  try {
    const { category, type, search, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    let sql = 'SELECT * FROM aiCharacters WHERE status = "active"';
    const params = [];
    
    if (category) {
      sql += ' AND category = ?';
      params.push(category);
    }
    if (type) {
      sql += ' AND type = ?';
      params.push(type);
    }
    if (search) {
      sql += ' AND (name LIKE ? OR description LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    
    sql += ' ORDER BY usageCount DESC, createdAt DESC LIMIT ' + parseInt(limit) + ' OFFSET ' + parseInt(offset);
    
    const [characters] = await pool.execute(sql, params);
    
    // 獲取總數
    let countSql = 'SELECT COUNT(*) as total FROM aiCharacters WHERE status = "active"';
    const countParams = [];
    if (category) {
      countSql += ' AND category = ?';
      countParams.push(category);
    }
    if (type) {
      countSql += ' AND type = ?';
      countParams.push(type);
    }
    if (search) {
      countSql += ' AND (name LIKE ? OR description LIKE ?)';
      countParams.push(`%${search}%`, `%${search}%`);
    }
    
    const [countResult] = await pool.execute(countSql, countParams);
    
    res.json({
      characters,
      total: countResult[0].total,
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (err) {
    console.error('Get characters error:', err);
    res.status(500).json({ error: { message: '獲取角色列表失敗' } });
  }
});

// 獲取角色詳情
app.get('/api/characters/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const [characters] = await pool.execute(
      'SELECT * FROM aiCharacters WHERE id = ? OR characterId = ?',
      [id, id]
    );
    
    if (characters.length === 0) {
      return res.status(404).json({ error: { message: '角色不存在' } });
    }
    
    const character = characters[0];
    
    // 增加使用次數
    await pool.execute('UPDATE aiCharacters SET usageCount = usageCount + 1 WHERE id = ?', [character.id]);
    
    res.json(character);
  } catch (err) {
    console.error('Get character error:', err);
    res.status(500).json({ error: { message: '獲取角色詳情失敗' } });
  }
});

// 用戶創建角色
app.post('/api/characters', authMiddleware, async (req, res) => {
  try {
    const { name, avatar, description, personality, backgroundStory, category, rpgSubCategory, gender, tags, isPublic } = req.body;
    
    if (!name || !personality) {
      return res.status(400).json({ error: { message: '名稱和性格設定為必填項' } });
    }
    
    const characterId = generateId(16);
    
    const [result] = await pool.execute(
      `INSERT INTO aiCharacters (characterId, userId, name, avatar, description, personality, backgroundStory, type, category, rpgSubCategory, gender, tags, isPublic, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, 'custom', ?, ?, ?, ?, ?, 'active')`,
      [characterId, req.user.id, name, avatar || null, description || null, personality, backgroundStory || null, category || 'companion', rpgSubCategory || null, gender || null, JSON.stringify(tags || []), isPublic || false]
    );
    
    res.json({
      id: result.insertId,
      characterId,
      name,
      message: '角色創建成功'
    });
  } catch (err) {
    console.error('Create character error:', err);
    res.status(500).json({ error: { message: '創建角色失敗' } });
  }
});

// 更新角色
app.put('/api/characters/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, avatar, description, personality, backgroundStory, category, rpgSubCategory, gender, tags, isPublic } = req.body;
    
    // 檢查權限
    const [characters] = await pool.execute(
      'SELECT * FROM aiCharacters WHERE (id = ? OR characterId = ?) AND userId = ?',
      [id, id, req.user.id]
    );
    
    if (characters.length === 0) {
      return res.status(403).json({ error: { message: '無權編輯此角色' } });
    }
    
    await pool.execute(
      `UPDATE aiCharacters SET name = ?, avatar = ?, description = ?, personality = ?, backgroundStory = ?, category = ?, rpgSubCategory = ?, gender = ?, tags = ?, isPublic = ?, updatedAt = NOW() WHERE id = ?`,
      [name, avatar, description, personality, backgroundStory, category, rpgSubCategory, gender, JSON.stringify(tags || []), isPublic, characters[0].id]
    );
    
    res.json({ message: '角色更新成功' });
  } catch (err) {
    console.error('Update character error:', err);
    res.status(500).json({ error: { message: '更新角色失敗' } });
  }
});

// 獲取用戶創建的角色
app.get('/api/my/characters', authMiddleware, async (req, res) => {
  try {
    const [characters] = await pool.execute(
      'SELECT * FROM aiCharacters WHERE userId = ? ORDER BY createdAt DESC',
      [req.user.id]
    );
    
    res.json({ characters });
  } catch (err) {
    console.error('Get my characters error:', err);
    res.status(500).json({ error: { message: '獲取我的角色失敗' } });
  }
});


// ==================== 通訊錄API ====================

// 獲取通訊錄
app.get('/api/contacts', authMiddleware, async (req, res) => {
  try {
    const [contacts] = await pool.execute(
      `SELECT uc.*, ac.name, ac.avatar, ac.description, ac.category, ac.rpgSubCategory
       FROM userContacts uc
       JOIN aiCharacters ac ON uc.characterId = ac.id
       WHERE uc.userId = ?
       ORDER BY uc.isPinned DESC, uc.addedAt DESC`,
      [req.user.id]
    );
    
    res.json({ contacts });
  } catch (err) {
    console.error('Get contacts error:', err);
    res.status(500).json({ error: { message: '獲取通訊錄失敗' } });
  }
});

// 添加到通訊錄
app.post('/api/contacts', authMiddleware, async (req, res) => {
  try {
    const { characterId } = req.body;
    
    // 檢查角色是否存在
    const [characters] = await pool.execute(
      'SELECT id FROM aiCharacters WHERE id = ?',
      [characterId]
    );
    
    if (characters.length === 0) {
      return res.status(404).json({ error: { message: '角色不存在' } });
    }
    
    // 檢查是否已在通訊錄
    const [existing] = await pool.execute(
      'SELECT id FROM userContacts WHERE userId = ? AND characterId = ?',
      [req.user.id, characterId]
    );
    
    if (existing.length > 0) {
      return res.status(400).json({ error: { message: '已在通訊錄中' } });
    }
    
    await pool.execute(
      'INSERT INTO userContacts (userId, characterId) VALUES (?, ?)',
      [req.user.id, characterId]
    );
    
    res.json({ message: '已添加到通訊錄' });
  } catch (err) {
    console.error('Add contact error:', err);
    res.status(500).json({ error: { message: '添加通訊錄失敗' } });
  }
});

// 從通訊錄移除
app.delete('/api/contacts/:characterId', authMiddleware, async (req, res) => {
  try {
    const { characterId } = req.params;
    
    await pool.execute(
      'DELETE FROM userContacts WHERE userId = ? AND characterId = ?',
      [req.user.id, characterId]
    );
    
    res.json({ message: '已從通訊錄移除' });
  } catch (err) {
    console.error('Remove contact error:', err);
    res.status(500).json({ error: { message: '移除通訊錄失敗' } });
  }
});

// 檢查是否在通訊錄
app.get('/api/contacts/check/:characterId', authMiddleware, async (req, res) => {
  try {
    const { characterId } = req.params;
    
    const [existing] = await pool.execute(
      'SELECT id FROM userContacts WHERE userId = ? AND characterId = ?',
      [req.user.id, characterId]
    );
    
    res.json({ inContacts: existing.length > 0 });
  } catch (err) {
    console.error('Check contact error:', err);
    res.status(500).json({ error: { message: '檢查通訊錄失敗' } });
  }
});

// ==================== 好感度API ====================

// 獲取與角色的好感度
app.get('/api/affinity/:characterId', authMiddleware, async (req, res) => {
  try {
    const { characterId } = req.params;
    
    let [affinity] = await pool.execute(
      'SELECT * FROM userCharacterAffinity WHERE userId = ? AND characterId = ?',
      [req.user.id, characterId]
    );
    
    if (affinity.length === 0) {
      // 創建初始好感度記錄
      await pool.execute(
        'INSERT INTO userCharacterAffinity (userId, characterId, affinityValue, affinityLevel) VALUES (?, ?, 0, "stranger")',
        [req.user.id, characterId]
      );
      affinity = [{
        userId: req.user.id,
        characterId: parseInt(characterId),
        affinityValue: 0,
        affinityLevel: 'stranger',
        totalInteractions: 0
      }];
    }
    
    res.json(affinity[0]);
  } catch (err) {
    console.error('Get affinity error:', err);
    res.status(500).json({ error: { message: '獲取好感度失敗' } });
  }
});

// 增加好感度（內部函數）
async function addAffinity(userId, characterId, changeValue, changeType, reason) {
  const conn = await pool.getConnection();
  try {
    // 獲取當前好感度
    let [affinity] = await conn.execute(
      'SELECT * FROM userCharacterAffinity WHERE userId = ? AND characterId = ?',
      [userId, characterId]
    );
    
    let beforeValue = 0;
    if (affinity.length === 0) {
      await conn.execute(
        'INSERT INTO userCharacterAffinity (userId, characterId, affinityValue, affinityLevel) VALUES (?, ?, 0, "stranger")',
        [userId, characterId]
      );
    } else {
      beforeValue = affinity[0].affinityValue;
    }
    
    const afterValue = Math.min(1000, Math.max(0, beforeValue + changeValue));
    const newLevel = calculateAffinityLevel(afterValue);
    
    // 更新好感度
    await conn.execute(
      'UPDATE userCharacterAffinity SET affinityValue = ?, affinityLevel = ?, totalInteractions = totalInteractions + 1, updatedAt = NOW() WHERE userId = ? AND characterId = ?',
      [afterValue, newLevel, userId, characterId]
    );
    
    // 記錄變化
    await conn.execute(
      'INSERT INTO affinityLogs (userId, characterId, changeType, changeValue, beforeValue, afterValue, reason) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [userId, characterId, changeType, changeValue, beforeValue, afterValue, reason]
    );
    
    return { beforeValue, afterValue, newLevel };
  } finally {
    conn.release();
  }
}

// ==================== 禮物API ====================

// 獲取禮物列表
app.get('/api/gifts', async (req, res) => {
  try {
    const { category } = req.query;
    
    let sql = 'SELECT * FROM giftConfigs WHERE isActive = TRUE';
    const params = [];
    
    if (category) {
      sql += ' AND category = ?';
      params.push(category);
    }
    
    sql += ' ORDER BY sortOrder ASC, price ASC';
    
    const [gifts] = await pool.execute(sql, params);
    
    res.json(gifts);
  } catch (err) {
    console.error('Get gifts error:', err);
    res.status(500).json({ error: { message: '獲取禮物列表失敗' } });
  }
});

// 送禮物
app.post('/api/gifts/send', authMiddleware, async (req, res) => {
  try {
    const { characterId, giftId, message } = req.body;
    
    // 獲取禮物信息
    const [gifts] = await pool.execute(
      'SELECT * FROM giftConfigs WHERE giftId = ? AND isActive = TRUE',
      [giftId]
    );
    
    if (gifts.length === 0) {
      return res.status(404).json({ error: { message: '禮物不存在' } });
    }
    
    const gift = gifts[0];
    
    // 檢查金幣餘額
    const [wallets] = await pool.execute(
      'SELECT coins FROM userWallets WHERE userId = ?',
      [req.user.id]
    );
    
    if (wallets.length === 0 || wallets[0].coins < gift.price) {
      return res.status(400).json({ error: { message: '金幣不足' } });
    }
    
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      
      // 扣除金幣
      await conn.execute(
        'UPDATE userWallets SET coins = coins - ?, totalCoinsSpent = totalCoinsSpent + ? WHERE userId = ?',
        [gift.price, gift.price, req.user.id]
      );
      
      // 記錄送禮
      await conn.execute(
        'INSERT INTO giftRecords (userId, characterId, giftId, giftName, coinSpent, affinityGained, message) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [req.user.id, characterId, giftId, gift.name, gift.price, gift.affinityPoints, message || null]
      );
      
      // 增加好感度
      const affinityResult = await addAffinity(req.user.id, characterId, gift.affinityPoints, 'gift', `送出禮物: ${gift.name}`);
      
      await conn.commit();
      
      res.json({
        message: '送禮成功',
        record: {
          giftName: gift.name,
          coinSpent: gift.price,
          affinityGained: gift.affinityPoints
        },
        affinity: affinityResult
      });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error('Send gift error:', err);
    res.status(500).json({ error: { message: '送禮失敗' } });
  }
});

// 獲取送禮記錄
app.get('/api/gifts/records', authMiddleware, async (req, res) => {
  try {
    const { characterId, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    let sql = 'SELECT gr.*, ac.name as characterName, ac.avatar as characterAvatar FROM giftRecords gr JOIN aiCharacters ac ON gr.characterId = ac.id WHERE gr.userId = ?';
    const params = [req.user.id];
    
    if (characterId) {
      sql += ' AND gr.characterId = ?';
      params.push(characterId);
    }
    
    sql += ' ORDER BY gr.sentAt DESC LIMIT ' + parseInt(limit) + ' OFFSET ' + parseInt(offset);
    
    const [records] = await pool.execute(sql, params);
    
    res.json({ records });
  } catch (err) {
    console.error('Get gift records error:', err);
    res.status(500).json({ error: { message: '獲取送禮記錄失敗' } });
  }
});

// ==================== 紅包API ====================

// 發紅包
app.post('/api/redpacket/send', authMiddleware, async (req, res) => {
  try {
    const { characterId, amount, message } = req.body;
    
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: { message: '請輸入有效金額' } });
    }
    
    // 檢查金幣餘額
    const [wallets] = await pool.execute(
      'SELECT coins FROM userWallets WHERE userId = ?',
      [req.user.id]
    );
    
    if (wallets.length === 0 || wallets[0].coins < amount) {
      return res.status(400).json({ error: { message: '金幣不足' } });
    }
    
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      
      // 扣除金幣
      await conn.execute(
        'UPDATE userWallets SET coins = coins - ?, totalCoinsSpent = totalCoinsSpent + ? WHERE userId = ?',
        [amount, amount, req.user.id]
      );
      
      // 計算好感度（紅包金額的10%）
      const affinityGained = Math.floor(amount * 0.1);
      
      // 記錄紅包
      const packetId = generateId(16);
      await conn.execute(
        'INSERT INTO redPackets (packetId, userId, characterId, amount, message, affinityGained) VALUES (?, ?, ?, ?, ?, ?)',
        [packetId, req.user.id, characterId, amount, message || null, affinityGained]
      );
      
      // 增加好感度
      const affinityResult = await addAffinity(req.user.id, characterId, affinityGained, 'gift', `發送紅包: ${amount}金幣`);
      
      await conn.commit();
      
      res.json({
        message: '紅包發送成功',
        record: {
          packetId,
          amount,
          affinityGained
        },
        affinity: affinityResult
      });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error('Send red packet error:', err);
    res.status(500).json({ error: { message: '發送紅包失敗' } });
  }
});

// 獲取紅包記錄
app.get('/api/redpacket/records', authMiddleware, async (req, res) => {
  try {
    const { characterId, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    let sql = 'SELECT rp.*, ac.name as characterName, ac.avatar as characterAvatar FROM redPackets rp JOIN aiCharacters ac ON rp.characterId = ac.id WHERE rp.userId = ?';
    const params = [req.user.id];
    
    if (characterId) {
      sql += ' AND rp.characterId = ?';
      params.push(characterId);
    }
    
    sql += ' ORDER BY rp.sentAt DESC LIMIT ' + parseInt(limit) + ' OFFSET ' + parseInt(offset);
    
    const [records] = await pool.execute(sql, params);
    
    res.json({ records });
  } catch (err) {
    console.error('Get red packet records error:', err);
    res.status(500).json({ error: { message: '獲取紅包記錄失敗' } });
  }
});


// ==================== 聊天API ====================

// 獲取聊天會話列表
app.get('/api/chat/sessions', authMiddleware, async (req, res) => {
  try {
    const [sessions] = await pool.execute(
      `SELECT cs.*, ac.name as characterName, ac.avatar as characterAvatar, ac.description as characterDescription
       FROM chatSessions cs
       JOIN aiCharacters ac ON cs.characterId = ac.id
       WHERE cs.userId = ?
       ORDER BY cs.isPinned DESC, cs.lastActiveAt DESC`,
      [req.user.id]
    );
    
    res.json({ sessions });
  } catch (err) {
    console.error('Get sessions error:', err);
    res.status(500).json({ error: { message: '獲取會話列表失敗' } });
  }
});

// 創建聊天會話
app.post('/api/chat/sessions', authMiddleware, async (req, res) => {
  try {
    const { characterId } = req.body;
    
    // 檢查角色是否存在
    const [characters] = await pool.execute(
      'SELECT * FROM aiCharacters WHERE id = ?',
      [characterId]
    );
    
    if (characters.length === 0) {
      return res.status(404).json({ error: { message: '角色不存在' } });
    }
    
    // 檢查是否已有會話
    const [existing] = await pool.execute(
      'SELECT * FROM chatSessions WHERE userId = ? AND characterId = ?',
      [req.user.id, characterId]
    );
    
    if (existing.length > 0) {
      return res.json({ session: existing[0], isNew: false });
    }
    
    // 創建新會話
    const sessionId = generateId(16);
    const character = characters[0];
    
    const [result] = await pool.execute(
      'INSERT INTO chatSessions (sessionId, userId, characterId, title) VALUES (?, ?, ?, ?)',
      [sessionId, req.user.id, characterId, `與${character.name}的對話`]
    );
    
    // 添加歡迎消息
    const welcomeMessageId = generateId(16);
    const welcomeContent = `你好！我是${character.name}。${character.description || '很高興認識你！'}`;
    
    await pool.execute(
      'INSERT INTO chatMessages (messageId, sessionId, role, content) VALUES (?, ?, ?, ?)',
      [welcomeMessageId, result.insertId, 'assistant', welcomeContent]
    );
    
    // 更新會話最後消息
    await pool.execute(
      'UPDATE chatSessions SET lastMessage = ?, lastActiveAt = NOW() WHERE id = ?',
      [welcomeContent, result.insertId]
    );
    
    res.json({
      session: {
        id: result.insertId,
        sessionId,
        userId: req.user.id,
        characterId,
        title: `與${character.name}的對話`,
        characterName: character.name,
        characterAvatar: character.avatar
      },
      isNew: true
    });
  } catch (err) {
    console.error('Create session error:', err);
    res.status(500).json({ error: { message: '創建會話失敗' } });
  }
});

// 獲取會話消息
app.get('/api/chat/sessions/:sessionId/messages', authMiddleware, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    // 驗證會話所有權
    const [sessions] = await pool.execute(
      'SELECT * FROM chatSessions WHERE (id = ? OR sessionId = ?) AND userId = ?',
      [sessionId, sessionId, req.user.id]
    );
    
    if (sessions.length === 0) {
      return res.status(404).json({ error: { message: '會話不存在' } });
    }
    
    const [messages] = await pool.execute(
      'SELECT * FROM chatMessages WHERE sessionId = ? ORDER BY createdAt ASC LIMIT ' + parseInt(limit) + ' OFFSET ' + parseInt(offset),
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
    const { sessionId } = req.params;
    const { content } = req.body;
    
    if (!content || content.trim() === '') {
      return res.status(400).json({ error: { message: '消息內容不能為空' } });
    }
    
    // 驗證會話所有權
    const [sessions] = await pool.execute(
      'SELECT cs.*, ac.name, ac.personality, ac.backgroundStory FROM chatSessions cs JOIN aiCharacters ac ON cs.characterId = ac.id WHERE (cs.id = ? OR cs.sessionId = ?) AND cs.userId = ?',
      [sessionId, sessionId, req.user.id]
    );
    
    if (sessions.length === 0) {
      return res.status(404).json({ error: { message: '會話不存在' } });
    }
    
    const session = sessions[0];
    
    // 保存用戶消息
    const userMessageId = generateId(16);
    await pool.execute(
      'INSERT INTO chatMessages (messageId, sessionId, role, content) VALUES (?, ?, ?, ?)',
      [userMessageId, session.id, 'user', content]
    );
    
    // 獲取歷史消息用於上下文
    const [history] = await pool.execute(
      'SELECT role, content FROM chatMessages WHERE sessionId = ? ORDER BY createdAt DESC LIMIT 20',
      [session.id]
    );
    
    // 調用AI生成回覆
    let aiReply = '';
    try {
      aiReply = await generateAIReply(session, content, history.reverse(), req.user.id);
    } catch (err) {
      console.error('AI reply error:', err);
      aiReply = `（${session.name}微微一笑）你好呀，很高興見到你！`;
    }
    
    // 保存AI回覆
    const aiMessageId = generateId(16);
    await pool.execute(
      'INSERT INTO chatMessages (messageId, sessionId, role, content) VALUES (?, ?, ?, ?)',
      [aiMessageId, session.id, 'assistant', aiReply]
    );
    
    // 更新會話
    await pool.execute(
      'UPDATE chatSessions SET lastMessage = ?, lastActiveAt = NOW() WHERE id = ?',
      [aiReply.substring(0, 200), session.id]
    );
    
    // 增加好感度（每次聊天+1）
    await addAffinity(req.user.id, session.characterId, 1, 'chat', '聊天互動');
    
    res.json({
      userMessage: { id: userMessageId, role: 'user', content, createdAt: new Date() },
      aiMessage: { id: aiMessageId, role: 'assistant', content: aiReply, createdAt: new Date() }
    });
  } catch (err) {
    console.error('Send message error:', err);
    res.status(500).json({ error: { message: '發送消息失敗' } });
  }
});

// AI回覆生成函數
async function generateAIReply(session, userMessage, history, userId) {
  // 首先檢查用戶是否有自定義API配置
  const [userConfigs] = await pool.execute(
    'SELECT * FROM userApiConfigs WHERE userId = ? AND enabled = TRUE AND isVerified = TRUE',
    [userId]
  );
  
  // 獲取系統API配置
  const [systemConfigs] = await pool.execute(
    'SELECT * FROM apiConfigs WHERE serviceType = "chat" AND isActive = TRUE ORDER BY priority ASC LIMIT 1'
  );
  
  let apiConfig = null;
  if (userConfigs.length > 0) {
    apiConfig = userConfigs[0];
  } else if (systemConfigs.length > 0) {
    apiConfig = systemConfigs[0];
  }
  
  if (!apiConfig || !apiConfig.apiKey) {
    // 沒有配置API，返回預設回覆
    return `（${session.name}微微一笑）你好呀，很高興見到你！`;
  }
  
  // 構建消息
  const messages = [
    {
      role: 'system',
      content: `你是${session.name}。${session.personality || ''}${session.backgroundStory ? '\n背景故事：' + session.backgroundStory : ''}\n請以角色的身份回覆用戶，保持角色設定，回覆要自然、有情感。`
    }
  ];
  
  // 添加歷史消息
  for (const msg of history.slice(-10)) {
    messages.push({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content
    });
  }
  
  // 添加當前用戶消息
  messages.push({ role: 'user', content: userMessage });
  
  try {
    const response = await fetch(apiConfig.baseUrl + '/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiConfig.apiKey}`
      },
      body: JSON.stringify({
        model: apiConfig.defaultModel || apiConfig.modelName || 'gpt-3.5-turbo',
        messages,
        temperature: parseFloat(apiConfig.temperature) || 0.7,
        max_tokens: apiConfig.maxTokens || 1024
      })
    });
    
    const data = await response.json();
    
    if (data.choices && data.choices[0] && data.choices[0].message) {
      return data.choices[0].message.content;
    }
    
    throw new Error('Invalid API response');
  } catch (err) {
    console.error('AI API error:', err);
    return `（${session.name}微微一笑）你好呀，很高興見到你！`;
  }
}

// ==================== 錢包API ====================

// 獲取錢包信息
app.get('/api/wallet', authMiddleware, async (req, res) => {
  try {
    let [wallets] = await pool.execute(
      'SELECT * FROM userWallets WHERE userId = ?',
      [req.user.id]
    );
    
    if (wallets.length === 0) {
      await pool.execute(
        'INSERT INTO userWallets (userId, points, coins) VALUES (?, 100, 10000)',
        [req.user.id]
      );
      wallets = [{ userId: req.user.id, points: 100, coins: 50, totalPointsEarned: 100, totalCoinsEarned: 50, totalCoinsSpent: 0 }];
    }
    
    res.json(wallets[0]);
  } catch (err) {
    console.error('Get wallet error:', err);
    res.status(500).json({ error: { message: '獲取錢包信息失敗' } });
  }
});

// 簽到
app.post('/api/wallet/checkin', authMiddleware, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    // 檢查今日是否已簽到
    const [existing] = await pool.execute(
      'SELECT * FROM checkInRecords WHERE userId = ? AND checkInDate = ?',
      [req.user.id, today]
    );
    
    if (existing.length > 0) {
      return res.status(400).json({ error: { message: '今日已簽到' } });
    }
    
    // 獲取昨日簽到記錄計算連續天數
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const [yesterdayRecord] = await pool.execute(
      'SELECT consecutiveDays FROM checkInRecords WHERE userId = ? AND checkInDate = ?',
      [req.user.id, yesterday]
    );
    
    const consecutiveDays = yesterdayRecord.length > 0 ? yesterdayRecord[0].consecutiveDays + 1 : 1;
    
    // 計算獎勵（連續簽到獎勵更多）
    const basePoints = 10;
    const bonusPoints = Math.min(consecutiveDays - 1, 6) * 2; // 最多額外12積分
    const totalPoints = basePoints + bonusPoints;
    
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      
      // 記錄簽到
      await conn.execute(
        'INSERT INTO checkInRecords (userId, checkInDate, consecutiveDays, pointsEarned) VALUES (?, ?, ?, ?)',
        [req.user.id, today, consecutiveDays, totalPoints]
      );
      
      // 更新錢包
      await conn.execute(
        'UPDATE userWallets SET points = points + ?, totalPointsEarned = totalPointsEarned + ? WHERE userId = ?',
        [totalPoints, totalPoints, req.user.id]
      );
      
      await conn.commit();
      
      res.json({
        message: '簽到成功',
        consecutiveDays,
        pointsEarned: totalPoints
      });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error('Checkin error:', err);
    res.status(500).json({ error: { message: '簽到失敗' } });
  }
});

// 積分兌換金幣
app.post('/api/wallet/exchange', authMiddleware, async (req, res) => {
  try {
    const { points } = req.body;
    
    if (!points || points <= 0 || points % 10 !== 0) {
      return res.status(400).json({ error: { message: '請輸入有效的積分數量（10的倍數）' } });
    }
    
    const coins = points / 10;
    
    const [wallets] = await pool.execute(
      'SELECT points FROM userWallets WHERE userId = ?',
      [req.user.id]
    );
    
    if (wallets.length === 0 || wallets[0].points < points) {
      return res.status(400).json({ error: { message: '積分不足' } });
    }
    
    await pool.execute(
      'UPDATE userWallets SET points = points - ?, coins = coins + ?, totalCoinsEarned = totalCoinsEarned + ? WHERE userId = ?',
      [points, coins, coins, req.user.id]
    );
    
    res.json({
      message: '兌換成功',
      pointsSpent: points,
      coinsGained: coins
    });
  } catch (err) {
    console.error('Exchange error:', err);
    res.status(500).json({ error: { message: '兌換失敗' } });
  }
});

// ==================== 用戶API配置 ====================

// 獲取用戶API配置
app.get('/api/user/api-config', authMiddleware, async (req, res) => {
  try {
    const [configs] = await pool.execute(
      'SELECT id, userId, enabled, provider, baseUrl, modelName, maxContextLength, temperature, isVerified, lastVerifiedAt, notes, createdAt, updatedAt FROM userApiConfigs WHERE userId = ?',
      [req.user.id]
    );
    
    if (configs.length === 0) {
      return res.json(null);
    }
    
    res.json(configs[0]);
  } catch (err) {
    console.error('Get user API config error:', err);
    res.status(500).json({ error: { message: '獲取API配置失敗' } });
  }
});

// 保存用戶API配置
app.post('/api/user/api-config', authMiddleware, async (req, res) => {
  try {
    const { enabled, provider, baseUrl, apiKey, modelName, maxContextLength, temperature, notes } = req.body;
    
    const [existing] = await pool.execute(
      'SELECT id FROM userApiConfigs WHERE userId = ?',
      [req.user.id]
    );
    
    if (existing.length > 0) {
      await pool.execute(
        'UPDATE userApiConfigs SET enabled = ?, provider = ?, baseUrl = ?, apiKey = ?, modelName = ?, maxContextLength = ?, temperature = ?, notes = ?, isVerified = FALSE, updatedAt = NOW() WHERE userId = ?',
        [enabled, provider, baseUrl, apiKey, modelName, maxContextLength || 4096, temperature || 0.7, notes, req.user.id]
      );
    } else {
      await pool.execute(
        'INSERT INTO userApiConfigs (userId, enabled, provider, baseUrl, apiKey, modelName, maxContextLength, temperature, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [req.user.id, enabled, provider, baseUrl, apiKey, modelName, maxContextLength || 4096, temperature || 0.7, notes]
      );
    }
    
    res.json({ message: 'API配置已保存' });
  } catch (err) {
    console.error('Save user API config error:', err);
    res.status(500).json({ error: { message: '保存API配置失敗' } });
  }
});

// 驗證用戶API配置
app.post('/api/user/api-config/verify', authMiddleware, async (req, res) => {
  try {
    const [configs] = await pool.execute(
      'SELECT * FROM userApiConfigs WHERE userId = ?',
      [req.user.id]
    );
    
    if (configs.length === 0) {
      return res.status(404).json({ error: { message: '請先保存API配置' } });
    }
    
    const config = configs[0];
    
    // 嘗試調用API驗證
    try {
      const response = await fetch(config.baseUrl + '/models', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`
        }
      });
      
      if (response.ok) {
        await pool.execute(
          'UPDATE userApiConfigs SET isVerified = TRUE, lastVerifiedAt = NOW() WHERE userId = ?',
          [req.user.id]
        );
        res.json({ message: 'API驗證成功', verified: true });
      } else {
        res.json({ message: 'API驗證失敗', verified: false, error: 'API響應錯誤' });
      }
    } catch (err) {
      res.json({ message: 'API驗證失敗', verified: false, error: err.message });
    }
  } catch (err) {
    console.error('Verify user API config error:', err);
    res.status(500).json({ error: { message: '驗證API配置失敗' } });
  }
});

// ==================== 邀請碼API ====================

// 獲取邀請碼
app.get('/api/invite/code', authMiddleware, async (req, res) => {
  try {
    let [codes] = await pool.execute(
      'SELECT * FROM userInviteCodes WHERE userId = ?',
      [req.user.id]
    );
    
    if (codes.length === 0) {
      const inviteCode = generateId(8).toUpperCase();
      await pool.execute(
        'INSERT INTO userInviteCodes (userId, inviteCode) VALUES (?, ?)',
        [req.user.id, inviteCode]
      );
      codes = [{ userId: req.user.id, inviteCode, inviteCount: 0, totalRewardPoints: 0 }];
    }
    
    res.json(codes[0]);
  } catch (err) {
    console.error('Get invite code error:', err);
    res.status(500).json({ error: { message: '獲取邀請碼失敗' } });
  }
});

// 獲取邀請記錄
app.get('/api/invite/records', authMiddleware, async (req, res) => {
  try {
    const [records] = await pool.execute(
      `SELECT uir.*, u.username, u.nickname, u.avatar 
       FROM userInviteRecords uir 
       JOIN users u ON uir.inviteeUserId = u.id 
       WHERE uir.inviterUserId = ? 
       ORDER BY uir.createdAt DESC`,
      [req.user.id]
    );
    
    res.json({ records });
  } catch (err) {
    console.error('Get invite records error:', err);
    res.status(500).json({ error: { message: '獲取邀請記錄失敗' } });
  }
});


// ==================== 朋友圈API ====================

// 獲取朋友圈動態
app.get('/api/moments', authMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    const [moments] = await pool.execute(
      `SELECT m.*, 
        CASE WHEN m.authorType = 'user' THEN u.nickname ELSE ac.name END as authorName,
        CASE WHEN m.authorType = 'user' THEN u.avatar ELSE ac.avatar END as authorAvatar
       FROM moments m
       LEFT JOIN users u ON m.authorType = 'user' AND m.userId = u.id
       LEFT JOIN aiCharacters ac ON m.authorType = 'ai' AND m.characterId = ac.id
       WHERE m.isDeleted = FALSE AND (m.visibility = 'public' OR m.userId = ?)
       ORDER BY m.createdAt DESC
       LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`,
      [req.user.id]
    );
    
    res.json({ moments });
  } catch (err) {
    console.error('Get moments error:', err);
    res.status(500).json({ error: { message: '獲取朋友圈失敗' } });
  }
});

// 發布動態
app.post('/api/moments', authMiddleware, async (req, res) => {
  try {
    const { content, images, location, visibility } = req.body;
    
    if (!content || content.trim() === '') {
      return res.status(400).json({ error: { message: '內容不能為空' } });
    }
    
    const momentId = generateId(16);
    
    await pool.execute(
      'INSERT INTO moments (momentId, authorType, userId, content, images, location, visibility) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [momentId, 'user', req.user.id, content, JSON.stringify(images || []), location || null, visibility || 'public']
    );
    
    res.json({ message: '發布成功', momentId });
  } catch (err) {
    console.error('Create moment error:', err);
    res.status(500).json({ error: { message: '發布失敗' } });
  }
});

// 點讚動態
app.post('/api/moments/:momentId/like', authMiddleware, async (req, res) => {
  try {
    const { momentId } = req.params;
    
    const [moments] = await pool.execute(
      'SELECT id FROM moments WHERE (id = ? OR momentId = ?) AND isDeleted = FALSE',
      [momentId, momentId]
    );
    
    if (moments.length === 0) {
      return res.status(404).json({ error: { message: '動態不存在' } });
    }
    
    const dbMomentId = moments[0].id;
    
    // 檢查是否已點讚
    const [existing] = await pool.execute(
      'SELECT id FROM momentLikes WHERE momentId = ? AND likerType = "user" AND userId = ?',
      [dbMomentId, req.user.id]
    );
    
    if (existing.length > 0) {
      // 取消點讚
      await pool.execute(
        'DELETE FROM momentLikes WHERE momentId = ? AND likerType = "user" AND userId = ?',
        [dbMomentId, req.user.id]
      );
      await pool.execute(
        'UPDATE moments SET likeCount = likeCount - 1 WHERE id = ?',
        [dbMomentId]
      );
      res.json({ message: '已取消點讚', liked: false });
    } else {
      // 點讚
      await pool.execute(
        'INSERT INTO momentLikes (momentId, likerType, userId) VALUES (?, "user", ?)',
        [dbMomentId, req.user.id]
      );
      await pool.execute(
        'UPDATE moments SET likeCount = likeCount + 1 WHERE id = ?',
        [dbMomentId]
      );
      res.json({ message: '點讚成功', liked: true });
    }
  } catch (err) {
    console.error('Like moment error:', err);
    res.status(500).json({ error: { message: '操作失敗' } });
  }
});

// 評論動態
app.post('/api/moments/:momentId/comments', authMiddleware, async (req, res) => {
  try {
    const { momentId } = req.params;
    const { content, replyToId } = req.body;
    
    if (!content || content.trim() === '') {
      return res.status(400).json({ error: { message: '評論內容不能為空' } });
    }
    
    const [moments] = await pool.execute(
      'SELECT id FROM moments WHERE (id = ? OR momentId = ?) AND isDeleted = FALSE',
      [momentId, momentId]
    );
    
    if (moments.length === 0) {
      return res.status(404).json({ error: { message: '動態不存在' } });
    }
    
    const dbMomentId = moments[0].id;
    const commentId = generateId(16);
    
    await pool.execute(
      'INSERT INTO momentComments (commentId, momentId, commenterType, userId, content, replyToId) VALUES (?, ?, "user", ?, ?, ?)',
      [commentId, dbMomentId, req.user.id, content, replyToId || null]
    );
    
    await pool.execute(
      'UPDATE moments SET commentCount = commentCount + 1 WHERE id = ?',
      [dbMomentId]
    );
    
    res.json({ message: '評論成功', commentId });
  } catch (err) {
    console.error('Comment moment error:', err);
    res.status(500).json({ error: { message: '評論失敗' } });
  }
});

// 獲取動態評論
app.get('/api/moments/:momentId/comments', authMiddleware, async (req, res) => {
  try {
    const { momentId } = req.params;
    
    const [moments] = await pool.execute(
      'SELECT id FROM moments WHERE (id = ? OR momentId = ?) AND isDeleted = FALSE',
      [momentId, momentId]
    );
    
    if (moments.length === 0) {
      return res.status(404).json({ error: { message: '動態不存在' } });
    }
    
    const [comments] = await pool.execute(
      `SELECT mc.*, 
        CASE WHEN mc.commenterType = 'user' THEN u.nickname ELSE ac.name END as commenterName,
        CASE WHEN mc.commenterType = 'user' THEN u.avatar ELSE ac.avatar END as commenterAvatar
       FROM momentComments mc
       LEFT JOIN users u ON mc.commenterType = 'user' AND mc.userId = u.id
       LEFT JOIN aiCharacters ac ON mc.commenterType = 'ai' AND mc.characterId = ac.id
       WHERE mc.momentId = ? AND mc.isDeleted = FALSE
       ORDER BY mc.createdAt ASC`,
      [moments[0].id]
    );
    
    res.json({ comments });
  } catch (err) {
    console.error('Get comments error:', err);
    res.status(500).json({ error: { message: '獲取評論失敗' } });
  }
});

// ==================== 管理後台API ====================

// 管理員登入
app.post('/api/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: { message: '請輸入用戶名和密碼' } });
    }
    
    const [admins] = await pool.execute(
      'SELECT * FROM adminUsers WHERE username = ? AND isActive = TRUE',
      [username]
    );
    
    if (admins.length === 0) {
      return res.status(401).json({ error: { message: '用戶不存在' } });
    }
    
    const admin = admins[0];
    const valid = await bcrypt.compare(password, admin.passwordHash);
    
    if (!valid) {
      return res.status(401).json({ error: { message: '密碼錯誤' } });
    }
    
    await pool.execute(
      'UPDATE adminUsers SET lastLoginAt = NOW() WHERE id = ?',
      [admin.id]
    );
    
    const token = jwt.sign(
      { id: admin.id, username: admin.username, adminRole: admin.adminRole },
      config.jwtSecret,
      { expiresIn: '24h' }
    );
    
    res.json({
      admin: {
        id: admin.id,
        username: admin.username,
        nickname: admin.nickname,
        adminRole: admin.adminRole
      },
      token
    });
  } catch (err) {
    console.error('Admin login error:', err);
    res.status(500).json({ error: { message: '登入失敗' } });
  }
});

// 管理員中間件
function adminAuthMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: { message: '未授權' } });
  }
  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    if (!decoded.adminRole) {
      return res.status(403).json({ error: { message: '需要管理員權限' } });
    }
    req.admin = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: { message: 'Token無效' } });
  }
}

// 獲取統計數據
app.get('/api/admin/stats', adminAuthMiddleware, async (req, res) => {
  try {
    const [userCount] = await pool.execute('SELECT COUNT(*) as count FROM users');
    const [characterCount] = await pool.execute('SELECT COUNT(*) as count FROM aiCharacters WHERE status = "active"');
    const [messageCount] = await pool.execute('SELECT COUNT(*) as count FROM chatMessages');
    const [activeUsers] = await pool.execute(
      'SELECT COUNT(DISTINCT userId) as count FROM chatSessions WHERE lastActiveAt > DATE_SUB(NOW(), INTERVAL 7 DAY)'
    );
    const [giftCount] = await pool.execute('SELECT COUNT(*) as count FROM giftRecords');
    const [redPacketCount] = await pool.execute('SELECT COUNT(*) as count FROM redPackets');
    
    res.json({
      totalUsers: userCount[0].count,
      totalCharacters: characterCount[0].count,
      totalMessages: messageCount[0].count,
      activeUsers7d: activeUsers[0].count,
      totalGifts: giftCount[0].count,
      totalRedPackets: redPacketCount[0].count
    });
  } catch (err) {
    console.error('Get stats error:', err);
    res.status(500).json({ error: { message: '獲取統計數據失敗' } });
  }
});

// 獲取用戶列表
app.get('/api/admin/users', adminAuthMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    let sql = 'SELECT id, username, email, nickname, avatar, role, vipLevel, vipExpireAt, isBanned, banReason, points, coins, createdAt, lastSignedIn FROM users';
    const params = [];
    
    if (search) {
      sql += ' WHERE username LIKE ? OR email LIKE ? OR nickname LIKE ?';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    
    sql += ` ORDER BY createdAt DESC LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`;
    
    const [users] = await pool.execute(sql, params);
    
    let countSql = 'SELECT COUNT(*) as total FROM users';
    if (search) {
      countSql += ' WHERE username LIKE ? OR email LIKE ? OR nickname LIKE ?';
    }
    const [countResult] = await pool.execute(countSql, search ? [`%${search}%`, `%${search}%`, `%${search}%`] : []);
    
    res.json({
      users,
      total: countResult[0].total,
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (err) {
    console.error('Get users error:', err);
    res.status(500).json({ error: { message: '獲取用戶列表失敗' } });
  }
});

// 編輯用戶
app.put('/api/admin/users/:id', adminAuthMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { nickname, vipLevel, vipExpireAt, isBanned, banReason, points, coins } = req.body;
    
    await pool.execute(
      'UPDATE users SET nickname = ?, vipLevel = ?, vipExpireAt = ?, isBanned = ?, banReason = ?, points = ?, coins = ?, updatedAt = NOW() WHERE id = ?',
      [nickname, vipLevel, vipExpireAt || null, isBanned || false, banReason || null, points, coins, id]
    );
    
    // 同步更新錢包
    await pool.execute(
      'UPDATE userWallets SET points = ?, coins = ? WHERE userId = ?',
      [points, coins, id]
    );
    
    // 記錄操作日誌
    await pool.execute(
      'INSERT INTO adminLogs (adminId, action, targetType, targetId, details) VALUES (?, ?, ?, ?, ?)',
      [req.admin.id, 'update_user', 'user', id, JSON.stringify(req.body)]
    );
    
    res.json({ message: '用戶更新成功' });
  } catch (err) {
    console.error('Update user error:', err);
    res.status(500).json({ error: { message: '更新用戶失敗' } });
  }
});

// 獲取角色列表（管理後台）
app.get('/api/admin/characters', adminAuthMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 20, search, category, status } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    let sql = 'SELECT * FROM aiCharacters WHERE 1=1';
    const params = [];
    
    if (search) {
      sql += ' AND (name LIKE ? OR description LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    if (category) {
      sql += ' AND category = ?';
      params.push(category);
    }
    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    
    sql += ` ORDER BY createdAt DESC LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`;
    
    const [characters] = await pool.execute(sql, params);
    
    res.json({ characters });
  } catch (err) {
    console.error('Get admin characters error:', err);
    res.status(500).json({ error: { message: '獲取角色列表失敗' } });
  }
});

// 創建/編輯角色（管理後台）
app.post('/api/admin/characters', adminAuthMiddleware, async (req, res) => {
  try {
    const { id, name, avatar, description, personality, backgroundStory, type, category, rpgSubCategory, gender, tags, isPublic, status } = req.body;
    
    if (id) {
      // 更新
      await pool.execute(
        `UPDATE aiCharacters SET name = ?, avatar = ?, description = ?, personality = ?, backgroundStory = ?, type = ?, category = ?, rpgSubCategory = ?, gender = ?, tags = ?, isPublic = ?, status = ?, updatedAt = NOW() WHERE id = ?`,
        [name, avatar, description, personality, backgroundStory, type || 'system', category, rpgSubCategory, gender, JSON.stringify(tags || []), isPublic, status || 'active', id]
      );
      res.json({ message: '角色更新成功' });
    } else {
      // 創建
      const characterId = generateId(16);
      const [result] = await pool.execute(
        `INSERT INTO aiCharacters (characterId, name, avatar, description, personality, backgroundStory, type, category, rpgSubCategory, gender, tags, isPublic, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [characterId, name, avatar, description, personality, backgroundStory, type || 'system', category, rpgSubCategory, gender, JSON.stringify(tags || []), isPublic, status || 'active']
      );
      res.json({ message: '角色創建成功', id: result.insertId, characterId });
    }
    
    // 記錄操作日誌
    await pool.execute(
      'INSERT INTO adminLogs (adminId, action, targetType, targetId, details) VALUES (?, ?, ?, ?, ?)',
      [req.admin.id, id ? 'update_character' : 'create_character', 'character', id || 0, JSON.stringify(req.body)]
    );
  } catch (err) {
    console.error('Save character error:', err);
    res.status(500).json({ error: { message: '保存角色失敗' } });
  }
});

// 刪除/下架角色
app.delete('/api/admin/characters/:id', adminAuthMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    
    await pool.execute(
      'UPDATE aiCharacters SET status = "offline", updatedAt = NOW() WHERE id = ?',
      [id]
    );
    
    await pool.execute(
      'INSERT INTO adminLogs (adminId, action, targetType, targetId) VALUES (?, ?, ?, ?)',
      [req.admin.id, 'delete_character', 'character', id]
    );
    
    res.json({ message: '角色已下架' });
  } catch (err) {
    console.error('Delete character error:', err);
    res.status(500).json({ error: { message: '下架角色失敗' } });
  }
});


// ==================== API配置管理 ====================

// 獲取API配置列表
app.get('/api/admin/api-configs', adminAuthMiddleware, async (req, res) => {
  try {
    const [configs] = await pool.execute(
      'SELECT id, name, provider, serviceType, baseUrl, defaultModel, temperature, maxTokens, isActive, priority, totalCalls, totalFailures, lastCalledAt, notes, createdAt FROM apiConfigs ORDER BY priority ASC'
    );
    
    res.json({ configs });
  } catch (err) {
    console.error('Get API configs error:', err);
    res.status(500).json({ error: { message: '獲取API配置失敗' } });
  }
});

// 創建/更新API配置
app.post('/api/admin/api-configs', adminAuthMiddleware, async (req, res) => {
  try {
    const { id, name, provider, serviceType, baseUrl, apiKey, defaultModel, temperature, maxTokens, topP, frequencyPenalty, presencePenalty, isActive, priority, rateLimit, notes } = req.body;
    
    if (id) {
      // 更新
      let sql = 'UPDATE apiConfigs SET name = ?, provider = ?, serviceType = ?, baseUrl = ?, defaultModel = ?, temperature = ?, maxTokens = ?, topP = ?, frequencyPenalty = ?, presencePenalty = ?, isActive = ?, priority = ?, rateLimit = ?, notes = ?, updatedAt = NOW()';
      const params = [name, provider, serviceType || 'chat', baseUrl, defaultModel, temperature || 0.7, maxTokens || 2048, topP || 0.95, frequencyPenalty || 0, presencePenalty || 0, isActive, priority || 100, rateLimit || 60, notes];
      
      if (apiKey) {
        sql += ', apiKey = ?';
        params.push(apiKey);
      }
      
      sql += ' WHERE id = ?';
      params.push(id);
      
      await pool.execute(sql, params);
      res.json({ message: 'API配置更新成功' });
    } else {
      // 創建
      const [result] = await pool.execute(
        'INSERT INTO apiConfigs (name, provider, serviceType, baseUrl, apiKey, defaultModel, temperature, maxTokens, topP, frequencyPenalty, presencePenalty, isActive, priority, rateLimit, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [name, provider, serviceType || 'chat', baseUrl, apiKey, defaultModel, temperature || 0.7, maxTokens || 2048, topP || 0.95, frequencyPenalty || 0, presencePenalty || 0, isActive !== false, priority || 100, rateLimit || 60, notes]
      );
      res.json({ message: 'API配置創建成功', id: result.insertId });
    }
    
    await pool.execute(
      'INSERT INTO adminLogs (adminId, action, targetType, targetId, details) VALUES (?, ?, ?, ?, ?)',
      [req.admin.id, id ? 'update_api_config' : 'create_api_config', 'api_config', id || 0, JSON.stringify({ ...req.body, apiKey: '***' })]
    );
  } catch (err) {
    console.error('Save API config error:', err);
    res.status(500).json({ error: { message: '保存API配置失敗' } });
  }
});

// 刪除API配置
app.delete('/api/admin/api-configs/:id', adminAuthMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    
    await pool.execute('DELETE FROM apiConfigs WHERE id = ?', [id]);
    
    await pool.execute(
      'INSERT INTO adminLogs (adminId, action, targetType, targetId) VALUES (?, ?, ?, ?)',
      [req.admin.id, 'delete_api_config', 'api_config', id]
    );
    
    res.json({ message: 'API配置已刪除' });
  } catch (err) {
    console.error('Delete API config error:', err);
    res.status(500).json({ error: { message: '刪除API配置失敗' } });
  }
});

// ==================== TTS配置管理 ====================

// 獲取TTS服務配置
app.get('/api/admin/tts-configs', adminAuthMiddleware, async (req, res) => {
  try {
    const [configs] = await pool.execute(
      'SELECT id, name, serviceType, apiBaseUrl, defaultVoice, isEnabled, isDefault, callCount, lastCalledAt, createdAt FROM ttsServiceConfigs ORDER BY isDefault DESC, createdAt ASC'
    );
    
    res.json({ configs });
  } catch (err) {
    console.error('Get TTS configs error:', err);
    res.status(500).json({ error: { message: '獲取TTS配置失敗' } });
  }
});

// 創建/更新TTS配置
app.post('/api/admin/tts-configs', adminAuthMiddleware, async (req, res) => {
  try {
    const { id, name, serviceType, apiBaseUrl, apiKey, defaultVoice, isEnabled, isDefault, extraConfig } = req.body;
    
    if (id) {
      let sql = 'UPDATE ttsServiceConfigs SET name = ?, serviceType = ?, apiBaseUrl = ?, defaultVoice = ?, isEnabled = ?, isDefault = ?, extraConfig = ?, updatedAt = NOW()';
      const params = [name, serviceType, apiBaseUrl, defaultVoice, isEnabled, isDefault, extraConfig ? JSON.stringify(extraConfig) : null];
      
      if (apiKey) {
        sql += ', apiKey = ?';
        params.push(apiKey);
      }
      
      sql += ' WHERE id = ?';
      params.push(id);
      
      await pool.execute(sql, params);
      
      // 如果設為默認，取消其他默認
      if (isDefault) {
        await pool.execute('UPDATE ttsServiceConfigs SET isDefault = FALSE WHERE id != ?', [id]);
      }
      
      res.json({ message: 'TTS配置更新成功' });
    } else {
      const [result] = await pool.execute(
        'INSERT INTO ttsServiceConfigs (name, serviceType, apiBaseUrl, apiKey, defaultVoice, isEnabled, isDefault, extraConfig) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [name, serviceType, apiBaseUrl, apiKey, defaultVoice, isEnabled !== false, isDefault || false, extraConfig ? JSON.stringify(extraConfig) : null]
      );
      
      if (isDefault) {
        await pool.execute('UPDATE ttsServiceConfigs SET isDefault = FALSE WHERE id != ?', [result.insertId]);
      }
      
      res.json({ message: 'TTS配置創建成功', id: result.insertId });
    }
    
    await pool.execute(
      'INSERT INTO adminLogs (adminId, action, targetType, targetId, details) VALUES (?, ?, ?, ?, ?)',
      [req.admin.id, id ? 'update_tts_config' : 'create_tts_config', 'tts_config', id || 0, JSON.stringify({ ...req.body, apiKey: '***' })]
    );
  } catch (err) {
    console.error('Save TTS config error:', err);
    res.status(500).json({ error: { message: '保存TTS配置失敗' } });
  }
});

// 刪除TTS配置
app.delete('/api/admin/tts-configs/:id', adminAuthMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    
    await pool.execute('DELETE FROM ttsServiceConfigs WHERE id = ?', [id]);
    
    res.json({ message: 'TTS配置已刪除' });
  } catch (err) {
    console.error('Delete TTS config error:', err);
    res.status(500).json({ error: { message: '刪除TTS配置失敗' } });
  }
});

// 獲取系統音色列表
app.get('/api/admin/voices', adminAuthMiddleware, async (req, res) => {
  try {
    const [voices] = await pool.execute(
      'SELECT * FROM systemVoices ORDER BY sortOrder ASC, createdAt ASC'
    );
    
    res.json({ voices });
  } catch (err) {
    console.error('Get voices error:', err);
    res.status(500).json({ error: { message: '獲取音色列表失敗' } });
  }
});

// 創建/更新系統音色
app.post('/api/admin/voices', adminAuthMiddleware, async (req, res) => {
  try {
    const { id, voiceId, name, description, previewUrl, provider, gender, styleTags, language, requiredVipLevel, isActive, sortOrder } = req.body;
    
    if (id) {
      await pool.execute(
        'UPDATE systemVoices SET voiceId = ?, name = ?, description = ?, previewUrl = ?, provider = ?, gender = ?, styleTags = ?, language = ?, requiredVipLevel = ?, isActive = ?, sortOrder = ?, updatedAt = NOW() WHERE id = ?',
        [voiceId, name, description, previewUrl, provider || 'system', gender || 'neutral', JSON.stringify(styleTags || []), language || 'zh-CN', requiredVipLevel || 0, isActive !== false, sortOrder || 0, id]
      );
      res.json({ message: '音色更新成功' });
    } else {
      const [result] = await pool.execute(
        'INSERT INTO systemVoices (voiceId, name, description, previewUrl, provider, gender, styleTags, language, requiredVipLevel, isActive, sortOrder) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [voiceId || generateId(16), name, description, previewUrl, provider || 'system', gender || 'neutral', JSON.stringify(styleTags || []), language || 'zh-CN', requiredVipLevel || 0, isActive !== false, sortOrder || 0]
      );
      res.json({ message: '音色創建成功', id: result.insertId });
    }
  } catch (err) {
    console.error('Save voice error:', err);
    res.status(500).json({ error: { message: '保存音色失敗' } });
  }
});

// ==================== VIP配置管理 ====================

// 獲取VIP等級配置
app.get('/api/admin/vip-configs', adminAuthMiddleware, async (req, res) => {
  try {
    const [configs] = await pool.execute(
      'SELECT * FROM vipLevelConfigs ORDER BY level ASC'
    );
    
    res.json({ configs });
  } catch (err) {
    console.error('Get VIP configs error:', err);
    res.status(500).json({ error: { message: '獲取VIP配置失敗' } });
  }
});

// 更新VIP等級配置
app.put('/api/admin/vip-configs/:id', adminAuthMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, badgeUrl, dailyTextMessages, dailyVoiceMessages, maxCharacters, canUseSystemVoice, canUseVoiceClone, memoryCapacity, contextLength, priorityResponse, adFree, isActive } = req.body;
    
    await pool.execute(
      'UPDATE vipLevelConfigs SET name = ?, description = ?, badgeUrl = ?, dailyTextMessages = ?, dailyVoiceMessages = ?, maxCharacters = ?, canUseSystemVoice = ?, canUseVoiceClone = ?, memoryCapacity = ?, contextLength = ?, priorityResponse = ?, adFree = ?, isActive = ?, updatedAt = NOW() WHERE id = ?',
      [name, description, badgeUrl, dailyTextMessages, dailyVoiceMessages, maxCharacters, canUseSystemVoice, canUseVoiceClone, memoryCapacity, contextLength, priorityResponse, adFree, isActive, id]
    );
    
    await pool.execute(
      'INSERT INTO adminLogs (adminId, action, targetType, targetId, details) VALUES (?, ?, ?, ?, ?)',
      [req.admin.id, 'update_vip_config', 'vip_config', id, JSON.stringify(req.body)]
    );
    
    res.json({ message: 'VIP配置更新成功' });
  } catch (err) {
    console.error('Update VIP config error:', err);
    res.status(500).json({ error: { message: '更新VIP配置失敗' } });
  }
});

// ==================== 禮物管理 ====================

// 獲取禮物配置列表
app.get('/api/admin/gift-configs', adminAuthMiddleware, async (req, res) => {
  try {
    const [gifts] = await pool.execute(
      'SELECT * FROM giftConfigs ORDER BY sortOrder ASC, createdAt ASC'
    );
    
    res.json({ gifts });
  } catch (err) {
    console.error('Get gift configs error:', err);
    res.status(500).json({ error: { message: '獲取禮物配置失敗' } });
  }
});

// 創建/更新禮物配置
app.post('/api/admin/gift-configs', adminAuthMiddleware, async (req, res) => {
  try {
    const { id, giftId, name, icon, description, price, affinityPoints, rarity, category, isActive, sortOrder } = req.body;
    
    if (id) {
      await pool.execute(
        'UPDATE giftConfigs SET giftId = ?, name = ?, icon = ?, description = ?, price = ?, affinityPoints = ?, rarity = ?, category = ?, isActive = ?, sortOrder = ? WHERE id = ?',
        [giftId, name, icon, description, price, affinityPoints, rarity || 'common', category || 'flower', isActive !== false, sortOrder || 0, id]
      );
      res.json({ message: '禮物配置更新成功' });
    } else {
      const [result] = await pool.execute(
        'INSERT INTO giftConfigs (giftId, name, icon, description, price, affinityPoints, rarity, category, isActive, sortOrder) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [giftId || generateId(8), name, icon, description, price, affinityPoints, rarity || 'common', category || 'flower', isActive !== false, sortOrder || 0]
      );
      res.json({ message: '禮物配置創建成功', id: result.insertId });
    }
  } catch (err) {
    console.error('Save gift config error:', err);
    res.status(500).json({ error: { message: '保存禮物配置失敗' } });
  }
});

// 刪除禮物配置
app.delete('/api/admin/gift-configs/:id', adminAuthMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    
    await pool.execute('UPDATE giftConfigs SET isActive = FALSE WHERE id = ?', [id]);
    
    res.json({ message: '禮物已停用' });
  } catch (err) {
    console.error('Delete gift config error:', err);
    res.status(500).json({ error: { message: '停用禮物失敗' } });
  }
});

// 獲取禮物贈送記錄
app.get('/api/admin/gift-records', adminAuthMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    const [records] = await pool.execute(
      `SELECT gr.*, u.username, u.nickname as userNickname, ac.name as characterName
       FROM giftRecords gr
       JOIN users u ON gr.userId = u.id
       JOIN aiCharacters ac ON gr.characterId = ac.id
       ORDER BY gr.sentAt DESC
       LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`
    );
    
    const [countResult] = await pool.execute('SELECT COUNT(*) as total FROM giftRecords');
    
    res.json({
      records,
      total: countResult[0].total,
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (err) {
    console.error('Get gift records error:', err);
    res.status(500).json({ error: { message: '獲取禮物記錄失敗' } });
  }
});

// 獲取紅包記錄
app.get('/api/admin/redpacket-records', adminAuthMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    const [records] = await pool.execute(
      `SELECT rp.*, u.username, u.nickname as userNickname, ac.name as characterName
       FROM redPackets rp
       JOIN users u ON rp.userId = u.id
       JOIN aiCharacters ac ON rp.characterId = ac.id
       ORDER BY rp.sentAt DESC
       LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`
    );
    
    const [countResult] = await pool.execute('SELECT COUNT(*) as total FROM redPackets');
    
    res.json({
      records,
      total: countResult[0].total,
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (err) {
    console.error('Get red packet records error:', err);
    res.status(500).json({ error: { message: '獲取紅包記錄失敗' } });
  }
});

// ==================== 管理員管理 ====================

// 獲取管理員列表
app.get('/api/admin/admins', adminAuthMiddleware, async (req, res) => {
  try {
    const [admins] = await pool.execute(
      'SELECT id, username, nickname, adminRole, lastLoginAt, lastLoginIp, isActive, createdAt FROM adminUsers ORDER BY createdAt ASC'
    );
    
    res.json({ admins });
  } catch (err) {
    console.error('Get admins error:', err);
    res.status(500).json({ error: { message: '獲取管理員列表失敗' } });
  }
});

// 創建/更新管理員
app.post('/api/admin/admins', adminAuthMiddleware, async (req, res) => {
  try {
    // 只有超級管理員可以管理管理員
    if (req.admin.adminRole !== 'super_admin') {
      return res.status(403).json({ error: { message: '只有超級管理員可以管理管理員' } });
    }
    
    const { id, username, password, nickname, adminRole, isActive } = req.body;
    
    if (id) {
      let sql = 'UPDATE adminUsers SET username = ?, nickname = ?, adminRole = ?, isActive = ?, updatedAt = NOW()';
      const params = [username, nickname, adminRole, isActive];
      
      if (password) {
        const passwordHash = await bcrypt.hash(password, 10);
        sql += ', passwordHash = ?';
        params.push(passwordHash);
      }
      
      sql += ' WHERE id = ?';
      params.push(id);
      
      await pool.execute(sql, params);
      res.json({ message: '管理員更新成功' });
    } else {
      if (!password) {
        return res.status(400).json({ error: { message: '請設置密碼' } });
      }
      
      const passwordHash = await bcrypt.hash(password, 10);
      const [result] = await pool.execute(
        'INSERT INTO adminUsers (username, passwordHash, nickname, adminRole, isActive) VALUES (?, ?, ?, ?, ?)',
        [username, passwordHash, nickname, adminRole || 'operator', isActive !== false]
      );
      res.json({ message: '管理員創建成功', id: result.insertId });
    }
  } catch (err) {
    console.error('Save admin error:', err);
    res.status(500).json({ error: { message: '保存管理員失敗' } });
  }
});

// 刪除管理員
app.delete('/api/admin/admins/:id', adminAuthMiddleware, async (req, res) => {
  try {
    if (req.admin.adminRole !== 'super_admin') {
      return res.status(403).json({ error: { message: '只有超級管理員可以刪除管理員' } });
    }
    
    const { id } = req.params;
    
    // 不能刪除自己
    if (parseInt(id) === req.admin.id) {
      return res.status(400).json({ error: { message: '不能刪除自己' } });
    }
    
    await pool.execute('DELETE FROM adminUsers WHERE id = ?', [id]);
    
    res.json({ message: '管理員已刪除' });
  } catch (err) {
    console.error('Delete admin error:', err);
    res.status(500).json({ error: { message: '刪除管理員失敗' } });
  }
});

// 獲取操作日誌
app.get('/api/admin/logs', adminAuthMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    const [logs] = await pool.execute(
      `SELECT al.*, au.username as adminUsername, au.nickname as adminNickname
       FROM adminLogs al
       JOIN adminUsers au ON al.adminId = au.id
       ORDER BY al.createdAt DESC
       LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`
    );
    
    res.json({ logs });
  } catch (err) {
    console.error('Get logs error:', err);
    res.status(500).json({ error: { message: '獲取操作日誌失敗' } });
  }
});

// 獲取動態列表（管理後台）
app.get('/api/admin/moments', adminAuthMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    const [moments] = await pool.execute(
      `SELECT m.*, 
        CASE WHEN m.authorType = 'user' THEN u.nickname ELSE ac.name END as authorName
       FROM moments m
       LEFT JOIN users u ON m.authorType = 'user' AND m.userId = u.id
       LEFT JOIN aiCharacters ac ON m.authorType = 'ai' AND m.characterId = ac.id
       ORDER BY m.createdAt DESC
       LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`
    );
    
    res.json({ moments });
  } catch (err) {
    console.error('Get admin moments error:', err);
    res.status(500).json({ error: { message: '獲取動態列表失敗' } });
  }
});

// 刪除動態
app.delete('/api/admin/moments/:id', adminAuthMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    
    await pool.execute('UPDATE moments SET isDeleted = TRUE WHERE id = ? OR momentId = ?', [id, id]);
    
    res.json({ message: '動態已刪除' });
  } catch (err) {
    console.error('Delete moment error:', err);
    res.status(500).json({ error: { message: '刪除動態失敗' } });
  }
// ==================== 排行榜API ====================

// 好感度排行榜
app.get('/api/rankings/affinity', authMiddleware, async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    
    const [rankings] = await pool.execute(
      `SELECT 
        uca.userId, uca.characterId, uca.affinityValue, uca.affinityLevel,
        ac.name, ac.avatar, ac.category
       FROM userCharacterAffinity uca
       JOIN aiCharacters ac ON uca.characterId = ac.id
       WHERE uca.userId = ?
       ORDER BY uca.affinityValue DESC
       LIMIT ?`,
      [req.user.id, parseInt(limit)]
    );
    
    const levelNames = {
      'stranger': '陌生人',
      'acquaintance': '熟人',
      'friend': '好友',
      'close': '挚友',
      'intimate': '亲密',
      'soulmate': '灵魂伴侣'
    };
    
    const result = rankings.map((r, index) => ({
      rank: index + 1,
      name: r.name,
      avatar: r.avatar,
      score: r.affinityValue,
      subtitle: `好感度等级: ${levelNames[r.affinityLevel] || '陌生人'}`,
      category: r.category
    }));
    
    res.json(result);
  } catch (err) {
    console.error('获取好感度排行榜失败:', err);
    res.status(500).json({ error: { message: '获取排行榜失败' } });
  }
});

// 聊天排行榜
app.get('/api/rankings/chat', authMiddleware, async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    
    const [rankings] = await pool.execute(
      `SELECT 
        ac.id, ac.name, ac.avatar, ac.category, ac.usageCount,
        COUNT(cm.id) as messageCount
       FROM aiCharacters ac
       LEFT JOIN chatSessions cs ON ac.id = cs.characterId AND cs.userId = ?
       LEFT JOIN chatMessages cm ON cs.id = cm.sessionId
       WHERE ac.status = 'active'
       GROUP BY ac.id
       ORDER BY messageCount DESC, ac.usageCount DESC
       LIMIT ?`,
      [req.user.id, parseInt(limit)]
    );
    
    const result = rankings.map((r, index) => ({
      rank: index + 1,
      name: r.name,
      avatar: r.avatar,
      score: r.messageCount || 0,
      subtitle: `总对话数: ${r.usageCount}`,
      category: r.category
    }));
    
    res.json(result);
  } catch (err) {
    console.error('获取聊天排行榜失败:', err);
    res.status(500).json({ error: { message: '获取排行榜失败' } });
  }
});

// 送礼排行榜
app.get('/api/rankings/gift', authMiddleware, async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    
    const [rankings] = await pool.execute(
      `SELECT 
        ac.id, ac.name, ac.avatar, ac.category,
        COALESCE(SUM(gr.coinSpent), 0) as totalGiftValue,
        COUNT(gr.id) as giftCount
       FROM aiCharacters ac
       LEFT JOIN giftRecords gr ON ac.id = gr.characterId AND gr.userId = ?
       WHERE ac.status = 'active'
       GROUP BY ac.id
       HAVING totalGiftValue > 0
       ORDER BY totalGiftValue DESC
       LIMIT ?`,
      [req.user.id, parseInt(limit)]
    );
    
    const result = rankings.map((r, index) => ({
      rank: index + 1,
      name: r.name,
      avatar: r.avatar,
      score: r.totalGiftValue,
      subtitle: `送出 ${r.giftCount} 次礼物`,
      category: r.category
    }));
    
    res.json(result);
  } catch (err) {
    console.error('获取送礼排行榜失败:', err);
    res.status(500).json({ error: { message: '获取排行榜失败' } });
  }
});

// ==================== 商城API ====================

// 获取商城商品列表
app.get('/api/shop/items', async (req, res) => {
  try {
    // 返回默认商品列表
    const items = [
      { id: 1, itemId: 'vip_month', name: 'VIP月卡', icon: '👑', category: 'vip', price: 30, description: '每日100条消息', duration: 30 },
      { id: 2, itemId: 'vip_quarter', name: 'VIP季卡', icon: '💎', category: 'vip', price: 80, originalPrice: 90, description: '每日200条消息', duration: 90 },
      { id: 3, itemId: 'vip_year', name: 'VIP年卡', icon: '🏆', category: 'vip', price: 298, originalPrice: 360, description: '无限消息', duration: 365 },
      { id: 4, itemId: 'coins_100', name: '100金币', icon: '💰', category: 'coins', price: 10, coinAmount: 100, description: '用于送礼物' },
      { id: 5, itemId: 'coins_500', name: '500金币', icon: '💰', category: 'coins', price: 45, originalPrice: 50, coinAmount: 500, description: '用于送礼物' },
      { id: 6, itemId: 'coins_1000', name: '1000金币', icon: '💰', category: 'coins', price: 80, originalPrice: 100, coinAmount: 1000, description: '用于送礼物' },
      { id: 7, itemId: 'voice_pack', name: '语音包', icon: '🔊', category: 'voice', price: 20, description: '解锁语音回复' },
      { id: 8, itemId: 'emoji_pack', name: '表情包', icon: '😊', category: 'emoji', price: 10, description: '专属表情' }
    ];
    
    res.json({ items });
  } catch (err) {
    console.error('获取商城商品失败:', err);
    res.status(500).json({ error: { message: '获取商品列表失败' } });
  }
});

// ==================== 签到API（修复版） ====================

// 签到
app.post('/api/checkin', authMiddleware, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    // 检查今日是否已签到
    const [existing] = await pool.execute(
      'SELECT * FROM checkInRecords WHERE userId = ? AND checkInDate = ?',
      [req.user.id, today]
    );
    
    if (existing.length > 0) {
      return res.status(400).json({ error: { message: '今日已签到' } });
    }
    
    // 获取昨日签到记录计算连续天数
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const [yesterdayRecord] = await pool.execute(
      'SELECT consecutiveDays FROM checkInRecords WHERE userId = ? AND checkInDate = ?',
      [req.user.id, yesterday]
    );
    
    const consecutiveDays = yesterdayRecord.length > 0 ? yesterdayRecord[0].consecutiveDays + 1 : 1;
    
    // 计算奖励（连续签到奖励更多）
    const basePoints = 10;
    const bonusPoints = Math.min(consecutiveDays - 1, 6) * 2;
    const totalPoints = basePoints + bonusPoints;
    
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      
      // 记录签到
      await conn.execute(
        'INSERT INTO checkInRecords (userId, checkInDate, consecutiveDays, pointsEarned) VALUES (?, ?, ?, ?)',
        [req.user.id, today, consecutiveDays, totalPoints]
      );
      
      // 确保钱包存在并更新
      const [wallets] = await conn.execute('SELECT id FROM userWallets WHERE userId = ?', [req.user.id]);
      if (wallets.length === 0) {
        await conn.execute('INSERT INTO userWallets (userId, points, coins, totalPointsEarned) VALUES (?, ?, 0, ?)', [req.user.id, totalPoints, totalPoints]);
      } else {
        await conn.execute(
          'UPDATE userWallets SET points = points + ?, totalPointsEarned = totalPointsEarned + ? WHERE userId = ?',
          [totalPoints, totalPoints, req.user.id]
        );
      }
      
      await conn.commit();
      
      res.json({
        message: '签到成功',
        consecutiveDays,
        points: totalPoints
      });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error('签到失败:', err);
    res.status(500).json({ error: { message: '签到失败' } });
  }
});

// ==================== 钱包API（修复版） ====================

// 获取钱包信息
app.get('/api/wallet/info', authMiddleware, async (req, res) => {
  try {
    let [wallets] = await pool.execute(
      'SELECT * FROM userWallets WHERE userId = ?',
      [req.user.id]
    );
    
    if (wallets.length === 0) {
      await pool.execute(
        'INSERT INTO userWallets (userId, points, coins, totalPointsEarned, totalCoinsEarned) VALUES (?, 100, 10000, 100, 10000)',
        [req.user.id]
      );
      wallets = [{ userId: req.user.id, points: 100, coins: 50, totalPointsEarned: 100, totalCoinsEarned: 50, totalCoinsSpent: 0 }];
    }
    
    res.json(wallets[0]);
  } catch (err) {
    console.error('获取钱包信息失败:', err);
    res.status(500).json({ error: { message: '获取钱包信息失败' } });
  }
});

// ==================== 用户角色API（修复版） ====================

// 获取用户创建的角色
app.get('/api/characters/my', authMiddleware, async (req, res) => {
  try {
    const [characters] = await pool.execute(
      'SELECT * FROM aiCharacters WHERE userId = ? ORDER BY createdAt DESC',
      [req.user.id]
    );
    
    res.json(characters);
  } catch (err) {
    console.error('获取我的角色失败:', err);
    res.status(500).json({ error: { message: '获取我的角色失败' } });
  }
});

// ==================== 红包API（修复路径） ====================

// 发红包
app.post('/api/redpackets/send', authMiddleware, async (req, res) => {
  try {
    const { characterId, amount, message } = req.body;
    
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: { message: '请输入有效金额' } });
    }
    
    // 检查金币余额
    const [wallets] = await pool.execute(
      'SELECT coins FROM userWallets WHERE userId = ?',
      [req.user.id]
    );
    
    if (wallets.length === 0 || wallets[0].coins < amount) {
      return res.status(400).json({ error: { message: '金币不足' } });
    }
    
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      
      // 扣除金币
      await conn.execute(
        'UPDATE userWallets SET coins = coins - ?, totalCoinsSpent = totalCoinsSpent + ? WHERE userId = ?',
        [amount, amount, req.user.id]
      );
      
      // 计算好感度
      const affinityGained = Math.floor(amount * 0.1);
      
      // 记录红包
      const packetId = crypto.randomBytes(8).toString('hex');
      await conn.execute(
        'INSERT INTO redPackets (packetId, userId, characterId, amount, message, affinityGained) VALUES (?, ?, ?, ?, ?, ?)',
        [packetId, req.user.id, characterId, amount, message || null, affinityGained]
      );
      
      // 增加好感度
      await conn.execute(
        `INSERT INTO userCharacterAffinity (userId, characterId, affinityValue, affinityLevel, totalInteractions) 
         VALUES (?, ?, ?, 'stranger', 1) 
         ON DUPLICATE KEY UPDATE affinityValue = affinityValue + ?, totalInteractions = totalInteractions + 1`,
        [req.user.id, characterId, affinityGained, affinityGained]
      );
      
      await conn.commit();
      
      res.json({
        message: '红包发送成功',
        packetId,
        amount,
        affinityGained
      });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error('发送红包失败:', err);
    res.status(500).json({ error: { message: '发送红包失败' } });
  }
});

// ==================== 用户API配置（修复版） ====================

// 保存用户API配置
app.post('/api/user/api-config', authMiddleware, async (req, res) => {
  try {
    const { provider, apiKey, apiUrl, model } = req.body;
    
    if (!apiKey) {
      return res.status(400).json({ error: { message: '请输入API Key' } });
    }
    
    // 根据provider设置默认URL
    let baseUrl = apiUrl;
    if (!baseUrl) {
      const defaultUrls = {
        'openai': 'https://api.openai.com/v1',
        'claude': 'https://api.anthropic.com/v1',
        'deepseek': 'https://api.deepseek.com/v1'
      };
      baseUrl = defaultUrls[provider] || apiUrl;
    }
    
    const [existing] = await pool.execute(
      'SELECT id FROM userApiConfigs WHERE userId = ?',
      [req.user.id]
    );
    
    if (existing.length > 0) {
      await pool.execute(
        'UPDATE userApiConfigs SET enabled = TRUE, provider = ?, baseUrl = ?, apiKey = ?, modelName = ?, isVerified = FALSE, updatedAt = NOW() WHERE userId = ?',
        [provider || 'openai', baseUrl, apiKey, model, req.user.id]
      );
    } else {
      await pool.execute(
        'INSERT INTO userApiConfigs (userId, enabled, provider, baseUrl, apiKey, modelName) VALUES (?, TRUE, ?, ?, ?, ?)',
        [req.user.id, provider || 'openai', baseUrl, apiKey, model]
      );
    }
    
    res.json({ message: 'API配置已保存' });
  } catch (err) {
    console.error('保存API配置失败:', err);
    res.status(500).json({ error: { message: '保存API配置失败' } });
  }
});

// 测试用户API配置
app.post('/api/user/api-config/test', authMiddleware, async (req, res) => {
  try {
    const { provider, apiKey, apiUrl } = req.body;
    
    if (!apiKey) {
      return res.status(400).json({ error: { message: '请输入API Key' } });
    }
    
    let baseUrl = apiUrl;
    if (!baseUrl) {
      const defaultUrls = {
        'openai': 'https://api.openai.com/v1',
        'claude': 'https://api.anthropic.com/v1',
        'deepseek': 'https://api.deepseek.com/v1'
      };
      baseUrl = defaultUrls[provider] || apiUrl;
    }
    
    try {
      const response = await fetch(baseUrl + '/models', {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${apiKey}` }
      });
      
      if (response.ok) {
        await pool.execute(
          'UPDATE userApiConfigs SET isVerified = TRUE, lastVerifiedAt = NOW() WHERE userId = ?',
          [req.user.id]
        );
        res.json({ success: true, message: '连接成功' });
      } else {
        res.json({ success: false, message: '连接失败' });
      }
    } catch (err) {
      res.json({ success: false, message: '连接失败: ' + err.message });
    }
  } catch (err) {
    console.error('测试API配置失败:', err);
    res.status(500).json({ error: { message: '测试失败' } });
  }
});

// 靜態文件服務
app.use("/admin", express.static("/var/www/weiai/admin"));
app.use("/", express.static("/var/www/weiai/frontend"));
// 啟動服務器
initDatabase().then(() => {
  app.listen(config.port, () => {
    console.log(`Server running on http://localhost:${config.port}`);
  });
}).catch(err => {
  console.error("Failed to initialize database:", err);
  process.exit(1);
});
