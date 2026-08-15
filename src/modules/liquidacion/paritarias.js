// Paritarias — actas y base de cálculo salarial.
// Fuente de verdad: 03_Liquidacion.md §3.9.

import { DB } from '../../state.js';
import { supaSync } from '../../shared/supabase.js';
import { ensureModal, cerrarModal, showToast, capturar } from '../../shared/modal.js';
import { esc, hoyISO, fechaISOToDisplay } from '../../shared/helpers.js';

export function getParitariaById(id) {
  return (DB.paritarias || []).find((p) => String(p.id) === String(id));
}

export function renderParitarias() {
  const cont = document.getElementById('screen-paritarias');
  cont.innerHTML = `
    <div class="toolbar">
      <div class="spacer"></div>
      <button class="btn" onclick="abrirModalParitaria()">+ Nueva acta paritaria</button>
    </div>
    <div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>Acta</th><th>Fecha</th><th>Salario base</th><th>Aumento</th><th>Vigencia</th><th>Observaciones</th><th>Acciones</th></tr></thead>
      <tbody>
        ${(DB.paritarias || []).filter((p) => !p.anulado).map((p) => `<tr>
          <td>${esc(p.acta || '')}</td>
          <td>${esc(fechaISOToDisplay(p.fecha))}</td>
          <td>$${p.salario || 0}</td>
          <td>${p.aumentoPorcentaje ? p.aumentoPorcentaje + '%' : '—'}</td>
          <td>${esc(fechaISOToDisplay(p.vigenciaDesde))} → ${esc(fechaISOToDisplay(p.vigenciaHasta))}</td>
          <td>${esc(p.observaciones || '')}</td>
          <td class="acciones">
            <button class="btn btn-secondary btn-sm" onclick="editarParitaria('${esc(String(p.id))}')">Editar</button>
            <button class="btn btn-danger btn-sm" onclick="anularParitaria('${esc(String(p.id))}')">Anular</button>
          </td>
        </tr>`).join('') || '<tr><td colspan="7" class="empty">Sin actas paritarias.</td></tr>'}
      </tbody>
    </table></div>`;
}

export function abrirModalParitaria() {
  abrirFormParitaria(null);
}

export function editarParitaria(id) {
  abrirFormParitaria(getParitariaById(id));
}

function abrirFormParitaria(p) {
  ensureModal('modal-paritaria', `
    <div class="modal-head"><h2>${p ? 'Editar acta paritaria' : 'Nueva acta paritaria'}</h2><button class="modal-close" onclick="cerrarModal('modal-paritaria')">×</button></div>
    <form id="form-paritaria">
      <div class="modal-body">
        <div class="form-grid">
          <div class="field"><label>Acta *</label><input name="acta" value="${esc(p?.acta || '')}" required /></div>
          <div class="field"><label>Fecha</label><input type="date" name="fecha" value="${esc(p?.fecha || hoyISO())}" /></div>
          <div class="field"><label>Salario base ($) *</label><input type="number" name="salario" value="${p?.salario ?? ''}" step="0.01" required /></div>
          <div class="field"><label>Aumento (%)</label><input type="number" name="aumentoPorcentaje" value="${p?.aumentoPorcentaje ?? ''}" step="0.01" /></div>
          <div class="field"><label>Vigencia desde</label><input type="date" name="vigenciaDesde" value="${esc(p?.vigenciaDesde || '')}" /></div>
          <div class="field"><label>Vigencia hasta</label><input type="date" name="vigenciaHasta" value="${esc(p?.vigenciaHasta || '')}" /></div>
          <div class="field full"><label>Observaciones</label><textarea name="observaciones" rows="2">${esc(p?.observaciones || '')}</textarea></div>
        </div>
      </div>
      <div class="modal-foot"><button type="button" class="btn btn-secondary" onclick="cerrarModal('modal-paritaria')">Cancelar</button><button type="submit" class="btn">Guardar</button></div>
    </form>`, { size: 'modal-lg' });
  document.getElementById('form-paritaria').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const datos = capturar(ev);
    if (!datos.acta) { showToast('Acta obligatoria.', 'err'); return; }
    const obj = { id: p?.id || Date.now().toString(), acta: datos.acta, fecha: datos.fecha || '', salario: Number(datos.salario) || 0, aumentoPorcentaje: datos.aumentoPorcentaje === '' ? null : Number(datos.aumentoPorcentaje), vigenciaDesde: datos.vigenciaDesde || '', vigenciaHasta: datos.vigenciaHasta || '', observaciones: datos.observaciones || '', anulado: false };
    if (p) {
      const idx = (DB.paritarias || []).findIndex((x) => String(x.id) === String(p.id));
      if (idx >= 0) DB.paritarias[idx] = obj; else DB.paritarias.push(obj);
    } else {
      (DB.paritarias ||= []).push(obj);
    }
    supaSync('paritarias', obj)
      .then(() => { cerrarModal('modal-paritaria'); showToast('Acta guardada', 'ok'); renderParitarias(); })
      .catch((e) => showToast(e.message, 'err'));
  });
}

export function guardarParitaria() { abrirModalParitaria(); }

export function anularParitaria(id) {
  const p = getParitariaById(id);
  if (!p) return;
  p.anulado = true;
  supaSync('paritarias', p)
    .then(() => { showToast('Acta anulada', 'warn'); renderParitarias(); })
    .catch((e) => showToast(e.message, 'err'));
}

export function verActasParitarias() {
  renderParitarias();
}
