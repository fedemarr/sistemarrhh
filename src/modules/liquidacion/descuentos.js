// Descuentos — vigentes por asociado; origen manual o por sanción.
// Fuente de verdad: 03_Liquidacion.md §3.8.

import { DB } from '../../state.js';
import { supaSync } from '../../shared/supabase.js';
import { ensureModal, cerrarModal, showToast, capturar } from '../../shared/modal.js';
import { esc, hoyISO, fechaISOToDisplay } from '../../shared/helpers.js';

export function getDescuentoById(id) {
  return (DB.descuentos || []).find((d) => String(d.id) === String(id));
}

export function descuentosDeSocio(nro) {
  return (DB.descuentos || []).filter((d) => String(d.nroSocio) === String(nro) && d.estado === 'Vigente');
}

export function descuentoTotalDe(nro) {
  return descuentosDeSocio(nro).reduce((a, d) => a + (Number(d.monto) || 0), 0);
}

export function renderDescuentos() {
  const cont = document.getElementById('screen-descuentos');
  cont.innerHTML = `
    <div class="toolbar">
      <input type="text" id="buscar-descuento" placeholder="Buscar…" oninput="filtrarDescuentos()" />
      <div class="spacer"></div>
      <button class="btn" onclick="abrirNuevoDescuento()">+ Nuevo descuento</button>
    </div>
    <div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>N°</th><th>Asociado</th><th>Motivo</th><th>Monto</th><th>Vigencia</th><th>Origen</th><th>Estado</th><th>Acciones</th></tr></thead>
      <tbody>
        ${(DB.descuentos || []).map((d) => {
          let acciones = `<button class="btn btn-secondary btn-sm" onclick="verDescuento('${esc(String(d.id))}')">Ver</button>`;
          if (d.estado === 'Vigente') acciones += `<button class="btn btn-danger btn-sm" onclick="anularDescuento('${esc(String(d.id))}')">Anular</button>`;
          return `<tr>
            <td>${esc(String(d.nroSocio || ''))}</td>
            <td>${esc(d.nombreAsociado || '')}</td>
            <td>${esc(d.motivo || '')}</td>
            <td><strong>$${d.monto || 0}</strong></td>
            <td>${esc(fechaISOToDisplay(d.vigenciaDesde))} → ${esc(fechaISOToDisplay(d.vigenciaHasta))}</td>
            <td><span class="chip ${d.tipo === 'Por sanción' ? 'chip-rojo' : 'chip-gris'}">${esc(d.tipo || 'Manual')}</span></td>
            <td><span class="chip ${d.estado === 'Vigente' ? 'chip-verde' : 'chip-gris'}">${esc(d.estado)}</span></td>
            <td class="acciones">${acciones}</td>
          </tr>`;
        }).join('') || '<tr><td colspan="8" class="empty">Sin descuentos.</td></tr>'}
      </tbody>
    </table></div>`;
}

export function filtrarDescuentos() {
  const term = document.getElementById('buscar-descuento')?.value.toLowerCase() || '';
  document.querySelectorAll('#screen-descuentos tbody tr').forEach((tr) => tr.classList.toggle('hidden', !tr.textContent.toLowerCase().includes(term)));
}

export function verDescuento(id) {
  const d = getDescuentoById(id);
  if (!d) return;
  ensureModal('modal-descuento-ver', `
    <div class="modal-head"><h2>Descuento — ${esc(d.nombreAsociado || '')}</h2><button class="modal-close" onclick="cerrarModal('modal-descuento-ver')">×</button></div>
    <div class="modal-body">
      <div class="grid3">
        ${[['N°', d.nroSocio], ['Motivo', d.motivo], ['Monto', `$${d.monto}`], ['Vigencia', `${fechaISOToDisplay(d.vigenciaDesde)} → ${fechaISOToDisplay(d.vigenciaHasta)}`], ['Origen', d.tipo], ['Estado', d.estado]]
          .map(([k, val]) => `<div><strong>${k}:</strong><br/>${esc(val === null || val === undefined || val === '' ? '—' : String(val))}</div>`).join('')}
      </div>
    </div>
    <div class="modal-foot"><button class="btn btn-secondary" onclick="cerrarModal('modal-descuento-ver')">Cerrar</button></div>
  `, {});
}

export function abrirNuevoDescuento() {
  abrirModalDescuento(null);
}

export function abrirEditarDescuento(id) {
  abrirModalDescuento(getDescuentoById(id));
}

function abrirModalDescuento(d) {
  ensureModal('modal-descuento', `
    <div class="modal-head"><h2>${d ? 'Editar descuento' : 'Nuevo descuento'}</h2><button class="modal-close" onclick="cerrarModal('modal-descuento')">×</button></div>
    <form id="form-descuento">
      <div class="modal-body">
        <div class="form-grid">
          <div class="field"><label>N° de socio *</label><input name="nroSocio" value="${esc(d?.nroSocio || '')}" onchange="autocompletarDescuento()" required /></div>
          <div class="field"><label>Asociado</label><input name="nombreAsociado" id="descuento-nombre" value="${esc(d?.nombreAsociado || '')}" /></div>
          <div class="field"><label>Motivo *</label><input name="motivo" value="${esc(d?.motivo || '')}" required /></div>
          <div class="field"><label>Monto ($) *</label><input type="number" name="monto" value="${d?.monto ?? ''}" step="0.01" required /></div>
          <div class="field"><label>Vigencia desde</label><input type="date" name="vigenciaDesde" value="${esc(d?.vigenciaDesde || hoyISO())}" /></div>
          <div class="field"><label>Vigencia hasta</label><input type="date" name="vigenciaHasta" value="${esc(d?.vigenciaHasta || '')}" /></div>
          <div class="field"><label>Origen</label>
            <select name="tipo"><option value="Manual" ${d?.tipo === 'Manual' ? 'selected' : ''}>Manual</option><option value="Por sanción" ${d?.tipo === 'Por sanción' ? 'selected' : ''}>Por sanción</option></select></div>
        </div>
      </div>
      <div class="modal-foot"><button type="button" class="btn btn-secondary" onclick="cerrarModal('modal-descuento')">Cancelar</button><button type="submit" class="btn">Guardar</button></div>
    </form>`, {});
  document.getElementById('form-descuento').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const datos = capturar(ev);
    if (!datos.nroSocio || !datos.monto) { showToast('N° y monto son obligatorios.', 'err'); return; }
    const obj = { id: d?.id || Date.now().toString(), nroSocio: Number(datos.nroSocio), nombreAsociado: datos.nombreAsociado, motivo: datos.motivo, monto: Number(datos.monto), vigenciaDesde: datos.vigenciaDesde || '', vigenciaHasta: datos.vigenciaHasta || '', tipo: datos.tipo || 'Manual', estado: 'Vigente', editadoEn: new Date().toISOString() };
    if (d) {
      const idx = (DB.descuentos || []).findIndex((x) => String(x.id) === String(d.id));
      if (idx >= 0) DB.descuentos[idx] = obj; else DB.descuentos.push(obj);
    } else {
      (DB.descuentos ||= []).push(obj);
    }
    supaSync('descuentos', obj)
      .then(() => { cerrarModal('modal-descuento'); showToast('Descuento guardado', 'ok'); renderDescuentos(); })
      .catch((e) => showToast(e.message, 'err'));
  });
}

export function autocompletarDescuento() {
  const form = document.getElementById('form-descuento');
  if (!form) return;
  const nro = form.elements.nroSocio.value;
  const leg = (DB.legajos || []).find((l) => String(l.nro) === String(nro));
  if (leg) { const n = document.getElementById('descuento-nombre'); if (n) n.value = leg.nombre || ''; }
}

export function guardarDescuento() { abrirNuevoDescuento(); }

export function anularDescuento(id) {
  const d = getDescuentoById(id);
  if (!d) return;
  d.estado = 'Anulado';
  supaSync('descuentos', d)
    .then(() => { showToast('Descuento anulado', 'warn'); renderDescuentos(); })
    .catch((e) => showToast(e.message, 'err'));
}
