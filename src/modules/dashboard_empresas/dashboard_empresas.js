// Dashboard empresas — resumen financiero por empresa (solo superadmin).

import { DB } from '../../state.js';
import { esSuperadmin } from '../../shared/auth.js';
import { esc, formatMoney, formatNumber, mesActual } from '../../shared/helpers.js';

export function renderDashboardEmpresas() {
  const cont = document.getElementById('screen-dashboard_empresas');
  if (!esSuperadmin()) {
    cont.innerHTML = '<div class="alert alert-warn">Acceso restringido: se requiere un usuario superadmin.</div>';
    return;
  }

  const empresas = DB.empresas || [];
  const mes = mesActual();
  const legajos = DB.legajos || [];
  const candidatos = DB.candidatos || [];
  const liqHoras = DB.liquidacionesHoras || [];
  const liqAdmin = DB.liqAdmin || [];
  const liquidaciones = DB.liquidaciones || [];
  const adelantos = DB.adelantos || [];

  const filas = empresas.map((e) => {
    const eid = String(e.id);
    const empleados = legajos.filter((l) => String(l.empresaId) === eid).length;
    const cantCandidatos = candidatos.filter((c) => String(c.empresaId) === eid).length;
    const liqMes = liqHoras
      .filter((l) => String(l.empresaId) === eid && String(l.mes || '').startsWith(mes))
      .reduce((s, l) => s + Number(l.total || l.monto || 0), 0)
      + liqAdmin
      .filter((l) => String(l.empresaId) === eid && String(l.mes || '').startsWith(mes))
      .reduce((s, l) => s + Number(l.total || l.monto || 0), 0);
    const totalPagado = liquidaciones
      .filter((l) => String(l.empresaId) === eid && l.estado === 'Emitido')
      .reduce((s, l) => s + Number(l.sueldoNeto || 0), 0);
    const activos = adelantos.filter((a) => String(a.empresaId) === eid && a.estado !== 'Finalizado' && a.estado !== 'Rechazado').length;
    return { empresa: e.nombre, empleados, cantCandidatos, liqMes, totalPagado, activos };
  });

  const totalEmpresas = filas.length;
  const totalEmpleados = filas.reduce((s, f) => s + f.empleados, 0);
  const totalPagado = filas.reduce((s, f) => s + f.totalPagado, 0);

  cont.innerHTML = `
    <div class="stats-row" style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:20px">
      <div class="stat-card" style="flex:1;min-width:180px;padding:16px;background:var(--bg-card,#fff);border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,.1)">
        <div class="stat-label" style="font-size:12px;color:#666;text-transform:uppercase">Total empresas</div>
        <div class="stat-value" style="font-size:28px;font-weight:700">${formatNumber(totalEmpresas)}</div>
      </div>
      <div class="stat-card" style="flex:1;min-width:180px;padding:16px;background:var(--bg-card,#fff);border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,.1)">
        <div class="stat-label" style="font-size:12px;color:#666;text-transform:uppercase">Total empleados</div>
        <div class="stat-value" style="font-size:28px;font-weight:700">${formatNumber(totalEmpleados)}</div>
      </div>
      <div class="stat-card" style="flex:1;min-width:180px;padding:16px;background:var(--bg-card,#fff);border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,.1)">
        <div class="stat-label" style="font-size:12px;color:#666;text-transform:uppercase">Total pagado</div>
        <div class="stat-value" style="font-size:28px;font-weight:700">${formatMoney(totalPagado)}</div>
      </div>
    </div>
    <div class="tbl-wrap"><table class="tbl">
      <thead><tr>
        <th>Empresa</th><th>Empleados</th><th>Candidatos</th><th>Liq. mes</th><th>Total pagado</th><th>Adelantos activos</th>
      </tr></thead>
      <tbody>
        ${filas.map((f) => `<tr>
          <td><strong>${esc(f.empresa)}</strong></td>
          <td>${formatNumber(f.empleados)}</td>
          <td>${formatNumber(f.cantCandidatos)}</td>
          <td>${formatMoney(f.liqMes)}</td>
          <td>${formatMoney(f.totalPagado)}</td>
          <td>${formatNumber(f.activos)}</td>
        </tr>`).join('') || '<tr><td colspan="6" class="empty">No hay empresas registradas.</td></tr>'}
      </tbody>
    </table></div>`;
}
