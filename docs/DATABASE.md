# 微爱 - 数据库文档

## 数据库架构概述

微爱使用MySQL数据库，包含以下主要表：

### 核心表结构

#### 1. users（用户表）
存储用户基本信息

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT | 主键 |
| email | VARCHAR(255) | 邮箱（唯一） |
| username | VARCHAR(100) | 用户名 |
| password | VARCHAR(255) | 密码（加密） |
| avatar | VARCHAR(255) | 头像URL |
| bio | TEXT | 个人简介 |
| createdAt | TIMESTAMP | 创建时间 |
| updatedAt | TIMESTAMP | 更新时间 |

#### 2. characters（角色表）
存储AI角色信息

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT | 主键 |
| name | VARCHAR(100) | 角色名称 |
| description | TEXT | 简短描述 |
| introduction | TEXT | 详细介绍 |
| story | TEXT | 故事背景 |
| category | VARCHAR(50) | 分类（assistant/rpg/companion） |
| rpgSubCategory | VARCHAR(50) | RPG子分类（仙侠/都市等） |
| personalityType | VARCHAR(100) | 性格特征 |
| avatar | VARCHAR(255) | 头像URL |
| chatCount | INT | 聊天次数 |
| likeCount | INT | 喜欢数 |
| createdAt | TIMESTAMP | 创建时间 |
| updatedAt | TIMESTAMP | 更新时间 |

#### 3. chatSessions（聊天会话表）
存储用户与角色的聊天会话

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT | 主键 |
| userId | INT | 用户ID（外键） |
| characterId | INT | 角色ID（外键） |
| lastMessage | TEXT | 最后一条消息 |
| lastMessageTime | TIMESTAMP | 最后消息时间 |
| createdAt | TIMESTAMP | 创建时间 |
| updatedAt | TIMESTAMP | 更新时间 |

#### 4. chatMessages（聊天消息表）
存储聊天记录

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT | 主键 |
| sessionId | INT | 会话ID（外键） |
| sender | VARCHAR(50) | 发送者（user/character） |
| message | LONGTEXT | 消息内容 |
| createdAt | TIMESTAMP | 创建时间 |

#### 5. userWallets（用户钱包表）
存储用户的虚拟货币和VIP信息

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT | 主键 |
| userId | INT | 用户ID（外键） |
| coins | INT | 金币数量 |
| points | INT | 积分数量 |
| vipLevel | INT | VIP等级 |
| vipExpireAt | TIMESTAMP | VIP过期时间 |
| createdAt | TIMESTAMP | 创建时间 |
| updatedAt | TIMESTAMP | 更新时间 |

#### 6. userCharacterAffinity（好感度表）
存储用户与角色的好感度

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT | 主键 |
| userId | INT | 用户ID（外键） |
| characterId | INT | 角色ID（外键） |
| affinity | INT | 好感度值 |
| affinityLevel | VARCHAR(50) | 好感度等级 |
| createdAt | TIMESTAMP | 创建时间 |
| updatedAt | TIMESTAMP | 更新时间 |

#### 7. gifts（礼物表）
存储可用的礼物配置

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT | 主键 |
| name | VARCHAR(100) | 礼物名称 |
| icon | VARCHAR(50) | 礼物图标 |
| price | INT | 价格（金币） |
| affinity | INT | 增加的好感度 |
| description | TEXT | 描述 |
| createdAt | TIMESTAMP | 创建时间 |

#### 8. giftRecords（礼物发送记录表）
记录用户发送的礼物

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT | 主键 |
| userId | INT | 用户ID（外键） |
| characterId | INT | 角色ID（外键） |
| giftId | INT | 礼物ID（外键） |
| quantity | INT | 数量 |
| totalCost | INT | 总花费 |
| createdAt | TIMESTAMP | 创建时间 |

#### 9. shopItems（商城商品表）
存储可购买的商品

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT | 主键 |
| name | VARCHAR(100) | 商品名称 |
| description | TEXT | 描述 |
| category | VARCHAR(50) | 分类（vip/coins/features） |
| price | INT | 价格 |
| value | INT | 价值（金币数量等） |
| duration | INT | 有效期（天数） |
| createdAt | TIMESTAMP | 创建时间 |

#### 10. purchaseRecords（购买记录表）
记录用户的购买历史

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT | 主键 |
| userId | INT | 用户ID（外键） |
| itemId | INT | 商品ID（外键） |
| price | INT | 购买价格 |
| status | VARCHAR(50) | 状态（success/pending/failed） |
| createdAt | TIMESTAMP | 创建时间 |

#### 11. checkinRecords（签到记录表）
记录用户的每日签到

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT | 主键 |
| userId | INT | 用户ID（外键） |
| checkinDate | DATE | 签到日期 |
| consecutiveDays | INT | 连续签到天数 |
| reward | INT | 奖励（积分） |
| createdAt | TIMESTAMP | 创建时间 |

#### 12. moments（朋友圈表）
存储用户发布的动态

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT | 主键 |
| userId | INT | 用户ID（外键） |
| content | TEXT | 内容 |
| images | JSON | 图片URL列表 |
| likeCount | INT | 点赞数 |
| commentCount | INT | 评论数 |
| createdAt | TIMESTAMP | 创建时间 |

#### 13. contacts（通讯录表）
存储用户的联系人（收藏的角色）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT | 主键 |
| userId | INT | 用户ID（外键） |
| characterId | INT | 角色ID（外键） |
| nickname | VARCHAR(100) | 昵称 |
| createdAt | TIMESTAMP | 创建时间 |

## 数据库初始化

### 1. 创建数据库

```bash
# 登录MySQL
mysql -u root -p

# 创建数据库
CREATE DATABASE weiai CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

# 创建用户
CREATE USER 'weiai'@'localhost' IDENTIFIED BY 'weiai123';

# 授予权限
GRANT ALL PRIVILEGES ON weiai.* TO 'weiai'@'localhost';
FLUSH PRIVILEGES;

# 退出
EXIT;
```

### 2. 导入架构

```bash
# 导入数据库架构
mysql -u weiai -pweiai123 weiai < database/schema.sql

# 导入初始数据
mysql -u weiai -pweiai123 weiai < database/init.sql
```

### 3. 验证导入

```bash
# 登录数据库
mysql -u weiai -pweiai123 weiai

# 查看所有表
SHOW TABLES;

# 查看表结构
DESCRIBE users;
DESCRIBE characters;
```

## 常用数据库操作

### 用户管理

```sql
-- 查看所有用户
SELECT * FROM users;

-- 查看特定用户
SELECT * FROM users WHERE email='user@example.com';

-- 创建用户（不推荐，应该通过API）
INSERT INTO users (email, username, password) 
VALUES ('user@example.com', 'username', 'hashed_password');

-- 更新用户信息
UPDATE users SET username='newname' WHERE id=1;

-- 删除用户
DELETE FROM users WHERE id=1;
```

### 角色管理

```sql
-- 查看所有角色
SELECT * FROM characters;

-- 按分类查看角色
SELECT * FROM characters WHERE category='rpg';

-- 按子分类查看角色
SELECT * FROM characters WHERE rpgSubCategory='仙侠';

-- 查看热门角色（按聊天次数）
SELECT * FROM characters ORDER BY chatCount DESC LIMIT 10;

-- 查看最受欢迎的角色（按喜欢数）
SELECT * FROM characters ORDER BY likeCount DESC LIMIT 10;

-- 更新角色聊天次数
UPDATE characters SET chatCount = chatCount + 1 WHERE id=1;
```

### 钱包管理

```sql
-- 查看用户钱包
SELECT * FROM userWallets WHERE userId=1;

-- 增加金币
UPDATE userWallets SET coins = coins + 100 WHERE userId=1;

-- 减少金币
UPDATE userWallets SET coins = coins - 50 WHERE userId=1;

-- 设置VIP
UPDATE userWallets 
SET vipLevel=1, vipExpireAt=DATE_ADD(NOW(), INTERVAL 30 DAY) 
WHERE userId=1;

-- 赠送所有用户金币
UPDATE userWallets SET coins = coins + 1000;
```

### 好感度管理

```sql
-- 查看用户与角色的好感度
SELECT * FROM userCharacterAffinity WHERE userId=1 AND characterId=1;

-- 增加好感度
UPDATE userCharacterAffinity 
SET affinity = affinity + 10 
WHERE userId=1 AND characterId=1;

-- 更新好感度等级
UPDATE userCharacterAffinity 
SET affinityLevel='亲密' 
WHERE userId=1 AND characterId=1;

-- 查看好感度排行榜
SELECT uca.*, c.name 
FROM userCharacterAffinity uca
JOIN characters c ON uca.characterId = c.id
ORDER BY uca.affinity DESC
LIMIT 10;
```

### 聊天记录

```sql
-- 查看用户的聊天会话
SELECT * FROM chatSessions WHERE userId=1;

-- 查看特定会话的消息
SELECT * FROM chatMessages WHERE sessionId=1 ORDER BY createdAt DESC;

-- 删除旧消息（保留最近1000条）
DELETE FROM chatMessages 
WHERE sessionId=1 
AND id NOT IN (
  SELECT id FROM (
    SELECT id FROM chatMessages 
    WHERE sessionId=1 
    ORDER BY createdAt DESC 
    LIMIT 1000
  ) t
);

-- 统计消息数量
SELECT sessionId, COUNT(*) as messageCount 
FROM chatMessages 
GROUP BY sessionId;
```

### 数据备份和恢复

```bash
# 备份数据库
mysqldump -u weiai -pweiai123 weiai > weiai_backup.sql

# 备份特定表
mysqldump -u weiai -pweiai123 weiai users characters > weiai_tables.sql

# 恢复数据库
mysql -u weiai -pweiai123 weiai < weiai_backup.sql

# 压缩备份
mysqldump -u weiai -pweiai123 weiai | gzip > weiai_backup.sql.gz

# 恢复压缩备份
gunzip < weiai_backup.sql.gz | mysql -u weiai -pweiai123 weiai
```

## 性能优化

### 添加索引

```sql
-- 查看现有索引
SHOW INDEX FROM users;

-- 添加索引
CREATE INDEX idx_email ON users(email);
CREATE INDEX idx_user_character ON chatSessions(userId, characterId);
CREATE INDEX idx_message_session ON chatMessages(sessionId, createdAt);

-- 删除索引
DROP INDEX idx_email ON users;
```

### 查询优化

```sql
-- 使用EXPLAIN分析查询
EXPLAIN SELECT * FROM chatMessages WHERE sessionId=1;

-- 查看表统计信息
ANALYZE TABLE chatMessages;

-- 优化表
OPTIMIZE TABLE chatMessages;

-- 查看表大小
SELECT 
  table_name, 
  ROUND(((data_length + index_length) / 1024 / 1024), 2) AS size_mb
FROM information_schema.tables
WHERE table_schema = 'weiai'
ORDER BY size_mb DESC;
```

### 慢查询日志

```sql
-- 启用慢查询日志
SET GLOBAL slow_query_log = 'ON';

-- 设置慢查询阈值（秒）
SET GLOBAL long_query_time = 2;

-- 查看慢查询日志位置
SHOW VARIABLES LIKE 'slow_query_log_file';

-- 查看慢查询日志
SHOW VARIABLES LIKE 'slow_query_log';
```

## 数据导出

### 导出为CSV

```sql
-- 导出用户数据为CSV
SELECT * FROM users 
INTO OUTFILE '/tmp/users.csv'
FIELDS TERMINATED BY ','
ENCLOSED BY '"'
LINES TERMINATED BY '\n';

-- 导出聊天记录为CSV
SELECT * FROM chatMessages 
INTO OUTFILE '/tmp/messages.csv'
FIELDS TERMINATED BY ','
ENCLOSED BY '"'
LINES TERMINATED BY '\n';
```

### 导出为JSON

```bash
# 使用mysqldump导出为JSON
mysqldump --json -u weiai -pweiai123 weiai users > users.json
```

## 数据清理

### 删除过期数据

```sql
-- 删除30天前的聊天记录
DELETE FROM chatMessages 
WHERE createdAt < DATE_SUB(NOW(), INTERVAL 30 DAY);

-- 删除过期的VIP
UPDATE userWallets 
SET vipLevel=0 
WHERE vipExpireAt < NOW() AND vipLevel > 0;

-- 删除未使用的会话（30天无消息）
DELETE FROM chatSessions 
WHERE lastMessageTime < DATE_SUB(NOW(), INTERVAL 30 DAY);
```

## 监控和维护

### 定期检查

```bash
# 检查数据库状态
mysql -u weiai -pweiai123 weiai -e "STATUS;"

# 检查表状态
mysql -u weiai -pweiai123 weiai -e "SHOW TABLE STATUS;"

# 检查进程
mysql -u weiai -pweiai123 weiai -e "SHOW PROCESSLIST;"
```

### 定期备份脚本

```bash
#!/bin/bash
# backup.sh - 每日备份脚本

BACKUP_DIR="/var/backups/weiai"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/weiai_$DATE.sql.gz"

mkdir -p $BACKUP_DIR

mysqldump -u weiai -pweiai123 weiai | gzip > $BACKUP_FILE

# 删除7天前的备份
find $BACKUP_DIR -name "weiai_*.sql.gz" -mtime +7 -delete

echo "Backup completed: $BACKUP_FILE"
```

---

**最后更新：2026-01-11**
