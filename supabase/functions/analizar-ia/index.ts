// Edge Function: analizar-ia
// Proxy a Gemini para el botón "Analizar con IA" (Psicotécnico/Preocupacional/
// Documentación). Le manda a Gemini el PDF/imagen REAL que se subió como
// adjunto (no solo un resumen en texto de los campos del formulario), así el
// análisis sale del contenido real del documento: fecha que figura, resultado
// real (apto/no apto), etc. — nunca inventado.
//
// La API key de Gemini vive como secreto del servidor (GEMINI_API_KEY) y el
// archivo se baja del bucket privado 'adjuntos' con service_role: ninguno de
// los dos llega al navegador.
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
const BUCKET = 'adjuntos';

function bufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  const chunk = 8192;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

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

    const { data: caller } = await supabase.from('usuarios').select('empresa_id, es_superadmin').eq('id', user.id).maybeSingle();
    if (!caller) return json({ error: 'Usuario sin perfil' }, 403);

    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiKey) return json({ error: 'El sistema no tiene configurada la IA todavía (falta GEMINI_API_KEY).' }, 500);

    const body = await req.json().catch(() => ({}));
    const prompt = String(body.prompt || '').trim();
    const { etapa, tipo, refIdLocal } = body;
    if (!prompt) return json({ error: 'Falta el prompt' }, 400);
    if (!etapa || !tipo || !refIdLocal) return json({ error: 'Falta indicar qué adjunto analizar (etapa/tipo/refIdLocal)' }, 400);

    // Busca el adjunto vigente para ese etapa+tipo+refIdLocal, y valida que
    // sea de la misma empresa que el que llama (o que sea superadmin) —
    // este handler corre con service_role y se salta las RLS, así que el
    // control de tenant hay que hacerlo acá.
    const { data: adjunto, error: errAdj } = await supabase
      .from('adjuntos')
      .select('archivo, nombre_archivo, empresa_id')
      .eq('etapa', etapa)
      .eq('tipo', tipo)
      .eq('ref_id_local', String(refIdLocal))
      .eq('vigente', true)
      .maybeSingle();
    if (errAdj) return json({ error: errAdj.message }, 500);
    if (!adjunto) return json({ error: 'No hay ningún archivo subido todavía para analizar. Subí el PDF primero.' }, 404);
    if (!caller.es_superadmin && String(adjunto.empresa_id) !== String(caller.empresa_id)) {
      return json({ error: 'No autorizado sobre este adjunto' }, 403);
    }

    const { data: fileBlob, error: errDown } = await supabase.storage.from(BUCKET).download(adjunto.archivo);
    if (errDown || !fileBlob) return json({ error: 'No se pudo descargar el adjunto: ' + (errDown?.message || 'archivo no encontrado') }, 500);

    const mimeType = fileBlob.type || (adjunto.nombre_archivo?.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream');
    const base64 = bufferToBase64(await fileBlob.arrayBuffer());

    const geminiBody = JSON.stringify({
      contents: [{
        parts: [
          { text: prompt },
          { inlineData: { mimeType, data: base64 } },
        ],
      }],
    });

    // Documentos más largos hacen que el modelo "piense" más y de vez en
    // cuando Google devuelve 503 ("modelo con alta demanda, temporal") —
    // reintenta un par de veces con backoff antes de darse por vencido.
    let res, data;
    const intentos = [0, 2000];
    for (let i = 0; i < intentos.length; i++) {
      if (intentos[i]) await new Promise((r) => setTimeout(r, intentos[i]));
      res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${geminiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: geminiBody,
      });
      data = await res.json().catch(() => null);
      if (res.ok) break;
      const reintentable = res.status === 503 || res.status === 429;
      if (!reintentable || i === intentos.length - 1) break;
    }
    if (!res.ok) {
      const msg = data?.error?.message || `Error de Gemini: ${res.status}`;
      const sugerencia = (res.status === 503 || res.status === 429) ? ' Probá de nuevo en un momento.' : '';
      return json({ error: msg + sugerencia }, 502);
    }

    const respuesta = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Sin respuesta de la IA.';
    return json({ respuesta, archivoAnalizado: adjunto.nombre_archivo });
  } catch (e) {
    return json({ error: 'Error interno: ' + (e?.message ?? String(e)) }, 500);
  }
});
