// functions/[[path]].js - TVBox Proxy 完整版
export async function onRequest(context) {
  var request = context.request;
  var env = context.env;
  var url = new URL(request.url);
  var path = url.pathname;

  // 1. 处理根路径：返回管理界面
  if (path === '/' || path === '') {
    return new Response(getAdminHTML(), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }

  // 2. 处理 API 请求
  if (path.startsWith('/api/')) {
    return handleAPI(request, env, path);
  }

  // 3. 代理请求：转发到配置的 TVBox 源
  var activeSource = '';
  try {
    activeSource = await env.TVBOX_KV.get('active_source');
  } catch (e) {
    // KV 未绑定时的降级处理
    activeSource = '';
  }

  if (!activeSource) {
    return new Response(JSON.stringify({ error: 'No source configured. Visit / to setup.', hint: '访问 / 配置源地址' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  // 构建目标 URL
  var targetUrl = activeSource;
  if (activeSource.includes('github.com') && !activeSource.includes('raw.githubusercontent.com')) {
    targetUrl = activeSource.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/');
  } else if (path !== '/') {
    var base = activeSource.replace(/\/$/, '');
    targetUrl = base + path + url.search;
  }

  try {
    var response = await fetch(targetUrl, {
      method: request.method,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': url.origin,
        'Accept': 'application/json',
      },
    });
    var newHeaders = new Headers(response.headers);
    newHeaders.set('Access-Control-Allow-Origin', '*');
    return new Response(response.body, { status: response.status, headers: newHeaders });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Proxy error: ' + error.message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}

// --- 管理界面 HTML ---
function getAdminHTML() {
  return '<!DOCTYPE html>' +
    '<html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">' +
    '<title>TVBox 源管理</title>' +
    '<style>body{font-family:sans-serif;background:#f0f2f5;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0}' +
    '.card{background:#fff;padding:2rem;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,.1);width:100%;max-width:400px;text-align:center}' +
    'h1{color:#333;margin-bottom:1rem}input{width:100%;padding:10px;margin:10px 0;border:1px solid #ddd;border-radius:4px;box-sizing:border-box}' +
    'button{width:100%;padding:10px;background:#007bff;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:16px}' +
    'button:hover{background:#0056b3}.hidden{display:none}.error{color:red;margin-bottom:10px;display:none}' +
    '#adminPanel{text-align:left;max-width:800px!important}.source-item{border-bottom:1px solid #eee;padding:10px 0;display:flex;justify-content:space-between;align-items:center}' +
    '.badge{padding:2px 8px;border-radius:10px;font-size:12px;color:#fff;background:#999;margin-left:5px}.badge-active{background:#28a745}' +
    '.btn-sm{padding:4px 8px;font-size:12px;margin-left:5px;cursor:pointer}</style></head>' +
    '<body><div id="loginCard" class="card"><h1>🔒 TVBox 管理</h1><div id="loginError" class="error">密码错误</div>' +
    '<input type="password" id="pwd" placeholder="密码 (默认 admin123)" onkeydown="if(event.key===\'Enter\')doLogin()">' +
    '<button onclick="doLogin()">登录</button><p style="font-size:12px;color:#666;margin-top:10px">默认密码：admin123</p></div>' +
    '<div id="adminPanel" class="card hidden"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">' +
    '<h2 style="margin:0">📺 源管理</h2><button onclick="logout()" style="width:auto;background:#6c757d">退出</button></div>' +
    '<div style="margin-bottom:1rem"><h3>添加新源</h3><input type="text" id="sName" placeholder="名称"><input type="text" id="sUrl" placeholder="源地址 URL">' +
    '<button onclick="addSource()">添加</button></div><div style="margin-bottom:1rem"><h3>GitHub 导入</h3>' +
    '<input type="text" id="ghUrl" placeholder="GitHub 链接"><button onclick="importGH()">提取并添加</button></div>' +
    '<div><h3>已配置源</h3><div id="sourceList">加载中...</div></div></div>' +
    '<script>' +
    'window.onload=function(){var p=localStorage.getItem(\'tv_pwd\');if(p)doLogin(p)};' +
    'function doLogin(savedPwd){var pwd=savedPwd||document.getElementById(\'pwd\').value;if(!pwd)return;fetch(\'/api/sources?password=\'+encodeURIComponent(pwd)).then(function(r){return r.json()}).then(function(d){if(d.error&&d.error!==\'No sources\'){document.getElementById(\'loginError\').style.display=\'block\'}else{localStorage.setItem(\'tv_pwd\',pwd);document.getElementById(\'loginCard\').classList.add(\'hidden\');document.getElementById(\'adminPanel\').classList.remove(\'hidden\');loadList(pwd)}}).catch(function(e){document.getElementById(\'loginCard\').classList.add(\'hidden\');document.getElementById(\'adminPanel\').classList.remove(\'hidden\');loadList(pwd)})}' +
    'function loadList(pwd){fetch(\'/api/sources?password=\'+(pwd||\'\')).then(function(r){return r.json()}).then(function(d){var list=document.getElementById(\'sourceList\');if(!d.sources||d.sources.length===0){list.innerHTML=\'<p style="color:#666">暂无源</p>\';return}list.innerHTML=d.sources.map(function(s){var active=d.active===s.url;return\'<div class="source-item"><div><strong>\'+s.name+\'</strong><span class="badge \'+(active?\'badge-active\':\'\')+\'">\'+(active?\'使用中\':\'\')+\'</span><br><small>\'+s.url+\'</small></div><div>\'+(active?\'\':\'<button class="btn-sm" onclick="activate(\\\'\\\'\'+s.url.replace(/\'/g,"\\\\\'")+\'\\\'\\\'">激活</button>\')+\' <button class="btn-sm" onclick="del(\'+s.id+\')">删除</button></div></div>\'}).join(\'\')})}' +
    'function addSource(){var n=document.getElementById(\'sName\').value;var u=document.getElementById(\'sUrl\').value;if(!u)return alert(\'输入 URL\');var pwd=localStorage.getItem(\'tv_pwd\');fetch(\'/api/sources?password=\'+pwd,{method:\'POST\',headers:{\'Content-Type\':\'application/json\'},body:JSON.stringify({name:n||\'Source\',url:u})}).then(function(){loadList(pwd);document.getElementById(\'sUrl\').value=\'\'})}' +
    'function activate(url){var pwd=localStorage.getItem(\'tv_pwd\');fetch(\'/api/activate?password=\'+pwd,{method:\'POST\',headers:{\'Content-Type\':\'application/json\'},body:JSON.stringify({url:url})}).then(function(){loadList(pwd)})}' +
    'function del(id){if(!confirm(\'确定？\'))return;var pwd=localStorage.getItem(\'tv_pwd\');fetch(\'/api/sources/\'+id+\'?password=\'+pwd,{method:\'DELETE\'}).then(function(){loadList(pwd)})}' +
    'function importGH(){var u=document.getElementById(\'ghUrl\').value;if(!u.includes(\'github.com\'))return alert(\'无效链接\');var raw=u.replace(\'github.com\',\'raw.githubusercontent.com\').replace(\'/blob/\',\'/\');document.getElementById(\'sUrl\').value=raw;document.getElementById(\'sName\').value=\'GitHub Import\';alert(\'已提取，请点添加\')}' +
    'function logout(){localStorage.removeItem(\'tv_pwd\');location.reload()}' +
    '</script></body></html>';
}

// --- API 处理逻辑 ---
function handleAPI(request, env, fullPath) {
  var url = new URL(request.url);
  var password = url.searchParams.get('password') || '';
  var adminPassword = env.ADMIN_PASSWORD || 'admin123';

  // 密码验证
  if (password !== adminPassword) {
     return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }

  // GET /api/sources
  if (fullPath === '/api/sources' && request.method === 'GET') {
    return env.TVBOX_KV.get('sources', { type: 'json' }).then(function(sources) {
      return env.TVBOX_KV.get('active_source').then(function(active) {
        return new Response(JSON.stringify({ sources: sources || [], active: active }), { headers: { 'Content-Type': 'application/json' } });
      });
    }).catch(function() {
      return new Response(JSON.stringify({ sources: [], active: null }), { headers: { 'Content-Type': 'application/json' } });
    });
  }

  // POST /api/sources
  if (fullPath === '/api/sources' && request.method === 'POST') {
    return request.json().then(function(body) {
      var sourceUrl = body.url;
      var name = body.name || 'Source';
      if (!sourceUrl) return new Response(JSON.stringify({ error: 'URL required' }), { status: 400 });
      
      return env.TVBOX_KV.get('sources', { type: 'json' }).then(function(sources) {
        sources = sources || [];
        sources.push({ name: name, url: sourceUrl, id: Date.now() });
        return env.TVBOX_KV.put('sources', JSON.stringify(sources)).then(function() {
          return env.TVBOX_KV.get('active_source').then(function(active) {
            if (!active) return env.TVBOX_KV.put('active_source', sourceUrl);
          });
        }).then(function() {
          return env.TVBOX_KV.get('sources', { type: 'json' }).then(function(newSources) {
             return new Response(JSON.stringify({ success: true, sources: newSources }), { headers: { 'Content-Type': 'application/json' } });
          });
        });
      });
    });
  }

  // POST /api/activate
  if (fullPath === '/api/activate' && request.method === 'POST') {
    return request.json().then(function(body) {
      return env.TVBOX_KV.put('active_source', body.url).then(function() {
        return new Response(JSON.stringify({ success: true, active: body.url }), { headers: { 'Content-Type': 'application/json' } });
      });
    });
  }

  // DELETE /api/sources/:id
  if (fullPath.startsWith('/api/sources/')) {
    var id = parseInt(fullPath.split('/').pop());
    return env.TVBOX_KV.get('sources', { type: 'json' }).then(function(sources) {
      sources = (sources || []).filter(function(s) { return s.id !== id; });
      return env.TVBOX_KV.put('sources', JSON.stringify(sources)).then(function() {
        return new Response(JSON.stringify({ success: true, sources: sources }), { headers: { 'Content-Type': 'application/json' } });
      });
    });
  }

  return new Response(JSON.stringify({ error: 'Not Found' }), { status: 404 });
}
