// ── PROXY: /api/clonevoice/voices ──────────────────────────────────────────
// Lista de voces disponibles para hipnosis
// ───────────────────────────────────────────────────────────────────────────

export async function onRequest(context) {
  const { request } = context;

  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }

  const voices = [
    { id: 'es-MX-DaliaNeural', name: 'Dalia (MX)', gender: 'female', lang: 'es-MX', description: 'Voz femenina mexicana, cálida y calmada — perfecta para hipnosis' },
    { id: 'es-MX-JorgeNeural', name: 'Jorge (MX)', gender: 'male', lang: 'es-MX', description: 'Voz masculina mexicana, profunda y serena — ideal para trance' },
    { id: 'es-ES-ElviraNeural', name: 'Elvira (ES)', gender: 'female', lang: 'es-ES', description: 'Voz española femenina, melodiosa y envolvente' },
    { id: 'en-US-JoannaNeural', name: 'Joanna (US)', gender: 'female', lang: 'en-US', description: 'AWS Polly Joanna — la mejor voz neural para bilingüe' },
    { id: 'en-US-MatthewNeural', name: 'Matthew (US)', gender: 'male', lang: 'en-US', description: 'AWS Polly Matthew — profunda, calmada, autoritaria' },
    { id: 'es-US-LupeNeural', name: 'Lupe (US Latam)', gender: 'female', lang: 'es-US', description: 'Voz latina femenina, cálida y natural' },
  ];

  return new Response(JSON.stringify(voices), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...cors },
  });
}
