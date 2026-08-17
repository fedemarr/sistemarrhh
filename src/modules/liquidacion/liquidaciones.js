// Recibos de sueldo — emisión, impresión y anulación.
// Fuente de verdad: 03_Liquidacion.md §3.11.

import { DB } from '../../state.js';
import { supaSync } from '../../shared/supabase.js';
import { ensureModal, cerrarModal, showToast } from '../../shared/modal.js';
import { esc, fechaISOToDisplay } from '../../shared/helpers.js';
import { getCurrentUser } from '../../shared/auth.js';
import { obtenerHorasLiquidacion, redondear2, periodoLabel } from './liqUtils.js';

export function getReciboById(id) {
  return (DB.liquidaciones || []).find((l) => String(l.id) === String(id));
}

export function renderLiquidaciones(tab = 'emitidos') {
  const cont = document.getElementById('screen-liquidaciones');
  cont.innerHTML = `
    <div class="tabs">
      ${[['emitidos', `Emitidos (${(DB.liquidaciones || []).filter((l) => l.estado === 'Emitido').length})`], ['borradores', `Borradores (${(DB.liquidaciones || []).filter((l) => l.estado === 'Borrador').length})`]]
        .map(([k, l]) => `<button class="tab-btn ${tab === k ? 'active' : ''}" onclick="renderLiquidaciones('${k}')">${l}</button>`).join('')}
    </div>
    <div class="toolbar">
      <div class="spacer"></div>
      <button class="btn" onclick="abrirNuevoRecibo()">+ Nuevo recibo</button>
    </div>
    <div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>N°</th><th>Asociado</th><th>Periodo</th><th>Bruto</th><th>Descuentos</th><th>Neto</th><th>Estado</th><th>Acciones</th></tr></thead>
      <tbody>
        ${(DB.liquidaciones || []).filter((l) => (tab === 'emitidos' ? l.estado === 'Emitido' : l.estado === 'Borrador')).map((l) => {
          let acciones = `<button class="btn btn-secondary btn-sm" onclick="verRecibo('${esc(String(l.id))}')">Ver</button>`;
          acciones += `<button class="btn btn-secondary btn-sm" onclick="imprimirRecibo('${esc(String(l.id))}')">Imprimir</button>`;
          if (l.estado === 'Borrador') acciones += `<button class="btn btn-success btn-sm" onclick="emitirRecibo('${esc(String(l.id))}')">Emitir</button>`;
          acciones += `<button class="btn btn-danger btn-sm" onclick="anularRecibo('${esc(String(l.id))}')">Anular</button>`;
          return `<tr>
            <td>${esc(String(l.nroSocio || ''))}</td>
            <td>${esc(l.nombreAsociado || '')}</td>
            <td>${esc(periodoLabel(l.anio, l.mes))}</td>
            <td>$${redondear2(l.sueldoBruto)}</td>
            <td>$${redondear2(l.descuentosTotal)}</td>
            <td><strong>$${redondear2(l.sueldoNeto)}</strong></td>
            <td><span class="chip ${l.estado === 'Emitido' ? 'chip-verde' : 'chip-naranja'}">${esc(l.estado)}</span></td>
            <td class="acciones">${acciones}</td>
          </tr>`;
        }).join('') || '<tr><td colspan="8" class="empty">Sin recibos.</td></tr>'}
      </tbody>
    </table></div>`;
}

export function abrirNuevoRecibo() {
  ensureModal('modal-recibo', `
    <div class="modal-head"><h2>Nuevo recibo de sueldo</h2><button class="modal-close" onclick="cerrarModal('modal-recibo')">×</button></div>
    <form id="form-recibo">
      <div class="modal-body">
        <p>Genera el recibo a partir de la liquidación de horas o administrativa del periodo. Si no existe, se crea en cero.</p>
        <div class="form-grid">
          <div class="field"><label>N° de socio *</label><input name="nroSocio" required /></div>
          <div class="field"><label>Asociado</label><input name="nombreAsociado" /></div>
          <div class="field"><label>Año *</label><input type="number" name="anio" value="${new Date().getFullYear()}" required /></div>
          <div class="field"><label>Mes *</label><input type="number" name="mes" value="${new Date().getMonth() + 1}" min="1" max="12" required /></div>
        </div>
      </div>
      <div class="modal-foot"><button type="button" class="btn btn-secondary" onclick="cerrarModal('modal-recibo')">Cancelar</button><button type="submit" class="btn">Generar</button></div>
    </form>`, {});
  document.getElementById('form-recibo').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const f = ev.target.elements;
    const nro = f.nroSocio.value;
    const anio = Number(f.anio.value);
    const mes = Number(f.mes.value);
    if (!nro) { showToast('N° de socio obligatorio.', 'err'); return; }
    if ((DB.liquidaciones || []).some((l) => String(l.nroSocio) === String(nro) && l.anio === anio && l.mes === mes && l.estado !== 'Anulado')) { showToast('Ya existe un recibo para ese periodo.', 'err'); return; }
    const leg = (DB.legajos || []).find((l) => String(l.nro) === String(nro));
    const horas = obtenerHorasLiquidacion(nro, anio, mes);
    const lAdmin = (DB.liqAdmin || []).find(l => String(l.nroSocio) === String(nro) && l.anio === anio && l.mes === mes && l.estado !== 'Anulado');
    let bruto = 0, desc = 0, fuente = '';
    if (horas?.sueldoBruto) {
      bruto = horas.sueldoBruto || 0;
      desc = horas.descuentosTotal || 0;
      fuente = 'Horas';
    } else if (lAdmin?.sueldoBruto) {
      bruto = lAdmin.sueldoBruto || 0;
      desc = lAdmin.descuentos || 0;
      fuente = 'Admin';
    }
    const recibo = {
      id: Date.now().toString(),
      nroSocio: Number(nro),
      nombreAsociado: f.nombreAsociado.value || leg?.nombre || '',
      anio,
      mes,
      sueldoBruto: bruto,
      descuentosTotal: desc,
      sueldoNeto: redondear2(bruto - desc),
      fuente,
      estado: 'Borrador',
      editadoPor: getCurrentUser()?.nombre || '',
      editadoEn: new Date().toISOString(),
    };
    DB.liquidaciones.push(recibo);
    supaSync('liquidaciones', recibo)
      .then(() => { cerrarModal('modal-recibo'); showToast('Recibo generado' + (fuente ? ` (fuente: ${fuente})` : ''), 'ok'); renderLiquidaciones('borradores'); })
      .catch((e) => showToast(e.message, 'err'));
  });
}

export function verRecibo(id) {
  const l = getReciboById(id);
  if (!l) return;
  ensureModal('modal-recibo-ver', `
    <div class="modal-head"><h2>Recibo — ${esc(l.nombreAsociado || '')}</h2><button class="modal-close" onclick="cerrarModal('modal-recibo-ver')">×</button></div>
    <div class="modal-body">
      <div class="recibo">
        <h3>Recibo de sueldo — ${esc(periodoLabel(l.anio, l.mes))}</h3>
        <p><strong>Asociado:</strong> ${esc(l.nombreAsociado || '')} (N° ${esc(l.nroSocio || '')})</p>
        ${l.fuente ? `<p><strong>Fuente:</strong> ${esc(l.fuente)}</p>` : ''}
        <div class="grid3">
          <div><strong>Bruto</strong><br/>$${redondear2(l.sueldoBruto)}</div>
          <div><strong>Descuentos</strong><br/>$${redondear2(l.descuentosTotal)}</div>
          <div><strong>Neto a cobrar</strong><br/><b>$${redondear2(l.sueldoNeto)}</b></div>
        </div>
        <p class="muted">Emitido: ${esc(fechaISOToDisplay(l.editadoEn?.slice(0, 10)))}</p>
      </div>
    </div>
    <div class="modal-foot"><button class="btn btn-secondary" onclick="cerrarModal('modal-recibo-ver')">Cerrar</button><button class="btn" onclick="imprimirRecibo('${esc(String(l.id))}')">Imprimir</button></div>
  `, { size: 'modal-lg' });
}

export function imprimirRecibo(id) {
  const l = getReciboById(id);
  if (!l) return;
  const win = window.open('', '_blank', 'width=800,height=600');
  if (!win) { showToast('Permití ventanas emergentes para imprimir.', 'warn'); return; }
  win.document.write(`<html><head><title>Recibo ${periodoLabel(l.anio, l.mes)}</title><style>
    body{font-family:Arial,sans-serif;padding:24px;max-width:640px;margin:auto}
    h2{text-align:center} .rec{width:100%;border-collapse:collapse} .rec td{padding:6px 8px}
    .b{border-top:1px solid #999;font-weight:bold} .total{font-size:18px}
    @media print { .no-print{display:none} }
  </style></head><body>
    <button class="no-print" onclick="window.print()">Imprimir</button>
    <h2>Cooperativa de Limpieza</h2>
    <h3>Recibo de sueldo — ${esc(periodoLabel(l.anio, l.mes))}</h3>
    <table class="rec">
      <tr><td>Asociado:</td><td><strong>${esc(l.nombreAsociado || '')}</strong></td><td>N°:</td><td>${esc(l.nroSocio || '')}</td></tr>
      ${l.fuente ? `<tr><td>Fuente:</td><td colspan="3">${esc(l.fuente)}</td></tr>` : ''}
      <tr><td>Conceptos</td><td colspan="3"></td></tr>
      <tr><td>Sueldo bruto</td><td>$${redondear2(l.sueldoBruto)}</td><td></td><td></td></tr>
      <tr><td>Descuentos</td><td>-$${redondear2(l.descuentosTotal)}</td><td></td><td></td></tr>
      <tr class="b"><td>Neto a cobrar</td><td class="total">$${redondear2(l.sueldoNeto)}</td><td></td><td></td></tr>
    </table>
    <p class="muted">Emitido el ${esc(fechaISOToDisplay(l.editadoEn?.slice(0, 10)))}</p>
  </body></html>`);
  win.document.close();
}

export function emitirRecibo(id) {
  const l = getReciboById(id);
  if (!l) return;
  l.estado = 'Emitido';
  l.fechaEmision = new Date().toISOString();
  supaSync('liquidaciones', l)
    .then(() => { showToast('Recibo emitido', 'ok'); renderLiquidaciones('emitidos'); })
    .catch((e) => showToast(e.message, 'err'));
}

export function anularRecibo(id) {
  const l = getReciboById(id);
  if (!l) return;
  l.estado = 'Anulado';
  supaSync('liquidaciones', l)
    .then(() => { showToast('Recibo anulado', 'warn'); renderLiquidaciones('emitidos'); })
    .catch((e) => showToast(e.message, 'err'));
}
