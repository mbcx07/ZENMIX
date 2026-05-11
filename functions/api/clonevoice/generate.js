# ── PROXY: /api/clonevoice/generate ─────────────────────────────────────────
# Genera audio TTS usando edge-tts (Azure Neural) vía servidor en Render
# ─────────────────────────────────────────────────────────────────────────────

// URL del servidor edge-tts en Render
const TTS_SERVER = 'https://zenmix-tts.onrender.com';

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
    
    // Reenviar al servidor edge-tts
    const resp = await fetch(`${TTS_SERVER}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: body.text,
        voice_id: body.voice_id || 'es-MX-DaliaNeural',
        speed: body.speed || 0.85,
        pitch: body.pitch || 0,
      }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      return new Response(err, {
        status: resp.status,
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
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...cors },
    });
  }
}
