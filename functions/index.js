export async function onRequest(context) {
  return new Response('<h1>Hello TVBox</h1><p>If you see this, it works!</p>', {
    headers: { 'Content-Type': 'text/html' }
  });
}
