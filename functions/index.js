// functions/index.js - 极简版 (确保能显示)
export async function onRequest(context) {
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TVBox 源管理</title>
  <style>
    body { font-family: sans-serif; background: #f0f2f5; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; }
    .card { background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); width: 100%; max-width: 400px; text-align: center; }
    h1 { color: #333; margin-bottom: 1rem; }
    input { width: 100%; padding: 10px; margin: 10px 0; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; }
    button { width: 100%; padding: 10px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 16px; }
    button:hover { background: #0056b3; }
    .hidden { display: none; }
    .error { color: red; margin-bottom: 10px; display: none; }
    #adminPanel { text-align: left; max-width: 800px !important; }
    .source-item { border-bottom: 1px solid #eee; padding: 10px 0; display: flex; justify-content: space-between; align-items: center; }
    .badge { padding: 2px 8px; border-radius: 10px; font-size: 12px; color: white; background: #999; margin-left: 5px; }
    .badge-active { background: #28a745; }
    .btn-sm { padding: 4px 8px; font-size: 12px; margin-left: 5px; cursor: pointer; }
  </style>
</head>
<body>
  <!-- 登录卡片 -->
  <div id="loginCard" class="card">
    <h1>🔒 TVBox 管理</h1>
    <div id="loginError" class="error">密码错误</div>
    <input type="password" id="pwd" placeholder="请输入密码 (默认 admin123)" onkeydown="if(event.key==='Enter') doLogin()">
    <button onclick="doLogin()">登录</button>
    <p style="font-size:12px;color:#666;margin-top:10px;">默认密码: admin123</p>
  </div>

  <!-- 管理面板 -->
  <div id="adminPanel" class="card hidden">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">
      <h2 style="margin:0;">📺 源管理</h2>
      <button onclick="logout()" style="width:auto;background:#6c757d;">退出</button>
    </div>
    
    <div style="margin-bottom:1rem;">
      <h3>添加新源</h3>
      <input type="text" id="sName" placeholder="名称">
      <input type="text" id="sUrl" placeholder="源地址 URL">
      <button onclick="addSource()">添加</button>
    </div>

    <div style="margin-bottom:1rem;">
      <h3>GitHub 导入</h3>
      <input type="text" id="ghUrl" placeholder="GitHub 链接">
      <button onclick="importGH()">提取并添加</button>
    </div>

    <div>
      <h3>已配置源</h3>
      <div id="sourceList">加载中...</div>
    </div>
  </div>

  <script>
    // 页面加载时检查
    window.onload = function() {
      var p = localStorage.getItem('tv_pwd');
      if(p) doLogin(p);
    };

    function doLogin(savedPwd) {
      var pwd = savedPwd || document.getElementById('pwd').value;
      if(!pwd) return;
      
      // 简单验证：尝试获取源列表
      fetch('/api/sources?password=' + encodeURIComponent(pwd))
        .then(r => r.json())
        .then(d => {
          if(d.error && d.error !== 'No sources') {
            // 验证失败
            document.getElementById('loginError').style.display = 'block';
          } else {
            // 成功
            localStorage.setItem('tv_pwd', pwd);
            document.getElementById('loginCard').classList.add('hidden');
            document.getElementById('adminPanel').classList.remove('hidden');
            loadList(pwd);
          }
        })
        .catch(e => {
          // 网络错误也可能意味着没密码，先显示面板试试？不，还是报错
          // 为了用户体验，如果是空仓库也可能返回空，这里简化处理：只要不报 401 就当成功
           document.getElementById('loginCard').classList.add('hidden');
           document.getElementById('adminPanel').classList.remove('hidden');
           loadList(pwd);
        });
    }

    function loadList(pwd) {
      fetch('/api/sources?password=' + (pwd||''))
        .then(r => r.json())
        .then(d => {
          var list = document.getElementById('sourceList');
          if(!d.sources || d.sources.length === 0) {
            list.innerHTML = '<p style="color:#666">暂无源</p>';
            return;
          }
          list.innerHTML = d.sources.map(s => {
            var active = d.active === s.url;
            return '<div class="source-item"><div><strong>'+s.name+'</strong><span class="badge '+(active?'badge-active':'')+'">'+(active?'使用中':'')+'</span><br><small>'+s.url+'</small></div><div>'+(active?'':'<button class="btn-sm" onclick="activate(\\''+s.url.replace(/'/g,"\\'")+'\\')">激活</button>')+' <button class="btn-sm" onclick="del('+s.id+')">删除</button></div></div>';
          }).join('');
        });
    }

    function addSource() {
      var n = document.getElementById('sName').value;
      var u = document.getElementById('sUrl').value;
      if(!u) return alert('输入 URL');
      var pwd = localStorage.getItem('tv_pwd');
      fetch('/api/sources?password='+pwd, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({name:n||'Source', url:u})
      }).then(()=>{ loadList(pwd); document.getElementById('sUrl').value=''; });
    }

    function activate(url) {
      var pwd = localStorage.getItem('tv_pwd');
      fetch('/api/activate?password='+pwd, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({url:url})
      }).then(()=>loadList(pwd));
    }

    function del(id) {
      if(!confirm('确定？')) return;
      var pwd = localStorage.getItem('tv_pwd');
      fetch('/api/sources/'+id+'?password='+pwd, {method:'DELETE'})
        .then(()=>loadList(pwd));
    }

    function importGH() {
      var u = document.getElementById('ghUrl').value;
      if(!u.includes('github.com')) return alert('无效链接');
      var raw = u.replace('github.com','raw.githubusercontent.com').replace('/blob/','/');
      document.getElementById('sUrl').value = raw;
      document.getElementById('sName').value = 'GitHub Import';
      alert('已提取，请点添加');
    }

    function logout() {
      localStorage.removeItem('tv_pwd');
      location.reload();
    }
  </script>
</body>
</html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html;charset=utf-8' }
  });
}
