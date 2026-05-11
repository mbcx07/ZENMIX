// ── PROXY: /api/clonevoice/voices ──────────────────────────────────────────
// Lista de voces disponibles
// ───────────────────────────────────────────────────────────────────────────

const VOICES = [
  { id: 'es-MX-DaliaNeural', name: 'Dalia (MX)', gender: 'female', lang: 'es-MX', description: 'Voz femenina mexicana, cálida y calmada — perfecta para hipnosis' },
  { id: 'es-MX-JorgeNeural', name: 'Jorge (MX)', gender: 'male', lang: 'es-MX', description: 'Voz masculina mexicana, profunda y serena — ideal para trance' },
  { id: 'es-ES-ElviraNeural', name: 'Elvira (ES)', gender: 'female', lang: 'es-ES', description: 'Voz española femenina, melodiosa y envolvente' },
  { id: 'en-US-JennyNeural', name: 'Jenny (US)', gender: 'female', lang: 'en-US', description: 'Voz americana femenina, muy natural y versátil' },
  { id: 'en-US-GuyNeural', name: 'Guy (US)', gender: 'male', lang: 'en-US', description: 'Voz americana masculina, profunda y calmada' },
  { id: 'piper-es', name: 'Piper (Local CPU)', gender: 'neutral', lang: 'es', description: '🧠 TTS local en CPU — sin internet, sin límites, gratis' },
];

export async function onRequest(context) {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (context.request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }

  return new Response(JSON.stringify(VOICES), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...cors },
  });
}
