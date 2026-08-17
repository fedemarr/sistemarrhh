// Estado global mutable DB, perfiles y registro de pantallas.
// Fuente de verdad: EXTRACCION_RRHH/05 (5.2, 5.5).

export const APP = {
  nombre: 'Gestia',
  subnombre: 'Gestión de personal y liquidación de sueldos',
  cliente: 'Cooperativa de limpieza',
};

export const DB = {};

// Sesión global (multitenant): currentUser lleva empresaId + esSuperadmin.
export const SESSION = { currentUser: null };

export const _KEYS = [
  'pedidos', 'candidatos', 'turnos', 'psicos', 'catAltPendientes', 'preocupacionales', 'documentacionIngreso',
  'legajos', 'reasignaciones', 'perfilPersonalAtributos', 'motivosReasignacionCfg', 'aprobadoresReasCfg',
  'capacitaciones', 'tiposCapacitacion', 'instructores', 'metodosEval', 'materialesCapacitacion',
  'vacaciones', 'motivosVacacionesCfg', 'usuariosVacacionesCfg', 'descansos', 'descansosConfig', 'motivosDescansoCfg',
  'movimientosPuntos', 'eventosPuntos', 'eventosCompetencia', 'resultadosCompetencia', 'reglasCompetencia',
  'reglasCompetenciaVersiones', 'premiosCompetenciaAnual', 'aniosCompetencia',
  'sancionesDisciplinarias', 'sancionEventos', 'sancionDescargos', 'catalogoInfracciones', 'catalogoInfraccionesVersiones',
  'sanciones', 'casosEnfermosAccidentes', 'certificadosMedicos', 'retirosEnfermosPendientes', 'casoEventosEnfermos', 'enfermos',
  'casosLegales', 'novedadesCasoLegal', 'casosLegalesAdjuntos', 'estadosLegales', 'situacionesLegales', 'tiposSituacionesLegalesCfg',
  'uniformes', 'prendasUniformeCfg', 'pruebasUniforme', 'pedidosUniformes', 'pedidoUniformePrendas', 'pedidoUniformeEventos', 'descuentosUniformePendientes',
  'categoriasBase', 'valoresHoraCategoria', 'plusAdicionales', 'valoresPlus', 'categorias',
  'retenciones', 'motivosRetencion', 'smvm', 'grillasLiq', 'pendientesAuth', 'historialAuth', 'alertasEFT',
  'motivosNoFact', 'motivosFueraEFT', 'parametrosServicio', 'parametrosValores', 'categoriasSalariales',
  'liqAdmin', 'liqAdminHoras', 'liqAdminSuplemento', 'liqAdminPeriodos', 'liqAdminTipo', 'liqAdminAjustes',
  'mantHoras', 'mantenimiento', 'retenes', 'retenHoras', 'liquidaciones', 'liquidacionesHoras',
  'monotributos', 'monoCambios', 'monoPagosMes', 'historialMono',
  'paritarias', 'paritariasCategorias', 'feriados', 'descuentos',
  'adelantos', 'pedidosAdelantos', 'pedidosAdelantosEventos', 'descuentosAdelantosPendientes', 'motivosAdelantosCfg',
  'planillasAdelantos', 'planillasInformales', 'adelantosInformales', 'prestamos', 'solicitudesPrestamos', 'adelantosConfig',
  'sugerencias', 'adjuntos', 'notificaciones', 'usuarios', 'perfiles', 'empresas', 'logs',
  'configFormPostulacion', 'configFormEntrevista', 'comunicaciones',
];

export function initDB() {
  for (const k of _KEYS) DB[k] = [];
  DB.adelantosConfig = [{ id: 'cfg', montoFijo: 30000, maxCuotas: 12, tablaCuotas: '4-6-9-12', alertaMonto: 50000 }];
  return DB;
}

// === Perfiles y menú por perfil ===
export const PERFILES = {
  // Nota: este perfil lo usan dos tipos de cuenta distintos:
  //  1) el superadmin de la plataforma (esSuperadmin=true) — el menú de
  //     Administración se le arma aparte en construirMenu(), ignorando esta lista.
  //  2) el admin de cada empresa (esSuperadmin=false, creado por la Edge
  //     Function crear-empresa) — a este sí se le aplican estos módulos, y
  //     debe ver todo el sistema dentro de su empresa.
  'Administrador total': {
    modulos: [
      'pedidos', 'candidatos', 'psicotecnico', 'preocupacional', 'documentacion', 'altas', 'legajos', 'reasignaciones',
      'capacitaciones', 'vacaciones', 'descansos', 'competencia', 'sanciones', 'enfermos', 'legales', 'uniformes',
      'categorias', 'smvm', 'liquidacion_horas', 'liq_admin', 'mantenimiento', 'retenes', 'liquidaciones',
      'monotributos', 'retenciones', 'descuentos', 'paritarias', 'feriados',
      'pedidos_adelantos', 'gestion_adelantos', 'sugerencias', 'comunicaciones',
      'config_form_postulacion', 'config_form_entrevista', 'usuarios_empresa',
    ],
    desc: 'Admin de empresa: acceso total a los módulos de su empresa (selección, personal, liquidación, adelantos, configuración).',
  },
  RRHH: {
    modulos: [
      'pedidos', 'candidatos', 'psicotecnico', 'preocupacional', 'documentacion', 'altas', 'legajos', 'reasignaciones',
      'capacitaciones', 'vacaciones', 'descansos', 'competencia', 'sanciones', 'enfermos', 'legales', 'uniformes',
      'categorias', 'smvm', 'liquidacion_horas', 'liq_admin', 'mantenimiento', 'retenes', 'liquidaciones',
      'monotributos', 'retenciones', 'descuentos', 'paritarias', 'feriados',
      'pedidos_adelantos', 'gestion_adelantos', 'sugerencias', 'comunicaciones',
    ],
    desc: 'Todo el sector RRHH: selección, ingreso, personal, liquidación.',
  },
  Operaciones: {
    modulos: [
      'pedidos', 'legajos', 'descansos', 'reasignaciones', 'enfermos', 'competencia',
      'categorias', 'liquidacion_horas', 'mantenimiento', 'retenes', 'paritarias', 'feriados', 'sugerencias',
    ],
    desc: 'Pedidos, descansos (aprobación 1), liquidación de horas, retenes, mantenimiento.',
  },
  Finanzas: {
    modulos: [
      'legajos', 'smvm', 'categorias', 'liquidacion_horas', 'liq_admin', 'mantenimiento', 'retenes', 'liquidaciones',
      'monotributos', 'retenciones', 'descuentos', 'paritarias', 'feriados',
      'pedidos_adelantos', 'gestion_adelantos', 'sugerencias',
    ],
    desc: 'Legajos (parcial), liquidaciones, retenciones, descuentos, adelantos (aprobación final).',
  },
  Supervisor: {
    modulos: [
      'pedidos', 'descansos', 'legajos', 'competencia', 'reasignaciones', 'uniformes', 'retenes', 'liquidacion_horas',
      'pedidos_adelantos', 'sugerencias',
    ],
    desc: 'Pedidos de personal, descansos y adelantos (solicitud), uniformes (entrega), sus grillas.',
  },
  Asociado: {
    modulos: ['mis_adelantos', 'sugerencias', 'comunicaciones'],
    desc: 'Portal del asociado: mis adelantos y buzón de sugerencias.',
  },
};

// === Registro de pantallas (cada módulo agrega su screenConfig) ===
export const SCREEN_CONFIG = {};

export function registerScreens(configs) {
  for (const cfg of configs) Object.assign(SCREEN_CONFIG, cfg);
}
