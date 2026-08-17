// Edge Function: agendar-turno
// Pública (la llama /agendar-entrevista sin login), pero corre con
// service_role para poder:
//  - action 'disponibilidad': devolver la config del calendario de la
//    empresa + cuántos turnos hay ocupados por franja (SOLO conteos,
//    nunca nombres — así no se filtra info de otros candidatos a un
//    desconocido llenando el formulario público).
//  - action 'reservar': valida cupo server-side (evita overbooking por
//    dos personas clickeando el mismo slot a la vez), crea el turno, y
//    busca al candidato existente por DNI+empresa para ACTUALIZARLO en
//    vez de duplicarlo (si ya era un precandidato/candidato cargado).
//
// Deploy:
//   supabase functions deploy agendar-turno

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

const DEFAULT_CONFIG = {
  dias_habilitados: [1, 2, 3, 4, 5],
  hora_desde: '09:00',
  hora_hasta: '17:00',
  duracion_min: 20,
  max_por_franja: 2,
};

function getFranjas(cfg) {
  const [hD, mD] = cfg.hora_desde.split(':').map(Number);
  const [hH, mH] = cfg.hora_hasta.split(':').map(Number);
  const out = [];
  let t = hD * 60 + mD;
  const fin = hH * 60 + mH;
  while (t + cfg.duracion_min <= fin) {
    const h = Math.floor(t / 60), m = t % 60;
    out.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    t += cfg.duracion_min;
  }
  return out;
}

const VALID_DNI = /^\d{6,8}$/;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    const body = await req.json().catch(() => ({}));
    const { action, empresaId } = body;
    if (!empresaId) return json({ error: 'Falta empresaId' }, 400);

    const { data: empresa } = await supabase.from('empresas').select('id, activa').eq('id', empresaId).maybeSingle();
    if (!empresa || empresa.activa === false) return json({ error: 'El link no es válido (empresa inexistente o inactiva).' }, 404);

    const { data: cfgRow } = await supabase.from('calendario_config').select('*').eq('empresa_id', empresaId).maybeSingle();
    const cfg = {
      dias_habilitados: cfgRow?.dias_habilitados ?? DEFAULT_CONFIG.dias_habilitados,
      hora_desde: cfgRow?.hora_desde ?? DEFAULT_CONFIG.hora_desde,
      hora_hasta: cfgRow?.hora_hasta ?? DEFAULT_CONFIG.hora_hasta,
      duracion_min: cfgRow?.duracion_min ?? DEFAULT_CONFIG.duracion_min,
      max_por_franja: cfgRow?.max_por_franja ?? DEFAULT_CONFIG.max_por_franja,
    };

    if (action === 'disponibilidad') {
      const dias = Math.min(Math.max(Number(body.dias) || 14, 1), 30);
      const hoy = new Date();
      const desde = hoy.toISOString().slice(0, 10);
      const finD = new Date(hoy);
      finD.setDate(finD.getDate() + dias);
      const hasta = finD.toISOString().slice(0, 10);

      const { data: turnos, error } = await supabase
        .from('turnos')
        .select('fecha, hora, estado')
        .eq('empresa_id', empresaId)
        .gte('fecha', desde)
        .lte('fecha', hasta);
      if (error) return json({ error: error.message }, 500);

      const ocupados = {};
      for (const t of turnos || []) {
        if (t.estado === 'Cancelado') continue;
        const key = `${t.fecha}|${t.hora}`;
        ocupados[key] = (ocupados[key] || 0) + 1;
      }

      return json({ config: cfg, franjas: getFranjas(cfg), ocupados, desde, hasta });
    }

    if (action === 'reservar') {
      const fecha = String(body.fecha || '');
      const hora = String(body.hora || '');
      const nombre = String(body.nombre || '').trim();
      const apellido = String(body.apellido || '').trim();
      const dni = String(body.dni || '').trim();
      const telefono = String(body.telefono || '').trim();
      const email = String(body.email || '').trim();
      const observaciones = String(body.observaciones || '').trim();

      if (!nombre || !apellido || !dni) return json({ error: 'Nombre, apellido y DNI son obligatorios' }, 400);
      if (!VALID_DNI.test(dni)) return json({ error: 'El DNI debe tener entre 6 y 8 dígitos' }, 400);
      if (!fecha || !hora) return json({ error: 'Elegí un día y horario' }, 400);
      const diaSemana = new Date(fecha + 'T00:00:00').getDay();
      if (!(cfg.dias_habilitados || []).includes(diaSemana)) return json({ error: 'Ese día no está habilitado' }, 400);
      if (!getFranjas(cfg).includes(hora)) return json({ error: 'Ese horario no es válido' }, 400);

      const { count, error: errCount } = await supabase
        .from('turnos')
        .select('id_local', { count: 'exact', head: true })
        .eq('empresa_id', empresaId)
        .eq('fecha', fecha)
        .eq('hora', hora)
        .neq('estado', 'Cancelado');
      if (errCount) return json({ error: errCount.message }, 500);
      if ((count || 0) >= cfg.max_por_franja) return json({ error: 'Ese turno ya se llenó, elegí otro horario.' }, 409);

      // Busca al candidato existente por DNI dentro de la empresa: si ya
      // estaba cargado (ej. vino de /postularme como Precandidato), se
      // actualiza en vez de crear un duplicado.
      const { data: candidatoExistente } = await supabase
        .from('candidatos')
        .select('id_local')
        .eq('empresa_id', empresaId)
        .eq('dni', dni)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      let candidatoId = candidatoExistente?.id_local || null;
      if (candidatoId) {
        const updates = { fecha_cita: fecha, hora_cita: hora, estado: 'Citado' };
        if (telefono) updates.telefono = telefono;
        if (email) updates.email = email;
        const { error: errUpd } = await supabase.from('candidatos').update(updates).eq('id_local', candidatoId);
        if (errUpd) return json({ error: errUpd.message }, 500);
      } else {
        candidatoId = crypto.randomUUID();
        const { error: errIns } = await supabase.from('candidatos').insert({
          id_local: candidatoId,
          empresa_id: empresaId,
          nombre,
          apellido,
          dni,
          telefono,
          email,
          obs: observaciones,
          estado: 'Citado',
          fecha_cita: fecha,
          hora_cita: hora,
          fecha: new Date().toISOString(),
          origen: 'agendar-entrevista',
        });
        if (errIns) return json({ error: errIns.message }, 500);
      }

      const { error: errTurno } = await supabase.from('turnos').insert({
        id_local: crypto.randomUUID(),
        empresa_id: empresaId,
        fecha,
        hora,
        estado: 'Pendiente',
        candidato_id: candidatoId,
        nombre: `${apellido}, ${nombre}`,
        observacion: observaciones,
      });
      if (errTurno) return json({ error: errTurno.message }, 500);

      return json({ ok: true });
    }

    return json({ error: 'Acción desconocida: ' + action }, 400);
  } catch (e) {
    return json({ error: 'Error interno: ' + (e?.message ?? String(e)) }, 500);
  }
});
