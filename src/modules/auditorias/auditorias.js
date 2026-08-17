// Auditorías — registro de actividad y logins (solo superadmin).

import { DB } from '../../state.js';
import { esSuperadmin } from '../../shared/auth.js';
import { esc, fechaISOToDisplay } from '../../shared/helpers.js';

export function renderAuditorias() {
  const cont = document.getElementById('screen-auditorias');
  if (!esSuperadmin()) {
    cont.innerHTML = '<div class="alert alert-warn">Acceso restringido: se requiere un usuario superadmin.</div>';
    return;
  }

  const logs = (DB.logs || []).slice().sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
  const empresas = DB.empresas || [];
  const empresaMap = {};
  empresas.forEach((e) => { empresaMap[String(e.id)] = e.nombre; });

  cont.innerHTML = `
    <div class="toolbar" style="margin-bottom:16px;display:flex;gap:12px;flex-wrap:wrap;align-items:end">
      <div class="field">
        <label>Desde</label>
        <input type="date" id="audit-desde" />
      </div>
      <div class="field">
        <label>Hasta</label>
        <input type="date" id="audit-hasta" />
      </div>
      <div class="field">
        <label>Empresa</label>
        <select id="audit-empresa">
          <option value="">Todas</option>
          ${empresas.map((e) => `<option value="${esc(String(e.id))}">${esc(e.nombre)}</option>`).join('')}
        </select>
      </div>
      <button class="btn btn-secondary btn-sm" onclick="filtrarAuditorias()">Filtrar</button>
    </div>
    <div id="audit-tabla"></div>`;

  renderTablaAuditoria(logs, empresaMap);
}

function renderTablaAuditoria(logs, empresaMap) {
  const tabla = document.getElementById('audit-tabla');
  if (!tabla) return;

  if (!logs.length) {
    tabla.innerHTML = '<div class="alert alert-info">Los registros de auditoría se guardan automáticamente cuando los usuarios inician sesión.</div>';
    return;
  }

  tabla.innerHTML = `
    <div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>Fecha</th><th>Usuario</th><th>Email</th><th>Empresa</th><th>Acción</th><th>IP</th></tr></thead>
      <tbody>
        ${logs.map((l) => `<tr>
          <td>${esc(fechaISOToDisplay(l.fecha) || l.fecha || '—')}</td>
          <td>${esc(l.usuario || '—')}</td>
          <td>${esc(l.email || '—')}</td>
          <td>${esc(empresaMap[String(l.empresaId)] || '—')}</td>
          <td><span class="chip ${l.accion === 'login' ? 'chip-verde' : 'chip-gris'}">${esc(l.accion || '—')}</span></td>
          <td>${esc(l.ip || '—')}</td>
        </tr>`).join('')}
      </tbody>
    </table></div>`;
}

window.filtrarAuditorias = function () {
  const desde = document.getElementById('audit-desde')?.value || '';
  const hasta = document.getElementById('audit-hasta')?.value || '';
  const empresaId = document.getElementById('audit-empresa')?.value || '';

  const empresas = DB.empresas || [];
  const empresaMap = {};
  empresas.forEach((e) => { empresaMap[String(e.id)] = e.nombre; });

  let logs = (DB.logs || []).slice().sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));

  if (desde) logs = logs.filter((l) => (l.fecha || '').slice(0, 10) >= desde);
  if (hasta) logs = logs.filter((l) => (l.fecha || '').slice(0, 10) <= hasta);
  if (empresaId) logs = logs.filter((l) => String(l.empresaId) === empresaId);

  renderTablaAuditoria(logs, empresaMap);
};
