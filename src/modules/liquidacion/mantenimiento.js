// Mantenimiento — estadísticas, backup, limpieza y logs.
// Fuente de verdad: 03_Liquidacion.md §3.12.

import { DB } from '../../state.js';
import { supaSync } from '../../shared/supabase.js';
import { showToast } from '../../shared/modal.js';
import { esc, fechaISOToDisplay } from '../../shared/helpers.js';

const TABLAS_CONTEO = ['legajos', 'pedidos', 'candidatos', 'psicotecnicos', 'preocupacionales', 'documentacionIngreso', 'altas', 'capacitaciones', 'vacaciones', 'descansos', 'sanciones', 'enfermos', 'situacionesLegales', 'uniformes', 'reasignaciones', 'adelantos', 'liquidacionesHoras', 'liquidaciones'];

export function renderMantenimiento() {
  const cont = document.getElementById('screen-mantenimiento');
  const stats = TABLAS_CONTEO.map((t) => {
    const arr = DB[t] || [];
    const anulados = arr.filter((x) => x.anulado || x.estado === 'Anulado').length;
    return { tabla: t, total: arr.length, anulados };
  });
  cont.innerHTML = `
    <div class="toolbar">
      <div class="spacer"></div>
      <button class="btn" onclick="exportarBackupJSON()">Exportar backup JSON</button>
      <button class="btn btn-secondary" onclick="limpiarRegistrosAnulados()">Limpiar registros anulados</button>
    </div>
    <div class="tabs">
      ${[['estadisticas', 'Estadísticas'], ['logs', `Logs (${(DB.logs || []).length})`]]
        .map(([k, l], i) => `<button class="tab-btn ${i === 0 ? 'active' : ''}" onclick="renderMantenimientoTab('${k}')">${l}</button>`).join('')}
    </div>
    <div id="mantenimiento-contenido"></div>`;
  renderMantenimientoTab('estadisticas');
  cont.dataset.stats = JSON.stringify(stats);
}

export function renderMantenimientoTab(tab) {
  const panel = document.getElementById('mantenimiento-contenido');
  if (!panel) return;
  if (tab === 'logs') {
    panel.innerHTML = `<div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>Fecha</th><th>Acción</th><th>Usuario</th></tr></thead>
      <tbody>${(DB.logs || []).slice().reverse().map((l) => `<tr><td>${esc(fechaISOToDisplay(l.fecha))}</td><td>${esc(l.accion || '')}</td><td>${esc(l.usuario || '')}</td></tr>`).join('') || '<tr><td colspan="3" class="empty">Sin logs.</td></tr>'}</tbody>
    </table></div>`;
    return;
  }
  const stats = JSON.parse(document.getElementById('screen-mantenimiento')?.dataset.stats || '[]');
  panel.innerHTML = `<div class="tbl-wrap"><table class="tbl">
    <thead><tr><th>Tabla</th><th>Total</th><th>Anulados</th></tr></thead>
    <tbody>${stats.map((s) => `<tr><td><code>${esc(s.tabla)}</code></td><td>${s.total}</td><td>${s.anulados}</td></tr>`).join('')}</tbody>
  </table></div>`;
}

export function exportarBackupJSON() {
  const backup = { fecha: new Date().toISOString(), db: DB };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `backup_rrhh_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  registrarLog('Exportación de backup', null);
}

export function limpiarRegistrosAnulados() {
  let eliminados = 0;
  for (const t of TABLAS_CONTEO) {
    const arr = DB[t] || [];
    const vivos = arr.filter((x) => !(x.anulado || x.estado === 'Anulado'));
    eliminados += arr.length - vivos.length;
    DB[t] = vivos;
  }
  showToast(`${eliminados} registros anulados eliminados`, 'ok');
  registrarLog(`Limpieza de anulados (${eliminados})`, null);
  renderMantenimiento();
}

export function registrarLog(accion, usuario) {
  const log = { id: Date.now().toString(), fecha: new Date().toISOString(), accion, usuario: usuario || '' };
  (DB.logs ||= []).push(log);
  supaSync('logs', log).catch(() => {});
  return log;
}

export function verLogs() {
  renderMantenimientoTab('logs');
}
