// ── PROXY: /api/clonevoice/generate ─────────────────────────────────────────
// Genera audio TTS desde CloneVoice API (POST)
// ─────────────────────────────────────────────────────────────────────────────

const CLONEVOICE_API_KEY = 'sk_8e2mlFaYTPZqYlOvS4ioTb33LfHmtMfJ';
const CLONEVOICE_API = 'https://voiceclone.cloud/v1';

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
    const resp = await fetch(`${CLONEVOICE_API}/generate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CLONEVOICE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
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
