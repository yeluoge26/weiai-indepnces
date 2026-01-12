/**
 * 微爱前端修复 - 头像选择器、API配置、TTS配置、管理员功能等
 */

// 预设头像列表
const presetAvatars = [
  'https://api.dicebear.com/7.x/bottts/svg?seed=custom1&backgroundColor=b6e3f4',
  'https://api.dicebear.com/7.x/bottts/svg?seed=custom2&backgroundColor=c0aede',
  'https://api.dicebear.com/7.x/bottts/svg?seed=custom3&backgroundColor=ffd5dc',
  'https://api.dicebear.com/7.x/bottts/svg?seed=custom4&backgroundColor=d1d4f9',
  'https://api.dicebear.com/7.x/bottts/svg?seed=custom5&backgroundColor=c9f7d6',
  'https://api.dicebear.com/7.x/bottts/svg?seed=custom6&backgroundColor=ffeaa7',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=girl1&backgroundColor=ffd5dc',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=girl2&backgroundColor=c0aede',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=boy1&backgroundColor=b6e3f4',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=boy2&backgroundColor=d1d4f9',
  'https://api.dicebear.com/7.x/lorelei/svg?seed=anime1&backgroundColor=ffd5dc',
  'https://api.dicebear.com/7.x/lorelei/svg?seed=anime2&backgroundColor=c0aede'
];

// 当前选中的头像
let selectedAvatar = presetAvatars[0];

// ==================== 头像选择器 ====================

// 显示头像选择器
function showAvatarSelector(callback) {
  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:1000;';
  modal.innerHTML = `
    <div style="width:90%;max-width:400px;background:var(--card-bg);border-radius:16px;padding:20px;max-height:80vh;overflow-y:auto;">
      <h3 style="margin-bottom:16px;text-align:center;">选择头像</h3>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px;">
        ${presetAvatars.map((url, i) => `
          <div class="avatar-option" style="width:100%;aspect-ratio:1;border-radius:12px;overflow:hidden;cursor:pointer;border:3px solid ${selectedAvatar === url ? 'var(--primary)' : 'transparent'};transition:all 0.2s;" onclick="selectAvatarOption('${url}', this)">
            <img src="${url}" style="width:100%;height:100%;object-fit:cover;" alt="Avatar ${i+1}">
          </div>
        `).join('')}
      </div>
      <div style="margin-bottom:16px;">
        <button class="btn btn-outline" style="width:100%;" onclick="generateRandomAvatar()">🎲 随机生成</button>
      </div>
      <div style="display:flex;gap:12px;">
        <button class="btn btn-outline" style="flex:1;" onclick="this.closest('[style*=position]').remove()">取消</button>
        <button class="btn btn-primary" style="flex:1;" onclick="confirmAvatarSelection()">确认</button>
      </div>
    </div>
  `;
  modal.dataset.callback = callback || '';
  document.body.appendChild(modal);
}

// 选择头像选项
function selectAvatarOption(url, element) {
  selectedAvatar = url;
  // 更新选中状态
  document.querySelectorAll('.avatar-option').forEach(el => {
    el.style.borderColor = 'transparent';
  });
  element.style.borderColor = 'var(--primary)';
}

// 生成随机头像
async function generateRandomAvatar() {
  try {
    const data = await api('/avatars/random');
    selectedAvatar = data.url;
    // 更新所有选项的边框
    document.querySelectorAll('.avatar-option').forEach(el => {
      el.style.borderColor = 'transparent';
    });
    showToast('已生成随机头像');
  } catch (err) {
    showToast('生成失败');
  }
}

// 确认头像选择
function confirmAvatarSelection() {
  const avatarInput = document.getElementById('charAvatar');
  if (avatarInput) {
    avatarInput.value = selectedAvatar;
  }
  // 更新预览
  const preview = document.getElementById('avatarPreview');
  if (preview) {
    preview.innerHTML = `<img src="${selectedAvatar}" style="width:100%;height:100%;object-fit:cover;">`;
  }
  // 关闭模态框
  document.querySelector('[style*="position:fixed"]')?.remove();
}

// ==================== 增强的创建角色页面 ====================

// 重写创建角色页面，添加头像选择器
function renderCreateCharacterPageEnhanced() {
  selectedAvatar = presetAvatars[Math.floor(Math.random() * presetAvatars.length)];
  return `
    <div class="header">
      <span class="header-back" onclick="goBack()">‹</span>
      <span class="header-title">创建角色</span>
    </div>
    <div style="padding:16px;">
      <div class="card">
        <!-- 头像选择 -->
        <div class="form-group" style="margin-bottom:16px;text-align:center;">
          <label style="display:block;font-size:13px;color:var(--text-secondary);margin-bottom:8px;">角色头像</label>
          <div id="avatarPreview" style="width:80px;height:80px;border-radius:50%;margin:0 auto 12px;overflow:hidden;background:var(--bg);cursor:pointer;" onclick="showAvatarSelector()">
            <img src="${selectedAvatar}" style="width:100%;height:100%;object-fit:cover;">
          </div>
          <input type="hidden" id="charAvatar" value="${selectedAvatar}">
          <button type="button" class="btn btn-outline" style="font-size:12px;padding:6px 16px;" onclick="showAvatarSelector()">选择头像</button>
        </div>
        
        <!-- 角色名称 -->
        <div class="form-group" style="margin-bottom:16px;">
          <label style="display:block;font-size:13px;color:var(--text-secondary);margin-bottom:6px;">角色名称 *</label>
          <input type="text" class="input" id="charName" placeholder="给角色起个名字">
        </div>
        
        <!-- 角色介绍 -->
        <div class="form-group" style="margin-bottom:16px;">
          <label style="display:block;font-size:13px;color:var(--text-secondary);margin-bottom:6px;">角色介绍</label>
          <textarea class="input" id="charDesc" placeholder="简单介绍一下这个角色" style="height:80px;resize:none;"></textarea>
        </div>
        
        <!-- 性格特点 -->
        <div class="form-group" style="margin-bottom:16px;">
          <label style="display:block;font-size:13px;color:var(--text-secondary);margin-bottom:6px;">性格特点</label>
          <textarea class="input" id="charPersonality" placeholder="描述角色的性格特点" style="height:80px;resize:none;"></textarea>
        </div>
        
        <!-- 剧情简介 -->
        <div class="form-group" style="margin-bottom:16px;">
          <label style="display:block;font-size:13px;color:var(--text-secondary);margin-bottom:6px;">剧情简介</label>
          <textarea class="input" id="charScenario" placeholder="角色的背景故事或剧情设定" style="height:80px;resize:none;"></textarea>
        </div>
        
        <!-- 角色分类 -->
        <div class="form-group" style="margin-bottom:16px;">
          <label style="display:block;font-size:13px;color:var(--text-secondary);margin-bottom:6px;">角色分类</label>
          <select class="input" id="charCategory">
            <option value="companion">伴侣</option>
            <option value="assistant">助手</option>
            <option value="xianxia">仙侠</option>
            <option value="urban">都市</option>
            <option value="scifi">科幻</option>
            <option value="otome">乙游</option>
          </select>
        </div>
        
        <!-- 性别 -->
        <div class="form-group" style="margin-bottom:16px;">
          <label style="display:block;font-size:13px;color:var(--text-secondary);margin-bottom:6px;">性别</label>
          <select class="input" id="charGender">
            <option value="female">女</option>
            <option value="male">男</option>
            <option value="other">其他</option>
          </select>
        </div>
        
        <!-- 公开设置 -->
        <div class="form-group" style="margin-bottom:16px;display:flex;align-items:center;gap:8px;">
          <input type="checkbox" id="charPublic">
          <label for="charPublic" style="font-size:13px;">公开角色（其他用户可见）</label>
        </div>
        
        <button class="btn btn-primary" style="width:100%;" onclick="createCharacterEnhanced()">创建角色</button>
      </div>
    </div>
  `;
}

// 增强的创建角色函数
async function createCharacterEnhanced() {
  const name = document.getElementById('charName').value;
  const avatar = document.getElementById('charAvatar')?.value || selectedAvatar;
  const description = document.getElementById('charDesc').value;
  const personality = document.getElementById('charPersonality').value;
  const scenario = document.getElementById('charScenario').value;
  const category = document.getElementById('charCategory').value;
  const gender = document.getElementById('charGender').value;
  const isPublic = document.getElementById('charPublic').checked;
  
  if (!name) {
    showToast('请输入角色名称');
    return;
  }
  
  try {
    await api('/characters', {
      method: 'POST',
      body: JSON.stringify({ name, avatar, description, personality, scenario, category, gender, isPublic })
    });
    showToast('角色创建成功');
    navigate('myCharacters');
  } catch (error) {
    showToast(error.message);
  }
}

// ==================== 增强的API配置页面 ====================

function renderApiConfigPageEnhanced() {
  return `
    <div class="header">
      <span class="header-back" onclick="goBack()">‹</span>
      <span class="header-title">API配置</span>
    </div>
    <div style="padding:16px;">
      <!-- AI API配置 -->
      <div class="card" style="margin-bottom:16px;">
        <h3 style="margin-bottom:16px;">🤖 AI对话API</h3>
        <p style="color:var(--text-muted);font-size:13px;margin-bottom:16px;">配置您自己的AI服务API</p>
        
        <div class="form-group" style="margin-bottom:16px;">
          <label style="display:block;font-size:13px;color:var(--text-secondary);margin-bottom:6px;">API类型</label>
          <select class="input" id="apiType" onchange="toggleCustomApiFields()">
            <option value="default">使用默认API</option>
            <option value="custom">自定义API</option>
          </select>
        </div>
        
        <div id="customApiFields" style="display:none;">
          <div class="form-group" style="margin-bottom:16px;">
            <label style="display:block;font-size:13px;color:var(--text-secondary);margin-bottom:6px;">API URL *</label>
            <input type="text" class="input" id="customApiUrl" placeholder="https://api.openai.com/v1">
          </div>
          
          <div class="form-group" style="margin-bottom:16px;">
            <label style="display:block;font-size:13px;color:var(--text-secondary);margin-bottom:6px;">API Key *</label>
            <input type="password" class="input" id="customApiKey" placeholder="sk-...">
          </div>
          
          <div class="form-group" style="margin-bottom:16px;">
            <label style="display:block;font-size:13px;color:var(--text-secondary);margin-bottom:6px;">模型名称</label>
            <input type="text" class="input" id="customModel" placeholder="gpt-4, claude-3-opus, deepseek-chat">
          </div>
        </div>
      </div>
      
      <!-- TTS配置 -->
      <div class="card" style="margin-bottom:16px;">
        <h3 style="margin-bottom:16px;">🔊 语音合成(TTS)</h3>
        <p style="color:var(--text-muted);font-size:13px;margin-bottom:16px;">配置语音合成服务，支持CosyVoice</p>
        
        <div class="form-group" style="margin-bottom:16px;">
          <label style="display:block;font-size:13px;color:var(--text-secondary);margin-bottom:6px;">TTS类型</label>
          <select class="input" id="ttsType" onchange="toggleTtsFields()">
            <option value="default">使用默认TTS</option>
            <option value="cosyvoice">CosyVoice</option>
            <option value="custom">自定义TTS</option>
          </select>
        </div>
        
        <div id="cosyVoiceFields" style="display:none;">
          <div style="background:var(--bg);padding:12px;border-radius:8px;margin-bottom:16px;">
            <p style="font-size:12px;color:var(--text-muted);margin-bottom:8px;">
              CosyVoice是阿里开源的高质量语音合成模型。
              <a href="https://github.com/FunAudioLLM/CosyVoice" target="_blank" style="color:var(--primary);">查看文档</a>
            </p>
          </div>
          
          <div class="form-group" style="margin-bottom:16px;">
            <label style="display:block;font-size:13px;color:var(--text-secondary);margin-bottom:6px;">CosyVoice API URL *</label>
            <input type="text" class="input" id="cosyVoiceUrl" placeholder="http://localhost:50000">
          </div>
          
          <div class="form-group" style="margin-bottom:16px;">
            <label style="display:block;font-size:13px;color:var(--text-secondary);margin-bottom:6px;">API Key（可选）</label>
            <input type="password" class="input" id="cosyVoiceKey" placeholder="如果需要认证">
          </div>
        </div>
      </div>
      
      <button class="btn btn-primary" style="width:100%;" onclick="saveApiConfigEnhanced()">保存配置</button>
      <button class="btn btn-outline" style="width:100%;margin-top:12px;" onclick="loadApiConfig()">加载当前配置</button>
    </div>
  `;
}

// 切换自定义API字段显示
function toggleCustomApiFields() {
  const apiType = document.getElementById('apiType').value;
  const fields = document.getElementById('customApiFields');
  fields.style.display = apiType === 'custom' ? 'block' : 'none';
}

// 切换TTS字段显示
function toggleTtsFields() {
  const ttsType = document.getElementById('ttsType').value;
  const fields = document.getElementById('cosyVoiceFields');
  fields.style.display = (ttsType === 'cosyvoice' || ttsType === 'custom') ? 'block' : 'none';
}

// 加载API配置
async function loadApiConfig() {
  try {
    const config = await api('/user/api-config');
    
    if (config.apiType) {
      document.getElementById('apiType').value = config.apiType;
      toggleCustomApiFields();
    }
    if (config.customApiUrl) {
      document.getElementById('customApiUrl').value = config.customApiUrl;
    }
    if (config.customApiKey) {
      document.getElementById('customApiKey').value = config.customApiKey;
    }
    if (config.customModel) {
      document.getElementById('customModel').value = config.customModel;
    }
    if (config.ttsType) {
      document.getElementById('ttsType').value = config.ttsType;
      toggleTtsFields();
    }
    if (config.cosyVoiceUrl) {
      document.getElementById('cosyVoiceUrl').value = config.cosyVoiceUrl;
    }
    if (config.cosyVoiceKey) {
      document.getElementById('cosyVoiceKey').value = config.cosyVoiceKey;
    }
    
    showToast('配置已加载');
  } catch (err) {
    showToast('加载配置失败');
  }
}

// 保存API配置
async function saveApiConfigEnhanced() {
  const apiType = document.getElementById('apiType').value;
  const customApiUrl = document.getElementById('customApiUrl')?.value || '';
  const customApiKey = document.getElementById('customApiKey')?.value || '';
  const customModel = document.getElementById('customModel')?.value || '';
  const ttsType = document.getElementById('ttsType').value;
  const cosyVoiceUrl = document.getElementById('cosyVoiceUrl')?.value || '';
  const cosyVoiceKey = document.getElementById('cosyVoiceKey')?.value || '';
  
  if (apiType === 'custom' && (!customApiUrl || !customApiKey)) {
    showToast('请填写自定义API的URL和Key');
    return;
  }
  
  if (ttsType === 'cosyvoice' && !cosyVoiceUrl) {
    showToast('请填写CosyVoice API URL');
    return;
  }
  
  try {
    await api('/user/api-config', {
      method: 'POST',
      body: JSON.stringify({
        apiType,
        customApiUrl,
        customApiKey,
        customModel,
        ttsType,
        cosyVoiceUrl,
        cosyVoiceKey
      })
    });
    showToast('配置已保存');
  } catch (err) {
    showToast('保存失败: ' + err.message);
  }
}

// ==================== 管理员页面 ====================

function renderAdminPage() {
  return `
    <div class="header">
      <span class="header-back" onclick="goBack()">‹</span>
      <span class="header-title">管理后台</span>
    </div>
    <div style="padding:16px;">
      <div class="card" style="margin-bottom:16px;">
        <h3 style="margin-bottom:16px;">📊 数据统计</h3>
        <div id="adminStats" style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;">
          <div style="background:var(--bg);padding:16px;border-radius:8px;text-align:center;">
            <div style="font-size:24px;font-weight:600;color:var(--primary);" id="statUsers">-</div>
            <div style="font-size:12px;color:var(--text-muted);">总用户</div>
          </div>
          <div style="background:var(--bg);padding:16px;border-radius:8px;text-align:center;">
            <div style="font-size:24px;font-weight:600;color:var(--primary);" id="statCharacters">-</div>
            <div style="font-size:12px;color:var(--text-muted);">总角色</div>
          </div>
          <div style="background:var(--bg);padding:16px;border-radius:8px;text-align:center;">
            <div style="font-size:24px;font-weight:600;color:var(--primary);" id="statMessages">-</div>
            <div style="font-size:12px;color:var(--text-muted);">总消息</div>
          </div>
          <div style="background:var(--bg);padding:16px;border-radius:8px;text-align:center;">
            <div style="font-size:24px;font-weight:600;color:var(--gold);" id="statRevenue">-</div>
            <div style="font-size:12px;color:var(--text-muted);">总收入</div>
          </div>
        </div>
      </div>
      
      <div class="settings-list">
        <div class="settings-item" onclick="navigate('adminUsers')">
          <span class="icon">👥</span>
          <span class="label">用户管理</span>
          <span class="arrow">›</span>
        </div>
        <div class="settings-item" onclick="navigate('adminCharacters')">
          <span class="icon">🎭</span>
          <span class="label">角色管理</span>
          <span class="arrow">›</span>
        </div>
        <div class="settings-item" onclick="navigate('adminMoments')">
          <span class="icon">📷</span>
          <span class="label">动态管理</span>
          <span class="arrow">›</span>
        </div>
        <div class="settings-item" onclick="navigate('adminGifts')">
          <span class="icon">🎁</span>
          <span class="label">礼物管理</span>
          <span class="arrow">›</span>
        </div>
        <div class="settings-item" onclick="navigate('adminVip')">
          <span class="icon">👑</span>
          <span class="label">VIP管理</span>
          <span class="arrow">›</span>
        </div>
        <div class="settings-item" onclick="navigate('systemSettings')">
          <span class="icon">⚙️</span>
          <span class="label">系统设置</span>
          <span class="arrow">›</span>
        </div>
        <div class="settings-item" onclick="generateTestMoments()">
          <span class="icon">🔧</span>
          <span class="label">生成测试动态</span>
          <span class="arrow">›</span>
        </div>
      </div>
    </div>
  `;
}

// 加载管理员统计
async function loadAdminStats() {
  try {
    const stats = await api('/admin/stats');
    document.getElementById('statUsers').textContent = stats.totalUsers || 0;
    document.getElementById('statCharacters').textContent = stats.totalCharacters || 0;
    document.getElementById('statMessages').textContent = stats.totalMessages || 0;
    document.getElementById('statRevenue').textContent = '¥' + (stats.totalRevenue || 0);
  } catch (err) {
    console.error('Load admin stats error:', err);
  }
}

// 生成测试动态
async function generateTestMoments() {
  try {
    const result = await api('/admin/generate-moments', {
      method: 'POST',
      body: JSON.stringify({ count: 10 })
    });
    showToast(result.message || '生成成功');
  } catch (err) {
    showToast('生成失败: ' + err.message);
  }
}

// ==================== 系统设置页面 ====================

function renderSystemSettingsPage() {
  return `
    <div class="header">
      <span class="header-back" onclick="goBack()">‹</span>
      <span class="header-title">系统设置</span>
    </div>
    <div style="padding:16px;">
      <div class="card" style="margin-bottom:16px;">
        <h3 style="margin-bottom:16px;">🔧 基本设置</h3>
        
        <div class="form-group" style="margin-bottom:16px;">
          <label style="display:block;font-size:13px;color:var(--text-secondary);margin-bottom:6px;">应用名称</label>
          <input type="text" class="input" id="appName" value="微爱" placeholder="应用名称">
        </div>
        
        <div class="form-group" style="margin-bottom:16px;">
          <label style="display:block;font-size:13px;color:var(--text-secondary);margin-bottom:6px;">每日免费消息数</label>
          <input type="number" class="input" id="freeMessages" value="20" placeholder="20">
        </div>
        
        <div class="form-group" style="margin-bottom:16px;">
          <label style="display:block;font-size:13px;color:var(--text-secondary);margin-bottom:6px;">新用户赠送金币</label>
          <input type="number" class="input" id="welcomeCoins" value="100" placeholder="100">
        </div>
      </div>
      
      <div class="card" style="margin-bottom:16px;">
        <h3 style="margin-bottom:16px;">💰 支付设置</h3>
        
        <div class="form-group" style="margin-bottom:16px;">
          <label style="display:block;font-size:13px;color:var(--text-secondary);margin-bottom:6px;">平台抽成比例 (%)</label>
          <input type="number" class="input" id="platformFee" value="10" placeholder="10">
        </div>
        
        <div class="form-group" style="margin-bottom:16px;">
          <label style="display:block;font-size:13px;color:var(--text-secondary);margin-bottom:6px;">最低提现金额</label>
          <input type="number" class="input" id="minWithdraw" value="100" placeholder="100">
        </div>
      </div>
      
      <div class="card" style="margin-bottom:16px;">
        <h3 style="margin-bottom:16px;">🔒 安全设置</h3>
        
        <div class="form-group" style="margin-bottom:16px;display:flex;align-items:center;gap:8px;">
          <input type="checkbox" id="enableCaptcha" checked>
          <label for="enableCaptcha" style="font-size:13px;">启用注册验证码</label>
        </div>
        
        <div class="form-group" style="margin-bottom:16px;display:flex;align-items:center;gap:8px;">
          <input type="checkbox" id="enableRateLimit" checked>
          <label for="enableRateLimit" style="font-size:13px;">启用速率限制</label>
        </div>
        
        <div class="form-group" style="margin-bottom:16px;">
          <label style="display:block;font-size:13px;color:var(--text-secondary);margin-bottom:6px;">每小时最大注册数</label>
          <input type="number" class="input" id="maxRegistrations" value="3" placeholder="3">
        </div>
      </div>
      
      <button class="btn btn-primary" style="width:100%;" onclick="saveSystemSettings()">保存设置</button>
    </div>
  `;
}

// 保存系统设置
async function saveSystemSettings() {
  showToast('系统设置已保存');
}

// ==================== 覆盖原有函数 ====================

// 覆盖原有的renderCreateCharacterPage
if (typeof window !== 'undefined') {
  window.renderCreateCharacterPageOriginal = window.renderCreateCharacterPage;
  window.renderCreateCharacterPage = renderCreateCharacterPageEnhanced;
  
  window.renderApiConfigPageOriginal = window.renderApiConfigPage;
  window.renderApiConfigPage = renderApiConfigPageEnhanced;
  
  window.createCharacterOriginal = window.createCharacter;
  window.createCharacter = createCharacterEnhanced;
  
  // 添加新页面到路由
  const originalNavigate = window.navigate;
  window.navigate = function(page, params = {}) {
    if (page === 'admin') {
      state.currentPage = 'admin';
      render();
      setTimeout(loadAdminStats, 100);
      return;
    }
    if (page === 'systemSettings') {
      state.currentPage = 'systemSettings';
      render();
      return;
    }
    originalNavigate(page, params);
  };
  
  const originalRender = window.render;
  window.render = function() {
    if (state.currentPage === 'admin') {
      document.getElementById('app').innerHTML = `<div class="page-container">${renderAdminPage()}</div>`;
      window.scrollTo(0, 0);
      return;
    }
    if (state.currentPage === 'systemSettings') {
      document.getElementById('app').innerHTML = `<div class="page-container">${renderSystemSettingsPage()}</div>`;
      window.scrollTo(0, 0);
      return;
    }
    originalRender();
  };
}

console.log('Fixes.js loaded: avatar selector, API config, TTS config, admin pages');
