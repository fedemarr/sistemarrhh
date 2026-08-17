// Liquidación administrativos — liquidación mensual por rango de fechas.
// Fuente de verdad: 03_Liquidacion.md §3.2.

import { DB } from '../../state.js';
import { supaSync } from '../../shared/supabase.js';
import { ensureModal, cerrarModal, showToast, capturar } from '../../shared/modal.js';
import { esc, hoyISO, fechaISOToDisplay } from '../../shared/helpers.js';
import { getCurrentUser } from '../../shared/auth.js';
import { obtenerCategorias, calcularSalario, redondear2 } from './liqUtils.js';

export function getLiqAdminById(id) {
  return (DB.liqAdmin || []).find((l) => String(l.id) === String(id));
}

export function renderLiqAdminInicial() {
  const cont = document.getElementById('screen-liq_admin');
  if (!cont) return;
  cont.innerHTML = `
    <div class="toolbar">
      <input type="text" id="buscar-liq-admin" placeholder="Buscar…" oninput="filtrarLiqAdmin()" />
      <div class="spacer"></div>
      <button class="btn" onclick="abrirNuevaLiqAdmin()">+ Nueva liquidación</button>
    </div>
    <div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>Asociado</th><th>Categoría</th><th>Rango</th><th>Bruto</th><th>Neto</th><th>Estado</th><th>Acciones</th></tr></thead>
      <tbody>
        ${(DB.liqAdmin || []).map((l) => {
          let acciones = `<button class="btn btn-secondary btn-sm" onclick="verLiqAdmin('${esc(String(l.id))}')">Ver</button>`;
          if (l.estado === 'Borrador') acciones += `<button class="btn btn-success btn-sm" onclick="liquidarAdminPorId('${esc(String(l.id))}')">Liquidar</button>`;
          acciones += `<button class="btn btn-danger btn-sm" onclick="anularLiqAdminPorId('${esc(String(l.id))}')">Anular</button>`;
          return `<tr>
            <td>${esc(l.nombreAsociado || '')}</td>
            <td>${esc(l.categoria || '')}</td>
            <td>${esc(fechaISOToDisplay(l.fechaDesde))} → ${esc(fechaISOToDisplay(l.fechaHasta))}</td>
            <td>$${redondear2(l.sueldoBruto)}</td>
            <td><strong>$${redondear2(l.sueldoNeto)}</strong></td>
            <td><span class="chip ${l.estado === 'Liquidado' ? 'chip-verde' : 'chip-naranja'}">${esc(l.estado)}</span></td>
            <td class="acciones">${acciones}</td>
          </tr>`;
        }).join('') || '<tr><td colspan="7" class="empty">Sin liquidaciones administrativas.</td></tr>'}
      </tbody>
    </table></div>`;
}

export function filtrarLiqAdmin() {
  const term = document.getElementById('buscar-liq-admin')?.value.toLowerCase() || '';
  document.querySelectorAll('#screen-liq-admin tbody tr').forEach((tr) => tr.classList.toggle('hidden', !tr.textContent.toLowerCase().includes(term)));
}

export function verLiqAdmin(id) {
  const l = getLiqAdminById(id);
  if (!l) return;
  ensureModal('modal-liq-admin-ver', `
    <div class="modal-head"><h2>Liquidación administrativo — ${esc(l.nombreAsociado || '')}</h2><button class="modal-close" onclick="cerrarModal('modal-liq-admin-ver')">×</button></div>
    <div class="modal-body">
      <div class="grid3">
        ${[['Categoría', l.categoria], ['Rango', `${fechaISOToDisplay(l.fechaDesde)} → ${fechaISOToDisplay(l.fechaHasta)}`], ['Bruto', `$${redondear2(l.sueldoBruto)}`], ['Adicionales', `$${redondear2(l.adicionales)}`], ['Descuentos', `$${redondear2(l.descuentos)}`], ['Neto', `$${redondear2(l.sueldoNeto)}`], ['Estado', l.estado]]
          .map(([k, val]) => `<div><strong>${k}:</strong><br/>${esc(val === null || val === undefined || val === '' ? '—' : String(val))}</div>`).join('')}
      </div>
    </div>
    <div class="modal-foot"><button class="btn btn-secondary" onclick="cerrarModal('modal-liq-admin-ver')">Cerrar</button></div>
  `, {});
}

export function abrirNuevaLiqAdmin() {
  ensureModal('modal-liq-admin', `
    <div class="modal-head"><h2>Nueva liquidación administrativa</h2><button class="modal-close" onclick="cerrarModal('modal-liq-admin')">×</button></div>
    <form id="form-liq-admin">
      <div class="modal-body">
        <div class="form-grid">
          <div class="field"><label>N° de socio</label><input name="nroSocio" onchange="autocompletarLiqAdmin()" /></div>
          <div class="field"><label>Asociado</label><input name="nombreAsociado" id="liq-admin-nombre" /></div>
          <div class="field"><label>Categoría</label>
            <select name="categoria">${obtenerCategorias().map((c) => `<option>${esc(c.nombre)}</option>`).join('')}</select></div>
          <div class="field"><label>Año</label><input type="number" name="anio" value="${new Date().getFullYear()}" /></div>
          <div class="field"><label>Mes</label><input type="number" name="mes" value="${new Date().getMonth() + 1}" min="1" max="12" /></div>
          <div class="field"><label>Desde *</label><input type="date" name="fechaDesde" value="${hoyISO()}" required /></div>
          <div class="field"><label>Hasta *</label><input type="date" name="fechaHasta" value="${hoyISO()}" required /></div>
          <div class="field"><label>Adicionales</label><input type="number" name="adicionales" value="0" /></div>
          <div class="field"><label>Descuentos</label><input type="number" name="descuentos" value="0" /></div>
        </div>
      </div>
      <div class="modal-foot"><button type="button" class="btn btn-secondary" onclick="cerrarModal('modal-liq-admin')">Cancelar</button><button type="submit" class="btn">Guardar</button></div>
    </form>`, { size: 'modal-lg' });
  document.getElementById('form-liq-admin').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const datos = capturar(ev);
    if (datos.fechaHasta < datos.fechaDesde) { showToast('La fecha Hasta no puede ser anterior a Desde.', 'err'); return; }
    const bruto = calcularSalario(datos.categoria, datos.anio, datos.mes);
    const l = {
      id: Date.now().toString(),
      nroSocio: Number(datos.nroSocio) || null,
      nombreAsociado: datos.nombreAsociado || '',
      categoria: datos.categoria,
      anio: Number(datos.anio),
      mes: Number(datos.mes),
      fechaDesde: datos.fechaDesde,
      fechaHasta: datos.fechaHasta,
      adicionales: Number(datos.adicionales) || 0,
      descuentos: Number(datos.descuentos) || 0,
      sueldoBruto: redondear2(bruto),
      sueldoNeto: redondear2(bruto + (Number(datos.adicionales) || 0) - (Number(datos.descuentos) || 0)),
      estado: 'Borrador',
      editadoPor: getCurrentUser()?.nombre || '',
      editadoEn: new Date().toISOString(),
    };
    DB.liqAdmin.push(l);
    supaSync('liqAdmin', l)
      .then(() => { cerrarModal('modal-liq-admin'); showToast('Liquidación guardada', 'ok'); renderLiqAdminInicial(); })
      .catch((e) => showToast(e.message, 'err'));
  });
}

export function autocompletarLiqAdmin() {
  const form = document.getElementById('form-liq-admin');
  if (!form) return;
  const nro = form.elements.nroSocio.value;
  const leg = (DB.legajos || []).find((l) => String(l.nro) === String(nro));
  if (leg) { const n = document.getElementById('liq-admin-nombre'); if (n) n.value = leg.nombre || ''; }
}

export function liquidarAdminPorId(id) {
  const l = getLiqAdminById(id);
  if (!l) return;
  l.estado = 'Liquidado';
  supaSync('liqAdmin', l)
    .then(() => { showToast('Liquidación cerrada', 'ok'); renderLiqAdminInicial(); })
    .catch((e) => showToast(e.message, 'err'));
}

export function anularLiqAdminPorId(id) {
  const l = getLiqAdminById(id);
  if (!l) return;
  l.estado = 'Anulado';
  supaSync('liqAdmin', l)
    .then(() => { showToast('Liquidación anulada', 'warn'); renderLiqAdminInicial(); })
    .catch((e) => showToast(e.message, 'err'));
}
