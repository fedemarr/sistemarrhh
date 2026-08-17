// Edge Function: analizar-ia
// Proxy a Gemini para el botón "Analizar con IA" (Psicotécnico/Preocupacional/
// Documentación/Altas). La API key de Gemini vive como secreto del servidor
// (GEMINI_API_KEY) — nunca se manda al navegador, así los usuarios no tienen
// que configurar nada. Solo exige que quien llama esté logueado (cualquier
// perfil), para no dejar la key expuesta a pedidos anónimos.
//
// Deploy:
//   supabase secrets set GEMINI_API_KEY=...
//   supabase functions deploy analizar-ia

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// gemini-2.0-flash fue dado de baja por Google. Modelo vigente: gemini-3.6-flash.
const GEMINI_MODEL = 'gemini-3.6-flash';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization') || '';
    if (!authHeader) return json({ error: 'No autorizado' }, 401);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    const jwt = authHeader.replace(/^Bearer\s+/i, '');
    const { data: { user } } = await supabase.auth.getUser(jwt);
    if (!user) return json({ error: 'Sesión inválida' }, 401);

    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiKey) return json({ error: 'El sistema no tiene configurada la IA todavía (falta GEMINI_API_KEY).' }, 500);

    const body = await req.json().catch(() => ({}));
    const prompt = String(body.prompt || '').trim();
    if (!prompt) return json({ error: 'Falta el prompt' }, 400);

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${geminiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) return json({ error: data?.error?.message || `Error de Gemini: ${res.status}` }, 502);

    const respuesta = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Sin respuesta de la IA.';
    return json({ respuesta });
  } catch (e) {
    return json({ error: 'Error interno: ' + (e?.message ?? String(e)) }, 500);
  }
});
