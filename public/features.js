// ==================== 微爱新功能前端模块 ====================
// 此文件包含角色市场、分享导出、推送通知等前端功能

// ==================== 角色市场功能 ====================

// 角色市场数据
let marketplaceListings = [];
let myListings = [];
let myPurchases = [];
let marketplaceSort = 'hot';
let marketplaceSearch = '';

// 渲染角色市场页面
function renderMarketplacePage() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="page marketplace-page">
      <div class="header">
        <h2>🏪 角色市场</h2>
      </div>
      
      <div class="tabs" style="display:flex;gap:10px;padding:10px;background:#f5f5f5;overflow-x:auto;">
        <button onclick="showMarketplaceTab('browse')" class="tab-btn active" id="tab-browse" style="padding:8px 16px;border:none;border-radius:20px;background:#007AFF;color:white;">浏览市场</button>
        <button onclick="showMarketplaceTab('my-listings')" class="tab-btn" id="tab-my-listings" style="padding:8px 16px;border:none;border-radius:20px;background:#e0e0e0;">我的上架</button>
        <button onclick="showMarketplaceTab('my-purchases')" class="tab-btn" id="tab-my-purchases" style="padding:8px 16px;border:none;border-radius:20px;background:#e0e0e0;">已购买</button>
      </div>
      
      <div id="marketplace-content" style="padding:15px;">
        <div id="marketplace-browse">
          <div style="display:flex;gap:10px;margin-bottom:15px;">
            <input type="text" id="marketplace-search" placeholder="搜索角色或卖家..." 
              style="flex:1;padding:10px;border:1px solid #ddd;border-radius:8px;"
              onkeyup="if(event.key==='Enter')searchMarketplace()">
            <select id="marketplace-sort" onchange="sortMarketplace(this.value)" 
              style="padding:10px;border:1px solid #ddd;border-radius:8px;">
              <option value="hot">热门</option>
              <option value="rating">评分</option>
              <option value="price-asc">价格↑</option>
              <option value="price-desc">价格↓</option>
              <option value="new">最新</option>
            </select>
          </div>
          <div id="listings-container"></div>
        </div>
        
        <div id="marketplace-my-listings" style="display:none;">
          <button onclick="showListCharacterModal()" style="width:100%;padding:12px;background:#007AFF;color:white;border:none;border-radius:8px;margin-bottom:15px;">
            + 上架我的角色
          </button>
          <div id="my-listings-container"></div>
        </div>
        
        <div id="marketplace-my-purchases" style="display:none;">
          <div id="my-purchases-container"></div>
        </div>
      </div>
    </div>
  `;
  
  loadMarketplaceListings();
  renderBottomNav('marketplace');
}

// 切换市场标签
function showMarketplaceTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.style.background = '#e0e0e0';
    btn.style.color = '#333';
  });
  document.getElementById('tab-' + tab.replace('my-', 'my-')).style.background = '#007AFF';
  document.getElementById('tab-' + tab.replace('my-', 'my-')).style.color = 'white';
  
  document.getElementById('marketplace-browse').style.display = tab === 'browse' ? 'block' : 'none';
  document.getElementById('marketplace-my-listings').style.display = tab === 'my-listings' ? 'block' : 'none';
  document.getElementById('marketplace-my-purchases').style.display = tab === 'my-purchases' ? 'block' : 'none';
  
  if (tab === 'browse') loadMarketplaceListings();
  else if (tab === 'my-listings') loadMyListings();
  else if (tab === 'my-purchases') loadMyPurchases();
}

// 加载市场列表
async function loadMarketplaceListings() {
  try {
    const res = await fetch(`/api/marketplace/listings?sort=${marketplaceSort}&search=${marketplaceSearch}`, {
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
    });
    const data = await res.json();
    marketplaceListings = data.listings || [];
    renderListings();
  } catch (err) {
    console.error('Load listings error:', err);
  }
}

// 渲染市场列表
function renderListings() {
  const container = document.getElementById('listings-container');
  if (!container) return;
  
  if (marketplaceListings.length === 0) {
    container.innerHTML = '<div style="text-align:center;padding:40px;color:#999;">暂无上架角色</div>';
    return;
  }
  
  container.innerHTML = marketplaceListings.map(item => `
    <div class="listing-card" style="background:white;border-radius:12px;padding:15px;margin-bottom:12px;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
      <div style="display:flex;gap:12px;">
        <img src="${item.avatar || 'https://via.placeholder.com/60'}" style="width:60px;height:60px;border-radius:50%;object-fit:cover;">
        <div style="flex:1;">
          <div style="font-weight:bold;font-size:16px;">${item.name}</div>
          <div style="color:#666;font-size:13px;margin-top:4px;">卖家: ${item.sellerName}</div>
          <div style="display:flex;align-items:center;gap:10px;margin-top:8px;">
            <span style="color:#FF9500;">⭐ ${(item.rating || 0).toFixed(1)}</span>
            <span style="color:#999;font-size:12px;">${item.salesCount || 0}人购买</span>
          </div>
        </div>
        <div style="text-align:right;">
          <div style="color:#FF3B30;font-size:18px;font-weight:bold;">${item.price} 💰</div>
          <button onclick="showPurchaseModal(${item.id})" style="margin-top:8px;padding:6px 16px;background:#007AFF;color:white;border:none;border-radius:16px;font-size:13px;">
            购买
          </button>
        </div>
      </div>
      ${item.description ? `<div style="margin-top:10px;padding-top:10px;border-top:1px solid #eee;color:#666;font-size:13px;">${item.description}</div>` : ''}
    </div>
  `).join('');
}

// 搜索市场
function searchMarketplace() {
  marketplaceSearch = document.getElementById('marketplace-search').value;
  loadMarketplaceListings();
}

// 排序市场
function sortMarketplace(sort) {
  marketplaceSort = sort;
  loadMarketplaceListings();
}

// 显示购买确认弹窗
function showPurchaseModal(listingId) {
  const listing = marketplaceListings.find(l => l.id === listingId);
  if (!listing) return;
  
  showModal(`
    <div style="text-align:center;">
      <img src="${listing.avatar || 'https://via.placeholder.com/80'}" style="width:80px;height:80px;border-radius:50%;margin-bottom:15px;">
      <h3 style="margin:0 0 10px;">${listing.name}</h3>
      <p style="color:#666;margin-bottom:20px;">卖家: ${listing.sellerName}</p>
      <div style="background:#f5f5f5;padding:15px;border-radius:8px;margin-bottom:20px;">
        <div style="font-size:24px;color:#FF3B30;font-weight:bold;">${listing.price} 💰</div>
        <div style="color:#999;font-size:12px;margin-top:5px;">购买后角色将复制到您的账户</div>
      </div>
      <div style="display:flex;gap:10px;">
        <button onclick="hideModal()" style="flex:1;padding:12px;background:#e0e0e0;border:none;border-radius:8px;">取消</button>
        <button onclick="purchaseCharacter(${listingId})" style="flex:1;padding:12px;background:#007AFF;color:white;border:none;border-radius:8px;">确认购买</button>
      </div>
    </div>
  `);
}

// 购买角色
async function purchaseCharacter(listingId) {
  try {
    const res = await fetch('/api/marketplace/purchase', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + localStorage.getItem('token')
      },
      body: JSON.stringify({ listingId })
    });
    
    const data = await res.json();
    if (data.success) {
      hideModal();
      showToast('购买成功！角色已添加到您的列表');
      loadMarketplaceListings();
    } else {
      showToast(data.error || '购买失败');
    }
  } catch (err) {
    showToast('购买失败：' + err.message);
  }
}

// 加载我的上架
async function loadMyListings() {
  try {
    const res = await fetch('/api/marketplace/my-listings', {
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
    });
    const data = await res.json();
    myListings = data.listings || [];
    renderMyListings();
  } catch (err) {
    console.error('Load my listings error:', err);
  }
}

// 渲染我的上架
function renderMyListings() {
  const container = document.getElementById('my-listings-container');
  if (!container) return;
  
  if (myListings.length === 0) {
    container.innerHTML = '<div style="text-align:center;padding:40px;color:#999;">您还没有上架任何角色</div>';
    return;
  }
  
  container.innerHTML = myListings.map(item => `
    <div class="listing-card" style="background:white;border-radius:12px;padding:15px;margin-bottom:12px;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
      <div style="display:flex;gap:12px;">
        <img src="${item.avatar || 'https://via.placeholder.com/60'}" style="width:60px;height:60px;border-radius:50%;object-fit:cover;">
        <div style="flex:1;">
          <div style="font-weight:bold;font-size:16px;">${item.name}</div>
          <div style="color:#666;font-size:13px;margin-top:4px;">
            状态: <span style="color:${item.status === 'active' ? '#34C759' : '#999'}">${item.status === 'active' ? '上架中' : '已下架'}</span>
          </div>
          <div style="display:flex;align-items:center;gap:10px;margin-top:8px;">
            <span style="color:#FF9500;">⭐ ${(item.rating || 0).toFixed(1)}</span>
            <span style="color:#999;font-size:12px;">销量: ${item.salesCount || 0}</span>
            <span style="color:#34C759;font-size:12px;">收入: ${item.totalRevenue || 0}💰</span>
          </div>
        </div>
        <div style="text-align:right;">
          <div style="color:#FF3B30;font-size:18px;font-weight:bold;">${item.price} 💰</div>
          ${item.status === 'active' ? `
            <button onclick="delistCharacter(${item.id})" style="margin-top:8px;padding:6px 12px;background:#FF3B30;color:white;border:none;border-radius:16px;font-size:12px;">
              下架
            </button>
          ` : ''}
        </div>
      </div>
    </div>
  `).join('');
}

// 显示上架角色弹窗
async function showListCharacterModal() {
  try {
    const res = await fetch('/api/characters', {
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
    });
    const data = await res.json();
    const characters = (data.characters || []).filter(c => c.type === 'custom');
    
    if (characters.length === 0) {
      showToast('您还没有创建任何角色');
      return;
    }
    
    showModal(`
      <h3 style="margin:0 0 15px;">上架角色</h3>
      <select id="list-character-select" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:8px;margin-bottom:15px;">
        ${characters.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
      </select>
      <input type="number" id="list-price" placeholder="价格（金币）" min="1" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:8px;margin-bottom:15px;box-sizing:border-box;">
      <textarea id="list-description" placeholder="角色描述（可选）" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:8px;margin-bottom:15px;height:80px;resize:none;box-sizing:border-box;"></textarea>
      <div style="display:flex;gap:10px;">
        <button onclick="hideModal()" style="flex:1;padding:12px;background:#e0e0e0;border:none;border-radius:8px;">取消</button>
        <button onclick="listCharacter()" style="flex:1;padding:12px;background:#007AFF;color:white;border:none;border-radius:8px;">上架</button>
      </div>
    `);
  } catch (err) {
    showToast('加载角色失败');
  }
}

// 上架角色
async function listCharacter() {
  const characterId = document.getElementById('list-character-select').value;
  const price = parseInt(document.getElementById('list-price').value);
  const description = document.getElementById('list-description').value;
  
  if (!price || price < 1) {
    showToast('请输入有效价格');
    return;
  }
  
  try {
    const res = await fetch('/api/marketplace/list', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + localStorage.getItem('token')
      },
      body: JSON.stringify({ characterId, price, description })
    });
    
    const data = await res.json();
    if (data.success) {
      hideModal();
      showToast('上架成功！');
      loadMyListings();
    } else {
      showToast(data.error || '上架失败');
    }
  } catch (err) {
    showToast('上架失败：' + err.message);
  }
}

// 下架角色
async function delistCharacter(listingId) {
  if (!confirm('确定要下架这个角色吗？')) return;
  
  try {
    const res = await fetch(`/api/marketplace/listings/${listingId}`, {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
    });
    
    const data = await res.json();
    if (data.success) {
      showToast('下架成功');
      loadMyListings();
    } else {
      showToast(data.error || '下架失败');
    }
  } catch (err) {
    showToast('下架失败：' + err.message);
  }
}

// 加载已购买
async function loadMyPurchases() {
  try {
    const res = await fetch('/api/marketplace/my-purchases', {
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
    });
    const data = await res.json();
    myPurchases = data.purchases || [];
    renderMyPurchases();
  } catch (err) {
    console.error('Load my purchases error:', err);
  }
}

// 渲染已购买
function renderMyPurchases() {
  const container = document.getElementById('my-purchases-container');
  if (!container) return;
  
  if (myPurchases.length === 0) {
    container.innerHTML = '<div style="text-align:center;padding:40px;color:#999;">您还没有购买任何角色</div>';
    return;
  }
  
  container.innerHTML = myPurchases.map(item => `
    <div class="purchase-card" style="background:white;border-radius:12px;padding:15px;margin-bottom:12px;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
      <div style="display:flex;gap:12px;">
        <img src="${item.avatar || 'https://via.placeholder.com/60'}" style="width:60px;height:60px;border-radius:50%;object-fit:cover;">
        <div style="flex:1;">
          <div style="font-weight:bold;font-size:16px;">${item.name}</div>
          <div style="color:#666;font-size:13px;margin-top:4px;">卖家: ${item.sellerName}</div>
          <div style="color:#999;font-size:12px;margin-top:4px;">购买时间: ${new Date(item.createdAt).toLocaleDateString()}</div>
        </div>
        <div style="text-align:right;">
          <div style="color:#FF3B30;font-size:16px;">${item.price} 💰</div>
          <button onclick="showReviewModal(${item.listingId})" style="margin-top:8px;padding:6px 12px;background:#FF9500;color:white;border:none;border-radius:16px;font-size:12px;">
            评价
          </button>
        </div>
      </div>
    </div>
  `).join('');
}

// 显示评价弹窗
function showReviewModal(listingId) {
  showModal(`
    <h3 style="margin:0 0 15px;">评价角色</h3>
    <div style="text-align:center;margin-bottom:15px;">
      <div id="rating-stars" style="font-size:32px;">
        ${[1,2,3,4,5].map(i => `<span onclick="setRating(${i})" style="cursor:pointer;color:#ddd;" data-star="${i}">★</span>`).join('')}
      </div>
      <div id="rating-text" style="color:#999;font-size:14px;margin-top:5px;">点击评分</div>
    </div>
    <input type="hidden" id="review-rating" value="0">
    <textarea id="review-comment" placeholder="写下您的评价（可选）" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:8px;margin-bottom:15px;height:80px;resize:none;box-sizing:border-box;"></textarea>
    <div style="display:flex;gap:10px;">
      <button onclick="hideModal()" style="flex:1;padding:12px;background:#e0e0e0;border:none;border-radius:8px;">取消</button>
      <button onclick="submitReview(${listingId})" style="flex:1;padding:12px;background:#007AFF;color:white;border:none;border-radius:8px;">提交</button>
    </div>
  `);
}

// 设置评分
function setRating(rating) {
  document.getElementById('review-rating').value = rating;
  const stars = document.querySelectorAll('#rating-stars span');
  stars.forEach((star, i) => {
    star.style.color = i < rating ? '#FF9500' : '#ddd';
  });
  const texts = ['', '很差', '较差', '一般', '很好', '非常好'];
  document.getElementById('rating-text').textContent = texts[rating];
}

// 提交评价
async function submitReview(listingId) {
  const rating = parseInt(document.getElementById('review-rating').value);
  const comment = document.getElementById('review-comment').value;
  
  if (rating < 1 || rating > 5) {
    showToast('请选择评分');
    return;
  }
  
  try {
    const res = await fetch('/api/marketplace/review', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + localStorage.getItem('token')
      },
      body: JSON.stringify({ listingId, rating, comment })
    });
    
    const data = await res.json();
    if (data.success) {
      hideModal();
      showToast('评价成功！');
    } else {
      showToast(data.error || '评价失败');
    }
  } catch (err) {
    showToast('评价失败：' + err.message);
  }
}

// ==================== 分享和导出功能 ====================

// 显示分享选项
function showShareOptions(sessionId) {
  showModal(`
    <h3 style="margin:0 0 15px;">分享对话</h3>
    <div style="display:flex;flex-direction:column;gap:10px;">
      <button onclick="createShare(${sessionId}, 'html')" style="padding:15px;background:#007AFF;color:white;border:none;border-radius:8px;display:flex;align-items:center;justify-content:center;gap:10px;">
        <span>📄</span> 生成HTML分享链接
      </button>
      <button onclick="exportChat(${sessionId}, 'html')" style="padding:15px;background:#34C759;color:white;border:none;border-radius:8px;display:flex;align-items:center;justify-content:center;gap:10px;">
        <span>⬇️</span> 导出为HTML文件
      </button>
      <button onclick="exportChat(${sessionId}, 'xml')" style="padding:15px;background:#FF9500;color:white;border:none;border-radius:8px;display:flex;align-items:center;justify-content:center;gap:10px;">
        <span>📋</span> 导出为XML文件
      </button>
      <button onclick="exportChat(${sessionId}, 'json')" style="padding:15px;background:#5856D6;color:white;border:none;border-radius:8px;display:flex;align-items:center;justify-content:center;gap:10px;">
        <span>{ }</span> 导出为JSON文件
      </button>
    </div>
    <button onclick="hideModal()" style="width:100%;padding:12px;background:#e0e0e0;border:none;border-radius:8px;margin-top:15px;">取消</button>
  `);
}

// 创建分享链接
async function createShare(sessionId, format) {
  try {
    const res = await fetch('/api/share/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + localStorage.getItem('token')
      },
      body: JSON.stringify({ sessionId, format })
    });
    
    const data = await res.json();
    if (data.success) {
      const shareUrl = window.location.origin + data.shareUrl;
      
      // 复制到剪贴板
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl);
        showToast('分享链接已复制到剪贴板！');
      }
      
      showModal(`
        <h3 style="margin:0 0 15px;">分享链接已生成</h3>
        <div style="background:#f5f5f5;padding:15px;border-radius:8px;word-break:break-all;margin-bottom:15px;">
          ${shareUrl}
        </div>
        <p style="color:#999;font-size:12px;margin-bottom:15px;">链接有效期7天</p>
        <button onclick="hideModal()" style="width:100%;padding:12px;background:#007AFF;color:white;border:none;border-radius:8px;">确定</button>
      `);
    } else {
      showToast(data.error || '创建分享失败');
    }
  } catch (err) {
    showToast('创建分享失败：' + err.message);
  }
}

// 导出聊天记录
function exportChat(sessionId, format) {
  const token = localStorage.getItem('token');
  window.open(`/api/chat/export/${format}/${sessionId}?token=${token}`, '_blank');
  hideModal();
  showToast('正在导出...');
}

// ==================== 推送通知功能 ====================

// 渲染推送设置页面
function renderPushSettingsPage() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="page push-settings-page">
      <div class="header" style="display:flex;align-items:center;padding:15px;">
        <button onclick="navigate('settings')" style="background:none;border:none;font-size:20px;">←</button>
        <h2 style="flex:1;text-align:center;margin:0;">推送设置</h2>
        <div style="width:30px;"></div>
      </div>
      
      <div style="padding:15px;">
        <div id="push-settings-content">
          <div style="text-align:center;padding:40px;color:#999;">加载中...</div>
        </div>
      </div>
    </div>
  `;
  
  loadPushSettings();
}

// 加载推送设置
async function loadPushSettings() {
  try {
    const res = await fetch('/api/push/settings', {
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
    });
    const settings = await res.json();
    renderPushSettingsForm(settings);
  } catch (err) {
    document.getElementById('push-settings-content').innerHTML = '<div style="text-align:center;padding:40px;color:#FF3B30;">加载失败</div>';
  }
}

// 渲染推送设置表单
function renderPushSettingsForm(settings) {
  const container = document.getElementById('push-settings-content');
  container.innerHTML = `
    <div style="background:white;border-radius:12px;overflow:hidden;">
      <div class="setting-item" style="display:flex;justify-content:space-between;align-items:center;padding:15px;border-bottom:1px solid #eee;">
        <span>启用推送通知</span>
        <label class="switch">
          <input type="checkbox" id="push-enabled" ${settings.enabled ? 'checked' : ''} onchange="savePushSettings()">
          <span class="slider"></span>
        </label>
      </div>
      <div class="setting-item" style="display:flex;justify-content:space-between;align-items:center;padding:15px;border-bottom:1px solid #eee;">
        <span>新消息通知</span>
        <label class="switch">
          <input type="checkbox" id="push-newMessage" ${settings.newMessage ? 'checked' : ''} onchange="savePushSettings()">
          <span class="slider"></span>
        </label>
      </div>
      <div class="setting-item" style="display:flex;justify-content:space-between;align-items:center;padding:15px;border-bottom:1px solid #eee;">
        <span>收到礼物通知</span>
        <label class="switch">
          <input type="checkbox" id="push-newGift" ${settings.newGift ? 'checked' : ''} onchange="savePushSettings()">
          <span class="slider"></span>
        </label>
      </div>
      <div class="setting-item" style="display:flex;justify-content:space-between;align-items:center;padding:15px;border-bottom:1px solid #eee;">
        <span>新粉丝通知</span>
        <label class="switch">
          <input type="checkbox" id="push-newFollower" ${settings.newFollower ? 'checked' : ''} onchange="savePushSettings()">
          <span class="slider"></span>
        </label>
      </div>
      <div class="setting-item" style="display:flex;justify-content:space-between;align-items:center;padding:15px;">
        <span>系统公告</span>
        <label class="switch">
          <input type="checkbox" id="push-systemNotice" ${settings.systemNotice ? 'checked' : ''} onchange="savePushSettings()">
          <span class="slider"></span>
        </label>
      </div>
    </div>
    
    <div style="background:white;border-radius:12px;overflow:hidden;margin-top:15px;">
      <div style="padding:15px;border-bottom:1px solid #eee;">
        <div style="font-weight:bold;margin-bottom:10px;">免打扰时段</div>
        <div style="display:flex;gap:10px;align-items:center;">
          <input type="time" id="push-quietStart" value="${settings.quietHoursStart || ''}" onchange="savePushSettings()" style="flex:1;padding:10px;border:1px solid #ddd;border-radius:8px;">
          <span>至</span>
          <input type="time" id="push-quietEnd" value="${settings.quietHoursEnd || ''}" onchange="savePushSettings()" style="flex:1;padding:10px;border:1px solid #ddd;border-radius:8px;">
        </div>
      </div>
    </div>
    
    <style>
      .switch { position: relative; display: inline-block; width: 50px; height: 28px; }
      .switch input { opacity: 0; width: 0; height: 0; }
      .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #ccc; transition: .3s; border-radius: 28px; }
      .slider:before { position: absolute; content: ""; height: 22px; width: 22px; left: 3px; bottom: 3px; background-color: white; transition: .3s; border-radius: 50%; }
      input:checked + .slider { background-color: #007AFF; }
      input:checked + .slider:before { transform: translateX(22px); }
    </style>
  `;
}

// 保存推送设置
async function savePushSettings() {
  const settings = {
    enabled: document.getElementById('push-enabled').checked,
    newMessage: document.getElementById('push-newMessage').checked,
    newGift: document.getElementById('push-newGift').checked,
    newFollower: document.getElementById('push-newFollower').checked,
    systemNotice: document.getElementById('push-systemNotice').checked,
    quietHoursStart: document.getElementById('push-quietStart').value || null,
    quietHoursEnd: document.getElementById('push-quietEnd').value || null
  };
  
  try {
    await fetch('/api/push/settings', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + localStorage.getItem('token')
      },
      body: JSON.stringify(settings)
    });
  } catch (err) {
    console.error('Save push settings error:', err);
  }
}

// ==================== 通用UI组件 ====================

// 显示模态框
function showModal(content) {
  let modal = document.getElementById('feature-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'feature-modal';
    modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:1000;padding:20px;';
    document.body.appendChild(modal);
  }
  
  modal.innerHTML = `
    <div style="background:white;border-radius:16px;padding:20px;max-width:400px;width:100%;max-height:80vh;overflow-y:auto;">
      ${content}
    </div>
  `;
  modal.style.display = 'flex';
}

// 隐藏模态框
function hideModal() {
  const modal = document.getElementById('feature-modal');
  if (modal) {
    modal.style.display = 'none';
  }
}

// 显示Toast提示
function showToast(message) {
  let toast = document.getElementById('feature-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'feature-toast';
    toast.style.cssText = 'position:fixed;bottom:100px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.8);color:white;padding:12px 24px;border-radius:24px;z-index:1001;transition:opacity 0.3s;';
    document.body.appendChild(toast);
  }
  
  toast.textContent = message;
  toast.style.opacity = '1';
  
  setTimeout(() => {
    toast.style.opacity = '0';
  }, 2000);
}

// ==================== 安全注册功能 ====================

// 渲染安全注册页面
function renderSecureRegisterPage() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="page register-page" style="padding:20px;">
      <div style="text-align:center;margin-bottom:30px;">
        <h1 style="font-size:28px;margin-bottom:10px;">微爱</h1>
        <p style="color:#666;">创建您的账户</p>
      </div>
      
      <div style="max-width:400px;margin:0 auto;">
        <input type="text" id="reg-username" placeholder="用户名" style="width:100%;padding:15px;border:1px solid #ddd;border-radius:8px;margin-bottom:15px;box-sizing:border-box;">
        <input type="email" id="reg-email" placeholder="邮箱" style="width:100%;padding:15px;border:1px solid #ddd;border-radius:8px;margin-bottom:15px;box-sizing:border-box;">
        <input type="password" id="reg-password" placeholder="密码" style="width:100%;padding:15px;border:1px solid #ddd;border-radius:8px;margin-bottom:15px;box-sizing:border-box;">
        
        <div style="display:flex;gap:10px;margin-bottom:15px;">
          <div style="flex:1;background:#f5f5f5;padding:15px;border-radius:8px;text-align:center;" id="captcha-question">
            加载验证码...
          </div>
          <input type="text" id="reg-captcha" placeholder="答案" style="width:100px;padding:15px;border:1px solid #ddd;border-radius:8px;text-align:center;">
          <button onclick="refreshCaptcha()" style="padding:15px;background:#e0e0e0;border:none;border-radius:8px;">🔄</button>
        </div>
        <input type="hidden" id="reg-captcha-id">
        
        <button onclick="secureRegister()" style="width:100%;padding:15px;background:#007AFF;color:white;border:none;border-radius:8px;font-size:16px;">
          注册
        </button>
        
        <p style="text-align:center;margin-top:20px;color:#666;">
          已有账户？<a href="#" onclick="navigate('login')" style="color:#007AFF;">登录</a>
        </p>
      </div>
    </div>
  `;
  
  refreshCaptcha();
}

// 刷新验证码
async function refreshCaptcha() {
  try {
    const res = await fetch('/api/captcha');
    const data = await res.json();
    document.getElementById('captcha-question').textContent = data.question;
    document.getElementById('reg-captcha-id').value = data.captchaId;
    document.getElementById('reg-captcha').value = '';
  } catch (err) {
    document.getElementById('captcha-question').textContent = '加载失败';
  }
}

// 安全注册
async function secureRegister() {
  const username = document.getElementById('reg-username').value;
  const email = document.getElementById('reg-email').value;
  const password = document.getElementById('reg-password').value;
  const captchaId = document.getElementById('reg-captcha-id').value;
  const captchaAnswer = document.getElementById('reg-captcha').value;
  
  if (!username || !email || !password) {
    showToast('请填写完整信息');
    return;
  }
  
  if (!captchaAnswer) {
    showToast('请输入验证码答案');
    return;
  }
  
  try {
    const res = await fetch('/api/auth/register-secure', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username,
        email,
        password,
        captchaId,
        captchaAnswer,
        deviceId: getDeviceId()
      })
    });
    
    const data = await res.json();
    
    if (data.token) {
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      showToast('注册成功！');
      navigate('home');
    } else {
      showToast(data.error || '注册失败');
      refreshCaptcha();
    }
  } catch (err) {
    showToast('注册失败：' + err.message);
    refreshCaptcha();
  }
}

// 获取设备ID
function getDeviceId() {
  let deviceId = localStorage.getItem('deviceId');
  if (!deviceId) {
    deviceId = 'device_' + Math.random().toString(36).substr(2, 16);
    localStorage.setItem('deviceId', deviceId);
  }
  return deviceId;
}

console.log('✅ 微爱新功能前端模块已加载');
