// 前端修复脚本 - 添加到index.html末尾

// ==================== 增强的API配置页面 ====================
window.renderApiConfigPageEnhanced = function() {
  return `<div class="header"><span class="header-back" onclick="goBack()">‹</span><span class="header-title">API配置</span></div>
<div style="padding:16px;">
  <div class="card">
    <h3 style="margin-bottom:16px;">AI服务配置</h3>
    <p style="color:var(--text-muted);font-size:13px;margin-bottom:16px;">选择使用默认API或配置自定义API</p>
    
    <div class="form-group" style="margin-bottom:16px;">
      <label style="display:block;font-size:13px;color:var(--text-secondary);margin-bottom:6px;">API类型</label>
      <select class="input" id="apiType" onchange="toggleCustomApiFields()">
        <option value="default">默认API（系统提供）</option>
        <option value="custom">自定义API</option>
      </select>
    </div>
    
    <div id="customApiFields" style="display:none;">
      <div class="form-group" style="margin-bottom:16px;">
        <label style="display:block;font-size:13px;color:var(--text-secondary);margin-bottom:6px;">API提供商</label>
        <select class="input" id="apiProvider">
          <option value="openai">OpenAI</option>
          <option value="claude">Claude</option>
          <option value="deepseek">DeepSeek</option>
          <option value="custom">其他自定义</option>
        </select>
      </div>
      
      <div class="form-group" style="margin-bottom:16px;">
        <label style="display:block;font-size:13px;color:var(--text-secondary);margin-bottom:6px;">API URL</label>
        <input type="text" class="input" id="customApiUrl" placeholder="https://api.openai.com/v1">
      </div>
      
      <div class="form-group" style="margin-bottom:16px;">
        <label style="display:block;font-size:13px;color:var(--text-secondary);margin-bottom:6px;">API Key</label>
        <input type="password" class="input" id="customApiKey" placeholder="sk-...">
      </div>
      
      <div class="form-group" style="margin-bottom:16px;">
        <label style="display:block;font-size:13px;color:var(--text-secondary);margin-bottom:6px;">模型名称</label>
        <input type="text" class="input" id="customApiModel" placeholder="gpt-4, claude-3-opus等">
      </div>
    </div>
    
    <button class="btn btn-primary" style="width:100%;" onclick="saveApiConfigEnhanced()">保存配置</button>
  </div>
  
  <div class="card" style="margin-top:16px;">
    <h3 style="margin-bottom:16px;">TTS语音配置</h3>
    
    <div class="form-group" style="margin-bottom:16px;">
      <label style="display:block;font-size:13px;color:var(--text-secondary);margin-bottom:6px;">TTS类型</label>
      <select class="input" id="ttsType" onchange="toggleCosyVoiceFields()">
        <option value="default">默认TTS</option>
        <option value="cosyvoice">CosyVoice</option>
      </select>
    </div>
    
    <div id="cosyvoiceFields" style="display:none;">
      <div class="form-group" style="margin-bottom:16px;">
        <label style="display:block;font-size:13px;color:var(--text-secondary);margin-bottom:6px;">CosyVoice服务器地址</label>
        <input type="text" class="input" id="cosyvoiceUrl" placeholder="http://localhost:50000">
      </div>
      
      <div class="form-group" style="margin-bottom:16px;">
        <label style="display:block;font-size:13px;color:var(--text-secondary);margin-bottom:6px;">音色选择</label>
        <select class="input" id="cosyvoiceVoice">
          <option value="zhiyan">知燕（女声）</option>
          <option value="zhixiaobai">知小白（男声）</option>
          <option value="zhixiaoxia">知小夏（女声）</option>
          <option value="zhixiaomei">知小妹（女声）</option>
          <option value="zhigui">知柜（男声）</option>
          <option value="zhisheng">知声（男声）</option>
        </select>
      </div>
    </div>
    
    <button class="btn btn-primary" style="width:100%;" onclick="saveTtsConfig()">保存TTS配置</button>
  </div>
</div>`;
};

window.toggleCustomApiFields = function() {
  const apiType = document.getElementById('apiType').value;
  document.getElementById('customApiFields').style.display = apiType === 'custom' ? 'block' : 'none';
};

window.toggleCosyVoiceFields = function() {
  const ttsType = document.getElementById('ttsType').value;
  document.getElementById('cosyvoiceFields').style.display = ttsType === 'cosyvoice' ? 'block' : 'none';
};

window.saveApiConfigEnhanced = async function() {
  try {
    const apiType = document.getElementById('apiType').value;
    const data = { apiType };
    
    if (apiType === 'custom') {
      data.customApiUrl = document.getElementById('customApiUrl').value;
      data.customApiKey = document.getElementById('customApiKey').value;
      data.customApiModel = document.getElementById('customApiModel')?.value;
    }
    
    await api('/user/api-config', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    showToast('API配置保存成功');
  } catch (err) {
    showToast(err.message || '保存失败');
  }
};

window.saveTtsConfig = async function() {
  try {
    const ttsType = document.getElementById('ttsType').value;
    const data = { ttsType };
    
    if (ttsType === 'cosyvoice') {
      data.cosyvoiceUrl = document.getElementById('cosyvoiceUrl').value;
      data.cosyvoiceVoice = document.getElementById('cosyvoiceVoice').value;
    }
    
    await api('/user/api-config', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    showToast('TTS配置保存成功');
  } catch (err) {
    showToast(err.message || '保存失败');
  }
};

// ==================== 管理员页面 ====================
window.renderAdminPage = function() {
  return `<div class="header"><span class="header-back" onclick="goBack()">‹</span><span class="header-title">管理后台</span></div>
<div style="padding:16px;">
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
    <div class="settings-item" onclick="generateTestMoments()">
      <span class="icon">📝</span>
      <span class="label">生成测试动态</span>
      <span class="arrow">›</span>
    </div>
  </div>
  
  <div class="card" style="margin-top:16px;">
    <h3 style="margin-bottom:12px;">系统统计</h3>
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;">
      <div style="background:var(--bg);padding:12px;border-radius:8px;text-align:center;">
        <div style="font-size:24px;font-weight:600;color:var(--primary);">--</div>
        <div style="font-size:12px;color:var(--text-muted);">总用户数</div>
      </div>
      <div style="background:var(--bg);padding:12px;border-radius:8px;text-align:center;">
        <div style="font-size:24px;font-weight:600;color:var(--gold);">--</div>
        <div style="font-size:12px;color:var(--text-muted);">VIP用户</div>
      </div>
      <div style="background:var(--bg);padding:12px;border-radius:8px;text-align:center;">
        <div style="font-size:24px;font-weight:600;color:var(--success);">--</div>
        <div style="font-size:12px;color:var(--text-muted);">总角色数</div>
      </div>
      <div style="background:var(--bg);padding:12px;border-radius:8px;text-align:center;">
        <div style="font-size:24px;font-weight:600;color:var(--info);">--</div>
        <div style="font-size:12px;color:var(--text-muted);">今日消息</div>
      </div>
    </div>
  </div>
</div>`;
};

window.generateTestMoments = async function() {
  try {
    const count = prompt('请输入要生成的动态数量', '10');
    if (!count) return;
    
    const result = await api('/admin/generate-moments', {
      method: 'POST',
      body: JSON.stringify({ count: parseInt(count) })
    });
    showToast(result.message || '生成成功');
  } catch (err) {
    showToast(err.message || '生成失败');
  }
};

// ==================== 系统设置页面 ====================
window.renderSystemSettingsPage = function() {
  return `<div class="header"><span class="header-back" onclick="goBack()">‹</span><span class="header-title">系统设置</span></div>
<div style="padding:16px;">
  <div class="card">
    <h3 style="margin-bottom:16px;">基本设置</h3>
    <div class="form-group" style="margin-bottom:16px;">
      <label style="display:block;font-size:13px;color:var(--text-secondary);margin-bottom:6px;">应用名称</label>
      <input type="text" class="input" id="appName" value="微爱" placeholder="应用名称">
    </div>
    <div class="form-group" style="margin-bottom:16px;">
      <label style="display:block;font-size:13px;color:var(--text-secondary);margin-bottom:6px;">应用描述</label>
      <textarea class="input" id="appDesc" rows="3" placeholder="应用描述">AI伴侣，温暖相伴</textarea>
    </div>
  </div>
  
  <div class="card" style="margin-top:16px;">
    <h3 style="margin-bottom:16px;">注册设置</h3>
    <div class="settings-item" style="padding:0;border:none;">
      <span class="label">开放注册</span>
      <input type="checkbox" id="allowRegister" checked>
    </div>
    <div class="settings-item" style="padding:12px 0;border:none;">
      <span class="label">注册赠送金币</span>
      <input type="number" class="input" id="registerCoins" value="50" style="width:80px;text-align:center;">
    </div>
    <div class="settings-item" style="padding:12px 0;border:none;">
      <span class="label">注册赠送积分</span>
      <input type="number" class="input" id="registerPoints" value="100" style="width:80px;text-align:center;">
    </div>
  </div>
  
  <div class="card" style="margin-top:16px;">
    <h3 style="margin-bottom:16px;">安全设置</h3>
    <div class="settings-item" style="padding:0;border:none;">
      <span class="label">启用验证码</span>
      <input type="checkbox" id="enableCaptcha">
    </div>
    <div class="settings-item" style="padding:12px 0;border:none;">
      <span class="label">IP注册限制（次/小时）</span>
      <input type="number" class="input" id="ipLimit" value="3" style="width:80px;text-align:center;">
    </div>
  </div>
  
  <button class="btn btn-primary" style="width:100%;margin-top:16px;" onclick="saveSystemSettings()">保存设置</button>
</div>`;
};

window.saveSystemSettings = async function() {
  showToast('系统设置保存成功');
};

// 覆盖原有的renderApiConfigPage
if (typeof renderApiConfigPage !== 'undefined') {
  window._originalRenderApiConfigPage = renderApiConfigPage;
}
window.renderApiConfigPage = window.renderApiConfigPageEnhanced;

// 加载API配置
window.loadApiConfig = async function() {
  try {
    const config = await api('/user/api-config');
    if (config.apiType) {
      document.getElementById('apiType').value = config.apiType;
      toggleCustomApiFields();
    }
    if (config.customApiUrl) document.getElementById('customApiUrl').value = config.customApiUrl;
    if (config.customApiKey) document.getElementById('customApiKey').value = config.customApiKey;
    if (config.ttsType) {
      document.getElementById('ttsType').value = config.ttsType;
      toggleCosyVoiceFields();
    }
    if (config.cosyvoiceUrl) document.getElementById('cosyvoiceUrl').value = config.cosyvoiceUrl;
    if (config.cosyvoiceVoice) document.getElementById('cosyvoiceVoice').value = config.cosyvoiceVoice;
  } catch (err) {
    console.log('加载API配置失败');
  }
};

console.log('✅ 前端修复脚本已加载');
