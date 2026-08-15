// Monotributo — retenciones por asociado y periodo.
// Fuente de verdad: 03_Liquidacion.md §3.6.

import { DB } from '../../state.js';
import { supaSync } from '../../shared/supabase.js';
import { ensureModal, cerrarModal, showToast, capturar } from '../../shared/modal.js';
import { esc } from '../../shared/helpers.js';

export const CATEGORIAS_MONO = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N'];

export function getMonoById(id) {
  return (DB.monotributos || []).find((m) => String(m.id) === String(id));
}

export function renderMonotributos() {
  const cont = document.getElementById('screen-monotributos');
  const anio = new Date().getFullYear();
  const mes = new Date().getMonth() + 1;
  const delMes = (DB.monotributos || []).filter((m) => m.anio === anio && m.mes === mes);
  cont.innerHTML = `
    <div class="stats">
      <div class="stat"><div class="num">${delMes.length}</div><div class="lbl">Retenciones del mes</div></div>
      <div class="stat"><div class="num">$${delMes.reduce((a, m) => a + (Number(m.monto) || 0), 0).toLocaleString('es-AR')}</div><div class="lbl">Total retenido</div></div>
    </div>
    <div class="toolbar">
      <div class="spacer"></div>
      <button class="btn" onclick="abrirNuevaRetMonotributo()">+ Nueva retención</button>
    </div>
    <div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>N°</th><th>Asociado</th><th>Periodo</th><th>Categoría</th><th>Monto</th><th>Estado</th><th>Acciones</th></tr></thead>
      <tbody>
        ${(DB.monotributos || []).map((m) => {
          let acciones = `<button class="btn btn-danger btn-sm" onclick="anularMono('${esc(String(m.id))}')">Anular</button>`;
          return `<tr>
            <td>${esc(String(m.nroSocio || ''))}</td>
            <td>${esc(m.nombreAsociado || '')}</td>
            <td>${esc(String(m.mes).padStart(2, '0') + '/' + m.anio)}</td>
            <td><span class="chip chip-azul">Cat. ${esc(m.categoria || '')}</span></td>
            <td>$${m.monto || 0}</td>
            <td><span class="chip ${m.estado === 'Anulado' ? 'chip-gris' : 'chip-verde'}">${esc(m.estado)}</span></td>
            <td class="acciones">${acciones}</td>
          </tr>`;
        }).join('') || '<tr><td colspan="7" class="empty">Sin retenciones de monotributo.</td></tr>'}
      </tbody>
    </table></div>`;
}

export function abrirNuevaRetMonotributo() {
  ensureModal('modal-mono', `
    <div class="modal-head"><h2>Nueva retención de monotributo</h2><button class="modal-close" onclick="cerrarModal('modal-mono')">×</button></div>
    <form id="form-mono">
      <div class="modal-body">
        <div class="form-grid">
          <div class="field"><label>N° de socio *</label><input name="nroSocio" onchange="autocompletarMono()" required /></div>
          <div class="field"><label>Asociado</label><input name="nombreAsociado" id="mono-nombre" /></div>
          <div class="field"><label>Categoría *</label><select name="categoria">${CATEGORIAS_MONO.map((c) => `<option>${c}</option>`).join('')}</select></div>
          <div class="field"><label>Monto ($) *</label><input type="number" name="monto" step="0.01" required /></div>
          <div class="field"><label>Año *</label><input type="number" name="anio" value="${new Date().getFullYear()}" /></div>
          <div class="field"><label>Mes *</label><input type="number" name="mes" value="${new Date().getMonth() + 1}" min="1" max="12" /></div>
        </div>
      </div>
      <div class="modal-foot"><button type="button" class="btn btn-secondary" onclick="cerrarModal('modal-mono')">Cancelar</button><button type="submit" class="btn">Guardar</button></div>
    </form>`, {});
  document.getElementById('form-mono').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const datos = capturar(ev);
    if (!datos.nroSocio || !datos.monto) { showToast('N° y monto son obligatorios.', 'err'); return; }
    const m = { id: Date.now().toString(), nroSocio: Number(datos.nroSocio), nombreAsociado: datos.nombreAsociado, categoria: datos.categoria, monto: Number(datos.monto), anio: Number(datos.anio), mes: Number(datos.mes), estado: 'Pendiente', editadoEn: new Date().toISOString() };
    DB.monotributos.push(m);
    supaSync('monotributos', m)
      .then(() => { cerrarModal('modal-mono'); showToast('Retención cargada', 'ok'); renderMonotributos(); })
      .catch((e) => showToast(e.message, 'err'));
  });
}

export function autocompletarMono() {
  const form = document.getElementById('form-mono');
  if (!form) return;
  const nro = form.elements.nroSocio.value;
  const leg = (DB.legajos || []).find((l) => String(l.nro) === String(nro));
  if (leg) { const n = document.getElementById('mono-nombre'); if (n) n.value = leg.nombre || ''; }
}

export function guardarRetMonotributo() { abrirNuevaRetMonotributo(); }

export function anularMono(id) {
  const m = getMonoById(id);
  if (!m) return;
  m.estado = 'Anulado';
  supaSync('monotributos', m)
    .then(() => { showToast('Retención anulada', 'warn'); renderMonotributos(); })
    .catch((e) => showToast(e.message, 'err'));
}
