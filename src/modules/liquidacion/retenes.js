// Retenes — configuración de retenciones a aplicar por periodo.
// Fuente de verdad: 03_Liquidacion.md §3.5.

import { DB } from '../../state.js';
import { supaSync } from '../../shared/supabase.js';
import { ensureModal, cerrarModal, showToast, capturar } from '../../shared/modal.js';
import { esc } from '../../shared/helpers.js';

export const MOTIVOS_RETEN_DEFAULT = ['Anticipo', 'Sobregiro', 'Cobro judicial', 'Otro'];

export function getRetenById(id) {
  return (DB.retenes || []).find((r) => String(r.id) === String(id));
}

export function renderRetenes() {
  const cont = document.getElementById('screen-retenes');
  cont.innerHTML = `
    <div class="toolbar"><div class="spacer"></div><button class="btn" onclick="agregarReten()">+ Nuevo retén</button></div>
    <div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>Motivo</th><th>Porcentaje</th><th>Monto fijo</th><th>Desde</th><th>Hasta</th><th>Activo</th><th>Acciones</th></tr></thead>
      <tbody>
        ${(DB.retenes || []).map((r) => `<tr>
          <td>${esc(r.motivo || '')}</td>
          <td>${r.porcentaje != null ? r.porcentaje + '%' : '—'}</td>
          <td>$${r.montoFijo || 0}</td>
          <td>${esc(r.desde || '')}</td>
          <td>${esc(r.hasta || '')}</td>
          <td><span class="chip ${r.activo ? 'chip-verde' : 'chip-gris'}">${r.activo ? 'Sí' : 'No'}</span></td>
          <td class="acciones">
            <button class="btn btn-secondary btn-sm" onclick="editarReten('${esc(String(r.id))}')">Editar</button>
            <button class="btn btn-danger btn-sm" onclick="anularReten('${esc(String(r.id))}')">Anular</button>
          </td>
        </tr>`).join('') || '<tr><td colspan="7" class="empty">Sin retenes configurados.</td></tr>'}
      </tbody>
    </table></div>`;
}

export function abrirModalReten(r) {
  ensureModal('modal-reten', `
    <div class="modal-head"><h2>${r ? 'Editar retén' : 'Nuevo retén'}</h2><button class="modal-close" onclick="cerrarModal('modal-reten')">×</button></div>
    <form id="form-reten">
      <div class="modal-body">
        <div class="form-grid">
          <div class="field"><label>Motivo *</label>
            <select name="motivo">${MOTIVOS_RETEN_DEFAULT.map((m) => `<option ${r?.motivo === m ? 'selected' : ''}>${m}</option>`).join('')}</select></div>
          <div class="field"><label>Porcentaje (%)</label><input type="number" name="porcentaje" value="${r?.porcentaje ?? ''}" step="0.01" /></div>
          <div class="field"><label>Monto fijo ($)</label><input type="number" name="montoFijo" value="${r?.montoFijo ?? 0}" step="0.01" /></div>
          <div class="field"><label>Desde</label><input type="date" name="desde" value="${esc(r?.desde || '')}" /></div>
          <div class="field"><label>Hasta</label><input type="date" name="hasta" value="${esc(r?.hasta || '')}" /></div>
          <div class="field"><label>Activo</label><select name="activo"><option value="true" ${r?.activo ? 'selected' : ''}>Sí</option><option value="false" ${r?.activo === false ? 'selected' : ''}>No</option></select></div>
        </div>
      </div>
      <div class="modal-foot"><button type="button" class="btn btn-secondary" onclick="cerrarModal('modal-reten')">Cancelar</button><button type="submit" class="btn">Guardar</button></div>
    </form>`, {});
  document.getElementById('form-reten').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const datos = capturar(ev);
    if (!datos.motivo) { showToast('Motivo obligatorio.', 'err'); return; }
    const obj = { id: r?.id || Date.now().toString(), motivo: datos.motivo, porcentaje: datos.porcentaje === '' || datos.porcentaje == null ? null : Number(datos.porcentaje), montoFijo: Number(datos.montoFijo) || 0, desde: datos.desde || '', hasta: datos.hasta || '', activo: datos.activo === 'true' };
    if (r) {
      const idx = (DB.retenes || []).findIndex((x) => String(x.id) === String(r.id));
      if (idx >= 0) DB.retenes[idx] = obj; else DB.retenes.push(obj);
    } else {
      (DB.retenes ||= []).push(obj);
    }
    supaSync('retenes', obj)
      .then(() => { cerrarModal('modal-reten'); showToast('Retén guardado', 'ok'); renderRetenes(); })
      .catch((e) => showToast(e.message, 'err'));
  });
}

export function agregarReten() { abrirModalReten(null); }
export function guardarReten() { abrirModalReten(null); }
export function editarReten(id) { abrirModalReten(getRetenById(id)); }

export function anularReten(id) {
  const r = getRetenById(id);
  if (!r) return;
  r.anulado = true;
  supaSync('retenes', r)
    .then(() => { showToast('Retén anulado', 'warn'); renderRetenes(); })
    .catch((e) => showToast(e.message, 'err'));
}
