export async function onRequest(context) {
  var html = "<!DOCTYPE html>";
  html += "<html><head><meta charset='utf-8'><title>TVBox Test</title></head>";
  html += "<body style='font-family:sans-serif; text-align:center; padding:50px;'>";
  html += "<h1 style='color:green'>✅ SUCCESS!</h1>";
  html += "<p>Cloudflare Pages Functions is working!</p>";
  html += "<p>Time: " + new Date().toISOString() + "</p>";
  html += "</body></html>";
  return new Response(html, { headers: { "Content-Type": "text/html" } });
}
