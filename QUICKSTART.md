# 微爱 - 快速开始指南

5分钟快速部署微爱应用！

## 📋 前置要求

- Linux服务器（Ubuntu 20.04+推荐）
- 2GB RAM + 10GB存储空间
- 互联网连接

## 🚀 一键部署脚本

### 方法1：自动部署（推荐）

```bash
# 下载并运行部署脚本
curl -sSL https://raw.githubusercontent.com/yeluoge26/weiai-indepnces/main/scripts/install.sh | bash

# 或者
wget -O - https://raw.githubusercontent.com/yeluoge26/weiai-indepnces/main/scripts/install.sh | bash
```

脚本会自动：
- ✅ 安装所有依赖
- ✅ 创建数据库
- ✅ 配置应用
- ✅ 启动服务

### 方法2：手动部署（5分钟）

#### 1️⃣ 系统准备（1分钟）

```bash
# 更新系统
sudo apt-get update && sudo apt-get upgrade -y

# 安装基础工具
sudo apt-get install -y curl wget git build-essential
```

#### 2️⃣ 安装依赖（2分钟）

```bash
# 安装Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 安装MySQL
sudo apt-get install -y mysql-server

# 安装Nginx
sudo apt-get install -y nginx

# 安装PM2
sudo npm install -g pm2
```

#### 3️⃣ 部署应用（1分钟）

```bash
# 克隆项目
git clone https://github.com/yeluoge26/weiai-indepnces.git
cd weiai-indepnces

# 创建数据库
mysql -u root << 'EOF'
CREATE DATABASE weiai CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'weiai'@'localhost' IDENTIFIED BY 'weiai123';
GRANT ALL PRIVILEGES ON weiai.* TO 'weiai'@'localhost';
FLUSH PRIVILEGES;
EOF

# 导入数据库
mysql -u weiai -pweiai123 weiai < database/schema.sql

# 启动应用
pm2 start server/server.js --name weiai
pm2 save
```

#### 4️⃣ 配置Nginx（1分钟）

```bash
# 创建Nginx配置
sudo tee /etc/nginx/sites-available/weiai > /dev/null << 'EOF'
server {
    listen 80;
    server_name _;
    
    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
EOF

# 启用配置
sudo ln -s /etc/nginx/sites-available/weiai /etc/nginx/sites-enabled/
sudo systemctl restart nginx
```

## ✅ 验证部署

```bash
# 检查服务状态
pm2 status

# 测试API
curl http://localhost:8080/api/health

# 访问应用
# 在浏览器中打开：http://your_server_ip
```

## 📱 首次使用

### 1. 注册账户

访问 `http://your_server_ip` 并注册新账户

### 2. 登录

使用注册的邮箱和密码登录

### 3. 开始聊天

- 点击"聊天"浏览角色
- 点击角色卡片查看详情
- 点击"开始聊天"进入聊天界面

### 4. 探索功能

- **商城** - 购买VIP或充值金币
- **排行榜** - 查看各类排行
- **我的** - 管理个人信息和设置

## 🔧 常用命令

```bash
# 查看应用日志
pm2 logs weiai

# 重启应用
pm2 restart weiai

# 停止应用
pm2 stop weiai

# 启动应用
pm2 start weiai

# 删除应用
pm2 delete weiai

# 查看系统状态
pm2 monit
```

## 🔐 安全建议

1. **修改数据库密码**
   ```bash
   mysql -u root
   > ALTER USER 'weiai'@'localhost' IDENTIFIED BY 'your_strong_password';
   > FLUSH PRIVILEGES;
   ```

2. **启用防火墙**
   ```bash
   sudo ufw allow 22/tcp
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   sudo ufw enable
   ```

3. **配置SSL证书**
   ```bash
   sudo apt-get install -y certbot python3-certbot-nginx
   sudo certbot --nginx -d your_domain.com
   ```

## 📊 系统要求

| 项目 | 最低 | 推荐 |
|------|------|------|
| CPU | 2核 | 4核 |
| 内存 | 2GB | 4GB |
| 存储 | 10GB | 50GB |
| 带宽 | 1Mbps | 10Mbps |

## 🆘 遇到问题？

### 问题1：无法访问应用

```bash
# 检查Nginx状态
sudo systemctl status nginx

# 检查防火墙
sudo ufw status

# 检查应用是否运行
pm2 status
```

### 问题2：数据库连接失败

```bash
# 检查MySQL状态
sudo systemctl status mysql

# 测试连接
mysql -u weiai -pweiai123 -h localhost weiai
```

### 问题3：高CPU/内存占用

```bash
# 查看进程
pm2 monit

# 重启应用
pm2 restart weiai

# 检查日志
pm2 logs weiai
```

## 📚 更多文档

- [完整部署指南](./DEPLOYMENT.md)
- [API文档](./docs/API.md)
- [数据库文档](./docs/DATABASE.md)
- [故障排除](./docs/TROUBLESHOOTING.md)

## 🎯 下一步

1. **配置AI API**（可选）
   - 支持OpenAI、Claude、DeepSeek等
   - 在"我的" > "API配置"中设置

2. **自定义角色**
   - 在"我的" > "我的角色"中创建自定义角色

3. **启用SSL**
   - 为应用配置HTTPS证书

4. **性能优化**
   - 配置Redis缓存
   - 优化数据库索引

## 💡 提示

- 默认新用户赠送10000金币用于测试
- 虚拟支付系统中，点击支付即成功
- 所有数据存储在本地数据库中

## 📞 获取帮助

- 📖 查看[完整文档](./README.md)
- 🐛 提交[Issue](https://github.com/yeluoge26/weiai-indepnces/issues)
- 💬 加入社区讨论

---

**祝您使用愉快！** 🎉
