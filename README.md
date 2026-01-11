# 微爱 (WeAI) - 独立部署版本

一个功能完整的AI伴侣聊天应用，支持角色扮演、虚拟礼物、排行榜等功能。

## ✨ 主要功能

- **角色聊天** - 与多个AI角色进行实时对话
- **角色广场** - 浏览和选择喜欢的角色，支持分类筛选
- **虚拟礼物系统** - 发送礼物给角色，增加好感度
- **红包功能** - 发送虚拟红包
- **商城系统** - VIP套餐、金币充值、功能包
- **排行榜** - 好感榜、聊天榜、送礼榜
- **钱包系统** - 虚拟支付、充值功能
- **签到系统** - 每日签到领取积分
- **通讯录** - 管理喜欢的角色
- **朋友圈** - 分享动态（开发中）
- **TTS语音** - 启用/禁用文字转语音
- **响应式设计** - 完全适配移动端和PC端

## 🚀 快速开始

### 系统要求

- **Node.js**: v14.0.0 或更高版本
- **MySQL**: v5.7 或更高版本
- **Nginx**: v1.16 或更高版本（可选，用于反向代理）
- **PM2**: 用于进程管理（推荐）

### 环境配置

#### 1. 安装依赖

```bash
# 安装Node.js（如果未安装）
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 安装MySQL（如果未安装）
sudo apt-get install -y mysql-server

# 安装Nginx（可选）
sudo apt-get install -y nginx

# 安装PM2（全局）
sudo npm install -g pm2
```

#### 2. 克隆仓库

```bash
git clone https://github.com/yeluoge26/weiai-indepnces.git
cd weiai-indepnces
```

#### 3. 配置数据库

```bash
# 创建数据库
mysql -u root -p < database/schema.sql

# 或者手动创建
mysql -u root -p
> CREATE DATABASE weiai CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
> EXIT;
```

#### 4. 配置后端

编辑 `server/config.js`：

```javascript
module.exports = {
  // 数据库配置
  db: {
    host: 'localhost',
    user: 'root',
    password: 'your_password',
    database: 'weiai',
    port: 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  },
  
  // 服务器配置
  server: {
    port: 8080,
    host: '0.0.0.0'
  },
  
  // AI API配置（可选）
  ai: {
    apiKey: 'your_api_key',
    provider: 'openai' // 'openai', 'claude', 'deepseek'
  }
};
```

#### 5. 启动服务

```bash
# 开发模式
node server.js

# 生产模式（使用PM2）
pm2 start server.js --name weiai
pm2 save
pm2 startup
```

#### 6. 配置Nginx（可选）

创建 `/etc/nginx/sites-available/weiai`：

```nginx
server {
    listen 80;
    server_name your_domain.com;

    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

启用配置：

```bash
sudo ln -s /etc/nginx/sites-available/weiai /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## 📁 项目结构

```
weiai-indepnces/
├── server/
│   ├── server.js              # 后端主文件
│   ├── config.js              # 配置文件
│   └── middleware/            # 中间件
├── public/
│   ├── index.html             # 前端主页面
│   ├── css/                   # 样式文件
│   └── js/                    # 脚本文件
├── database/
│   ├── schema.sql             # 数据库架构
│   └── init.sql               # 初始化数据
├── docs/
│   ├── DEPLOYMENT.md          # 部署指南
│   ├── API.md                 # API文档
│   ├── DATABASE.md            # 数据库文档
│   └── TROUBLESHOOTING.md     # 故障排除
├── package.json               # 项目依赖
├── .env.example               # 环境变量示例
└── README.md                  # 本文件
```

## 🔧 API文档

### 认证

所有需要认证的API都需要在请求头中包含 `Authorization: Bearer <token>`

### 主要API端点

#### 用户相关
- `POST /api/auth/register` - 用户注册
- `POST /api/auth/login` - 用户登录
- `GET /api/auth/me` - 获取当前用户信息

#### 角色相关
- `GET /api/characters` - 获取所有角色
- `GET /api/characters/:id` - 获取角色详情
- `POST /api/characters` - 创建角色

#### 聊天相关
- `POST /api/chat/sessions` - 创建聊天会话
- `GET /api/chat/sessions` - 获取用户的聊天会话
- `POST /api/chat/messages` - 发送消息
- `GET /api/chat/messages/:sessionId` - 获取聊天记录

#### 钱包相关
- `GET /api/wallet/info` - 获取钱包信息
- `POST /api/wallet/recharge` - 充值金币
- `POST /api/wallet/checkin` - 每日签到

#### 商城相关
- `GET /api/shop/items` - 获取商品列表
- `POST /api/shop/purchase` - 购买商品

#### 排行榜
- `GET /api/leaderboard/affinity` - 好感度排行榜
- `GET /api/leaderboard/chat` - 聊天排行榜
- `GET /api/leaderboard/gift` - 送礼排行榜

详细API文档见 [API.md](./docs/API.md)

## 🗄️ 数据库

### 主要表结构

- `users` - 用户表
- `characters` - 角色表
- `chatSessions` - 聊天会话表
- `chatMessages` - 聊天消息表
- `userWallets` - 用户钱包表
- `userCharacterAffinity` - 用户与角色的好感度表
- `gifts` - 礼物配置表
- `shopItems` - 商城商品表

详细数据库文档见 [DATABASE.md](./docs/DATABASE.md)

## 🐛 故障排除

### 常见问题

1. **数据库连接失败**
   - 检查MySQL是否运行
   - 验证数据库凭证
   - 确保数据库已创建

2. **前端无法加载**
   - 检查Nginx配置
   - 验证后端服务是否运行
   - 检查浏览器控制台错误

3. **API返回错误**
   - 检查服务器日志
   - 验证请求格式
   - 检查认证token

详细故障排除指南见 [TROUBLESHOOTING.md](./docs/TROUBLESHOOTING.md)

## 📝 配置说明

### 环境变量

创建 `.env` 文件：

```env
# 数据库
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=weiai
DB_PORT=3306

# 服务器
SERVER_PORT=8080
SERVER_HOST=0.0.0.0

# AI API（可选）
AI_PROVIDER=openai
AI_API_KEY=your_api_key
AI_API_URL=https://api.openai.com/v1

# 应用
APP_ENV=production
APP_DEBUG=false
```

### 虚拟支付

本版本使用虚拟支付系统，用户点击支付即成功。如需集成真实支付，请修改 `/api/shop/purchase` 和 `/api/wallet/recharge` 端点。

## 🔐 安全建议

1. **修改默认密码** - 确保数据库和应用的默认密码已更改
2. **启用HTTPS** - 在生产环境中使用SSL证书
3. **限制API速率** - 实施API速率限制防止滥用
4. **验证用户输入** - 所有用户输入都应进行验证和清理
5. **定期备份** - 定期备份数据库

## 📊 性能优化

1. **启用缓存** - 使用Redis缓存频繁访问的数据
2. **数据库索引** - 确保关键字段有索引
3. **CDN** - 使用CDN加速静态资源
4. **压缩** - 启用Gzip压缩

## 🤝 贡献

欢迎提交Issue和Pull Request！

## 📄 许可证

MIT License

## 📞 支持

如有问题，请提交Issue或联系开发者。

## 🎯 更新日志

### v1.0.0 (2026-01-11)
- 初始版本发布
- 完整的聊天功能
- 虚拟礼物系统
- 商城和排行榜
- 响应式设计
- TTS语音功能
