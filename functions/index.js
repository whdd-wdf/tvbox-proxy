// functions/index.js - 首页与管理界面入口
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // 简单的密码验证逻辑 (通过 URL 参数 ?password=xxx 或 Cookie)
  const password = url.searchParams.get('password') || request.headers.get('Cookie)?.split('tvbox_pwd=')?.[1]?.split(';')?.[0];
  const correctPassword = env.ADMIN_PASSWORD || 'admin123'; // 默认密码 admin123

  // 如果未设置密码且是首次访问，引导设置密码
  // 如果已设置密码但未提供或错误，显示登录页
  // 如果密码正确，显示管理面板

  // 读取 HTML 文件
  const html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TVBox 源管理 - 安全登录</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 1rem; }
    .card { background: white; border-radius: 12px; padding: 2rem; width: 100%; max-width: 400px; box-shadow: 0 10px 25px rgba(0,0,0,0.2); text-align: center; }
    h1 { color: #333; margin-bottom: 1.5rem; font-size: 1.5rem; }
    .icon { font-size: 3rem; margin-bottom: 1rem; display: block; }
    input { width: 100%; padding: 0.8rem; border: 2px solid #e0e0e0; border-radius: 6px; margin-bottom: 1rem; font-size: 1rem; text-align: center; }
    input:focus { outline: none; border-color: #667eea; }
    button { width: 100%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; padding: 0.8rem; border-radius: 6px; cursor: pointer; font-size: 1rem; font-weight: 600; transition: transform 0.2s; }
    button:hover { transform: translateY(-2px); }
    .hint { margin-top: 1rem; color: #666; font-size: 0.85rem; }
    .error { color: #dc3545; margin-bottom: 1rem; display: none; }
    /* 管理面板样式 (内联以简化) */
    .admin-panel { display: none; text-align: left; }
    .source-item { display: flex; justify-content: space-between; align-items: center; padding: 1rem; border-bottom: 1px solid #eee; }
    .source-item:last-child { border-bottom: none; }
    .source-info { flex: 1; }
    .source-name { font-weight: 600; color: #333; }
    .source-url { color: #666; font-size: 0.85rem; word-break: break-all; margin-top: 0.2rem; }
    .badge { display: inline-block; padding: 0.2rem 0.6rem; border-radius: 20px; font-size: 0.75rem; font-weight: 600; margin-left: 0.5rem; }
    .badge-active { background: #28a745; color: white; }
    .badge-inactive { background: #e0e0e0; color: #666; }
    .btn-group { display: flex; gap: 0.5rem; margin-left: 1rem; }
    .btn-activate { background: #28a745; padding: 0.4rem 0.8rem; font-size: 0.9rem; }
    .btn-delete { background: #dc3545; padding: 0.4rem 0.8rem; font-size: 0.9rem; }
    .section { margin-bottom: 1.5rem; }
    .section h3 { color: #333; margin-bottom: 0.5rem; font-size: 1.1rem; }
    .hint-text { color: #666; font-size: 0.85rem; margin-bottom: 0.5rem; }
  </style>
</head>
<body>
  <div class="card" id="loginCard">
    <span class="icon">🔒</span>
    <h1>TVBox 源管理</h1>
    <div id="loginError" class="error">密码错误，请重试</div>
    <input type="password" id="passwordInput" placeholder="请输入管理员密码">
    <button onclick="checkPassword()">登录</button>
    <div class="hint">默认密码：<strong>admin123</strong><br>(可在 Cloudflare 环境变量中修改 ADMIN_PASSWORD)</div>
  </div>

  <div class="card admin-panel" id="adminPanel" style="max-width: 900px;">
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem;">
      <h1 style="margin:0;">📺 TVBox 源管理</h1>
      <button onclick="logout()" style="width:auto; background:#6c757d;">退出登录</button>
    </div>
    
    <div class="section">
      <h3>添加新源</h3>
      <input type="text" id="sourceName" placeholder="源名称 (例如：GitHub 精选)">
      <input type="text" id="sourceUrl" placeholder="源地址 (JSON API URL 或 GitHub 链接)">
      <button onclick="addSource()">添加源</button>
    </div>

    <div class="section">
      <h3>从 GitHub 导入</h3>
      <p class="hint-text">输入 GitHub 仓库中的 TVBox 配置文件地址</p>
      <input type="text" id="githubUrl" placeholder="https://github.com/username/repo/blob/main/api.json">
      <button onclick="importFromGitHub()">提取并添加</button>
    </div>

    <div class="section">
      <h3>已配置的源</h3>
      <div id="sourceList"><div style="text-align:center; color:#666; padding:2rem;">加载中...</div></div>
    </div>
  </div>

  <script>
    const DEFAULT_PWD = 'admin123'; // 前端默认值，仅用于演示，实际校验在后端
    
    // 检查 URL 中的密码参数
    const urlParams = new URLSearchParams(window.location.search);
    const pwd = urlParams.get('password');
    
    if (pwd) {
      verifyAndShow(pwd);
    } else {
      // 检查本地存储
      const storedPwd = localStorage.getItem('tvbox_admin_pwd');
      if (storedPwd) {
        verifyAndShow(storedPwd);
      }
    }

    function checkPassword() {
      const input = document.getElementById('passwordInput').value.trim();
      if (!input) return alert('请输入密码');
      verifyAndShow(input);
    }

    async function verifyAndShow(pwd) {
      // 简单验证：尝试获取源列表，如果成功说明密码可能正确（或者未设置密码）
      // 实际生产环境应在后端验证
      try {
        const res = await fetch('/api/sources?password=' + pwd);
        if (res.ok) {
          const data = await res.json();
          if (!data.error) {
            localStorage.setItem('tvbox_admin_pwd', pwd);
            showAdminPanel();
            loadSources(pwd);
            return;
          }
        }
      } catch(e) {}
      
      document.getElementById('loginError').style.display = 'block';
      document.getElementById('passwordInput').value = '';
    }

    function showAdminPanel() {
      document.getElementById('loginCard').style.display = 'none';
      const panel = document.getElementById('adminPanel');
      panel.style.display = 'block';
      // 移除 URL 中的密码参数，保持整洁
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    function logout() {
      localStorage.removeItem('tvbox_admin_pwd');
      location.reload();
    }

    async function loadSources(pwd) {
      const urlPwd = pwd || localStorage.getItem('tvbox_admin_pwd') || '';
      try {
        const res = await fetch('/api/sources?password=' + urlPwd);
        const data = await res.json();
        const list = document.getElementById('sourceList');
        
        if (!data.sources || data.sources.length === 0) {
          list.innerHTML = '<p style="color:#666;text-align:center;padding:2rem;">暂无配置，请添加新源。</p>';
          return;
        }
        
        list.innerHTML = data.sources.map(s => {
          const isActive = data.active === s.url;
          return \`
            <div class="source-item">
              <div class="source-info">
                <div class="source-name">\${escapeHtml(s.name)} 
                  <span class="badge \${isActive ? 'badge-active' : 'badge-inactive'}">
                    \${isActive ? '✓ 使用中' : '未激活'}
                  </span>
                </div>
                <div class="source-url">\${escapeHtml(s.url)}</div>
              </div>
              <div class="btn-group">
                \${!isActive ? '<button class="btn-activate" onclick="activateSource(\\\''+s.url.replace(/'/g, "\\'")+'\\\')">激活</button>' : ''}
                <button class="btn-delete" onclick="deleteSource(\${s.id})">删除</button>
              </div>
            </div>
          \`;
        }).join('');
      } catch (e) {
        document.getElementById('sourceList').innerHTML = '<p style="color:#dc3545;text-align:center;">加载失败</p>';
      }
    }

    async function addSource() {
      const name = document.getElementById('sourceName').value.trim();
      const url = document.getElementById('sourceUrl').value.trim();
      if (!url) return alert('请输入源地址');
      
      const pwd = localStorage.getItem('tvbox_admin_pwd') || '';
      try {
        const res = await fetch('/api/sources?password=' + pwd, {
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
      const pwd = localStorage.getItem('tvbox_admin_pwd') || '';
      try {
        await fetch('/api/activate?password=' + pwd, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url }),
        });
        loadSources();
      } catch (e) {
        alert('激活失败');
      }
    }

    async function deleteSource(id) {
      if (!confirm('确定删除此源？')) return;
      const pwd = localStorage.getItem('tvbox_admin_pwd') || '';
      try {
        await fetch('/api/sources/' + id + '?password=' + pwd, { method: 'DELETE' });
        loadSources();
      } catch (e) {
        alert('删除失败');
      }
    }

    async function importFromGitHub() {
      const input = document.getElementById('githubUrl').value.trim();
      if (!input.includes('github.com')) return alert('请输入有效的 GitHub 地址');
      
      try {
        let rawUrl = input.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/').replace('/tree/', '/');
        const testRes = await fetch(rawUrl);
        if (!testRes.ok) throw new Error('无法访问该地址');
        const json = await testRes.json();
        if (!json.spider && !json.sites && !json.home) throw new Error('不是有效的 TVBox 配置文件');
        
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
  </script>
</body>
</html>
  `;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html;charset=utf-8' },
  });
}
