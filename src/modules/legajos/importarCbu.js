// Legajos — importador de CBU por CSV (nroSocio, cbu).
// Fuente de verdad: 01_Flujo_Ingreso.md §1.7.

import { DB } from '../../state.js';
import { supaSync } from '../../shared/supabase.js';
import { ensureModal, cerrarModal, showToast } from '../../shared/modal.js';
import { esc, esCbuValido } from '../../shared/helpers.js';

export function abrirImportarCbu() {
  ensureModal('modal-import-cbu', `
    <div class="modal-head"><h2>Importar CBU (CSV)</h2><button class="modal-close" onclick="cerrarModal('modal-import-cbu')">×</button></div>
    <div class="modal-body">
      <p>Columnas: <code>nroSocio,cbu</code> (CBU de 22 dígitos).</p>
      <div class="toolbar">
        <input type="file" id="cbu-import-file" accept=".csv,text/csv" />
      </div>
      <div id="cbu-import-preview"></div>
    </div>
    <div class="modal-foot"><button class="btn btn-secondary" onclick="cerrarModal('modal-import-cbu')">Cerrar</button></div>
  `, {});
  document.getElementById('cbu-import-file').addEventListener('change', (ev) => {
    const f = ev.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => previewCbu(r.result);
    r.readAsText(f);
  });
}

let _cbuImport = [];

function previewCbu(texto) {
  const filas = texto.replace(/\r/g, '').split('\n').filter((l) => l.trim()).slice(1);
  const datos = filas.map((l) => {
    const c = l.split(/[,;]/).map((x) => x.trim());
    return { nroSocio: c[0], cbu: String(c[1] || '').replace(/\D/g, '') };
  });
  _cbuImport = datos.filter((d) => d.nroSocio && esCbuValido(d.cbu));
  const invalidos = datos.filter((d) => d.nroSocio && !esCbuValido(d.cbu)).length;
  document.getElementById('cbu-import-preview').innerHTML = `
    <div class="alert ${_cbuImport.length ? 'alert-ok' : 'alert-warn'}">${_cbuImport.length} CBU válidos · ${invalidos} inválidos (ignorados).</div>
    ${_cbuImport.length ? '<button class="btn" onclick="confirmarImportarCbu()">Confirmar importación</button>' : ''}`;
}

export function confirmarImportarCbu() {
  let n = 0;
  const tareas = _cbuImport.map(({ nroSocio, cbu }) => {
    const leg = (DB.legajos || []).find((l) => String(l.nro) === String(nroSocio));
    if (!leg) return Promise.resolve();
    leg.cbu = cbu;
    return supaSync('legajos', leg).then(() => n++);
  });
  Promise.all(tareas)
    .then(() => { showToast(`${n} CBU actualizados`, 'ok'); cerrarModal('modal-import-cbu'); renderLegajos(); })
    .catch((e) => showToast(e.message, 'err'));
}
