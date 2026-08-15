// Competencia Anual — configuración de reglas/puntos.
// Fuente de verdad: 02_Gestion_Personal.md §2.2.

import { DB } from '../../state.js';
import { supaSync } from '../../shared/supabase.js';
import { ensureModal, cerrarModal, showToast, capturar } from '../../shared/modal.js';
import { esc } from '../../shared/helpers.js';
import { REGLAS_DEFAULT, reglasActivas } from './movimientos.js';

export function renderReglasComp() {
  const cont = document.getElementById('screen-reglas-comp');
  cont.innerHTML = `
    <div class="toolbar">
      <div class="spacer"></div>
      <button class="btn" onclick="agregarReglaComp()">+ Nueva regla</button>
      <button class="btn btn-secondary" onclick="resetearReglasDefault()">Restaurar reglas por defecto</button>
    </div>
    <div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>Código</th><th>Descripción</th><th>Puntos</th><th>Activa</th><th>Acciones</th></tr></thead>
      <tbody>
        ${reglasActivas().map((r) => `<tr>
          <td><code>${esc(r.reglaCodigo)}</code></td>
          <td>${esc(r.descripcion)}</td>
          <td>${r.puntos}</td>
          <td><span class="chip ${r.activa ? 'chip-verde' : 'chip-gris'}">${r.activa ? 'Sí' : 'No'}</span></td>
          <td class="acciones">
            <button class="btn btn-secondary btn-sm" onclick="editarReglaComp('${esc(r.reglaCodigo)}')">Editar</button>
            <button class="btn btn-secondary btn-sm" onclick="toggleReglaComp('${esc(r.reglaCodigo)}')">${r.activa ? 'Desactivar' : 'Activar'}</button>
            <button class="btn btn-danger btn-sm" onclick="anularReglaComp('${esc(r.reglaCodigo)}')">Anular</button>
          </td>
        </tr>`).join('') || '<tr><td colspan="5" class="empty">Sin reglas.</td></tr>'}
      </tbody>
    </table></div>`;
}

function reglaPorCodigo(codigo) {
  return (DB.reglasCompetencia || []).find((r) => r.reglaCodigo === codigo) || REGLAS_DEFAULT.find((r) => r.reglaCodigo === codigo);
}

export function toggleReglaComp(codigo) {
  const r = reglaPorCodigo(codigo);
  if (!r) return;
  r.activa = !r.activa;
  const arr = (DB.reglasCompetencia ||= []);
  const existente = arr.find((x) => x.reglaCodigo === codigo);
  if (existente) Object.assign(existente, r);
  else arr.push({ ...r });
  supaSync('reglasCompetencia', { ...r })
    .then(() => { renderReglasComp(); showToast(`Regla ${r.activa ? 'activada' : 'desactivada'}`, 'ok'); })
    .catch((e) => showToast(e.message, 'err'));
}

export function editarReglaComp(codigo) {
  const r = reglaPorCodigo(codigo);
  if (!r) return;
  ensureModal('modal-regla', `
    <div class="modal-head"><h2>Editar regla</h2><button class="modal-close" onclick="cerrarModal('modal-regla')">×</button></div>
    <form id="form-regla">
      <div class="modal-body">
        <div class="form-grid">
          <div class="field"><label>Código</label><input name="reglaCodigo" value="${esc(r.reglaCodigo)}" readonly /></div>
          <div class="field"><label>Descripción</label><input name="descripcion" value="${esc(r.descripcion)}" required /></div>
          <div class="field"><label>Puntos</label><input type="number" name="puntos" value="${r.puntos}" required /></div>
        </div>
      </div>
      <div class="modal-foot"><button type="button" class="btn btn-secondary" onclick="cerrarModal('modal-regla')">Cancelar</button><button type="submit" class="btn">Guardar</button></div>
    </form>`, {});
  document.getElementById('form-regla').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const datos = capturar(ev);
    const r2 = reglaPorCodigo(datos.reglaCodigo);
    Object.assign(r2, { descripcion: datos.descripcion, puntos: Number(datos.puntos) });
    const arr = (DB.reglasCompetencia ||= []);
    const existente = arr.find((x) => x.reglaCodigo === datos.reglaCodigo);
    if (existente) Object.assign(existente, r2);
    else arr.push({ ...r2 });
    supaSync('reglasCompetencia', { ...r2 })
      .then(() => { cerrarModal('modal-regla'); renderReglasComp(); showToast('Regla guardada', 'ok'); })
      .catch((e) => showToast(e.message, 'err'));
  });
}

export function agregarReglaComp() {
  ensureModal('modal-regla', `
    <div class="modal-head"><h2>Nueva regla</h2><button class="modal-close" onclick="cerrarModal('modal-regla')">×</button></div>
    <form id="form-regla">
      <div class="modal-body">
        <div class="form-grid">
          <div class="field"><label>Código</label><input name="reglaCodigo" placeholder="mi_regla" required /></div>
          <div class="field"><label>Descripción</label><input name="descripcion" required /></div>
          <div class="field"><label>Puntos</label><input type="number" name="puntos" value="0" required /></div>
        </div>
      </div>
      <div class="modal-foot"><button type="button" class="btn btn-secondary" onclick="cerrarModal('modal-regla')">Cancelar</button><button type="submit" class="btn">Guardar</button></div>
    </form>`, {});
  document.getElementById('form-regla').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const datos = capturar(ev);
    if ((DB.reglasCompetencia || []).some((r) => r.reglaCodigo === datos.reglaCodigo)) { showToast('Ese código ya existe.', 'err'); return; }
    const nueva = { ...datos, puntos: Number(datos.puntos), activa: true, criterioExcluyente: false };
    (DB.reglasCompetencia ||= []).push(nueva);
    supaSync('reglasCompetencia', nueva)
      .then(() => { cerrarModal('modal-regla'); renderReglasComp(); showToast('Regla creada', 'ok'); })
      .catch((e) => showToast(e.message, 'err'));
  });
}

export function anularReglaComp(codigo) {
  const r = reglaPorCodigo(codigo);
  if (!r) return;
  r.anulado = true;
  const arr = (DB.reglasCompetencia ||= []);
  const existente = arr.find((x) => x.reglaCodigo === codigo);
  if (existente) Object.assign(existente, r);
  else arr.push({ ...r });
  supaSync('reglasCompetencia', { ...r })
    .then(() => { renderReglasComp(); showToast('Regla anulada', 'warn'); })
    .catch((e) => showToast(e.message, 'err'));
}

export function resetearReglasDefault() {
  DB.reglasCompetencia = REGLAS_DEFAULT.map((r) => ({ ...r }));
  Promise.all(DB.reglasCompetencia.map((r) => supaSync('reglasCompetencia', r)))
    .then(() => { renderReglasComp(); showToast('Reglas restauradas', 'ok'); })
    .catch((e) => showToast(e.message, 'err'));
}
