// Importador histórico de candidatos — planilla CSV real de entrevistas (28 columnas).
// Fuente de verdad: 01_Flujo_Ingreso.md §1.2.

import { DB } from '../../state.js';
import { supaSync } from '../../shared/supabase.js';
import { showToast, cerrarModal, ensureModal } from '../../shared/modal.js';
import { esc, fechaCsvAISO } from '../../shared/helpers.js';

export const COLUMNAS_HISTORICO = [
  'fecha', 'entrevistadora', 'modalidad', 'apellidos', 'nombres', 'dni', 'genero', 'telefono', 'edad',
  'localidad', 'zona', 'disponibilidad', 'experiencia', 'presencia', 'exp_verbal', 'compr_consignas',
  'predisposicion', 'rel_interpersonal', 'evaluacion_final', 'observaciones', 'medio',
  'detalle_convocatoria', 'correo_electronico', 'posible_servicio', 'fecha_psico', 'psicotecnico',
  'fecha_ingreso', 'obs_psicotecnico',
];

export function mapearEstadoDesdeResultado(evaluacionFinal) {
  const e = String(evaluacionFinal || '').toLowerCase().trim();
  if (!e) return 'Entrevistado';
  if (e.includes('aprob')) return 'Aprobado';
  if (e.includes('desaprob')) return 'Rechazado';
  return 'Entrevistado';
}

// Parser CSV: soporta comas o punto y coma, y campos entre comillas.
export function parsearCsv(texto) {
  const lineas = texto.replace(/\r/g, '').split('\n').filter((l) => l.trim());
  if (!lineas.length) return [];
  const delim = lineas[0].includes(';') ? ';' : ',';
  const filas = [];
  for (const linea of lineas) {
    const campos = [];
    let cur = '';
    let entreComillas = false;
    for (const ch of linea) {
      if (ch === '"') entreComillas = !entreComillas;
      else if (ch === delim && !entreComillas) { campos.push(cur); cur = ''; }
      else cur += ch;
    }
    campos.push(cur);
    filas.push(campos.map((c) => c.trim()));
  }
  return filas;
}

export function prepararImportacion(texto) {
  const filas = parsearCsv(texto);
  const encabezados = filas[0] || [];
  const datos = filas.slice(1).filter((f) => f.some((c) => c));
  const dnisExistentes = new Set((DB.candidatos || []).map((c) => c.dni));
  const vistos = new Set();
  const preview = [];

  for (const f of datos) {
    const obj = {};
    COLUMNAS_HISTORICO.forEach((col, i) => { obj[col] = f[i] || ''; });
    const dni = obj.dni.replace(/\D/g, '');
    const _yaImportado = dnisExistentes.has(dni);
    const _duplicadoEnArchivo = vistos.has(dni);
    vistos.add(dni);
    const _valido = /^\d{6,8}$/.test(dni) && Boolean(obj.apellidos || obj.nombres) && !_duplicadoEnArchivo;
    preview.push({ ...obj, dni, _valido, _yaImportado });
  }
  return { preview, ok: preview.filter((p) => p._valido && !p._yaImportado) };
}

export function renderImportadorHistorico(container) {
  container.innerHTML = `
    <div class="card" style="max-width:820px">
      <h3>Importar histórico de candidatos</h3>
      <p>Subí la planilla de entrevistas de RRHH (CSV, ${COLUMNAS_HISTORICO.length} columnas). El sistema valida DNI y evita duplicados.</p>
      <div class="toolbar">
        <input type="file" id="hist-csv" accept=".csv,text/csv" />
        <button class="btn btn-secondary" onclick="descargarPlantillaHistorico()">Descargar plantilla</button>
      </div>
      <div id="hist-preview"></div>
    </div>`;
  document.getElementById('hist-csv').addEventListener('change', (ev) => {
    const file = ev.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => mostrarPreview(reader.result);
    reader.readAsText(file);
  });
}

export function descargarPlantillaHistorico() {
  const cab = COLUMNAS_HISTORICO.join(',');
  const fila = [
    '01/03/2026', 'María Gómez', 'Presencial', 'Pérez', 'Juan', '30123456', 'Masculino', '11-5555-6666', '28',
    'San Martín', 'Oeste', 'Full time', 'Sí', 'Buena', 'Buena', 'Buena', 'Buena', 'Muy buena', 'Aprobado',
    'Sin observaciones', 'Referido', '—', 'jperez@mail.com', 'Edificio Centro', '05/03/2026', 'Apto', '06/03/2026', '—',
  ];
  const blob = new Blob(['\ufeff' + cab + '\n' + fila.join(',')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'plantilla_historico_candidatos.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}

function mostrarPreview(texto) {
  const { preview, ok } = prepararImportacion(texto);
  _ultimaImportacion = { preview, ok };
  const cont = document.getElementById('hist-preview');
  cont.innerHTML = `
    ${preview.length ? `<div class="alert ${ok.length ? 'alert-ok' : 'alert-warn'}">${ok.length} filas válidas para importar de ${preview.length} totales (${preview.length - ok.length} inválidas/duplicadas).</div>` : '<div class="alert alert-error">El archivo no tiene filas de datos.</div>'}
    <div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>Fecha</th><th>Apellidos</th><th>Nombres</th><th>DNI</th><th>Zona</th><th>Evaluación</th><th>Estado destino</th><th>Estado</th></tr></thead>
      <tbody>
        ${preview.map((p, i) => `<tr>
          <td>${esc(p.fecha)}</td><td>${esc(p.apellidos)}</td><td>${esc(p.nombres)}</td><td>${esc(p.dni)}</td>
          <td>${esc(p.zona)}</td><td>${esc(p.evaluacion_final)}</td><td>${mapearEstadoDesdeResultado(p.evaluacion_final)}</td>
          <td>${p._valido ? (p._yaImportado ? '<span class="chip chip-naranja">Ya importado</span>' : '<span class="chip chip-verde">OK</span>') : '<span class="chip chip-rojo">Inválido</span>'}</td>
        </tr>`).join('')}
      </tbody>
    </table></div>
    ${ok.length ? `<div class="toolbar"><button class="btn" onclick="confirmarImportHistorico()">Importar ${ok.length} candidatos</button></div>` : ''}`;
}

let _ultimaImportacion = null;

export function confirmarImportHistorico() {
  if (!_ultimaImportacion?.ok?.length) { showToast('No hay filas para importar.', 'err'); return; }
  let n = 0;
  const tareas = _ultimaImportacion.ok.map((p) => {
    const cand = {
      id: Date.now().toString() + Math.floor(Math.random() * 1000),
      apellido: p.apellidos,
      nombre: p.nombres,
      dni: p.dni,
      genero: p.genero,
      telefono: p.telefono,
      localidad: p.localidad,
      zona: p.zona,
      disponibilidadHoraria: p.disponibilidad,
      medio: p.medio || 'Importación histórica',
      email: p.correo_electronico,
      obs: `Histórico: entrevistadora ${p.entrevistadora} · fecha cita ${p.fecha} · ${p.observaciones}`,
      fechaCita: fechaCsvAISO(p.fecha) || '',
      estado: mapearEstadoDesdeResultado(p.evaluacion_final),
      creadoPor: 'Importación histórica',
    };
    DB.candidatos.push(cand);
    return supaSync('candidatos', cand).then(() => n++);
  });
  Promise.all(tareas)
    .then(() => { showToast(`${n} candidatos importados`, 'ok'); _ultimaImportacion = null; renderImportadorHistorico(document.getElementById('cand-contenido')); })
    .catch((e) => showToast(e.message, 'err'));
}

// Hook para el botón de importar desde el preview.
window.__setImportacionHistorico = (obj) => { _ultimaImportacion = obj; };
