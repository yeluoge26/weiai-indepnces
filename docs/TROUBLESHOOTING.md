# 微爱 - 故障排除指南

## 常见问题解决方案

### 1. 应用无法启动

#### 症状
```
Error: Cannot find module 'express'
或
Error: connect ECONNREFUSED 127.0.0.1:3306
```

#### 解决方案

**检查依赖是否安装**
```bash
# 安装依赖
npm install

# 或使用 yarn
yarn install
```

**检查数据库连接**
```bash
# 测试MySQL连接
mysql -u weiai -pweiai123 -h localhost weiai

# 如果连接失败，检查MySQL是否运行
sudo systemctl status mysql

# 启动MySQL
sudo systemctl start mysql
```

**查看详细错误日志**
```bash
# 查看PM2日志
pm2 logs weiai

# 或直接运行应用查看错误
node server.js
```

---

### 2. 无法访问应用

#### 症状
- 浏览器显示 `ERR_CONNECTION_REFUSED`
- 或显示 `502 Bad Gateway`

#### 解决方案

**检查应用是否运行**
```bash
# 查看PM2状态
pm2 status

# 如果应用已停止，重启它
pm2 restart weiai

# 或手动启动
npm start
```

**检查端口是否被占用**
```bash
# 查看8080端口是否被占用
sudo lsof -i :8080

# 如果被占用，杀死进程
sudo kill -9 <PID>
```

**检查防火墙**
```bash
# 查看防火墙状态
sudo ufw status

# 允许80和8080端口
sudo ufw allow 80/tcp
sudo ufw allow 8080/tcp
sudo ufw allow 443/tcp
```

**检查Nginx配置**
```bash
# 测试Nginx配置
sudo nginx -t

# 重启Nginx
sudo systemctl restart nginx

# 查看Nginx状态
sudo systemctl status nginx
```

---

### 3. 数据库连接失败

#### 症状
```
Error: ER_ACCESS_DENIED_FOR_USER
或
Error: connect ECONNREFUSED
```

#### 解决方案

**检查MySQL用户和密码**
```bash
# 登录MySQL
mysql -u root -p

# 查看用户
SELECT user, host FROM mysql.user;

# 创建用户（如果不存在）
CREATE USER 'weiai'@'localhost' IDENTIFIED BY 'weiai123';
GRANT ALL PRIVILEGES ON weiai.* TO 'weiai'@'localhost';
FLUSH PRIVILEGES;
```

**检查数据库是否存在**
```bash
# 登录MySQL
mysql -u weiai -pweiai123

# 查看数据库
SHOW DATABASES;

# 如果不存在，创建数据库
CREATE DATABASE weiai CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

**导入数据库架构**
```bash
# 导入schema
mysql -u weiai -pweiai123 weiai < database/schema.sql

# 导入初始数据
mysql -u weiai -pweiai123 weiai < database/init.sql
```

**检查.env文件配置**
```bash
# 确保.env文件中的数据库配置正确
cat .env

# 应该包含：
# DB_HOST=localhost
# DB_PORT=3306
# DB_USER=weiai
# DB_PASSWORD=weiai123
# DB_NAME=weiai
```

---

### 4. 高CPU/内存占用

#### 症状
- 应用运行缓慢
- 系统响应迟缓

#### 解决方案

**查看进程资源占用**
```bash
# 查看PM2监控
pm2 monit

# 或使用top命令
top

# 查看Node.js进程
ps aux | grep node
```

**重启应用**
```bash
# 重启应用
pm2 restart weiai

# 或完全重启
pm2 kill
pm2 start server.js --name weiai
```

**优化应用配置**
```bash
# 在ecosystem.config.js中调整
max_memory_restart: '500M'  # 内存超过500M时自动重启
```

**检查数据库查询**
```bash
# 登录MySQL
mysql -u weiai -pweiai123 weiai

# 查看运行中的查询
SHOW PROCESSLIST;

# 查看慢查询日志
SHOW VARIABLES LIKE 'slow_query_log';
```

---

### 5. 用户无法登录

#### 症状
- 登录失败
- 显示"用户名或密码错误"

#### 解决方案

**检查用户是否存在**
```bash
# 登录MySQL
mysql -u weiai -pweiai123 weiai

# 查看用户
SELECT * FROM users;

# 查看特定用户
SELECT * FROM users WHERE email='user@example.com';
```

**检查密码哈希**
```bash
# 密码应该被加密存储
# 如果看到明文密码，说明有问题
```

**重置用户密码**
```bash
# 使用应用API重置密码
# 或直接更新数据库（不推荐）
UPDATE users SET password='hashed_password' WHERE email='user@example.com';
```

---

### 6. 聊天功能不工作

#### 症状
- 无法发送消息
- 无法接收AI回复

#### 解决方案

**检查聊天会话是否创建**
```bash
# 登录MySQL
mysql -u weiai -pweiai123 weiai

# 查看会话
SELECT * FROM chatSessions;
```

**检查消息是否保存**
```bash
# 查看消息表
SELECT * FROM chatMessages;
```

**检查API是否响应**
```bash
# 测试API
curl -X GET http://localhost:8080/api/characters

# 测试认证API
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'
```

**查看应用日志**
```bash
# 查看PM2日志
pm2 logs weiai --lines 100
```

---

### 7. 支付功能失败

#### 症状
- 充值失败
- 购买商品失败

#### 解决方案

**检查虚拟支付配置**
```bash
# 在.env中确保启用虚拟支付
VIRTUAL_PAYMENT=true
```

**检查用户钱包**
```bash
# 登录MySQL
mysql -u weiai -pweiai123 weiai

# 查看钱包
SELECT * FROM userWallets;

# 查看特定用户的钱包
SELECT * FROM userWallets WHERE userId=1;
```

**手动更新钱包**
```bash
# 增加金币
UPDATE userWallets SET coins = coins + 100 WHERE userId=1;
```

**检查购买记录**
```bash
# 查看购买记录
SELECT * FROM purchaseRecords;
```

---

### 8. 文件上传失败

#### 症状
- 无法上传头像或图片
- 显示"上传失败"

#### 解决方案

**检查上传目录权限**
```bash
# 检查uploads目录
ls -la uploads/

# 如果不存在，创建目录
mkdir -p uploads

# 设置权限
chmod 755 uploads
chmod 755 public
```

**检查文件大小限制**
```bash
# 在.env中检查
MAX_FILE_SIZE=5242880  # 5MB

# 在Nginx中检查
client_max_body_size 10M;
```

**检查允许的文件类型**
```bash
# 在.env中检查
ALLOWED_FILE_TYPES=jpg,jpeg,png,gif,webp
```

---

### 9. SSL/HTTPS 问题

#### 症状
- 浏览器显示"不安全"警告
- 无法建立HTTPS连接

#### 解决方案

**获取SSL证书**
```bash
# 使用Let's Encrypt（免费）
sudo apt-get install -y certbot python3-certbot-nginx

# 获取证书
sudo certbot --nginx -d your_domain.com

# 自动续期
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer
```

**配置Nginx使用SSL**
```bash
# 编辑Nginx配置
sudo nano /etc/nginx/sites-available/weiai

# 取消注释HTTPS部分
# 填入正确的证书路径
```

**测试SSL配置**
```bash
# 测试Nginx配置
sudo nginx -t

# 重启Nginx
sudo systemctl restart nginx
```

---

### 10. 性能优化

#### 症状
- 应用响应缓慢
- 数据库查询慢

#### 解决方案

**启用Redis缓存**
```bash
# 安装Redis
sudo apt-get install -y redis-server

# 在.env中配置
REDIS_HOST=localhost
REDIS_PORT=6379

# 重启应用
pm2 restart weiai
```

**优化数据库索引**
```bash
# 登录MySQL
mysql -u weiai -pweiai123 weiai

# 查看表大小
SELECT table_name, ROUND(((data_length + index_length) / 1024 / 1024), 2) AS size_mb
FROM information_schema.tables
WHERE table_schema = 'weiai';

# 分析表
ANALYZE TABLE chatMessages;
ANALYZE TABLE chatSessions;
```

**启用应用集群模式**
```bash
# 在ecosystem.config.js中
instances: 'max',  # 使用所有CPU核心
exec_mode: 'cluster'
```

---

## 获取帮助

如果问题仍未解决，请：

1. **查看日志**
   ```bash
   pm2 logs weiai
   ```

2. **检查系统状态**
   ```bash
   pm2 status
   pm2 monit
   ```

3. **提交Issue**
   - 访问 [GitHub Issues](https://github.com/yeluoge26/weiai-indepnces/issues)
   - 提供详细的错误信息和日志

4. **联系支持**
   - 邮件：support@weiai.com
   - 文档：https://docs.weiai.com

---

## 常用命令速查

```bash
# 应用管理
pm2 start server.js --name weiai      # 启动应用
pm2 restart weiai                      # 重启应用
pm2 stop weiai                         # 停止应用
pm2 delete weiai                       # 删除应用
pm2 status                             # 查看状态
pm2 logs weiai                         # 查看日志
pm2 monit                              # 监控资源

# 数据库管理
mysql -u weiai -pweiai123 weiai       # 连接数据库
mysql -u weiai -pweiai123 weiai < database/schema.sql  # 导入架构
mysqldump -u weiai -pweiai123 weiai > backup.sql       # 备份数据库

# 系统管理
sudo systemctl status mysql            # 检查MySQL
sudo systemctl status nginx            # 检查Nginx
sudo systemctl restart mysql           # 重启MySQL
sudo systemctl restart nginx           # 重启Nginx

# 网络诊断
curl http://localhost:8080            # 测试连接
curl -v http://localhost:8080         # 详细输出
netstat -tlnp | grep 8080             # 检查端口
sudo lsof -i :8080                    # 查看进程
```

---

**最后更新：2026-01-11**
