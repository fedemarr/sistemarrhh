// Sugerencias — alta anónima; gestión por RRHH.
// Fuente de verdad: 02_Gestion_Personal.md §2.9.

import { DB } from '../../state.js';
import { supaSync } from '../../shared/supabase.js';
import { ensureModal, cerrarModal, showToast, capturar } from '../../shared/modal.js';
import { esc, fechaISOToDisplay } from '../../shared/helpers.js';
import { getCurrentUser, esRol } from '../../shared/auth.js';

export const CATEGORIAS_SUG = ['General', 'Seguridad', 'Operativo', 'Recursos humanos', 'Condiciones de trabajo'];

export function getSugerenciaById(id) {
  return (DB.sugerencias || []).find((s) => String(s.id) === String(id));
}

export function renderSugerencias() {
  const cont = document.getElementById('screen-sugerencias');
  const u = getCurrentUser();
  const esRrhh = u && esRol('Administrador total', 'RRHH');
  const lista = (DB.sugerencias || []).slice().sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
  cont.innerHTML = `
    <div class="stats">
      <div class="stat"><div class="num">${lista.length}</div><div class="lbl">Total</div></div>
      <div class="stat"><div class="num">${lista.filter((s) => s.estado === 'Nueva').length}</div><div class="lbl">Nuevas</div></div>
    </div>
    <div class="toolbar">
      <div class="spacer"></div>
      <button class="btn" onclick="abrirModalNuevaSugerencia()">+ Nueva sugerencia</button>
    </div>
    <div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>Fecha</th><th>Categoría</th><th>Texto</th><th>Anónima</th><th>Estado</th><th>Acciones</th></tr></thead>
      <tbody>
        ${lista.map((s) => {
          let acciones = `<button class="btn btn-secondary btn-sm" onclick="verSugerencia('${esc(String(s.id))}')">Ver</button>`;
          if (esRrhh) {
            if (s.estado === 'Nueva') acciones += `<button class="btn btn-success btn-sm" onclick="cerrarSugerencia('${esc(String(s.id))}')">Marcar vista</button>`;
            acciones += `<button class="btn btn-danger btn-sm" onclick="eliminarSugerencia('${esc(String(s.id))}')">Eliminar</button>`;
          }
          return `<tr>
            <td>${esc(fechaISOToDisplay(s.fecha))}</td>
            <td><span class="chip chip-azul">${esc(s.categoria || '')}</span></td>
            <td>${esc(s.texto)}</td>
            <td>${s.anonimo ? 'Sí' : 'No'}</td>
            <td><span class="chip ${s.estado === 'Nueva' ? 'chip-naranja' : 'chip-verde'}">${esc(s.estado)}</span></td>
            <td class="acciones">${acciones}</td>
          </tr>`;
        }).join('') || '<tr><td colspan="6" class="empty">Sin sugerencias.</td></tr>'}
      </tbody>
    </table></div>`;
}

export function abrirModalNuevaSugerencia() {
  ensureModal('modal-sugerencia', `
    <div class="modal-head"><h2>Nueva sugerencia</h2><button class="modal-close" onclick="cerrarModal('modal-sugerencia')">×</button></div>
    <form id="form-sugerencia">
      <div class="modal-body">
        <div class="form-grid">
          <div class="field"><label>Categoría</label>
            <select name="categoria">${CATEGORIAS_SUG.map((c) => `<option>${c}</option>`).join('')}</select></div>
          <div class="field"><label>Anónima</label>
            <select name="anonimo"><option value="true">Sí</option><option value="false">No</option></select></div>
          <div class="field full"><label>Texto *</label><textarea name="texto" rows="4" required></textarea></div>
        </div>
      </div>
      <div class="modal-foot"><button type="button" class="btn btn-secondary" onclick="cerrarModal('modal-sugerencia')">Cancelar</button><button type="submit" class="btn">Enviar</button></div>
    </form>`, {});
  document.getElementById('form-sugerencia').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const datos = capturar(ev);
    if (!datos.texto) { showToast('El texto es obligatorio.', 'err'); return; }
    const s = {
      id: Date.now().toString(),
      fecha: new Date().toISOString(),
      texto: datos.texto,
      categoria: datos.categoria,
      anonimo: datos.anonimo === 'true',
      usuario: datos.anonimo === 'true' ? '' : (getCurrentUser()?.nombre || ''),
      estado: 'Nueva',
    };
    DB.sugerencias.push(s);
    supaSync('sugerencias', s)
      .then(() => { cerrarModal('modal-sugerencia'); showToast('Sugerencia enviada', 'ok'); renderSugerencias(); })
      .catch((e) => showToast(e.message, 'err'));
  });
}

export function guardarSugerencia() { abrirModalNuevaSugerencia(); }

export function verSugerencia(id) {
  const s = getSugerenciaById(id);
  if (!s) return;
  ensureModal('modal-sugerencia-ver', `
    <div class="modal-head"><h2>Sugerencia — ${esc(s.categoria)}</h2><button class="modal-close" onclick="cerrarModal('modal-sugerencia-ver')">×</button></div>
    <div class="modal-body">
      <p>${esc(s.texto)}</p>
      <p class="muted">Fecha: ${esc(fechaISOToDisplay(s.fecha))} · Anónima: ${s.anonimo ? 'Sí' : 'No'}${s.usuario ? ' · De: ' + esc(s.usuario) : ''}</p>
    </div>
    <div class="modal-foot"><button class="btn btn-secondary" onclick="cerrarModal('modal-sugerencia-ver')">Cerrar</button></div>
  `, {});
}

export function cerrarSugerencia(id) {
  const s = getSugerenciaById(id);
  if (!s) return;
  s.estado = 'Vista';
  supaSync('sugerencias', s)
    .then(() => { showToast('Sugerencia marcada como vista', 'ok'); renderSugerencias(); })
    .catch((e) => showToast(e.message, 'err'));
}

export function eliminarSugerencia(id) {
  const s = getSugerenciaById(id);
  if (!s) return;
  const idx = (DB.sugerencias || []).findIndex((x) => String(x.id) === String(id));
  if (idx >= 0) DB.sugerencias.splice(idx, 1);
  supaSync('sugerencias', s)
    .then(() => { showToast('Sugerencia eliminada', 'ok'); renderSugerencias(); })
    .catch((e) => showToast(e.message, 'err'));
}

export function sugerenciasScreenInicio() {
  renderSugerencias();
}
