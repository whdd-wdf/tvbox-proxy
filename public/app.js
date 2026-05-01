// public/app.js - 前端逻辑
async function loadSources() {
  try {
    const res = await fetch('/api/sources');
    const data = await res.json();
    const list = document.getElementById('sourceList');
    
    if (!data.sources || data.sources.length === 0) {
      list.innerHTML = '<p style="color:#666;text-align:center;padding:2rem;">暂无配置，请添加新源。</p>';
      return;
    }
    
    list.innerHTML = data.sources.map(s => {
      const isActive = data.active === s.url;
      return `
        <div class="source-item">
          <div class="source-info">
            <div class="source-name">${escapeHtml(s.name)} 
              <span class="badge ${isActive ? 'badge-active' : 'badge-inactive'}">
                ${isActive ? '✓ 使用中' : '未激活'}
              </span>
            </div>
            <div class="source-url">${escapeHtml(s.url)}</div>
          </div>
          <div class="btn-group" style="flex:none;margin-left:1rem;">
            ${!isActive ? `<button class="btn-activate" onclick="activateSource('${escapeJs(s.url)}')">激活</button>` : ''}
            <button class="btn-delete" onclick="deleteSource(${s.id})">删除</button>
          </div>
        </div>
      `;
    }).join('');
  } catch (e) {
    document.getElementById('sourceList').innerHTML = '<p style="color:#dc3545;text-align:center;">加载失败：' + escapeHtml(e.message) + '</p>';
  }
}

async function addSource() {
  const name = document.getElementById('sourceName').value.trim();
  const url = document.getElementById('sourceUrl').value.trim();
  
  if (!url) {
    alert('请输入源地址');
    return;
  }
  
  try {
    const res = await fetch('/api/sources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name || 'Source', url }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    
    document.getElementById('sourceUrl').value = '';
    document.getElementById('sourceName').value = '';
    loadSources();
  } catch (e) {
    alert('添加失败：' + e.message);
  }
}

async function activateSource(url) {
  try {
    const res = await fetch('/api/activate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    if (res.ok) loadSources();
  } catch (e) {
    alert('激活失败：' + e.message);
  }
}

async function deleteSource(id) {
  if (!confirm('确定删除此源？')) return;
  try {
    const res = await fetch('/api/sources/' + id, { method: 'DELETE' });
    if (res.ok) loadSources();
  } catch (e) {
    alert('删除失败：' + e.message);
  }
}

async function importFromGitHub() {
  const input = document.getElementById('githubUrl').value.trim();
  if (!input.includes('github.com')) {
    alert('请输入有效的 GitHub 地址');
    return;
  }
  
  try {
    // 转换 GitHub 地址为 raw 地址
    let rawUrl = input
      .replace('github.com', 'raw.githubusercontent.com')
      .replace('/blob/', '/')
      .replace('/tree/', '/');
    
    // 验证链接
    const testRes = await fetch(rawUrl);
    if (!testRes.ok) throw new Error('无法访问该地址，请检查链接是否正确');
    
    const json = await testRes.json();
    if (!json.spider && !json.sites && !json.home) {
      throw new Error('看起来不像有效的 TVBox 配置文件');
    }
    
    document.getElementById('sourceUrl').value = rawUrl;
    document.getElementById('sourceName').value = 'GitHub Import';
    alert('提取成功！请点击"添加源"按钮保存。');
  } catch (e) {
    alert('提取失败：' + e.message);
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function escapeJs(text) {
  return text.replace(/'/g, "\\'").replace(/"/g, '\\"');
}

// 初始化
loadSources();
