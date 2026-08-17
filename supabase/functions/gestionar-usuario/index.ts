// Edge Function: gestionar-usuario
// CRUD de usuarios vía Auth + tabla usuarios. Solo superadmin.
//
// Deploy:
//   supabase functions deploy gestionar-usuario

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

async function silent(fn) {
  try { await fn; } catch {}
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization') || '';
    if (!authHeader) return json({ error: 'No autorizado' }, 401);

    const supaAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    const jwt = authHeader.replace(/^Bearer\s+/i, '');
    const { data: { user } } = await supaAdmin.auth.getUser(jwt);
    if (!user) return json({ error: 'Sesión inválida' }, 401);

    const { data: caller } = await supaAdmin.from('usuarios').select('es_superadmin').eq('id', user.id).maybeSingle();
    if (!caller?.es_superadmin) return json({ error: 'Requiere superadmin' }, 403);

    const body = await req.json().catch(() => ({}));
    const { action } = body;

    if (action === 'create') {
      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password || '');
      const nombre = String(body.nombre || '').trim();
      const perfil = String(body.perfil || '').trim();
      const nroSocio = body.nroSocio || null;
      const empresaId = body.empresaId;

      if (!email) return json({ error: 'Email obligatorio' }, 400);
      if (!nombre) return json({ error: 'Nombre obligatorio' }, 400);
      if (password.length < 6) return json({ error: 'La contraseña debe tener al menos 6 caracteres' }, 400);
      if (!empresaId) return json({ error: 'Empresa obligatoria' }, 400);

      const { data: authUser, error: authError } = await supaAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (authError) return json({ error: authError.message }, 400);

      const { error: profileError } = await supaAdmin
        .from('usuarios')
        .insert([{
          id: authUser.user.id,
          email,
          nombre,
          perfil,
          nro_socio: nroSocio || null,
          empresa_id: empresaId,
          es_superadmin: false,
        }]);
      if (profileError) {
        await silent(supaAdmin.auth.admin.deleteUser(authUser.user.id));
        return json({ error: profileError.message }, 500);
      }

      return json({ ok: true, userId: authUser.user.id });
    }

    if (action === 'update') {
      const userId = body.userId;
      const nombre = body.nombre;
      const perfil = body.perfil;
      const activo = body.activo;

      if (!userId) return json({ error: 'userId requerido' }, 400);

      const updates = {};
      if (nombre !== undefined) updates.nombre = nombre;
      if (perfil !== undefined) updates.perfil = perfil;
      if (activo !== undefined) updates.activo = activo;

      const { error } = await supaAdmin
        .from('usuarios')
        .update(updates)
        .eq('id', userId);
      if (error) return json({ error: error.message }, 500);

      return json({ ok: true });
    }

    if (action === 'resetPassword') {
      const userId = body.userId;
      const password = String(body.password || '');

      if (!userId) return json({ error: 'userId requerido' }, 400);
      if (password.length < 6) return json({ error: 'La contraseña debe tener al menos 6 caracteres' }, 400);

      const { error } = await supaAdmin.auth.admin.updateUserById(userId, {
        password,
      });
      if (error) return json({ error: error.message }, 500);

      return json({ ok: true });
    }

    if (action === 'delete') {
      const userId = body.userId;
      if (!userId) return json({ error: 'userId requerido' }, 400);

      await silent(supaAdmin.from('usuarios').delete().eq('id', userId));
      await silent(supaAdmin.auth.admin.deleteUser(userId));

      return json({ ok: true });
    }

    return json({ error: 'Acción desconocida: ' + action }, 400);
  } catch (e) {
    return json({ error: 'Error interno: ' + (e?.message ?? String(e)) }, 500);
  }
});
