// functions/[[path]].js - 纯净版：无后台，直接作为 TVBox 接口
// 配置方式：在 Cloudflare 后台设置环境变量 DEFAULT_SOURCE
export async function onRequest(context) {
  var request = context.request;
  var env = context.env;
  var url = new URL(request.url);
  var path = url.pathname;

  // 1. 获取激活的源 (优先 KV，其次环境变量)
  var activeSource = '';
  try { activeSource = await env.TVBOX_KV.get('active_source'); } catch (e) {}
  if (!activeSource) { activeSource = env.DEFAULT_SOURCE || ''; }

  if (!activeSource) {
    return new Response(JSON.stringify({ error: 'No source. Set DEFAULT_SOURCE env.' }), { 
      status: 503, headers: { 'Content-Type': 'application/json' } 
    });
  }

  // 2. 处理 GitHub 链接转换
  var targetUrl = activeSource;
  if (activeSource.includes('github.com') && !activeSource.includes('raw.githubusercontent.com')) {
    targetUrl = activeSource.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/');
  }

  // 3. 核心转发逻辑
  // 访问 / 或 /api.json 返回配置，其他路径转发
  var isRoot = (path === '/' || path === '' || path === '/api.json');
  
  if (isRoot) {
    try {
      var res = await fetch(targetUrl, { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' } });
      var data = await res.json();
      var newHeaders = new Headers(res.headers);
      newHeaders.set('Access-Control-Allow-Origin', '*');
      newHeaders.set('Content-Type', 'application/json');
      return new Response(JSON.stringify(data), { headers: newHeaders });
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Fetch failed: ' + e.message }), { status: 502, headers: { 'Content-Type': 'application/json' } });
    }
  }

  // 转发其他请求
  var finalUrl = targetUrl;
  if (path !== '/' && path !== '/api.json') {
     var base = targetUrl.substring(0, targetUrl.lastIndexOf('/') + 1);
     finalUrl = base + path.replace(/^\//, ''); 
  }

  try {
    var response = await fetch(finalUrl, { method: request.method, headers: { 'User-Agent': 'Mozilla/5.0' } });
    var newHeaders = new Headers(response.headers);
    newHeaders.set('Access-Control-Allow-Origin', '*');
    return new Response(response.body, { status: response.status, headers: newHeaders });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Proxy error' }), { status: 502, headers: { 'Content-Type': 'application/json' } });
  }
}
