export async function onRequest(context) {
  return new Response('<h1 style="color:red; font-size:30px;">🎉 SUCCESS! Functions are ALIVE!</h1><p>Time: ' + new Date().toISOString() + '</p>', {
    headers: { 'Content-Type': 'text/html' }
  });
}
