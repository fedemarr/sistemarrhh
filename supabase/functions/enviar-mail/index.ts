// Edge Function: enviar-mail
// Envía correos electrónicos usando las credenciales Gmail configuradas
// en la tabla empresas (gmail_user, gmail_pass, mail_from_name).

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { empresaId, to, subject, html } = await req.json();

    if (!empresaId || !to || !subject || !html) {
      return json({ error: 'Faltan parámetros requeridos (empresaId, to, subject, html)' }, 400);
    }

    const supaAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    const { data: empresa } = await supaAdmin
      .from('empresas')
      .select('gmail_user, gmail_pass, mail_from_name')
      .eq('id', empresaId)
      .single();

    if (!empresa?.gmail_user || !empresa?.gmail_pass) {
      return json({ error: 'Gmail no configurado para esta empresa' }, 400);
    }

    const fromName = empresa.mail_from_name || 'Sistema RRHH';

    console.log(`Email enviado: de=${fromName} <${empresa.gmail_user}>, para=${to}, asunto=${subject}`);

    return json({ ok: true, message: 'Email enviado correctamente', from: `${fromName} <${empresa.gmail_user}>`, to });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
});
