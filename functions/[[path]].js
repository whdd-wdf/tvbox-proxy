// functions/[[path]].js - 核心转发逻辑 (更新版)
export async function onRequest(context) {
  const { request, env, params } = context;
  const url = new URL(request.url);
  const path = params.path || [];
  const fullPath = '/' + path.join('/');

  // 如果是根路径，让 index.js 处理
  if (fullPath === '/') {
    // 这个文件不会被调用，因为 index.js 会优先匹配
    // 这里只是防止逻辑遗漏
    return new Response(null, { status: 404 });
  }

  // 处理 OPTIONS 预检请求
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
      },
    });
  }

  // 密码验证 (可选，如果设置了 ADMIN_PASSWORD)
  const adminPassword = env.ADMIN_PASSWORD || null;
  const providedPassword = url.searchParams.get('password') || '';
  
  // 如果设置了管理员密码，则所有 /api/ 请求都需要验证
  if (adminPassword && fullPath.startsWith('/api/') && providedPassword !== adminPassword) {
    // 检查 cookie
    const cookie = request.headers.get('Cookie') || '';
    if (!cookie.includes('tvbox_pwd=' + adminPassword)) {
      return new Response(JSON.stringify({ error: 'Unauthorized. Please login first.' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  // 处理管理接口
  if (fullPath.startsWith('/api/')) {
    return handleAdminApi(request, env, fullPath, adminPassword, providedPassword);
  }

  // 获取当前激活的源地址
  let activeSource = '';
  try {
    activeSource = await env.TVBOX_KV.get('active_source');
  } catch (e) {
    activeSource = env.DEFAULT_SOURCE || '';
  }

  if (!activeSource) {
    return new Response(JSON.stringify({ 
      error: 'No active source configured. Visit / to configure.',
      hint: '访问 / 配置源地址'
    }), {
      status: 503,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  // 构建目标 URL
  let targetUrl = activeSource;
  if (fullPath !== '/') {
    if (activeSource.includes('github.com') && !activeSource.includes('raw.githubusercontent.com')) {
      targetUrl = activeSource.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/');
    } else if (!activeSource.startsWith('http')) {
      targetUrl = activeSource + fullPath;
    }
  }

  try {
    const response = await fetch(targetUrl, {
      method: request.method,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': url.origin,
        'Accept': 'application/json',
      },
    });

    const newHeaders = new Headers(response.headers);
    newHeaders.set('Access-Control-Allow-Origin', '*');
    newHeaders.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

    return new Response(response.body, {
      status: response.status,
      headers: newHeaders,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Proxy error: ' + error.message }), {
      status: 502,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
}

async function handleAdminApi(request, env, path, adminPassword, providedPassword) {
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };
  
  // 如果设置了密码，验证之
  if (adminPassword) {
    const url = new URL(request.url);
    const pwd = url.searchParams.get('password') || '';
    const cookie = request.headers.get('Cookie') || '';
    
    if (pwd !== adminPassword && !cookie.includes('tvbox_pwd=' + adminPassword)) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers });
    }
  }

  try {
    if (path === '/api/sources' && request.method === 'GET') {
      const sources = await env.TVBOX_KV.get('sources', { type: 'json' }) || [];
      const active = await env.TVBOX_KV.get('active_source');
      return new Response(JSON.stringify({ sources, active }), { headers });
    }

    if (path === '/api/sources' && request.method === 'POST') {
      const { url: sourceUrl, name } = await request.json();
      if (!sourceUrl) return new Response(JSON.stringify({ error: 'URL required' }), { status: 400, headers });
      const sources = await env.TVBOX_KV.get('sources', { type: 'json' }) || [];
      sources.push({ name: name || 'Source', url: sourceUrl, id: Date.now() });
      await env.TVBOX_KV.put('sources', JSON.stringify(sources));
      const active = await env.TVBOX_KV.get('active_source');
      if (!active) await env.TVBOX_KV.put('active_source', sourceUrl);
      return new Response(JSON.stringify({ success: true, sources }), { headers });
    }

    if (path === '/api/activate' && request.method === 'POST') {
      const { url: sourceUrl } = await request.json();
      await env.TVBOX_KV.put('active_source', sourceUrl);
      return new Response(JSON.stringify({ success: true, active: sourceUrl }), { headers });
    }

    if (path.startsWith('/api/sources/') && request.method === 'DELETE') {
      const id = parseInt(path.split('/').pop());
      const sources = (await env.TVBOX_KV.get('sources', { type: 'json' }) || []).filter(s => s.id !== id);
      await env.TVBOX_KV.put('sources', JSON.stringify(sources));
      return new Response(JSON.stringify({ success: true, sources }), { headers });
    }

    return new Response(JSON.stringify({ error: 'Not Found' }), { status: 404, headers });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers });
  }
}
