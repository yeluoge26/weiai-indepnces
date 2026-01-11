# 微爱 - 系统要求和版本兼容性

## 系统要求

### 最低配置

| 项目 | 最低要求 | 推荐配置 |
|------|---------|---------|
| **操作系统** | Linux (Ubuntu 18.04+) | Ubuntu 20.04 LTS / Debian 11 |
| **CPU** | 2核 | 4核 |
| **内存** | 2GB RAM | 4GB RAM |
| **存储** | 10GB | 50GB SSD |
| **带宽** | 1Mbps | 10Mbps |
| **网络** | 互联网连接 | 稳定的互联网连接 |

### 支持的操作系统

- ✅ Ubuntu 20.04 LTS (推荐)
- ✅ Ubuntu 22.04 LTS
- ✅ Debian 11
- ✅ Debian 12
- ✅ CentOS 7
- ✅ CentOS 8
- ⚠️ 其他Linux发行版（可能需要调整）
- ❌ Windows（不支持，建议使用WSL2）
- ❌ macOS（不支持生产环境）

## 软件版本要求

### 必需软件

#### Node.js
- **最低版本**: 14.0.0
- **推荐版本**: 18.x LTS
- **最新版本**: 20.x

```bash
# 检查Node.js版本
node --version

# 检查npm版本
npm --version
```

#### MySQL
- **最低版本**: 5.7
- **推荐版本**: 8.0
- **最新版本**: 8.1

```bash
# 检查MySQL版本
mysql --version

# 连接MySQL检查版本
mysql -u root -p -e "SELECT VERSION();"
```

#### Nginx（可选，用于反向代理）
- **最低版本**: 1.14
- **推荐版本**: 1.20+
- **最新版本**: 1.25+

```bash
# 检查Nginx版本
nginx -v
```

#### PM2（进程管理）
- **最低版本**: 5.0.0
- **推荐版本**: 5.3+
- **最新版本**: 5.4+

```bash
# 检查PM2版本
pm2 --version
```

### 可选软件

#### Redis（用于缓存）
- **最低版本**: 5.0
- **推荐版本**: 6.0+
- **最新版本**: 7.0+

#### SSL/TLS（用于HTTPS）
- **推荐**: Let's Encrypt (免费)
- **Certbot**: 用于自动化证书管理

## 依赖包版本

### Node.js 依赖

```json
{
  "dependencies": {
    "express": "^4.18.2",
    "mysql2": "^3.6.0",
    "cors": "^2.8.5",
    "body-parser": "^1.20.2",
    "jsonwebtoken": "^9.1.0",
    "bcryptjs": "^2.4.3",
    "dotenv": "^16.3.1"
  },
  "devDependencies": {
    "nodemon": "^3.0.1"
  }
}
```

### 系统包依赖

#### Ubuntu/Debian

```bash
# 基础工具
build-essential
curl
wget
git

# Node.js
nodejs
npm

# 数据库
mysql-server
mysql-client

# Web服务器
nginx

# 进程管理
pm2

# 其他
openssl
ca-certificates
```

## 网络要求

### 端口需求

| 端口 | 协议 | 说明 | 必需 |
|------|------|------|------|
| 80 | HTTP | Web服务 | ✅ |
| 443 | HTTPS | 安全Web服务 | ⚠️ 推荐 |
| 3306 | TCP | MySQL数据库 | ✅ |
| 8080 | TCP | Node.js应用 | ✅ |
| 6379 | TCP | Redis缓存 | ⚠️ 可选 |

### 防火墙配置

```bash
# 允许HTTP
sudo ufw allow 80/tcp

# 允许HTTPS
sudo ufw allow 443/tcp

# 允许SSH
sudo ufw allow 22/tcp

# 允许MySQL（仅本地）
sudo ufw allow from 127.0.0.1 to 127.0.0.1 port 3306

# 启用防火墙
sudo ufw enable
```

## 磁盘空间需求

| 组件 | 空间 | 说明 |
|------|------|------|
| 系统 | 5GB | Ubuntu基础系统 |
| 应用代码 | 100MB | Node.js应用 |
| 数据库 | 2GB | MySQL数据库初始 |
| 日志 | 1GB | 应用和系统日志 |
| 上传文件 | 可变 | 用户上传的文件 |
| **总计** | **10GB+** | 最低配置 |

## 内存使用

### 预期内存占用

| 组件 | 内存 | 说明 |
|------|------|------|
| 系统 | 300MB | Ubuntu基础 |
| MySQL | 500MB | 数据库服务 |
| Node.js | 200MB | 单个进程 |
| Nginx | 50MB | Web服务器 |
| 其他 | 200MB | 系统服务 |
| **总计** | **1.2GB** | 空闲状态 |

### 高负载情况

- 100并发用户: 2GB
- 500并发用户: 4GB
- 1000+并发用户: 8GB+

## 性能基准

### 单服务器性能指标

| 指标 | 值 | 说明 |
|------|-----|------|
| 并发连接数 | 100-500 | 取决于硬件 |
| 请求延迟 | <100ms | 平均响应时间 |
| 吞吐量 | 1000+ req/s | 每秒请求数 |
| 数据库查询 | <50ms | 平均查询时间 |

### 扩展建议

- **100-500用户**: 单服务器足够
- **500-2000用户**: 考虑使用Redis缓存
- **2000+用户**: 考虑负载均衡和数据库主从复制

## 浏览器兼容性

### 前端支持

| 浏览器 | 最低版本 | 推荐版本 |
|--------|---------|---------|
| Chrome | 60+ | 最新版 |
| Firefox | 55+ | 最新版 |
| Safari | 11+ | 最新版 |
| Edge | 15+ | 最新版 |
| 移动浏览器 | iOS 11+, Android 5+ | 最新版 |

## 安全要求

### 必需的安全配置

1. **SSL/TLS 证书**
   - 生产环境必须使用HTTPS
   - 推荐使用Let's Encrypt免费证书

2. **防火墙**
   - 启用UFW或iptables
   - 只开放必要的端口

3. **SSH访问**
   - 禁用密码登录，使用密钥认证
   - 更改默认SSH端口（可选）

4. **数据库安全**
   - 使用强密码
   - 禁止远程数据库访问
   - 定期备份

5. **应用安全**
   - 定期更新依赖包
   - 启用CORS限制
   - 实施速率限制

## 备份要求

### 备份策略

- **日备份**: 每天备份数据库
- **周备份**: 每周完整备份
- **月备份**: 每月长期保留备份
- **异地备份**: 定期上传到云存储

### 备份空间

- 每日备份: 100MB
- 周备份: 700MB
- 月备份: 3GB
- **总计**: 5GB+

## 监控要求

### 推荐的监控工具

1. **系统监控**
   - Prometheus + Grafana
   - New Relic
   - Datadog

2. **日志管理**
   - ELK Stack (Elasticsearch, Logstash, Kibana)
   - Splunk
   - Papertrail

3. **性能监控**
   - PM2 Plus
   - New Relic APM
   - Datadog APM

## 升级路径

### 版本兼容性

- v1.0.0 → v1.1.0: 直接升级
- v1.x → v2.0: 需要数据库迁移
- 跨主版本升级: 建议先在测试环境验证

### 升级步骤

```bash
# 1. 备份数据库
mysqldump -u weiai -pweiai123 weiai > backup.sql

# 2. 停止应用
pm2 stop weiai

# 3. 更新代码
git pull origin main

# 4. 更新依赖
npm install

# 5. 运行迁移（如果需要）
npm run migrate

# 6. 启动应用
pm2 start weiai
```

## 故障转移和高可用性

### 推荐的HA配置

1. **负载均衡**
   - Nginx反向代理
   - HAProxy
   - AWS ELB

2. **数据库复制**
   - MySQL主从复制
   - MySQL Group Replication
   - Percona XtraDB Cluster

3. **缓存层**
   - Redis集群
   - Memcached

## 成本估算

### 云服务器成本（月度）

| 配置 | AWS | Azure | DigitalOcean | 阿里云 |
|------|-----|-------|--------------|--------|
| 2GB RAM | $10 | $15 | $6 | $5 |
| 4GB RAM | $20 | $30 | $12 | $10 |
| 8GB RAM | $40 | $60 | $24 | $20 |

### 其他成本

- 域名: $10-15/年
- SSL证书: 免费 (Let's Encrypt)
- 备份存储: $5-20/月
- CDN: $0-50/月 (可选)

## 许可证要求

### 开源许可证

- **应用**: MIT License
- **依赖包**: 查看各自的许可证

### 第三方服务

- OpenAI API: 需要API Key和付费账户
- Claude API: 需要API Key和付费账户
- DeepSeek API: 需要API Key

## 支持和更新

### 版本支持周期

- v1.0.x: 12个月
- v1.1.x: 18个月
- v2.0.x: 24个月

### 获取更新

```bash
# 检查更新
npm outdated

# 更新依赖
npm update

# 更新特定包
npm install package@latest
```

---

**最后更新：2026-01-11**
