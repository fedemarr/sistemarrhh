// Competencia Anual — motor de eventos/reglas y resultados por asociado.
// Fuente de verdad: 02_Gestion_Personal.md §2.2.

import { DB } from '../../state.js';
import { supaSync } from '../../shared/supabase.js';
import { showToast } from '../../shared/modal.js';

export const REGLAS_DEFAULT = [
  { reglaCodigo: 'capacitacion_servicio', descripcion: 'Capacitación aprobada en servicio', puntos: 5, activa: true, criterioExcluyente: false },
  { reglaCodigo: 'capacitacion_presencial', descripcion: 'Capacitación aprobada presencial', puntos: 4, activa: true, criterioExcluyente: false },
  { reglaCodigo: 'capacitacion_virtual', descripcion: 'Capacitación aprobada virtual', puntos: 2, activa: true, criterioExcluyente: false },
  { reglaCodigo: 'vacaciones_completadas', descripcion: 'Tomó vacaciones completas del año', puntos: 3, activa: true, criterioExcluyente: false },
  { reglaCodigo: 'asistencia_regular', descripcion: 'Asistencia regular (sin ausencias injustificadas)', puntos: 3, activa: true, criterioExcluyente: false },
  { reglaCodigo: 'descanso_cumplido', descripcion: 'Cumplió los descansos reglamentarios', puntos: 2, activa: true, criterioExcluyente: false },
  { reglaCodigo: 'sancion_leve', descripcion: 'Sancionado por falta leve', puntos: -2, activa: true, criterioExcluyente: false },
  { reglaCodigo: 'sancion_grave', descripcion: 'Sancionado por falta grave', puntos: -4, activa: true, criterioExcluyente: false },
  { reglaCodigo: 'enfermo_prolongado', descripcion: 'Enfermo con más de 90 días', puntos: -3, activa: true, criterioExcluyente: false },
  { reglaCodigo: 'otro', descripcion: 'Otro evento relevante', puntos: 0, activa: true, criterioExcluyente: false },
];

export function reglasActivas() {
  const cfg = DB.reglasCompetencia || [];
  return cfg.length ? cfg.filter((r) => r.activa) : REGLAS_DEFAULT.filter((r) => r.activa);
}

export function reglaPorCodigo(codigo) {
  const cfg = DB.reglasCompetencia || [];
  const regla = cfg.find((r) => r.reglaCodigo === codigo) || REGLAS_DEFAULT.find((r) => r.reglaCodigo === codigo);
  return regla && regla.activa ? regla : null;
}

export function registrarEvento({ reglaCodigo, fecha, protagonista, referenciaExterna, origenModulo, observaciones, generadoPor, nro }) {
  const regla = reglaPorCodigo(reglaCodigo);
  if (!regla) return Promise.resolve(null);
  const evento = {
    id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
    fecha: fecha || new Date().toISOString().slice(0, 10),
    origenModulo: origenModulo || 'manual',
    reglaCodigo,
    protagonista: Number(protagonista),
    referenciaExterna: referenciaExterna || '',
    observaciones: observaciones || '',
    generadoPor: generadoPor || '',
    nro: nro || (DB.legajos || []).find((l) => String(l.nro) === String(protagonista))?.nro || protagonista,
    aprobado: null,
    comentarios: '',
    anulado: false,
  };
  DB.eventosCompetencia.push(evento);
  return supaSync('eventosCompetencia', evento).catch((e) => showToast(e.message, 'err'));
}

export function puntosPorRegla(reglaCodigo) {
  const r = reglaPorCodigo(reglaCodigo);
  return r ? r.puntos : 0;
}

export function totalesPorAsociado(anio) {
  const anioStr = String(anio);
  const mapa = {};
  for (const ev of DB.eventosCompetencia || []) {
    if (ev.anulado) continue;
    const fecha = ev.fecha || '';
    if (!fecha.startsWith(anioStr)) continue;
    const puntos = puntosPorRegla(ev.reglaCodigo);
    mapa[ev.protagonista] = mapa[ev.protagonista] || { protagonista: ev.protagonista, puntos: 0, eventos: [] };
    mapa[ev.protagonista].puntos += puntos;
    mapa[ev.protagonista].eventos.push(ev);
  }
  return Object.values(mapa).sort((a, b) => b.puntos - a.puntos);
}

export function resultadoAnual(protagonista, anio) {
  const totales = totalesPorAsociado(anio).find((t) => t.protagonista === Number(protagonista));
  const puntos = totales?.puntos || 0;
  let conclusion;
  if (puntos >= 8) conclusion = 'Desempeño sobresaliente';
  else if (puntos >= 5) conclusion = 'Desempeño conforme';
  else if (puntos >= 2) conclusion = 'Necesita mejoras';
  else conclusion = 'Desempeño insuficiente';
  return { protagonista: Number(protagonista), anio, puntos, conclusion };
}

export function promediarPuntosAnio(anio) {
  const totales = totalesPorAsociado(anio);
  if (!totales.length) return 0;
  return Math.round((totales.reduce((a, b) => a + b.puntos, 0) / totales.length) * 10) / 10;
}
