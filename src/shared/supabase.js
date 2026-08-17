// Cliente Supabase + persistencia por upsert id_local.
// Fuente de verdad: EXTRACCION_RRHH/05 (5.2, 5.3, 5.6).

import { createClient } from '@supabase/supabase-js';
import { DB, SESSION } from '../state.js';

const ENV_URL = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_SUPABASE_URL : undefined;
const ENV_KEY = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_SUPABASE_ANON_KEY : undefined;

export const SUPABASE_URL = ENV_URL || process?.env?.VITE_SUPABASE_URL || '';
export const SUPABASE_ANON_KEY = ENV_KEY || process?.env?.VITE_SUPABASE_ANON_KEY || '';

let _client = null;

export function hayConfigSupabase() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

export function getClient(override) {
  if (override) return override;
  if (_client) return _client;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Falta configuración de Supabase (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).');
  }
  _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return _client;
}

// Inyección para tests / contexto no-browser.
export function setClient(c) { _client = c; }

// Cliente para formularios públicos (/postularme, /agendar-entrevista).
// A propósito NO reusa getClient(): ese cliente persiste la sesión en
// localStorage, y como estas páginas públicas viven en el mismo origen que
// el panel logueado, si un empleado las abre en la misma pestaña/navegador
// donde tiene sesión iniciada, supabase-js reutilizaría su JWT en vez de
// mandar la request como anónimo -> el insert (sin empresa_id) choca contra
// la política RLS de tenant y tira "row-level security policy" en vez de
// guardarse como postulación anónima.
let _publicClient = null;
export function getPublicClient() {
  if (_publicClient) return _publicClient;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Falta configuración de Supabase (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).');
  }
  _publicClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return _publicClient;
}

// === Mapa clave-JS → tabla Supabase (sección 5.6 + tablas de migración) ===
export const _SM = {
  legajos: 'legajos',
  candidatos: 'candidatos',
  turnos: 'turnos',
  psicos: 'psicos',
  catAltPendientes: 'cat_alt_pendientes',
  preocupacionales: 'preocupacionales',
  documentacionIngreso: 'documentacion_ingreso',
  pedidos: 'pedidos',
  perfilPersonalAtributos: 'perfil_personal_atributos',
  reasignaciones: 'reasignaciones',
  motivosReasignacionCfg: 'motivos_reasignacion',
  aprobadoresReasCfg: 'aprobadores_reasignacion',
  sanciones: 'sanciones',
  capacitaciones: 'capacitaciones',
  tiposCapacitacion: 'tipos_capacitacion',
  instructores: 'instructores',
  metodosEval: 'metodos_evaluacion',
  materialesCapacitacion: 'materiales_capacitacion',
  vacaciones: 'vacaciones',
  motivosVacacionesCfg: 'motivos_vacaciones',
  usuariosVacacionesCfg: 'usuarios_vacaciones',
  descansos: 'descansos',
  descansosConfig: 'descansos_config',
  motivosDescansoCfg: 'motivos_descanso',
  movimientosPuntos: 'movimientos_puntos',
  eventosPuntos: 'eventos_puntos',
  eventosCompetencia: 'eventos_competencia',
  resultadosCompetencia: 'resultados_competencia',
  reglasCompetencia: 'reglas_competencia',
  reglasCompetenciaVersiones: 'reglas_competencia_versiones',
  premiosCompetenciaAnual: 'premios_competencia_anual',
  aniosCompetencia: 'anios_competencia',
  sancionesDisciplinarias: 'sanciones_disciplinarias',
  sancionEventos: 'sancion_eventos',
  sancionDescargos: 'sancion_descargos',
  catalogoInfracciones: 'catalogo_infracciones',
  catalogoInfraccionesVersiones: 'catalogo_infracciones_versiones',
  enfermos: 'enfermos',
  casosEnfermosAccidentes: 'casos_enfermos_accidentes',
  certificadosMedicos: 'certificados_medicos',
  retirosEnfermosPendientes: 'retiros_enfermos_pendientes',
  casoEventosEnfermos: 'caso_eventos_enfermos',
  casosLegales: 'casos_legales',
  novedadesCasoLegal: 'novedades_caso_legal',
  casosLegalesAdjuntos: 'casos_legales_adjuntos',
  estadosLegales: 'estados_legales',
  situacionesLegales: 'situaciones_legales',
  tiposSituacionesLegalesCfg: 'tipos_situaciones_legales',
  uniformes: 'uniformes',
  prendasUniformeCfg: 'prendas_uniforme',
  pruebasUniforme: 'pruebas_uniforme',
  pedidosUniformes: 'pedidos_uniformes',
  pedidoUniformePrendas: 'pedido_uniforme_prendas',
  pedidoUniformeEventos: 'pedido_uniforme_eventos',
  descuentosUniformePendientes: 'descuentos_uniforme_pendientes',
  categoriasBase: 'categorias_base',
  valoresHoraCategoria: 'valores_hora_categoria',
  plusAdicionales: 'plus_adicionales',
  valoresPlus: 'valores_plus',
  categorias: 'categorias',
  retenciones: 'retenciones',
  motivosRetencion: 'motivos_retencion',
  smvm: 'smvm',
  grillasLiq: 'grillas_liq',
  pendientesAuth: 'pendientes_auth',
  historialAuth: 'historial_auth',
  alertasEFT: 'alertas_eft',
  motivosNoFact: 'motivos_no_facturables',
  motivosFueraEFT: 'motivos_fuera_eft',
  parametrosServicio: 'parametros_servicio',
  parametrosValores: 'parametros_valores',
  categoriasSalariales: 'categorias_salariales',
  liqAdmin: 'liq_admin',
  liqAdminHoras: 'liq_admin_horas',
  liqAdminSuplemento: 'liq_admin_suplemento',
  liqAdminPeriodos: 'liq_admin_periodos',
  liqAdminTipo: 'liq_admin_tipo',
  liqAdminAjustes: 'liq_admin_ajustes',
  mantHoras: 'mant_horas_rows',
  mantenimiento: 'mantenimiento',
  retenes: 'retenes',
  retenHoras: 'reten_horas_rows',
  liquidaciones: 'liquidaciones',
  liquidacionesHoras: 'liquidaciones_horas',
  monotributos: 'monotributos',
  monoCambios: 'mono_cambios',
  monoPagosMes: 'mono_pagos_mes',
  historialMono: 'historial_mono',
  paritarias: 'paritarias',
  paritariasCategorias: 'paritarias_categorias',
  feriados: 'feriados',
  descuentos: 'descuentos',
  adelantos: 'adelantos',
  motivosAdelantosCfg: 'motivos_adelantos',
  pedidosAdelantos: 'pedidos_adelantos',
  pedidosAdelantosEventos: 'pedidos_adelantos_eventos',
  descuentosAdelantosPendientes: 'descuentos_adelantos_pendientes',
  planillasAdelantos: 'planillas_adelantos',
  planillasInformales: 'planillas_informales',
  adelantosInformales: 'adelantos_informales',
  prestamos: 'prestamos',
  solicitudesPrestamos: 'solicitudes_prestamos',
  adelantosConfig: 'adelantos_config',
  sugerencias: 'sugerencias',
  adjuntos: 'adjuntos',
  notificaciones: 'notificaciones',
  usuarios: 'usuarios',
  perfiles: 'perfiles',
  empresas: 'empresas',
  logs: 'logs',
  configFormPostulacion: 'config_form_postulacion',
  configFormEntrevista: 'config_form_entrevista',
  comunicaciones: 'comunicaciones',
};

// === Mapeo camelCase ↔ snake_case (explícito + overrides por acrónimos) ===
const _OVERRIDES = {
  horasEFT: 'horas_eft',
  infoEFT: 'info_eft',
  hsEFT: 'hs_eft',
  fueraEFT: 'fuera_eft',
};
const _REVERSE = {};
for (const k of Object.keys(_OVERRIDES)) _REVERSE[_OVERRIDES[k]] = k;

export function _toSnake(key) {
  if (Object.prototype.hasOwnProperty.call(_OVERRIDES, key)) return _OVERRIDES[key];
  return String(key)
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .toLowerCase();
}

export function _toCamel(key) {
  if (Object.prototype.hasOwnProperty.call(_REVERSE, key)) return _REVERSE[key];
  return String(key).replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

export function _toSnakeRow(obj) {
  const out = {};
  for (const k of Object.keys(obj || {})) {
    if (k === 'id' || k === 'id_local') { out.id_local = String(obj.id_local ?? obj.id); continue; }
    out[_toSnake(k)] = obj[k];
  }
  if (out.id_local === undefined) out.id_local = String(obj.id ?? Date.now());
  return out;
}

export function _toCamelRow(row) {
  const out = {};
  for (const k of Object.keys(row || {})) out[_toCamel(k)] = row[k];
  return out;
}

// === Carga inicial: todas las tablas → objeto DB (en paralelo) ===
export async function supaInit() {
  const client = getClient();
  const BATCH = 20;
  const entries = Object.entries(_SM);
  for (let i = 0; i < entries.length; i += BATCH) {
    const batch = entries.slice(i, i + BATCH);
    await Promise.all(batch.map(async ([key, table]) => {
      try {
        const { data, error } = await client.from(table).select('*');
        if (error) {
          console.warn(`supaInit: tabla ${table} → ${error.message}`);
          return;
        }
        DB[key] = (data || []).map(_toCamelRow);
      } catch (e) {
        console.warn(`supaInit: tabla ${table} → ${e.message}`);
      }
    }));
  }
  return DB;
}

// === Upsert por id_local (multitenant: inyecta empresa_id de la sesión) ===
export async function supaSync(dbKey, obj) {
  const table = _SM[dbKey];
  if (!table) throw new Error(`Tabla desconocida para "${dbKey}"`);
  const empresaId = SESSION.currentUser?.empresaId || null;
  if (empresaId && obj.empresaId === undefined && dbKey !== 'empresas') obj.empresaId = empresaId;
  const row = _toSnakeRow(obj);
  const { error } = await getClient().from(table).upsert(row, { onConflict: 'id_local' });
  if (error) throw new Error(`supaSync(${dbKey}): ${error.message}`);
  // Reflejo en memoria
  const arr = DB[dbKey] || (DB[dbKey] = []);
  const idx = arr.findIndex((x) => String(x.id) === String(obj.id));
  if (idx >= 0) arr[idx] = obj;
  else arr.push(obj);
  return obj;
}

export async function supaDel(dbKey, idLocal) {
  const table = _SM[dbKey];
  if (!table) throw new Error(`Tabla desconocida para "${dbKey}"`);
  const { error } = await getClient().from(table).delete().eq('id_local', String(idLocal));
  if (error) throw new Error(`supaDel(${dbKey}): ${error.message}`);
  const arr = DB[dbKey] || [];
  const idx = arr.findIndex((x) => String(x.id) === String(idLocal));
  if (idx >= 0) arr.splice(idx, 1);
}
