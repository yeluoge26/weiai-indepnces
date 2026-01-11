# 微爱 API 文档

## 基础信息

**基础URL**: `http://your_domain/api`

**认证方式**: JWT Token (Bearer)

**响应格式**: JSON

## 认证

所有需要认证的API请求都需要在请求头中包含：

```
Authorization: Bearer <your_jwt_token>
```

## 响应格式

### 成功响应

```json
{
  "code": 0,
  "message": "success",
  "data": {}
}
```

### 错误响应

```json
{
  "code": 1,
  "message": "error message",
  "error": "error details"
}
```

## API 端点

### 认证相关

#### 用户注册

```http
POST /auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123",
  "username": "username"
}
```

**响应**:
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "userId": 1,
    "email": "user@example.com",
    "username": "username"
  }
}
```

#### 用户登录

```http
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

**响应**:
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": 1,
      "email": "user@example.com",
      "username": "username"
    }
  }
}
```

#### 获取当前用户信息

```http
GET /auth/me
Authorization: Bearer <token>
```

**响应**:
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": 1,
    "email": "user@example.com",
    "username": "username",
    "createdAt": "2026-01-11T00:00:00Z"
  }
}
```

### 角色相关

#### 获取所有角色

```http
GET /characters?category=all&page=1&limit=20
```

**查询参数**:
- `category`: 角色分类 (all, assistant, rpg, companion)
- `page`: 页码（默认1）
- `limit`: 每页数量（默认20）

**响应**:
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "characters": [
      {
        "id": 1,
        "name": "小爱",
        "description": "温柔体贴的AI伴侣",
        "category": "companion",
        "avatar": "url",
        "personality": ["温柔", "体贴"],
        "chatCount": 1011,
        "likeCount": 500
      }
    ],
    "total": 100,
    "page": 1,
    "limit": 20
  }
}
```

#### 获取角色详情

```http
GET /characters/:id
```

**响应**:
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": 1,
    "name": "小爱",
    "description": "温柔体贴的AI伴侣",
    "introduction": "我是小爱，一个AI伴侣...",
    "story": "剧情简介...",
    "category": "companion",
    "personality": ["温柔", "体贴"],
    "avatar": "url",
    "chatCount": 1011,
    "likeCount": 500
  }
}
```

#### 创建自定义角色

```http
POST /characters
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "我的角色",
  "description": "描述",
  "introduction": "介绍",
  "story": "故事",
  "personality": ["特征1", "特征2"]
}
```

### 聊天相关

#### 创建聊天会话

```http
POST /chat/sessions
Authorization: Bearer <token>
Content-Type: application/json

{
  "characterId": 1
}
```

**响应**:
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "sessionId": 1,
    "characterId": 1,
    "userId": 1,
    "createdAt": "2026-01-11T00:00:00Z"
  }
}
```

#### 获取聊天会话列表

```http
GET /chat/sessions
Authorization: Bearer <token>
```

**响应**:
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "sessions": [
      {
        "sessionId": 1,
        "characterId": 1,
        "characterName": "小爱",
        "lastMessage": "最后一条消息",
        "lastMessageTime": "2026-01-11T00:00:00Z"
      }
    ]
  }
}
```

#### 发送消息

```http
POST /chat/messages
Authorization: Bearer <token>
Content-Type: application/json

{
  "sessionId": 1,
  "message": "你好"
}
```

**响应**:
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "messageId": 1,
    "sessionId": 1,
    "userId": 1,
    "message": "你好",
    "createdAt": "2026-01-11T00:00:00Z"
  }
}
```

#### 获取聊天记录

```http
GET /chat/messages/:sessionId?page=1&limit=50
Authorization: Bearer <token>
```

**响应**:
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "messages": [
      {
        "messageId": 1,
        "sessionId": 1,
        "sender": "user",
        "message": "你好",
        "createdAt": "2026-01-11T00:00:00Z"
      },
      {
        "messageId": 2,
        "sessionId": 1,
        "sender": "character",
        "message": "你好，很高兴认识你",
        "createdAt": "2026-01-11T00:00:01Z"
      }
    ],
    "total": 100,
    "page": 1,
    "limit": 50
  }
}
```

### 钱包相关

#### 获取钱包信息

```http
GET /wallet/info
Authorization: Bearer <token>
```

**响应**:
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "userId": 1,
    "coins": 1050,
    "points": 110,
    "vipLevel": 0,
    "vipExpireAt": null
  }
}
```

#### 充值金币

```http
POST /wallet/recharge
Authorization: Bearer <token>
Content-Type: application/json

{
  "amount": 100,
  "paymentMethod": "virtual"
}
```

**响应**:
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "orderId": "ORDER_123",
    "amount": 100,
    "newBalance": 1150,
    "status": "success"
  }
}
```

#### 每日签到

```http
POST /wallet/checkin
Authorization: Bearer <token>
```

**响应**:
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "reward": 10,
    "newBalance": 1160,
    "consecutiveDays": 1
  }
}
```

### 商城相关

#### 获取商品列表

```http
GET /shop/items?category=all
```

**查询参数**:
- `category`: vip, coins, features

**响应**:
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "itemId": 1,
        "name": "VIP月卡",
        "description": "每月30元",
        "price": 30,
        "category": "vip",
        "duration": 30
      }
    ]
  }
}
```

#### 购买商品

```http
POST /shop/purchase
Authorization: Bearer <token>
Content-Type: application/json

{
  "itemId": 1,
  "paymentMethod": "virtual"
}
```

**响应**:
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "orderId": "ORDER_456",
    "itemId": 1,
    "status": "success",
    "newBalance": 1020
  }
}
```

### 排行榜相关

#### 获取好感度排行榜

```http
GET /leaderboard/affinity?limit=10
```

**响应**:
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "leaderboard": [
      {
        "rank": 1,
        "characterId": 1,
        "characterName": "小爱",
        "affinity": 9999,
        "affinityLevel": "灵魂伴侣"
      }
    ]
  }
}
```

#### 获取聊天排行榜

```http
GET /leaderboard/chat?limit=10
```

**响应**:
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "leaderboard": [
      {
        "rank": 1,
        "characterId": 1,
        "characterName": "小爱",
        "chatCount": 1011
      }
    ]
  }
}
```

#### 获取送礼排行榜

```http
GET /leaderboard/gift?limit=10
```

**响应**:
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "leaderboard": [
      {
        "rank": 1,
        "characterId": 1,
        "characterName": "小爱",
        "giftCount": 500,
        "totalValue": 5000
      }
    ]
  }
}
```

### 礼物相关

#### 获取礼物列表

```http
GET /gifts
```

**响应**:
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "gifts": [
      {
        "giftId": 1,
        "name": "玫瑰",
        "icon": "🌹",
        "price": 10,
        "affinity": 5
      }
    ]
  }
}
```

#### 发送礼物

```http
POST /gifts/send
Authorization: Bearer <token>
Content-Type: application/json

{
  "characterId": 1,
  "giftId": 1,
  "quantity": 1
}
```

**响应**:
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "giftId": 1,
    "characterId": 1,
    "quantity": 1,
    "totalCost": 10,
    "newBalance": 1040,
    "affinityIncrease": 5
  }
}
```

### 红包相关

#### 发送红包

```http
POST /redpacket/send
Authorization: Bearer <token>
Content-Type: application/json

{
  "characterId": 1,
  "amount": 100,
  "message": "祝福语"
}
```

**响应**:
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "redpacketId": 1,
    "characterId": 1,
    "amount": 100,
    "message": "祝福语",
    "newBalance": 950
  }
}
```

### TTS相关

#### 获取TTS音频

```http
GET /tts/generate?text=你好&characterId=1
Authorization: Bearer <token>
```

**查询参数**:
- `text`: 要转换的文本
- `characterId`: 角色ID

**响应**:
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "audioUrl": "url_to_audio_file",
    "duration": 2.5
  }
}
```

## 错误代码

| 代码 | 含义 | 说明 |
|------|------|------|
| 0 | 成功 | 请求成功 |
| 1 | 通用错误 | 一般错误 |
| 401 | 未认证 | 需要登录 |
| 403 | 禁止访问 | 无权限 |
| 404 | 未找到 | 资源不存在 |
| 422 | 验证失败 | 参数验证失败 |
| 429 | 请求过于频繁 | 触发限流 |
| 500 | 服务器错误 | 内部服务器错误 |

## 速率限制

- 每个IP每分钟最多1000个请求
- 每个用户每小时最多10000个请求

## 示例代码

### JavaScript/Node.js

```javascript
const axios = require('axios');

const api = axios.create({
  baseURL: 'http://localhost:8080/api'
});

// 登录
async function login(email, password) {
  const response = await api.post('/auth/login', { email, password });
  return response.data.data.token;
}

// 获取角色列表
async function getCharacters(token) {
  const response = await api.get('/characters', {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data.data.characters;
}

// 发送消息
async function sendMessage(token, sessionId, message) {
  const response = await api.post('/chat/messages', 
    { sessionId, message },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return response.data.data;
}
```

### Python

```python
import requests

class WeiAiAPI:
    def __init__(self, base_url='http://localhost:8080/api'):
        self.base_url = base_url
        self.token = None
    
    def login(self, email, password):
        response = requests.post(
            f'{self.base_url}/auth/login',
            json={'email': email, 'password': password}
        )
        self.token = response.json()['data']['token']
        return self.token
    
    def get_characters(self):
        headers = {'Authorization': f'Bearer {self.token}'}
        response = requests.get(
            f'{self.base_url}/characters',
            headers=headers
        )
        return response.json()['data']['characters']
    
    def send_message(self, session_id, message):
        headers = {'Authorization': f'Bearer {self.token}'}
        response = requests.post(
            f'{self.base_url}/chat/messages',
            json={'sessionId': session_id, 'message': message},
            headers=headers
        )
        return response.json()['data']
```

## 更新日志

- v1.0.0 (2026-01-11) - 初始版本
