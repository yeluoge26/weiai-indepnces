-- 微爱数据库架构

-- 用户表
CREATE TABLE IF NOT EXISTS `users` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `email` VARCHAR(255) UNIQUE NOT NULL,
  `username` VARCHAR(100),
  `password` VARCHAR(255) NOT NULL,
  `avatar` VARCHAR(255),
  `bio` TEXT,
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 角色表
CREATE TABLE IF NOT EXISTS `characters` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL,
  `description` TEXT,
  `introduction` TEXT,
  `story` TEXT,
  `category` VARCHAR(50),
  `rpgSubCategory` VARCHAR(50),
  `personalityType` VARCHAR(100),
  `avatar` VARCHAR(255),
  `chatCount` INT DEFAULT 0,
  `likeCount` INT DEFAULT 0,
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_category` (`category`),
  INDEX `idx_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 聊天会话表
CREATE TABLE IF NOT EXISTS `chatSessions` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `userId` INT NOT NULL,
  `characterId` INT NOT NULL,
  `lastMessage` TEXT,
  `lastMessageTime` TIMESTAMP,
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`characterId`) REFERENCES `characters`(`id`) ON DELETE CASCADE,
  INDEX `idx_user_id` (`userId`),
  INDEX `idx_character_id` (`characterId`),
  UNIQUE KEY `unique_session` (`userId`, `characterId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 聊天消息表
CREATE TABLE IF NOT EXISTS `chatMessages` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `sessionId` INT NOT NULL,
  `sender` VARCHAR(50),
  `message` LONGTEXT,
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`sessionId`) REFERENCES `chatSessions`(`id`) ON DELETE CASCADE,
  INDEX `idx_session_id` (`sessionId`),
  INDEX `idx_created_at` (`createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 用户钱包表
CREATE TABLE IF NOT EXISTS `userWallets` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `userId` INT UNIQUE NOT NULL,
  `coins` INT DEFAULT 10000,
  `points` INT DEFAULT 0,
  `vipLevel` INT DEFAULT 0,
  `vipExpireAt` TIMESTAMP NULL,
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  INDEX `idx_user_id` (`userId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 用户与角色好感度表
CREATE TABLE IF NOT EXISTS `userCharacterAffinity` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `userId` INT NOT NULL,
  `characterId` INT NOT NULL,
  `affinity` INT DEFAULT 0,
  `affinityLevel` VARCHAR(50) DEFAULT '陌生人',
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`characterId`) REFERENCES `characters`(`id`) ON DELETE CASCADE,
  UNIQUE KEY `unique_affinity` (`userId`, `characterId`),
  INDEX `idx_user_id` (`userId`),
  INDEX `idx_character_id` (`characterId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 礼物配置表
CREATE TABLE IF NOT EXISTS `gifts` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL,
  `icon` VARCHAR(50),
  `price` INT NOT NULL,
  `affinity` INT NOT NULL,
  `description` TEXT,
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 礼物发送记录表
CREATE TABLE IF NOT EXISTS `giftRecords` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `userId` INT NOT NULL,
  `characterId` INT NOT NULL,
  `giftId` INT NOT NULL,
  `quantity` INT DEFAULT 1,
  `totalCost` INT,
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`characterId`) REFERENCES `characters`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`giftId`) REFERENCES `gifts`(`id`) ON DELETE CASCADE,
  INDEX `idx_user_id` (`userId`),
  INDEX `idx_character_id` (`characterId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 商城商品表
CREATE TABLE IF NOT EXISTS `shopItems` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL,
  `description` TEXT,
  `category` VARCHAR(50),
  `price` INT NOT NULL,
  `value` INT,
  `duration` INT,
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_category` (`category`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 购买记录表
CREATE TABLE IF NOT EXISTS `purchaseRecords` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `userId` INT NOT NULL,
  `itemId` INT NOT NULL,
  `price` INT,
  `status` VARCHAR(50),
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`itemId`) REFERENCES `shopItems`(`id`) ON DELETE CASCADE,
  INDEX `idx_user_id` (`userId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 签到记录表
CREATE TABLE IF NOT EXISTS `checkinRecords` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `userId` INT NOT NULL,
  `checkinDate` DATE NOT NULL,
  `consecutiveDays` INT DEFAULT 1,
  `reward` INT,
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  UNIQUE KEY `unique_checkin` (`userId`, `checkinDate`),
  INDEX `idx_user_id` (`userId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 朋友圈表
CREATE TABLE IF NOT EXISTS `moments` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `userId` INT NOT NULL,
  `content` TEXT,
  `images` JSON,
  `likeCount` INT DEFAULT 0,
  `commentCount` INT DEFAULT 0,
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  INDEX `idx_user_id` (`userId`),
  INDEX `idx_created_at` (`createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 通讯录表
CREATE TABLE IF NOT EXISTS `contacts` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `userId` INT NOT NULL,
  `characterId` INT NOT NULL,
  `nickname` VARCHAR(100),
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`characterId`) REFERENCES `characters`(`id`) ON DELETE CASCADE,
  UNIQUE KEY `unique_contact` (`userId`, `characterId`),
  INDEX `idx_user_id` (`userId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 创建索引以提高查询性能
CREATE INDEX idx_user_created ON users(createdAt);
CREATE INDEX idx_character_category ON characters(category);
CREATE INDEX idx_session_user_character ON chatSessions(userId, characterId);
CREATE INDEX idx_message_session_created ON chatMessages(sessionId, createdAt);
