// functions/[[path]].js - TVBox Proxy Core
export async function onRequest(context) {
  const { request, env, params } = context;
  const url = new URL(request.url);
  const path = params.path || [];
  const fullPath = "/" + path.join("/");

  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, X-API-Key",
      },
    });
  }

  if (fullPath.startsWith("/api/")) {
    return handleAdminApi(request, env, fullPath);
  }

  let activeSource = "";
  try {
    activeSource = await env.TVBOX_KV.get("active_source");
  } catch (e) {
    activeSource = env.DEFAULT_SOURCE || "";
  }

  if (!activeSource) {
    return new Response(JSON.stringify({ error: "No source configured. Visit / to setup.", hint: "访问 / 配置源地址" }), {
      status: 503,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }

  let targetUrl = activeSource;
  if (fullPath !== "/") {
    if (activeSource.includes("github.com") && !activeSource.includes("raw.githubusercontent.com")) {
      targetUrl = activeSource.replace("github.com", "raw.githubusercontent.com").replace("/blob/", "/");
    } else if (!activeSource.startsWith("http")) {
      targetUrl = activeSource + fullPath;
    }
  }

  try {
    const response = await fetch(targetUrl, {
      method: request.method,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Referer": url.origin,
        "Accept": "application/json",
      },
    });
    const newHeaders = new Headers(response.headers);
    newHeaders.set("Access-Control-Allow-Origin", "*");
    newHeaders.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    return new Response(response.body, { status: response.status, headers: newHeaders });
  } catch (error) {
    return new Response(JSON.stringify({ error: "Proxy error: " + error.message }), {
      status: 502,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
}

async function handleAdminApi(request, env, path) {
  const headers = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" };
  try {
    if (path === "/api/sources" && request.method === "GET") {
      const sources = await env.TVBOX_KV.get("sources", { type: "json" }) || [];
      const active = await env.TVBOX_KV.get("active_source");
      return new Response(JSON.stringify({ sources, active }), { headers });
    }
    if (path === "/api/sources" && request.method === "POST") {
      const { url: sourceUrl, name } = await request.json();
      if (!sourceUrl) return new Response(JSON.stringify({ error: "URL required" }), { status: 400, headers });
      const sources = await env.TVBOX_KV.get("sources", { type: "json" }) || [];
      sources.push({ name: name || "Source", url: sourceUrl, id: Date.now() });
      await env.TVBOX_KV.put("sources", JSON.stringify(sources));
      const active = await env.TVBOX_KV.get("active_source");
      if (!active) await env.TVBOX_KV.put("active_source", sourceUrl);
      return new Response(JSON.stringify({ success: true, sources }), { headers });
    }
    if (path === "/api/activate" && request.method === "POST") {
      const { url: sourceUrl } = await request.json();
      await env.TVBOX_KV.put("active_source", sourceUrl);
      return new Response(JSON.stringify({ success: true, active: sourceUrl }), { headers });
    }
    if (path.startsWith("/api/sources/") && request.method === "DELETE") {
      const id = parseInt(path.split("/").pop());
      const sources = (await env.TVBOX_KV.get("sources", { type: "json" }) || []).filter(s => s.id !== id);
      await env.TVBOX_KV.put("sources", JSON.stringify(sources));
      return new Response(JSON.stringify({ success: true, sources }), { headers });
    }
    return new Response(JSON.stringify({ error: "Not Found" }), { status: 404, headers });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers });
  }
}
