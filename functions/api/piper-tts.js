// ── PROXY: /api/piper-tts ─────────────────────────────────────────
// Proxy para Piper TTS local (corre en WSL vía cloudflared tunnel)
// Si no hay tunnel activo, devuelve error claro
// ─────────────────────────────────────────────────────────────────────

// URL del tunnel activo — usa el que está corriendo ahora
// Se actualiza manualmente cuando cambia el tunnel
const PIPER_TUNNEL = 'https://passport-rent-modules-nsw.trycloudflare.com';

export async function onRequest(context) {
  const { request } = context;

  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', ...cors },
    });
  }

  try {
    const body = await request.json();

    // Reenviar al Piper server local vía tunnel
    const resp = await fetch(`${PIPER_TUNNEL}/api/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: body.text,
        voice: 'piper-es',
        reverb: 50,
        echo: 0,
        bass: 30,
      }),
      signal: AbortSignal.timeout(60000), // 60s timeout
    });

    if (!resp.ok) {
      return new Response(JSON.stringify({ error: 'Piper TTS local no disponible — revisa que el servidor local esté activo' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json', ...cors },
      });
    }

    const audioBuffer = await resp.arrayBuffer();
    return new Response(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.byteLength.toString(),
        ...cors,
      },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: 'Piper TTS no disponible: ' + err.message }), {
      status: 503,
      headers: { 'Content-Type': 'application/json', ...cors },
    });
  }
}
