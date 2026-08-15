// Edge Function: crear-empresa
// Solo superadmin. Crea la empresa, el usuario admin en Auth, la fila en
// public.usuarios y el seed de catálogos para el nuevo tenant.
//
// Deploy:
//   supabase login
//   supabase link --project-ref ievchflhukdskteiksel
//   supabase functions deploy crear-empresa
//
// La función usa SUPABASE_SERVICE_ROLE_KEY (se inyecta automáticamente).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const VALID_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function seedEmpresa(supabase, empresaId) {
  const fecha = new Date().toISOString();
  const rows = [
    ['categorias', [
      { id: `c1-${empresaId}`, nombre: 'Categoría 1', categoria: 1, factor: 1, adicional: 0, anulado: false },
      { id: `c2-${empresaId}`, nombre: 'Categoría 2', categoria: 2, factor: 1.05, adicional: 0, anulado: false },
      { id: `c3-${empresaId}`, nombre: 'Categoría 3', categoria: 3, factor: 1.1, adicional: 0, anulado: false },
      { id: `c4-${empresaId}`, nombre: 'Categoría 4', categoria: 4, factor: 1.15, adicional: 0, anulado: false },
      { id: `c5-${empresaId}`, nombre: 'Categoría 5', categoria: 5, factor: 1.2, adicional: 0, anulado: false },
      { id: `c6-${empresaId}`, nombre: 'Categoría 6', categoria: 6, factor: 1.3, adicional: 0, anulado: false },
      { id: `c7-${empresaId}`, nombre: 'Categoría 7', categoria: 7, factor: 1.4, adicional: 0, anulado: false },
    ]],
    ['smvm', [
      { id: `smvm-${empresaId}`, vigencia_desde: '2025-08-01', valor: 234315.12 },
    ]],
    ['parametros_valores', [
      { id: `sv-${empresaId}`, nombre_parametro: 'SMVM', valor: 234315.12, anio: 2025, mes: 8, detalle: 'Salario mínimo vital y móvil' },
      { id: `vc-${empresaId}`, nombre_parametro: 'valorCategoria1', valor: 234315.12, anio: 2025, mes: 8, detalle: 'Valor base categoría 1' },
    ]],
    ['motivos_reasignacion', [
      ['Baja del servicio', 'Conflicto con cliente', 'Conflicto con supervisor', 'Pedido del asociado', 'Bajo rendimiento', 'Necesidad de otro servicio', 'Cierre de servicio', 'Reducción de personal', 'Rotación interna', 'Vacante en otro servicio', 'Motivo personal', 'Otro']
        .map((nombre, i) => ({ id: `mr-${i}-${empresaId}`, nombre, anulado: false })),
    ]],
    ['aprobadores_reasignacion', [
      { id: `ar-1-${empresaId}`, nombre: 'Gerente de Operaciones', cargo: 'Gerente', anulado: false },
      { id: `ar-2-${empresaId}`, nombre: 'Gerente de RRHH', cargo: 'Gerente', anulado: false },
    ]],
    ['tipos_capacitacion', ['Curso', 'Taller', 'Charla', 'Formación en servicio'].map((nombre, i) => ({ id: `tc-${i}-${empresaId}`, nombre }))],
    ['instructores', ['Instructor interno', 'Instructor externo'].map((nombre, i) => ({ id: `in-${i}-${empresaId}`, nombre }))],
    ['metodos_evaluacion', ['Evaluación escrita', 'Evaluación práctica', 'Observación en servicio'].map((nombre, i) => ({ id: `me-${i}-${empresaId}`, nombre }))],
    ['motivos_vacaciones', [{ id: `mv-1-${empresaId}`, nombre: 'Vacaciones anuales', anulado: false }, { id: `mv-2-${empresaId}`, nombre: 'Vacaciones fraccionadas', anulado: false }]],
    ['motivos_descanso', [{ id: `md-1-${empresaId}`, nombre: 'Descanso semanal', anulado: false }, { id: `md-2-${empresaId}`, nombre: 'Descanso mensual', anulado: false }]],
    ['tipos_situaciones_legales', ['Embargo', 'Inhibición', 'Quiebra', 'Concursado', 'Decreto de embargo', 'Otro'].map((nombre, i) => ({ id: `tl-${i}-${empresaId}`, nombre, anulado: false }))],
    ['motivos_adelantos', ['Anticipo de sueldo', 'Gastos médicos', 'Compra de uniforme', 'Emergencia familiar', 'Otro'].map((nombre, i) => ({ id: `ma-${i}-${empresaId}`, nombre, anulado: false }))],
    ['adelantos_config', [{ id: `cfg-${empresaId}`, monto_fijo: 30000, max_cuotas: 12, tabla_cuotas: '4-6-9-12', alerta_monto: 50000 }]],
    ['prendas_uniforme', [
      { id: `pu-1-${empresaId}`, prenda: 'Rematera', funcion: 'Todas', talles: ['S', 'M', 'L', 'XL'], anulado: false },
      { id: `pu-2-${empresaId}`, prenda: 'Pantalón', funcion: 'Todas', talles: ['40', '42', '44', '46', '48'], anulado: false },
      { id: `pu-3-${empresaId}`, prenda: 'Zapatos de seguridad', funcion: 'Todas', talles: ['38', '39', '40', '41', '42', '43', '44', '45'], anulado: false },
      { id: `pu-4-${empresaId}`, prenda: 'Chaleco', funcion: 'Todas', talles: ['S', 'M', 'L', 'XL'], anulado: false },
    ]],
    ['reglas_competencia', [
      ['capacitacion_servicio', 'Capacitación aprobada en servicio', 5],
      ['capacitacion_presencial', 'Capacitación aprobada presencial', 4],
      ['capacitacion_virtual', 'Capacitación aprobada virtual', 2],
      ['vacaciones_completadas', 'Tomó vacaciones completas del año', 3],
      ['asistencia_regular', 'Asistencia regular (sin ausencias injustificadas)', 3],
      ['descanso_cumplido', 'Cumplió los descansos reglamentarios', 2],
      ['sancion_leve', 'Sancionado por falta leve', -2],
      ['sancion_grave', 'Sancionado por falta grave', -4],
      ['enfermo_prolongado', 'Enfermo con más de 90 días', -3],
      ['otro', 'Otro evento relevante', 0],
    ].map(([codigo, descripcion, puntos], i) => ({ id: `rc-${i}-${empresaId}`, regla_codigo: codigo, descripcion, puntos, activa: true, criterio_excluyente: false }))],
    ['parametros_servicio', ['Edificios A', 'Edificios B', 'Colegio', 'Hospital', 'Palacio Municipal']
      .map((servicio, i) => ({ id: `serv-${i}-${empresaId}`, servicio, dias_vacaciones: 14, dias_descanso: 1, horas_servicio: 6 }))],
  ];

  for (const [tabla, filas] of rows) {
    const conTenant = filas.map((f) => ({ ...f, empresa_id: empresaId }));
    const { error } = await supabase.from(tabla).insert(conTenant);
    if (error) {
      console.error(`seedEmpresa(${tabla}): ${error.message}`);
      throw error;
    }
  }
  return fecha;
}

Deno.serve(async (req) => {
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

  const { data: caller } = await supabase.from('usuarios').select('*').eq('id', user.id).maybeSingle();
  if (!caller?.es_superadmin) return json({ error: 'Requiere un usuario superadmin' }, 403);

  const body = await req.json().catch(() => ({}));
  const nombre = String(body.nombre || '').trim();
  const nombreAdmin = String(body.nombreAdmin || '').trim();
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');

  if (!nombre) return json({ error: 'El nombre de la empresa es obligatorio' }, 400);
  if (!nombreAdmin) return json({ error: 'El nombre del admin es obligatorio' }, 400);
  if (!VALID_EMAIL.test(email)) return json({ error: 'Email inválido' }, 400);
  if (password.length < 6) return json({ error: 'La contraseña debe tener al menos 6 caracteres' }, 400);

  const empresaId = crypto.randomUUID();

  const { error: errEmpresa } = await supabase.from('empresas').insert({
    id: empresaId,
    nombre,
    fecha_alta: new Date().toISOString(),
    activa: true,
  });
  if (errEmpresa) return json({ error: `No se pudo crear la empresa: ${errEmpresa.message}` }, 500);

  const { data: nuevo, error: errUser } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nombre: nombreAdmin },
  });
  if (errUser) {
    await supabase.from('empresas').delete().eq('id', empresaId).catch(() => {});
    return json({ error: `No se pudo crear el usuario admin: ${errUser.message}` }, 400);
  }

  const { error: errPerfil } = await supabase.from('usuarios').insert({
    id: nuevo.user.id,
    email,
    nombre: nombreAdmin,
    perfil: 'Administrador total',
    nro_socio: null,
    empresa_id: empresaId,
    es_superadmin: false,
  });
  if (errPerfil) {
    await supabase.from('empresas').delete().eq('id', empresaId).catch(() => {});
    await supabase.auth.admin.deleteUser(nuevo.user.id).catch(() => {});
    return json({ error: `No se pudo asignar el perfil: ${errPerfil.message}` }, 500);
  }

  try {
    await seedEmpresa(supabase, empresaId);
  } catch (e) {
    await supabase.from('usuarios').delete().eq('id', nuevo.user.id).catch(() => {});
    await supabase.from('empresas').delete().eq('id', empresaId).catch(() => {});
    await supabase.auth.admin.deleteUser(nuevo.user.id).catch(() => {});
    return json({ error: `No se pudo completar el alta: ${e.message}` }, 500);
  }

  return json({ ok: true, empresaId, nombre, usuario: email });
});
