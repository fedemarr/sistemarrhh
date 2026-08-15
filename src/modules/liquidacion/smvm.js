// SMVM y valores — parámetros por periodo con historial.
// Fuente de verdad: 03_Liquidacion.md §3.4.

import { DB } from '../../state.js';
import { supaSync } from '../../shared/supabase.js';
import { ensureModal, cerrarModal, showToast, capturar } from '../../shared/modal.js';
import { esc } from '../../shared/helpers.js';

export const PARAMETROS_DEFAULT = ['SMVM', 'valorCategoria1'];

export function parametrosValores() {
  const vals = DB.parametrosValores || [];
  if (!vals.length) {
    const anio = new Date().getFullYear();
    const mes = new Date().getMonth() + 1;
    return PARAMETROS_DEFAULT.map((p) => ({ id: `${p}-${anio}-${mes}`, nombreParametro: p, valor: p === 'SMVM' ? 234315.12 : 234315.12, anio, mes, detalle: '' }));
  }
  return vals;
}

export function renderSmvm() {
  const cont = document.getElementById('screen-smvm');
  const valores = [...parametrosValores()].sort((a, b) => String(b.anio + '-' + String(b.mes).padStart(2, '0')).localeCompare(String(a.anio + '-' + String(a.mes).padStart(2, '0'))));
  cont.innerHTML = `
    <div class="toolbar">
      <div class="spacer"></div>
      <button class="btn" onclick="agregarValorParametro()">+ Nuevo valor</button>
    </div>
    <div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>Parámetro</th><th>Valor</th><th>Periodo</th><th>Detalle</th><th>Acciones</th></tr></thead>
      <tbody>
        ${valores.map((v) => `<tr>
          <td><code>${esc(v.nombreParametro)}</code></td>
          <td><strong>$${Number(v.valor).toLocaleString('es-AR')}</strong></td>
          <td>${esc(String(v.mes).padStart(2, '0') + '/' + v.anio)}</td>
          <td>${esc(v.detalle || '')}</td>
          <td class="acciones">
            <button class="btn btn-secondary btn-sm" onclick="editarValorParametro('${esc(String(v.id))}')">Editar</button>
            <button class="btn btn-danger btn-sm" onclick="anularValorParametro('${esc(String(v.id))}')">Anular</button>
          </td>
        </tr>`).join('') || '<tr><td colspan="5" class="empty">Sin valores.</td></tr>'}
      </tbody>
    </table></div>`;
}

export function verParametrosVerHistorial() {
  renderSmvm();
}

export function abrirModalValorParametro(v) {
  ensureModal('modal-valor-param', `
    <div class="modal-head"><h2>${v ? 'Editar valor' : 'Nuevo valor de parámetro'}</h2><button class="modal-close" onclick="cerrarModal('modal-valor-param')">×</button></div>
    <form id="form-valor-param">
      <div class="modal-body">
        <div class="form-grid">
          <div class="field"><label>Parámetro *</label>
            <select name="nombreParametro">${PARAMETROS_DEFAULT.map((p) => `<option ${v?.nombreParametro === p ? 'selected' : ''}>${p}</option>`).join('')}</select></div>
          <div class="field"><label>Valor ($) *</label><input type="number" name="valor" value="${v?.valor ?? ''}" step="0.01" required /></div>
          <div class="field"><label>Año *</label><input type="number" name="anio" value="${v?.anio ?? new Date().getFullYear()}" required /></div>
          <div class="field"><label>Mes *</label><input type="number" name="mes" value="${v?.mes ?? new Date().getMonth() + 1}" min="1" max="12" required /></div>
          <div class="field full"><label>Detalle</label><textarea name="detalle" rows="2">${esc(v?.detalle || '')}</textarea></div>
        </div>
      </div>
      <div class="modal-foot"><button type="button" class="btn btn-secondary" onclick="cerrarModal('modal-valor-param')">Cancelar</button><button type="submit" class="btn">Guardar</button></div>
    </form>`, {});
  document.getElementById('form-valor-param').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const datos = capturar(ev);
    const obj = { id: v?.id || Date.now().toString(), nombreParametro: datos.nombreParametro, valor: Number(datos.valor) || 0, anio: Number(datos.anio), mes: Number(datos.mes), detalle: datos.detalle || '' };
    if (v) {
      const idx = (DB.parametrosValores || []).findIndex((x) => String(x.id) === String(v.id));
      if (idx >= 0) DB.parametrosValores[idx] = obj;
      else DB.parametrosValores.push(obj);
    } else {
      if ((DB.parametrosValores || []).some((x) => x.nombreParametro === datos.nombreParametro && x.anio === Number(datos.anio) && x.mes === Number(datos.mes))) { showToast('Ese valor ya existe para el periodo.', 'err'); return; }
      (DB.parametrosValores ||= []).push(obj);
    }
    supaSync('parametrosValores', obj)
      .then(() => { cerrarModal('modal-valor-param'); showToast('Valor guardado', 'ok'); renderSmvm(); })
      .catch((e) => showToast(e.message, 'err'));
  });
}

export function agregarValorParametro() { abrirModalValorParametro(null); }
export function guardarValorParametro() { abrirModalValorParametro(null); }
export function editarValorParametro(id) { abrirModalValorParametro((DB.parametrosValores || []).find((x) => String(x.id) === String(id))); }

export function anularValorParametro(id) {
  const v = (DB.parametrosValores || []).find((x) => String(x.id) === String(id));
  if (!v) return;
  v.anulado = true;
  supaSync('parametrosValores', v)
    .then(() => { showToast('Valor anulado', 'warn'); renderSmvm(); })
    .catch((e) => showToast(e.message, 'err'));
}
