// Legajos — importador CSV de legajos (plantilla descargable).
// Fuente de verdad: 01_Flujo_Ingreso.md §1.7.

import { DB } from '../../state.js';
import { supaSync } from '../../shared/supabase.js';
import { ensureModal, cerrarModal, showToast } from '../../shared/modal.js';
import { esc, fechaCsvAISO, maxP1 } from '../../shared/helpers.js';

const CAMPOS = [
  ['nombre', 'Nombre'],
  ['dni', 'DNI'],
  ['funcion', 'Función'],
  ['servicio', 'Servicio'],
  ['supervisor', 'Supervisor'],
  ['ingreso', 'Ingreso (DD/MM/AAAA)'],
  ['categoria', 'Categoría'],
];

export function abrirImportadorLegajos() {
  ensureModal('modal-import-legajos', `
    <div class="modal-head"><h2>Importar legajos (CSV)</h2><button class="modal-close" onclick="cerrarModal('modal-import-legajos')">×</button></div>
    <div class="modal-body">
      <p>Columnas: ${CAMPOS.map(([, l]) => l).join(' · ')}</p>
      <div class="toolbar">
        <input type="file" id="leg-import-file" accept=".csv,text/csv" />
        <button class="btn btn-secondary" onclick="descargarPlantillaLegajos()">Descargar plantilla</button>
      </div>
      <div id="leg-import-preview"></div>
    </div>
    <div class="modal-foot"><button class="btn btn-secondary" onclick="cerrarModal('modal-import-legajos')">Cerrar</button></div>
  `, {});
  document.getElementById('leg-import-file').addEventListener('change', (ev) => {
    const f = ev.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => previewLegajos(r.result);
    r.readAsText(f);
  });
}

export function descargarPlantillaLegajos() {
  const cab = CAMPOS.map(([k]) => k).join(',');
  const fila = ['Juan Pérez', '30123456', 'Operario', 'Edificio Centro', 'Carlos Gómez', '01/06/2026', 'Operario C2'];
  const blob = new Blob(['\ufeff' + cab + '\n' + fila.join(',')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'plantilla_legajos.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}

let _legImport = [];

function previewLegajos(texto) {
  const filas = texto.replace(/\r/g, '').split('\n').filter((l) => l.trim()).slice(1);
  const datos = filas.map((l) => {
    const c = l.split(/[,;]/).map((x) => x.trim().replace(/^"|"$/g, ''));
    const o = {};
    CAMPOS.forEach(([k], i) => { o[k] = c[i] || ''; });
    return o;
  });
  _legImport = datos.filter((d) => d.dni && d.nombre);
  document.getElementById('leg-import-preview').innerHTML = `
    <div class="alert ${_legImport.length ? 'alert-ok' : 'alert-warn'}">${_legImport.length} legajos válidos listos para importar.</div>
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Nombre</th><th>DNI</th><th>Función</th><th>Servicio</th><th>Ingreso</th></tr></thead><tbody>
      ${_legImport.map((d) => `<tr><td>${esc(d.nombre)}</td><td>${esc(d.dni)}</td><td>${esc(d.funcion)}</td><td>${esc(d.servicio)}</td><td>${esc(d.ingreso)}</td></tr>`).join('')}
    </tbody></table></div>
    ${_legImport.length ? '<button class="btn" onclick="confirmarImportacionLegajos()">Confirmar importación</button>' : ''}`;
}

export function confirmarImportacionLegajos() {
  let nro = maxP1(DB.legajos, 'nro');
  let n = 0;
  const tareas = _legImport.map((d) => {
    const legajo = {
      id: String(nro),
      nro,
      nombre: d.nombre,
      dni: d.dni,
      funcion: d.funcion,
      servicio: d.servicio,
      supervisor: d.supervisor,
      sector: d.funcion === 'Administrativo' ? 'Administrativo' : 'Operativo',
      ingreso: fechaCsvAISO(d.ingreso) || '',
      estado: 'Activo',
      estadoLegal: '',
      estadoMedico: '',
      fechaBaja: '',
      fechaReincorp: '',
      legajoAnteriorNro: '',
      periodoPrueba: 6,
      categoria: d.categoria,
      tallesUniforme: {},
      polizas: [],
    };
    nro++;
    DB.legajos.push(legajo);
    return supaSync('legajos', legajo).then(() => n++);
  });
  Promise.all(tareas)
    .then(() => { showToast(`${n} legajos importados`, 'ok'); cerrarModal('modal-import-legajos'); renderLegajos(); })
    .catch((e) => showToast(e.message, 'err'));
}
