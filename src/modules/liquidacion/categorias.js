// Categorías salariales — mantenimiento y vista previa de montos.
// Fuente de verdad: 03_Liquidacion.md §3.3.

import { DB } from '../../state.js';
import { supaSync } from '../../shared/supabase.js';
import { ensureModal, cerrarModal, showToast, capturar } from '../../shared/modal.js';
import { esc } from '../../shared/helpers.js';
import { obtenerCategorias, valorCategoria1, calcularSalario, redondear2 } from './liqUtils.js';

export function renderCategorias() {
  const cont = document.getElementById('screen-categorias');
  const anio = new Date().getFullYear();
  const mes = new Date().getMonth() + 1;
  cont.innerHTML = `
    <div class="card"><h3>Valor de la categoría 1 (${String(mes).padStart(2, '0')}/${anio})</h3>
      <p>Base SMVM actual: <strong>$${redondear2(valorCategoria1(anio, mes))}</strong></p>
    </div>
    <div class="toolbar"><div class="spacer"></div><button class="btn" onclick="agregarCategoria()">+ Nueva categoría</button></div>
    <div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>Nombre</th><th>Factor</th><th>Adicional</th><th>Salario actual</th><th>Acciones</th></tr></thead>
      <tbody>
        ${obtenerCategorias().map((c) => `<tr>
          <td>${esc(c.nombre)}</td>
          <td>${c.factor || 1}</td>
          <td>$${c.adicional || 0}</td>
          <td><strong>$${redondear2(calcularSalario(c.nombre, anio, mes))}</strong></td>
          <td class="acciones"><button class="btn btn-secondary btn-sm" onclick="editarCategoria('${esc(String(c.id))}')">Editar</button><button class="btn btn-danger btn-sm" onclick="anularCategoria('${esc(String(c.id))}')">Anular</button></td>
        </tr>`).join('') || '<tr><td colspan="5" class="empty">Sin categorías.</td></tr>'}
      </tbody>
    </table></div>`;
}

export function vistaPreviaCategorias() {
  renderCategorias();
}

export function abrirModalCategoria(c) {
  ensureModal('modal-categoria', `
    <div class="modal-head"><h2>${c ? 'Editar categoría' : 'Nueva categoría'}</h2><button class="modal-close" onclick="cerrarModal('modal-categoria')">×</button></div>
    <form id="form-categoria">
      <div class="modal-body">
        <div class="form-grid">
          <div class="field"><label>Nombre *</label><input name="nombre" value="${esc(c?.nombre || '')}" required /></div>
          <div class="field"><label>Factor (multiplicador)</label><input type="number" name="factor" value="${c?.factor ?? 1}" step="0.01" /></div>
          <div class="field"><label>Adicional ($)</label><input type="number" name="adicional" value="${c?.adicional ?? 0}" /></div>
        </div>
      </div>
      <div class="modal-foot"><button type="button" class="btn btn-secondary" onclick="cerrarModal('modal-categoria')">Cancelar</button><button type="submit" class="btn">Guardar</button></div>
    </form>`, {});
  document.getElementById('form-categoria').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const datos = capturar(ev);
    if (!datos.nombre) { showToast('Nombre obligatorio.', 'err'); return; }
    const obj = { id: c?.id || Date.now().toString(), nombre: datos.nombre, factor: Number(datos.factor) || 1, adicional: Number(datos.adicional) || 0, anulado: false };
    if (c) {
      const idx = (DB.categorias || []).findIndex((x) => String(x.id) === String(c.id));
      if (idx >= 0) DB.categorias[idx] = obj;
      else DB.categorias.push(obj);
    } else {
      if ((DB.categorias || []).some((x) => x.nombre === datos.nombre)) { showToast('Ese nombre ya existe.', 'err'); return; }
      (DB.categorias ||= []).push(obj);
    }
    supaSync('categorias', obj)
      .then(() => { cerrarModal('modal-categoria'); showToast('Categoría guardada', 'ok'); renderCategorias(); })
      .catch((e) => showToast(e.message, 'err'));
  });
}

export function agregarCategoria() { abrirModalCategoria(null); }
export function editarCategoria(id) { abrirModalCategoria((DB.categorias || []).find((c) => String(c.id) === String(id)) || obtenerCategorias().find((c) => String(c.id) === String(id))); }
export function guardarCategoria() { abrirModalCategoria(null); }

export function anularCategoria(id) {
  const c = (DB.categorias || []).find((x) => String(x.id) === String(id));
  if (!c) { showToast('Solo se anulan categorías propias.', 'warn'); return; }
  c.anulado = true;
  supaSync('categorias', c)
    .then(() => { showToast('Categoría anulada', 'warn'); renderCategorias(); })
    .catch((e) => showToast(e.message, 'err'));
}

export function verParametrosValoresYObservaciones() {
  renderCategorias();
}
