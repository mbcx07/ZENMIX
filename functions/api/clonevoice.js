// ── Proxy Cloudflare Pages Function ─────────────────────────────────────────
// Oculta la API key de CloneVoice del frontend
// Las Pages Functions corren en el mismo dominio, sin CORS issues
// ────────────────────────────────────────────────────────────────────────────

const CLONEVOICE_API_KEY = 'sk_8e2mlFaYTPZqYlOvS4ioTb33LfHmtMfJ';
const CLONEVOICE_API = 'https://voiceclone.cloud/v1';

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const path = url.pathname.replace('/api/clonevoice/', '');

  const headers = {
    'Authorization': `Bearer ${CLONEVOICE_API_KEY}`,
    'Content-Type': 'application/json',
  };

  const origin = request.headers.get('origin') || '*';

  const proxyHeaders = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  // OPTIONS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: proxyHeaders,
    });
  }

  try {
    if (path === 'voices') {
      const resp = await fetch(`${CLONEVOICE_API}/voices`, { headers });
      const data = await resp.json();
      return new Response(JSON.stringify(data), {
        status: resp.status,
        headers: { 'Content-Type': 'application/json', ...proxyHeaders },
      });
    }

    if (path === 'generate') {
      const body = await request.json();
      const resp = await fetch(`${CLONEVOICE_API}/generate`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      if (!resp.ok) {
        const err = await resp.text();
        return new Response(JSON.stringify({ error: err }), {
          status: resp.status,
          headers: { 'Content-Type': 'application/json', ...proxyHeaders },
        });
      }

      const audioBuffer = await resp.arrayBuffer();
      return new Response(audioBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'audio/mpeg',
          'Content-Length': audioBuffer.byteLength.toString(),
          ...proxyHeaders,
        },
      });
    }

    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json', ...proxyHeaders },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...proxyHeaders },
    });
  }
}
