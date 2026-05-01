export async function onRequest(context) {
  // 简单的路由判断
  const { request } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  // 如果是根路径，返回管理界面
  if (path === '/' || path === '') {
    return new Response(getHTML(), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }

  // 其他路径返回一个简单的测试响应
  return new Response('TVBox Proxy is running! Path: ' + path, {
    headers: { 'Content-Type': 'text/plain' }
  });
}

function getHTML() {
  return `<!DOCTYPE html>
<html><head><title>TVBox</title></head>
<body style="display:flex;justify-content:center;align-items:center;height:100vh;font-family:sans-serif;">
  <div style="text-align:center;">
    <h1>✅ 部署成功!</h1>
    <p>TVBox Proxy 已就绪</p>
    <p style="color:#666;font-size:12px;">下一步：配置 KV 和添加源</p>
  </div>
</body></html>`;
}
