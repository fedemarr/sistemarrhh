// Feriados — calendario de feriados nacionales.
// Fuente de verdad: 03_Liquidacion.md §3.10.

import { DB } from '../../state.js';
import { supaSync } from '../../shared/supabase.js';
import { ensureModal, cerrarModal, showToast, capturar } from '../../shared/modal.js';
import { esc, fechaISOToDisplay } from '../../shared/helpers.js';

export const TIPOS_FERIADO = ['Inamovible', 'Trasladable', 'No laborable'];

export function getFeriadoById(id) {
  return (DB.feriados || []).find((f) => String(f.id) === String(id));
}

export function renderFeriados() {
  const cont = document.getElementById('screen-feriados');
  const anio = new Date().getFullYear();
  cont.innerHTML = `
    <div class="toolbar">
      <label>Año <input type="number" id="feriado-anio" value="${anio}" min="2020" max="2100" style="width:80px" onchange="renderFeriados()" /></label>
      <div class="spacer"></div>
      <button class="btn" onclick="abrirNuevoFeriado()">+ Nuevo feriado</button>
    </div>
    <div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>Fecha</th><th>Nombre</th><th>Tipo</th><th>Acciones</th></tr></thead>
      <tbody>
        ${(DB.feriados || []).filter((f) => (f.fecha || '').startsWith(String(Number(document.getElementById('feriado-anio')?.value) || anio))).sort((a, b) => String(a.fecha).localeCompare(String(b.fecha))).map((f) => `<tr>
          <td>${esc(fechaISOToDisplay(f.fecha))}</td>
          <td>${esc(f.nombre || '')}</td>
          <td><span class="chip ${f.tipo === 'Inamovible' ? 'chip-verde' : f.tipo === 'Trasladable' ? 'chip-naranja' : 'chip-gris'}">${esc(f.tipo)}</span></td>
          <td class="acciones"><button class="btn btn-danger btn-sm" onclick="anularFeriado('${esc(String(f.id))}')">Eliminar</button></td>
        </tr>`).join('') || '<tr><td colspan="4" class="empty">Sin feriados para ese año.</td></tr>'}
      </tbody>
    </table></div>`;
}

export function abrirNuevoFeriado() {
  ensureModal('modal-feriado', `
    <div class="modal-head"><h2>Nuevo feriado</h2><button class="modal-close" onclick="cerrarModal('modal-feriado')">×</button></div>
    <form id="form-feriado">
      <div class="modal-body">
        <div class="form-grid">
          <div class="field"><label>Fecha *</label><input type="date" name="fecha" required /></div>
          <div class="field"><label>Nombre *</label><input name="nombre" required /></div>
          <div class="field"><label>Tipo</label>
            <select name="tipo">${TIPOS_FERIADO.map((t) => `<option>${t}</option>`).join('')}</select></div>
        </div>
      </div>
      <div class="modal-foot"><button type="button" class="btn btn-secondary" onclick="cerrarModal('modal-feriado')">Cancelar</button><button type="submit" class="btn">Guardar</button></div>
    </form>`, {});
  document.getElementById('form-feriado').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const datos = capturar(ev);
    if (!datos.fecha || !datos.nombre) { showToast('Fecha y nombre obligatorios.', 'err'); return; }
    if ((DB.feriados || []).some((f) => f.fecha === datos.fecha)) { showToast('Ya existe un feriado en esa fecha.', 'err'); return; }
    const f = { id: Date.now().toString(), fecha: datos.fecha, nombre: datos.nombre, tipo: datos.tipo };
    DB.feriados.push(f);
    supaSync('feriados', f)
      .then(() => { cerrarModal('modal-feriado'); showToast('Feriado cargado', 'ok'); renderFeriados(); })
      .catch((e) => showToast(e.message, 'err'));
  });
}

export function guardarFeriado() { abrirNuevoFeriado(); }

export function anularFeriado(id) {
  const f = getFeriadoById(id);
  if (!f) return;
  const idx = (DB.feriados || []).findIndex((x) => String(x.id) === String(id));
  if (idx >= 0) DB.feriados.splice(idx, 1);
  supaSync('feriados', f)
    .then(() => { showToast('Feriado eliminado', 'ok'); renderFeriados(); })
    .catch((e) => showToast(e.message, 'err'));
}

export function feriadosDelPeriodo(anio, mes) {
  return (DB.feriados || []).filter((f) => (f.fecha || '').startsWith(`${anio}-${String(mes).padStart(2, '0')}`));
}
