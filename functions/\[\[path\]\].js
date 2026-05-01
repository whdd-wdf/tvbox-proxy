// functions/index.js - 绝对兼容版 (ES5 风格)
export async function onRequest(context) {
  var html = "<!DOCTYPE html>";
  html += "<html><head><meta charset='utf-8'><title>TVBox</title></head>";
  html += "<body style='font-family:sans-serif;text-align:center;padding:50px;'>";
  html += "<h1>✅ Hello from Cloudflare Pages!</h1>";
  html += "<p>JavaScript is working.</p>";
  html += "<p style='color:#666'>Next step: Add KV and logic.</p>";
  html += "</body></html>";

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" }
  });
}
