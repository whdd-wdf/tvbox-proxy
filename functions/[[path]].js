// functions/[[path]].js - TVBox Proxy 无密码版 + 预置源
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
  } catch (e) {}

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

// --- 管理界面 HTML (无密码版) ---
function getAdminHTML() {
  return '<!DOCTYPE html>' +
    '<html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">' +
    '<title>TVBox 源管理</title>' +
    '<style>body{font-family:sans-serif;background:#f0f2f5;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0}' +
    '.card{background:#fff;padding:2rem;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,.1);width:100%;max-width:800px;text-align:center}' +
    'h1{color:#333;margin-bottom:1rem}input{width:100%;padding:10px;margin:10px 0;border:1px solid #ddd;border-radius:4px;box-sizing:border-box}' +
    'button{width:auto;padding:10px 20px;background:#007bff;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:16px;margin:5px}' +
    'button:hover{background:#0056b3}.hidden{display:none}.error{color:red;margin-bottom:10px;display:none}' +
    '#adminPanel{text-align:left;max-width:900px!important;width:100%}.source-item{border-bottom:1px solid #eee;padding:15px 10px;display:flex;justify-content:space-between;align-items:center}' +
    '.badge{padding:4px 10px;border-radius:12px;font-size:12px;color:#fff;background:#999;margin-left:8px}.badge-active{background:#28a745}.badge-inactive{background:#e0e0e0}' +
    '.btn-sm{padding:6px 12px;font-size:13px;margin-left:8px;cursor:pointer;border:none;border-radius:4px;color:white}' +
    '.btn-activate{background:#28a745}.btn-delete{background:#dc3545}' +
    '.source-info{text-align:left;flex:1}' +
    '.source-url{color:#666;font-size:13px;margin-top:4px;word-break:break-all}' +
    '.section-title{font-size:18px;font-weight:bold;margin:20px 0 10px;color:#333;border-bottom:2px solid #007bff;padding-bottom:5px;display:inline-block}' +
    '</style></head>' +
    '<body><div id="adminPanel" class="card">' +
    '<h1>📺 TVBox 源管理</h1>' +
    '<p style="color:#666;font-size:14px;">无需密码，直接管理。当前已配置 <span id="count">0</span> 个源。</p>' +
    
    '<div style="margin-bottom:20px;text-align:left;padding:0 20px;">' +
    '<div class="section-title">添加新源</div>' +
    '<div style="display:flex;gap:10px;flex-wrap:wrap;">' +
    '<input type="text" id="sName" placeholder="名称" style="flex:1;min-width:100px;margin:0">' +
    '<input type="text" id="sUrl" placeholder="源地址 URL" style="flex:2;min-width:200px;margin:0">' +
    '<button onclick="addSource()" style="margin:0">添加</button>' +
    '</div></div>' +

    '<div style="margin-bottom:20px;text-align:left;padding:0 20px;">' +
    '<div class="section-title">GitHub 导入</div>' +
    '<div style="display:flex;gap:10px;flex-wrap:wrap;">' +
    '<input type="text" id="ghUrl" placeholder="GitHub 链接" style="flex:1;min-width:200px;margin:0">' +
    '<button onclick="importGH()" style="margin:0">提取并添加</button>' +
    '</div></div>' +

    '<div style="text-align:left;padding:0 20px;">' +
    '<div class="section-title">已配置源</div>' +
    '<div id="sourceList" style="margin-top:10px;">加载中...</div>' +
    '</div>' +
    '</div>' +
    
    '<script>' +
    'window.onload=function(){loadList()};' +
    'function loadList(){fetch(\'/api/sources\').then(function(r){return r.json()}).then(function(d){var list=document.getElementById(\'sourceList\');var countSpan=document.getElementById(\'count\');if(!d.sources||d.sources.length===0){list.innerHTML=\'<p style="color:#666;text-align:center;padding:20px;">暂无源，请在上方添加。</p>\';countSpan.innerText=\'0\';return}countSpan.innerText=d.sources.length;list.innerHTML=d.sources.map(function(s){var active=d.active===s.url;return\'<div class="source-item"><div class="source-info"><strong>\'+s.name+\'</strong><span class="badge \'+(active?\'badge-active\':\'badge-inactive\')+\'">\'+(active?\'✓ 使用中\':\'未激活\')+\'</span><div class="source-url">\'+s.url+\'</div></div><div>\'+(active?\'\':\'<button class="btn-sm btn-activate" onclick="activate(\\\'\\\'\'+s.url.replace(/\'/g,"\\\\\'")+\'\\\'\\\'">激活</button>\')+\' <button class="btn-sm btn-delete" onclick="del(\'+s.id+\')">删除</button></div></div>\'}).join(\'\')})})}' +
    'function addSource(){var n=document.getElementById(\'sName\').value;var u=document.getElementById(\'sUrl\').value;if(!u)return alert(\'请输入源地址\');fetch(\'/api/sources\',{method:\'POST\',headers:{\'Content-Type\':\'application/json\'},body:JSON.stringify({name:n||\'Source\',url:u})}).then(function(){loadList();document.getElementById(\'sUrl\').value=\'\';document.getElementById(\'sName\').value=\'\'})}' +
    'function activate(url){fetch(\'/api/activate\',{method:\'POST\',headers:{\'Content-Type\':\'application/json\'},body:JSON.stringify({url:url})}).then(function(){loadList()})}' +
    'function del(id){if(!confirm(\'确定删除此源？\'))return;fetch(\'/api/sources/\'+id,{method:\'DELETE\'}).then(function(){loadList()})}' +
    'function importGH(){var u=document.getElementById(\'ghUrl\').value;if(!u.includes(\'github.com\'))return alert(\'请输入有效的 GitHub 地址\');var raw=u.replace(\'github.com\',\'raw.githubusercontent.com\').replace(\'/blob\',\'\').replace(\'/tree\',\'\');fetch(raw).then(function(r){if(!r.ok)throw new Error(\'无法访问\');return r.json()}).then(function(json){if(!json.spider&&!json.sites&&!json.home)throw new Error(\'非有效配置文件\');document.getElementById(\'sUrl\').value=raw;document.getElementById(\'sName\').value=\'GitHub Import\';alert(\'提取成功！请点击"添加"按钮。\')}).catch(function(e){alert(\'提取失败：\'+e.message)})}' +
    '</script></body></html>';
}

// --- API 处理逻辑 (无密码验证) ---
function handleAPI(request, env, fullPath) {
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
        // 防止重复添加
        for(var i=0; i<sources.length; i++) {
          if(sources[i].url === sourceUrl) {
             return new Response(JSON.stringify({ error: 'Source already exists' }), { status: 400 });
          }
        }
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
