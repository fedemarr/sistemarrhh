-- ============================================================================
-- Sistema RRHH — Cooperativa de limpieza — MULTITENANT
-- Esquema + RLS por empresa + Storage + seed para Supabase (PostgreSQL).
-- Todas las tablas de tenant tienen `empresa_id`; el RLS filtra con
-- auth_empresa_id() (empresa del usuario logueado) y los superadmins
-- (usuarios.es_superadmin = true) ven todo.
-- Ejecutar en el SQL Editor de Supabase.
-- ============================================================================

create extension if not exists pgcrypto;

-- ============================================================================
-- 1) TABLAS
-- ============================================================================

-- ---- Empresas (tenants) -----------------------------------------------------
create table if not exists public.empresas (
  id text primary key,
  nombre text not null,
  fecha_alta text,
  activa boolean default true,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.perfiles (
  id_local text primary key, nombre text, "desc" text,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.usuarios (
  id uuid primary key, email text unique, nombre text, perfil text, nro_socio text,
  empresa_id text references public.empresas(id),
  es_superadmin boolean default false,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

-- ============================================================================
-- 2) HELPERS DE TENANT (RLS) — después de public.usuarios
-- ============================================================================

create or replace function public.auth_empresa_id() returns text
language sql stable security definer set search_path = public as $$
  select u.empresa_id from public.usuarios u where u.id = auth.uid();
$$;

create or replace function public.is_superadmin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.usuarios u where u.id = auth.uid() and u.es_superadmin);
$$;

-- ---- Ingreso / selección ----------------------------------------------------
create table if not exists public.candidatos (
  id_local text primary key,
  apellido text, nombre text, dni text, cuit text, fec_nac text, fecha_nacimiento text,
  estado_civil text, genero text, nacionalidad text, telefono text, email text,
  calle text, piso text, zona text, partido text, localidad text,
  disponibilidad_horaria text, disponibilidad text, medio text, nombre_referido text, obs text,
  estado text, creado_por text, fecha_cita text, hora_cita text,
  motivo_baja text, motivo_rechazo text, asistio boolean default false,
  servicio_deseado text, experiencia text, fecha text, origen text,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.turnos (
  id_local text primary key, fecha text, hora text, estado text, candidato_id text,
  nombre text, responsable text, observacion text,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.psicos (
  id_local text primary key, dni text, candidato_id text, nombre text,
  fecha_realizacion text, resultado text, etapas text, estado text, observaciones text,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.cat_alt_pendientes (
  id_local text primary key, dni text, nombre text, candidato_id text, psico_id text,
  estado text, creado_desde text, copia boolean default false, polizas text,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.preocupacionales (
  id_local text primary key, dni text, candidato_id text, nombre text,
  fecha_turno text, prestador text, fecha_resultado text, resultado text, motivo text,
  estado text, observaciones text,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.documentacion_ingreso (
  id_local text primary key, dni text, candidato_id text, nombre text,
  antec_vencimiento text, libreta_aplica boolean default false, libreta_vencimiento text,
  curso_tiene boolean default false, curso_vencimiento text, estado text, anulado boolean default false,
  motivo text, observaciones text,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

-- ---- Legajos / personal -----------------------------------------------------
create table if not exists public.legajos (
  id_local text primary key, nro text, nombre text, dni text, cuit text,
  funcion text, servicio text, supervisor text, sector text,
  ingreso text, estado text, estado_legal text, estado_medico text,
  fecha_baja text, fecha_reincorp text, legajo_anterior_nro text,
  seguro text, localidad text, partido text, codigo_postal text, tel text, mail text,
  direccion text, zona text, fec_nac text, estado_civil text, nac text, genero text,
  banco text, cbu text, calzado text, ambo text, talles_uniforme jsonb,
  periodo_prueba text, fecha_ingreso_prueba text, categoria text,
  obra_social text, obra_social_inicio_tramite text, forma_pago text,
  integracion numeric, polizas text, motivo_baja text,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.perfil_personal_atributos (
  id_local text primary key, puesto text,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

-- ---- Reasignaciones ---------------------------------------------------------
create table if not exists public.reasignaciones (
  id_local text primary key, nro text, nombre text,
  servicio_origen text, servicio_destino text, supervisor_origen text, supervisor_destino text,
  categoria text, motivo text, motivo_detalle text,
  fecha_solicitud text, fecha_efectiva text, estado text, observaciones text, creado_por text,
  aprobado_por_rrhh text, fecha_aprobacion_rrhh text, motivo_rechazo_rrhh text,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.motivos_reasignacion (
  id_local text primary key, nombre text, anulado boolean default false,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.aprobadores_reasignacion (
  id_local text primary key, nombre text, cargo text, anulado boolean default false,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

-- ---- Capacitaciones ---------------------------------------------------------
create table if not exists public.capacitaciones (
  id_local text primary key, nro_socio text, legajo_id_local text, nombre_asociado text,
  tipo text, fecha text, lugar text, servicio text, instructor text, metodo_evaluacion text,
  observaciones text, estado text, resultado text, puntaje numeric, materiales_ids jsonb,
  adjunto_id_local text, anulado boolean default false, editado_por text, editado_en text,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.tipos_capacitacion (
  id_local text primary key, nombre text,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.instructores (
  id_local text primary key, nombre text,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.metodos_evaluacion (
  id_local text primary key, nombre text,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.materiales_capacitacion (
  id_local text primary key, nombre text, tipo_capacitacion text,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

-- ---- Vacaciones / Descansos -------------------------------------------------
create table if not exists public.vacaciones (
  id_local text primary key, nro_socio text, nombre_asociado text, servicio text,
  motivo text, fecha_inicio text, fecha_final text, dias numeric, estado text,
  fechas_tomadas jsonb, fecha_solicitud text, historial jsonb,
  editado_por text, editado_en text, fecha_ultimo_cierre text,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.motivos_vacaciones (
  id_local text primary key, nombre text, anulado boolean default false,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.usuarios_vacaciones (
  id_local text primary key, nombre text, anulado boolean default false,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.descansos (
  id_local text primary key, nro_socio text, nombre_asociado text, servicio text,
  tipo text, fecha text, motivo text, detalle_motivo text, estado text,
  creado_por text, editado_en text,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.descansos_config (
  id_local text primary key, servicio text, dia_semanal text, dia_mensual text, anulado boolean default false,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.motivos_descanso (
  id_local text primary key, nombre text, anulado boolean default false,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

-- ---- Competencia anual ------------------------------------------------------
create table if not exists public.movimientos_puntos (
  id_local text primary key,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.eventos_puntos (
  id_local text primary key,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.eventos_competencia (
  id_local text primary key, fecha text, origen_modulo text, regla_codigo text,
  protagonista numeric, referencia_externa text, observaciones text, generado_por text, nro text,
  aprobado boolean default false, comentarios text, anulado boolean default false,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.resultados_competencia (
  id_local text primary key, protagonista numeric, anio numeric, puntos numeric,
  conclusion text, aprobado_por text, aprobado_en text, plan_mejora text,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.reglas_competencia (
  id_local text primary key, regla_codigo text, descripcion text, puntos numeric,
  activa boolean default true, criterio_excluyente boolean default false,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.reglas_competencia_versiones (
  id_local text primary key,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.premios_competencia_anual (
  id_local text primary key,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.anios_competencia (
  id_local text primary key,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

-- ---- Sanciones --------------------------------------------------------------
create table if not exists public.sanciones (
  id_local text primary key, nro_socio text, nombre_asociado text, servicio text,
  tipo text, motivo text, detalle_motivo text, fecha text, gravedad text, estado text,
  sancionado_por text, descuento_id text, historial jsonb, editado_en text,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.sanciones_disciplinarias (
  id_local text primary key,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.sancion_eventos (
  id_local text primary key,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.sancion_descargos (
  id_local text primary key,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.catalogo_infracciones (
  id_local text primary key,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.catalogo_infracciones_versiones (
  id_local text primary key,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

-- ---- Enfermos / accidentes --------------------------------------------------
create table if not exists public.enfermos (
  id_local text primary key, nro_socio text, nombre_asociado text, servicio text,
  fecha_inicio text, fecha_fin text, dias_aislado numeric, motivo text, detalle_motivo text,
  obra_social text, estado text, notificado boolean default false, editado_en text,
  fecha_control text, fecha_alta text,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.casos_enfermos_accidentes (
  id_local text primary key,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.certificados_medicos (
  id_local text primary key,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.retiros_enfermos_pendientes (
  id_local text primary key,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.caso_eventos_enfermos (
  id_local text primary key,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

-- ---- Legales ----------------------------------------------------------------
create table if not exists public.situaciones_legales (
  id_local text primary key, nro_socio text, nombre_asociado text, servicio text,
  tipo text, fecha_inicio text, fecha_fin text, motivo text, detalle_motivo text,
  estado text, creado_por text, editado_en text,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.tipos_situaciones_legales (
  id_local text primary key, nombre text, anulado boolean default false,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.casos_legales (
  id_local text primary key,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.novedades_caso_legal (
  id_local text primary key,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.casos_legales_adjuntos (
  id_local text primary key,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.estados_legales (
  id_local text primary key,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

-- ---- Uniformes --------------------------------------------------------------
create table if not exists public.uniformes (
  id_local text primary key, nro_socio text, nombre_asociado text, servicio text,
  funcion text, prenda text, talle text, talles jsonb, fecha text, tipo_entrega text,
  proveedor text, notas text, estado text, creado_por text, editado_en text, fecha_entrega text,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.prendas_uniforme (
  id_local text primary key, prenda text, funcion text, talles jsonb, anulado boolean default false,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.pruebas_uniforme (
  id_local text primary key, nro_socio text, nombre_asociado text, fecha text,
  observaciones text, estado text,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.pedidos_uniformes (
  id_local text primary key,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.pedido_uniforme_prendas (
  id_local text primary key,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.pedido_uniforme_eventos (
  id_local text primary key,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.descuentos_uniforme_pendientes (
  id_local text primary key, legajo_id_local text, estado text, motivo_generacion text,
  monto_total numeric, cuotas_cobradas numeric, cuotas_totales numeric,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

-- ---- Liquidación ------------------------------------------------------------
create table if not exists public.categorias_base (
  id_local text primary key,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.valores_hora_categoria (
  id_local text primary key,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.plus_adicionales (
  id_local text primary key,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.valores_plus (
  id_local text primary key,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.categorias (
  id_local text primary key, nombre text, categoria numeric, factor numeric, adicional numeric,
  anulado boolean default false,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.smvm (
  id_local text primary key, vigencia_desde text, valor numeric,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.parametros_valores (
  id_local text primary key, nombre_parametro text, valor numeric, anio numeric, mes numeric, detalle text,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.parametros_servicio (
  id_local text primary key, servicio text, dias_vacaciones numeric, dias_descanso numeric,
  horas_servicio numeric,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.categorias_salariales (
  id_local text primary key,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.liq_admin (
  id_local text primary key, nro_socio text, nombre_asociado text, categoria text,
  anio numeric, mes numeric, fecha_desde text, fecha_hasta text,
  adicionales jsonb, descuentos jsonb, sueldo_bruto numeric, sueldo_neto numeric,
  estado text, editado_por text, editado_en text,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.liq_admin_horas (
  id_local text primary key,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.liq_admin_suplemento (
  id_local text primary key,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.liq_admin_periodos (
  id_local text primary key,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.liq_admin_tipo (
  id_local text primary key,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.liq_admin_ajustes (
  id_local text primary key,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.mant_horas_rows (
  id_local text primary key,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.mantenimiento (
  id_local text primary key,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.retenes (
  id_local text primary key, motivo text, porcentaje numeric, monto_fijo numeric,
  desde text, hasta text, activo boolean default true, anulado boolean default false,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.reten_horas_rows (
  id_local text primary key,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.liquidaciones (
  id_local text primary key, nro_socio text, nombre_asociado text, anio numeric, mes numeric,
  sueldo_bruto numeric, descuentos_total numeric, sueldo_neto numeric,
  estado text, editado_por text, editado_en text, fecha_emision text,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.liquidaciones_horas (
  id_local text primary key, nro_socio text, nombre_asociado text, servicio text, categoria text,
  anio numeric, mes numeric, horas_trabajadas numeric, valor_hora numeric,
  sueldo_bruto numeric, descuentos_total numeric, sueldo_neto numeric,
  observaciones text, estado text, editado_por text, editado_en text, fecha_liquidacion text,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.monotributos (
  id_local text primary key, nro_socio text, nombre_asociado text, categoria text,
  monto numeric, anio numeric, mes numeric, estado text, editado_en text,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.mono_cambios (
  id_local text primary key,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.mono_pagos_mes (
  id_local text primary key,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.historial_mono (
  id_local text primary key,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.paritarias (
  id_local text primary key, acta text, fecha text, salario numeric, aumento_porcentaje numeric,
  vigencia_desde text, vigencia_hasta text, observaciones text, anulado boolean default false,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.paritarias_categorias (
  id_local text primary key,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.feriados (
  id_local text primary key, fecha text, nombre text, tipo text,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.descuentos (
  id_local text primary key, nro_socio text, nombre_asociado text, motivo text, monto numeric,
  vigencia_desde text, vigencia_hasta text, tipo text, estado text, editado_en text,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.retenciones (
  id_local text primary key, dni text, nombre_asociado text, tipo text, entidad text, nro text,
  monto numeric, anio numeric, mes numeric, estado text,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.motivos_retencion (
  id_local text primary key,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.grillas_liq (
  id_local text primary key,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.pendientes_auth (
  id_local text primary key,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.historial_auth (
  id_local text primary key,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.alertas_eft (
  id_local text primary key,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.motivos_no_facturables (
  id_local text primary key,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.motivos_fuera_eft (
  id_local text primary key,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

-- ---- Adelantos / préstamos --------------------------------------------------
create table if not exists public.adelantos (
  id_local text primary key, nro_socio text, nombre_asociado text, servicio text,
  monto numeric, cuotas numeric, monto_cuota numeric, motivo text, detalle_motivo text,
  fecha_pedido text, estado text, historial jsonb, observaciones text,
  aprobado_por_sup text, fecha_aprob_sup text, motivo_rechazo_sup text,
  aprobado_por_fin text, fecha_aprob_fin text, motivo_rechazo_fin text,
  entregado_por text, fecha_entrega text,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.motivos_adelantos (
  id_local text primary key, nombre text, anulado boolean default false,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.pedidos_adelantos (
  id_local text primary key,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.pedidos_adelantos_eventos (
  id_local text primary key,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.descuentos_adelantos_pendientes (
  id_local text primary key,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.planillas_adelantos (
  id_local text primary key, periodo text, estado text, items jsonb,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.planillas_informales (
  id_local text primary key, periodo text, estado text, items jsonb,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.adelantos_informales (
  id_local text primary key,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.prestamos (
  id_local text primary key, nro_socio text, periodo text, monto numeric, monto_total numeric, estado text,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.solicitudes_prestamos (
  id_local text primary key, nro_socio text, monto_solicitado numeric, estado text,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.adelantos_config (
  id_local text primary key, monto_fijo numeric, max_cuotas numeric, tabla_cuotas text, alerta_monto numeric,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

-- ---- Sugerencias / adjuntos / notificaciones / logs -------------------------
create table if not exists public.sugerencias (
  id_local text primary key, fecha text, texto text, categoria text,
  anonimo boolean default false, usuario text, estado text,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.adjuntos (
  id_local text primary key, etapa text, tipo text, ref_id_local text,
  archivo text, nombre_archivo text, vigente boolean default true, subido_por text, subido_en text,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.notificaciones (
  id_local text primary key, tipo text, mensaje text, destinatarios jsonb,
  ref_id text, leida boolean default false, fecha text,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.logs (
  id_local text primary key, fecha text, accion text, usuario text,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

-- ============================================================================
-- 2) TENANT: empresa_id en todas las tablas de tenant + índices
-- ============================================================================

do $$
declare t text;
begin
  for t in
    select tablename from pg_tables
    where schemaname = 'public' and tablename not in ('empresas', 'perfiles')
  loop
    execute format('alter table public.%I add column if not exists empresa_id text', t);
    execute format('create index if not exists %I on public.%I (empresa_id)', 'idx_' || t || '_empresa', t);
  end loop;
end $$;

-- ============================================================================
-- 3) RLS — políticas por tenant
-- ============================================================================

do $$
declare t text;
begin
  for t in
    select tablename from pg_tables
    where schemaname = 'public' and tablename not in ('empresas', 'perfiles', 'usuarios')
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', 'tenant_select_' || t, t);
    execute format('create policy %I on public.%I for select to authenticated using (empresa_id = public.auth_empresa_id() or public.is_superadmin())', 'tenant_select_' || t, t);
    execute format('drop policy if exists %I on public.%I', 'tenant_insert_' || t, t);
    execute format('create policy %I on public.%I for insert to authenticated with check (empresa_id = public.auth_empresa_id() or public.is_superadmin())', 'tenant_insert_' || t, t);
    execute format('drop policy if exists %I on public.%I', 'tenant_update_' || t, t);
    execute format('create policy %I on public.%I for update to authenticated using (empresa_id = public.auth_empresa_id() or public.is_superadmin()) with check (empresa_id = public.auth_empresa_id() or public.is_superadmin())', 'tenant_update_' || t, t);
    execute format('drop policy if exists %I on public.%I', 'tenant_delete_' || t, t);
    execute format('create policy %I on public.%I for delete to authenticated using (empresa_id = public.auth_empresa_id() or public.is_superadmin())', 'tenant_delete_' || t, t);
  end loop;
end $$;

-- usuarios: cada uno lee su fila y las de su empresa; solo superadmin escribe ajenos.
alter table public.usuarios enable row level security;
drop policy if exists "usuarios_select" on public.usuarios;
create policy "usuarios_select" on public.usuarios
  for select to authenticated using (id = auth.uid() or empresa_id = public.auth_empresa_id() or public.is_superadmin());
drop policy if exists "usuarios_insert" on public.usuarios;
create policy "usuarios_insert" on public.usuarios
  for insert to authenticated with check (public.is_superadmin());
drop policy if exists "usuarios_update" on public.usuarios;
create policy "usuarios_update" on public.usuarios
  for update to authenticated using (id = auth.uid() or public.is_superadmin()) with check (public.is_superadmin());
drop policy if exists "usuarios_delete" on public.usuarios;
create policy "usuarios_delete" on public.usuarios
  for delete to authenticated using (public.is_superadmin());

-- perfiles: catálogo global, lectura para todos los autenticados.
alter table public.perfiles enable row level security;
drop policy if exists "perfiles_select" on public.perfiles;
create policy "perfiles_select" on public.perfiles for select to authenticated using (true);

-- empresas: superadmin gestiona; los demás leen solo su propia empresa.
alter table public.empresas enable row level security;
drop policy if exists "empresas_select" on public.empresas;
create policy "empresas_select" on public.empresas
  for select to authenticated using (id = public.auth_empresa_id() or public.is_superadmin());
drop policy if exists "empresas_insert" on public.empresas;
create policy "empresas_insert" on public.empresas
  for insert to authenticated with check (public.is_superadmin());
drop policy if exists "empresas_update" on public.empresas;
create policy "empresas_update" on public.empresas
  for update to authenticated using (public.is_superadmin()) with check (public.is_superadmin());
drop policy if exists "empresas_delete" on public.empresas;
create policy "empresas_delete" on public.empresas
  for delete to authenticated using (public.is_superadmin());

-- Candidatos: inserción anónima (formulario público postularme, sin empresa).
drop policy if exists "anon_insert_candidatos" on public.candidatos;
create policy "anon_insert_candidatos" on public.candidatos
  for insert to anon with check (true);
drop policy if exists "anon_select_candidatos" on public.candidatos;
create policy "anon_select_candidatos" on public.candidatos
  for select to anon using (false);

-- ============================================================================
-- 4) STORAGE — bucket de adjuntos (PDFs)
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('adjuntos', 'adjuntos', false)
on conflict (id) do nothing;

drop policy if exists "adjuntos_auth_read" on storage.objects;
create policy "adjuntos_auth_read" on storage.objects
  for select to authenticated using (bucket_id = 'adjuntos');
drop policy if exists "adjuntos_auth_write" on storage.objects;
create policy "adjuntos_auth_write" on storage.objects
  for insert to authenticated with check (bucket_id = 'adjuntos');
drop policy if exists "adjuntos_auth_update" on storage.objects;
create policy "adjuntos_auth_update" on storage.objects
  for update to authenticated using (bucket_id = 'adjuntos');
drop policy if exists "adjuntos_auth_delete" on storage.objects;
create policy "adjuntos_auth_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'adjuntos');

-- ============================================================================
-- 5) SEED — empresa inicial + usuarios demo + catálogos
-- ============================================================================

-- ---- Empresa inicial (tenant 1) ---------------------------------------------
insert into public.empresas (id, nombre, fecha_alta, activa) values
  ('emp-1', 'Cooperativa de limpieza', '2025-01-01', true)
on conflict (id) do nothing;

-- ---- Perfiles ---------------------------------------------------------------
insert into public.perfiles (id_local, nombre, "desc") values
  ('admin', 'Administrador total', 'Superusuario de la empresa: acceso completo a los módulos de su tenant.'),
  ('rrhh', 'RRHH', 'Todo el sector RRHH: selección, ingreso, personal, liquidación.'),
  ('ops', 'Operaciones', 'Servicios, reasignaciones, sanciones y novedades de personal.'),
  ('fin', 'Finanzas', 'Liquidación, retenciones, monotributo, adelantos.'),
  ('sup', 'Supervisor', 'Su servicio, su equipo, novedades y aprobaciones.'),
  ('asoc', 'Asociado', 'Autoconsulta y trámites personales (adelantos, vacaciones).')
on conflict (id_local) do nothing;

-- ---- Usuarios demo ---------------------------------------------------------
-- IMPORTANTE: los usuarios de auth NO se insertan por SQL (GoTrue rechaza filas
-- con columnas NULL). Crear los usuarios con la Admin API (service_role) y luego
-- insertar sus filas en public.usuarios con el id devuelto por la API.
-- Script de referencia: scripts/seed-demo-users.mjs
-- Credenciales demo: admin@rrhh.cliente.com / Admin123!  (admin superadmin)
--   rrhh@rrhh.cliente.com / Rrhh123! | operaciones@rrhh.cliente.com / Oper123!
--   finanzas@rrhh.cliente.com / Fin123! | supervisor@rrhh.cliente.com / Sup123!
--   asociado@rrhh.cliente.com / Asoc123!

-- ---- Servicios --------------------------------------------------------------
insert into public.parametros_servicio (id_local, servicio, dias_vacaciones, dias_descanso, horas_servicio, empresa_id) values
  ('edificios-a', 'Edificios A', 14, 1, 6, 'emp-1'),
  ('edificios-b', 'Edificios B', 14, 1, 6, 'emp-1'),
  ('colegio', 'Colegio', 21, 1, 6, 'emp-1'),
  ('hospital', 'Hospital', 21, 1, 8, 'emp-1'),
  ('palacio', 'Palacio Municipal', 28, 1, 8, 'emp-1')
on conflict (id_local) do nothing;

-- ---- Categorías salariales y SMVM -------------------------------------------
insert into public.categorias (id_local, nombre, categoria, factor, adicional, anulado, empresa_id) values
  ('c1', 'Categoría 1', 1, 1, 0, false, 'emp-1'),
  ('c2', 'Categoría 2', 2, 1.05, 0, false, 'emp-1'),
  ('c3', 'Categoría 3', 3, 1.1, 0, false, 'emp-1'),
  ('c4', 'Categoría 4', 4, 1.15, 0, false, 'emp-1'),
  ('c5', 'Categoría 5', 5, 1.2, 0, false, 'emp-1'),
  ('c6', 'Categoría 6', 6, 1.3, 0, false, 'emp-1'),
  ('c7', 'Categoría 7', 7, 1.4, 0, false, 'emp-1')
on conflict (id_local) do nothing;

insert into public.smvm (id_local, vigencia_desde, valor, empresa_id) values
  ('smvm-2025', '2025-08-01', 234315.12, 'emp-1')
on conflict (id_local) do nothing;

insert into public.parametros_valores (id_local, nombre_parametro, valor, anio, mes, detalle, empresa_id) values
  ('smvm-2025-8', 'SMVM', 234315.12, 2025, 8, 'Salario mínimo vital y móvil', 'emp-1'),
  ('vc1-2025-8', 'valorCategoria1', 234315.12, 2025, 8, 'Valor base categoría 1', 'emp-1')
on conflict (id_local) do nothing;

-- ---- Catálogos: reasignaciones ----------------------------------------------
insert into public.motivos_reasignacion (id_local, nombre, anulado, empresa_id) values
  ('mr-01', 'Baja del servicio', false, 'emp-1'), ('mr-02', 'Conflicto con cliente', false, 'emp-1'),
  ('mr-03', 'Conflicto con supervisor', false, 'emp-1'), ('mr-04', 'Pedido del asociado', false, 'emp-1'),
  ('mr-05', 'Bajo rendimiento', false, 'emp-1'), ('mr-06', 'Necesidad de otro servicio', false, 'emp-1'),
  ('mr-07', 'Cierre de servicio', false, 'emp-1'), ('mr-08', 'Reducción de personal', false, 'emp-1'),
  ('mr-09', 'Rotación interna', false, 'emp-1'), ('mr-10', 'Vacante en otro servicio', false, 'emp-1'),
  ('mr-11', 'Motivo personal', false, 'emp-1'), ('mr-12', 'Otro', false, 'emp-1')
on conflict (id_local) do nothing;

insert into public.aprobadores_reasignacion (id_local, nombre, cargo, anulado, empresa_id) values
  ('ar-01', 'Gerente de Operaciones', 'Gerente', false, 'emp-1'),
  ('ar-02', 'Gerente de RRHH', 'Gerente', false, 'emp-1')
on conflict (id_local) do nothing;

-- ---- Catálogos: capacitaciones ----------------------------------------------
insert into public.tipos_capacitacion (id_local, nombre, empresa_id) values
  ('tc-01', 'Curso', 'emp-1'), ('tc-02', 'Taller', 'emp-1'), ('tc-03', 'Charla', 'emp-1'), ('tc-04', 'Formación en servicio', 'emp-1')
on conflict (id_local) do nothing;

insert into public.instructores (id_local, nombre, empresa_id) values
  ('in-01', 'Instructor interno', 'emp-1'), ('in-02', 'Instructor externo', 'emp-1')
on conflict (id_local) do nothing;

insert into public.metodos_evaluacion (id_local, nombre, empresa_id) values
  ('me-01', 'Evaluación escrita', 'emp-1'), ('me-02', 'Evaluación práctica', 'emp-1'), ('me-03', 'Observación en servicio', 'emp-1')
on conflict (id_local) do nothing;

-- ---- Catálogos: vacaciones / descansos --------------------------------------
insert into public.motivos_vacaciones (id_local, nombre, anulado, empresa_id) values
  ('mv-01', 'Vacaciones anuales', false, 'emp-1'), ('mv-02', 'Vacaciones fraccionadas', false, 'emp-1')
on conflict (id_local) do nothing;

insert into public.motivos_descanso (id_local, nombre, anulado, empresa_id) values
  ('md-01', 'Descanso semanal', false, 'emp-1'), ('md-02', 'Descanso mensual', false, 'emp-1')
on conflict (id_local) do nothing;

-- ---- Catálogos: legales -----------------------------------------------------
insert into public.tipos_situaciones_legales (id_local, nombre, anulado, empresa_id) values
  ('tl-01', 'Embargo', false, 'emp-1'), ('tl-02', 'Inhibición', false, 'emp-1'), ('tl-03', 'Quiebra', false, 'emp-1'),
  ('tl-04', 'Concursado', false, 'emp-1'), ('tl-05', 'Decreto de embargo', false, 'emp-1'), ('tl-06', 'Otro', false, 'emp-1')
on conflict (id_local) do nothing;

-- ---- Catálogos: adelantos ---------------------------------------------------
insert into public.motivos_adelantos (id_local, nombre, anulado, empresa_id) values
  ('ma-01', 'Anticipo de sueldo', false, 'emp-1'), ('ma-02', 'Gastos médicos', false, 'emp-1'),
  ('ma-03', 'Compra de uniforme', false, 'emp-1'), ('ma-04', 'Emergencia familiar', false, 'emp-1'),
  ('ma-05', 'Otro', false, 'emp-1')
on conflict (id_local) do nothing;

insert into public.adelantos_config (id_local, monto_fijo, max_cuotas, tabla_cuotas, alerta_monto, empresa_id) values
  ('cfg', 30000, 12, '4-6-9-12', 50000, 'emp-1')
on conflict (id_local) do nothing;

-- ---- Catálogos: uniformes ---------------------------------------------------
insert into public.prendas_uniforme (id_local, prenda, funcion, talles, anulado, empresa_id) values
  ('pu-01', 'Rematera', 'Todas', '["S","M","L","XL"]', false, 'emp-1'),
  ('pu-02', 'Pantalón', 'Todas', '["40","42","44","46","48"]', false, 'emp-1'),
  ('pu-03', 'Zapatos de seguridad', 'Todas', '["38","39","40","41","42","43","44","45"]', false, 'emp-1'),
  ('pu-04', 'Chaleco', 'Todas', '["S","M","L","XL"]', false, 'emp-1')
on conflict (id_local) do nothing;

-- ---- Competencia anual: reglas default --------------------------------------
insert into public.reglas_competencia (id_local, regla_codigo, descripcion, puntos, activa, criterio_excluyente, empresa_id) values
  ('rc-01', 'capacitacion_servicio', 'Capacitación aprobada en servicio', 5, true, false, 'emp-1'),
  ('rc-02', 'capacitacion_presencial', 'Capacitación aprobada presencial', 4, true, false, 'emp-1'),
  ('rc-03', 'capacitacion_virtual', 'Capacitación aprobada virtual', 2, true, false, 'emp-1'),
  ('rc-04', 'vacaciones_completadas', 'Tomó vacaciones completas del año', 3, true, false, 'emp-1'),
  ('rc-05', 'asistencia_regular', 'Asistencia regular (sin ausencias injustificadas)', 3, true, false, 'emp-1'),
  ('rc-06', 'descanso_cumplido', 'Cumplió los descansos reglamentarios', 2, true, false, 'emp-1'),
  ('rc-07', 'sancion_leve', 'Sancionado por falta leve', -2, true, false, 'emp-1'),
  ('rc-08', 'sancion_grave', 'Sancionado por falta grave', -4, true, false, 'emp-1'),
  ('rc-09', 'enfermo_prolongado', 'Enfermo con más de 90 días', -3, true, false, 'emp-1'),
  ('rc-10', 'otro', 'Otro evento relevante', 0, true, false, 'emp-1')
on conflict (id_local) do nothing;

-- ---- Feriados (ejemplo) -----------------------------------------------------
insert into public.feriados (id_local, fecha, nombre, tipo, empresa_id) values
  ('fer-2026-01-01', '2026-01-01', 'Año nuevo', 'feriado', 'emp-1'),
  ('fer-2026-05-01', '2026-05-01', 'Día del Trabajador', 'feriado', 'emp-1'),
  ('fer-2026-05-25', '2026-05-25', 'Revolución de Mayo', 'feriado', 'emp-1'),
  ('fer-2026-07-09', '2026-07-09', 'Día de la Independencia', 'feriado', 'emp-1'),
  ('fer-2026-12-25', '2026-12-25', 'Navidad', 'feriado', 'emp-1')
on conflict (id_local) do nothing;

-- ---- Legajos de ejemplo (emp-1) ---------------------------------------------
insert into public.legajos (id_local, nro, nombre, dni, cuit, funcion, servicio, supervisor, ingreso, estado, categoria, cbu, integracion, empresa_id) values
  ('leg-100', '100', 'Juan Pérez', '30111222', '20-30111222-3', 'Personal de limpieza', 'Edificios A', 'Supervisor', '2024-03-15', 'Activo', 'Categoría 1', '0000003100001234567890', 11715.76, 'emp-1'),
  ('leg-101', '101', 'María González', '30999888', '27-30999888-4', 'Personal de limpieza', 'Edificios B', 'Supervisor', '2023-08-01', 'Activo', 'Categoría 2', '0000003100000987654321', 11715.76, 'emp-1')
on conflict (id_local) do nothing;
