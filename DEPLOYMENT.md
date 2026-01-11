# 微爱 - 完整部署指南

本指南详细说明如何在不同的服务器环境上部署微爱独立版本。

## 📋 目录

1. [系统要求](#系统要求)
2. [前置准备](#前置准备)
3. [Linux服务器部署](#linux服务器部署)
4. [Windows服务器部署](#windows服务器部署)
5. [Docker部署](#docker部署)
6. [性能优化](#性能优化)
7. [监控和维护](#监控和维护)

## 系统要求

### 最低配置

- **CPU**: 2核
- **内存**: 2GB
- **存储**: 10GB
- **网络**: 100Mbps

### 推荐配置

- **CPU**: 4核
- **内存**: 4GB
- **存储**: 50GB
- **网络**: 1Gbps

### 软件版本要求

| 软件 | 最低版本 | 推荐版本 |
|------|---------|---------|
| Node.js | 14.0.0 | 18.x LTS |
| MySQL | 5.7 | 8.0 |
| Nginx | 1.16 | 1.24 |
| PM2 | 5.0.0 | 最新版 |

## 前置准备

### 1. 系统更新

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get upgrade -y

# CentOS/RHEL
sudo yum update -y
```

### 2. 创建应用用户

```bash
# 创建非root用户
sudo useradd -m -s /bin/bash weiai
sudo usermod -aG sudo weiai
```

### 3. 配置防火墙

```bash
# Ubuntu/Debian (UFW)
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 8080/tcp
sudo ufw enable

# CentOS/RHEL (firewalld)
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --permanent --add-port=8080/tcp
sudo firewall-cmd --reload
```

## Linux服务器部署

### 完整部署步骤

#### 第1步：安装Node.js

```bash
# 使用NodeSource仓库（推荐）
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 验证安装
node --version
npm --version
```

#### 第2步：安装MySQL

```bash
# Ubuntu 20.04+
sudo apt-get install -y mysql-server

# 初始化MySQL
sudo mysql_secure_installation

# 启动MySQL
sudo systemctl start mysql
sudo systemctl enable mysql

# 验证安装
mysql --version
```

#### 第3步：安装Nginx

```bash
sudo apt-get install -y nginx

# 启动Nginx
sudo systemctl start nginx
sudo systemctl enable nginx

# 验证安装
nginx -v
```

#### 第4步：安装PM2

```bash
sudo npm install -g pm2

# 验证安装
pm2 --version
```

#### 第5步：克隆项目

```bash
# 切换到weiai用户
sudo su - weiai

# 克隆仓库
git clone https://github.com/yeluoge26/weiai-indepnces.git
cd weiai-indepnces
```

#### 第6步：配置数据库

```bash
# 创建数据库用户
mysql -u root -p << EOF
CREATE DATABASE weiai CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'weiai'@'localhost' IDENTIFIED BY 'your_secure_password';
GRANT ALL PRIVILEGES ON weiai.* TO 'weiai'@'localhost';
FLUSH PRIVILEGES;
EXIT;
EOF

# 导入数据库架构
mysql -u weiai -p weiai < database/schema.sql

# 导入初始数据
mysql -u weiai -p weiai < database/init.sql
```

#### 第7步：配置应用

```bash
# 复制配置文件
cp server/config.example.js server/config.js

# 编辑配置
nano server/config.js
```

编辑以下内容：

```javascript
module.exports = {
  db: {
    host: 'localhost',
    user: 'weiai',
    password: 'your_secure_password',
    database: 'weiai',
    port: 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  },
  server: {
    port: 8080,
    host: '0.0.0.0'
  }
};
```

#### 第8步：启动应用

```bash
# 使用PM2启动
pm2 start server/server.js --name weiai

# 设置开机自启
pm2 startup
pm2 save

# 查看进程状态
pm2 status
```

#### 第9步：配置Nginx反向代理

创建 `/etc/nginx/sites-available/weiai`：

```nginx
upstream weiai_backend {
    server 127.0.0.1:8080;
}

server {
    listen 80;
    server_name your_domain.com;
    
    # 重定向到HTTPS（可选）
    # return 301 https://$server_name$request_uri;
    
    # 日志
    access_log /var/log/nginx/weiai_access.log;
    error_log /var/log/nginx/weiai_error.log;
    
    # 静态文件
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        root /home/weiai/weiai-indepnces/public;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
    
    # API和HTML
    location / {
        proxy_pass http://weiai_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # 超时设置
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
```

启用配置：

```bash
sudo ln -s /etc/nginx/sites-available/weiai /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

#### 第10步：配置SSL（可选但推荐）

使用Let's Encrypt：

```bash
# 安装Certbot
sudo apt-get install -y certbot python3-certbot-nginx

# 获取证书
sudo certbot --nginx -d your_domain.com

# 自动续期
sudo systemctl enable certbot.timer
```

### 验证部署

```bash
# 检查服务状态
sudo systemctl status nginx
sudo systemctl status mysql
pm2 status

# 检查日志
pm2 logs weiai
tail -f /var/log/nginx/weiai_access.log
tail -f /var/log/nginx/weiai_error.log

# 测试API
curl http://localhost:8080/api/health
```

## Windows服务器部署

### 使用WSL2（推荐）

1. **启用WSL2**
   ```powershell
   wsl --install
   ```

2. **安装Ubuntu**
   ```powershell
   wsl --install -d Ubuntu-22.04
   ```

3. **按照Linux部署步骤进行**

### 原生Windows部署

#### 1. 安装Node.js

从 https://nodejs.org/ 下载并安装LTS版本

#### 2. 安装MySQL

从 https://dev.mysql.com/downloads/mysql/ 下载并安装

#### 3. 克隆项目

```powershell
git clone https://github.com/yeluoge26/weiai-indepnces.git
cd weiai-indepnces
```

#### 4. 配置数据库

使用MySQL Workbench创建数据库和用户

#### 5. 启动应用

```powershell
# 开发模式
node server/server.js

# 生产模式（使用PM2 for Windows）
npm install -g pm2
pm2 start server/server.js --name weiai
```

#### 6. 配置IIS反向代理

在IIS中创建反向代理规则，指向 `http://localhost:8080`

## Docker部署

### 使用Docker Compose

创建 `docker-compose.yml`：

```yaml
version: '3.8'

services:
  mysql:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: root_password
      MYSQL_DATABASE: weiai
      MYSQL_USER: weiai
      MYSQL_PASSWORD: weiai_password
    ports:
      - "3306:3306"
    volumes:
      - mysql_data:/var/lib/mysql
      - ./database/schema.sql:/docker-entrypoint-initdb.d/schema.sql
    networks:
      - weiai_network

  weiai:
    build: .
    ports:
      - "8080:8080"
    environment:
      DB_HOST: mysql
      DB_USER: weiai
      DB_PASSWORD: weiai_password
      DB_NAME: weiai
    depends_on:
      - mysql
    networks:
      - weiai_network

  nginx:
    image: nginx:latest
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./public:/usr/share/nginx/html
    depends_on:
      - weiai
    networks:
      - weiai_network

volumes:
  mysql_data:

networks:
  weiai_network:
    driver: bridge
```

创建 `Dockerfile`：

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install --production

COPY . .

EXPOSE 8080

CMD ["node", "server/server.js"]
```

启动容器：

```bash
docker-compose up -d
```

## 性能优化

### 1. 数据库优化

```sql
-- 添加索引
CREATE INDEX idx_user_id ON userWallets(userId);
CREATE INDEX idx_session_user ON chatSessions(userId);
CREATE INDEX idx_message_session ON chatMessages(sessionId);
CREATE INDEX idx_affinity_user ON userCharacterAffinity(userId);
```

### 2. 缓存配置

安装Redis：

```bash
sudo apt-get install -y redis-server
sudo systemctl start redis-server
sudo systemctl enable redis-server
```

在应用中启用Redis缓存

### 3. 连接池配置

在 `config.js` 中调整：

```javascript
db: {
  connectionLimit: 20,  // 增加连接数
  waitForConnections: true,
  queueLimit: 0
}
```

### 4. Nginx优化

```nginx
# 启用gzip压缩
gzip on;
gzip_types text/plain text/css text/javascript application/json;
gzip_min_length 1000;

# 启用缓存
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=weiai_cache:10m;
proxy_cache weiai_cache;
proxy_cache_valid 200 10m;
```

## 监控和维护

### 1. 日志管理

```bash
# 查看应用日志
pm2 logs weiai

# 查看Nginx日志
tail -f /var/log/nginx/weiai_access.log
tail -f /var/log/nginx/weiai_error.log

# 查看MySQL日志
tail -f /var/log/mysql/error.log
```

### 2. 性能监控

```bash
# 使用PM2监控
pm2 monit

# 使用top查看系统资源
top

# 使用htop（更友好的界面）
sudo apt-get install -y htop
htop
```

### 3. 定期备份

```bash
#!/bin/bash
# backup.sh

BACKUP_DIR="/home/weiai/backups"
DATE=$(date +%Y%m%d_%H%M%S)

# 备份数据库
mysqldump -u weiai -p weiai > $BACKUP_DIR/weiai_$DATE.sql

# 备份应用文件
tar -czf $BACKUP_DIR/weiai_app_$DATE.tar.gz /home/weiai/weiai-indepnces

# 删除7天前的备份
find $BACKUP_DIR -name "weiai_*.sql" -mtime +7 -delete
find $BACKUP_DIR -name "weiai_app_*.tar.gz" -mtime +7 -delete
```

设置定时任务：

```bash
crontab -e

# 每天凌晨2点执行备份
0 2 * * * /home/weiai/backup.sh
```

### 4. 监控脚本

创建 `monitor.sh`：

```bash
#!/bin/bash

# 检查应用是否运行
if ! pm2 list | grep -q "weiai"; then
    echo "Application is down! Restarting..."
    pm2 restart weiai
fi

# 检查MySQL是否运行
if ! systemctl is-active --quiet mysql; then
    echo "MySQL is down! Restarting..."
    sudo systemctl restart mysql
fi

# 检查磁盘空间
DISK_USAGE=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ $DISK_USAGE -gt 90 ]; then
    echo "Disk usage is high: $DISK_USAGE%"
fi

# 检查内存使用
MEM_USAGE=$(free | awk 'NR==2 {print int($3/$2 * 100)}')
if [ $MEM_USAGE -gt 90 ]; then
    echo "Memory usage is high: $MEM_USAGE%"
fi
```

设置定时执行：

```bash
crontab -e

# 每5分钟检查一次
*/5 * * * * /home/weiai/monitor.sh
```

## 故障排除

### 常见问题

1. **端口被占用**
   ```bash
   # 查找占用8080端口的进程
   lsof -i :8080
   # 杀死进程
   kill -9 <PID>
   ```

2. **数据库连接失败**
   ```bash
   # 检查MySQL状态
   sudo systemctl status mysql
   # 检查连接
   mysql -u weiai -p -h localhost weiai
   ```

3. **Nginx 502错误**
   ```bash
   # 检查后端应用
   pm2 status
   pm2 logs weiai
   # 检查Nginx配置
   sudo nginx -t
   ```

4. **磁盘空间不足**
   ```bash
   # 清理日志
   sudo journalctl --vacuum=time:7d
   # 清理包管理器缓存
   sudo apt-get clean
   ```

## 升级指南

```bash
# 备份当前版本
cp -r /home/weiai/weiai-indepnces /home/weiai/weiai-indepnces.backup

# 拉取最新代码
cd /home/weiai/weiai-indepnces
git pull origin main

# 重启应用
pm2 restart weiai
```

## 支持

如有问题，请查看 [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) 或提交Issue。
