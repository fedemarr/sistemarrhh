// Capacitaciones — agenda, dictado, resultados y evaluación; hookea Competencia Anual.
// Fuente de verdad: 02_Gestion_Personal.md §2.1.

import { DB } from '../../state.js';
import { supaSync } from '../../shared/supabase.js';
import { ensureModal, cerrarModal, showToast, capturar } from '../../shared/modal.js';
import { esc, hoyISO, fechaISOToDisplay } from '../../shared/helpers.js';
import { getCurrentUser } from '../../shared/auth.js';
import { registrarEvento } from '../competencia/movimientos.js';

export const LUGARES_CAP = ['Servicio', 'Oficina Central', 'Virtual', 'Externo'];
export const ESTADOS_CAP = ['Programada', 'Dictada', 'Cancelada'];
export const RESULTADOS_CAP = ['Aprobado', 'Desaprobado', 'Pendiente evaluación', 'Sin evaluación'];

export function getCapById(id) {
  return (DB.capacitaciones || []).find((c) => String(c.id) === String(id));
}

export function esAdministrativo(leg) {
  return leg?.sector === 'Administrativo' || leg?.funcion === 'Administrativo';
}

export function autocompletarCap() {
  const nro = document.getElementById('cap-nro-socio')?.value;
  const leg = (DB.legajos || []).find((l) => String(l.nro) === String(nro));
  if (!leg) { showToast('Socio no encontrado.', 'warn'); return; }
  if (leg.estado !== 'Activo') { showToast('No se agenda capacitación para un asociado no activo.', 'err'); return; }
  const el = document.getElementById('cap-nombre');
  if (el) el.value = leg.nombre || '';
  const serv = document.getElementById('cap-servicio');
  if (serv && leg.servicio && !serv.value) serv.value = leg.servicio;
}

export function renderCapacitaciones(tab = 'registro') {
  const cont = document.getElementById('screen-capacitaciones');
  const pendientes = (DB.capacitaciones || []).filter(
    (c) => !c.anulado && (c.estado === 'Programada' || (c.estado === 'Dictada' && c.resultado === 'Pendiente evaluación'))
  );
  cont.innerHTML = `
    <div class="stats">
      <div class="stat"><div class="num">${(DB.capacitaciones || []).length}</div><div class="lbl">Total</div></div>
      <div class="stat"><div class="num">${pendientes.length}</div><div class="lbl">Pendientes (programada o sin resultado)</div></div>
      <div class="stat"><div class="num">${(DB.capacitaciones || []).filter((c) => c.estado === 'Dictada' && c.resultado === 'Aprobado').length}</div><div class="lbl">Aprobadas</div></div>
    </div>
    <div class="tabs">
      ${[['registro', 'Registro'], ['estadisticas', 'Estadísticas'], ['calendario', 'Plan mensual'], ['repositorio', 'Repositorio'], ['evaluaciones', 'Evaluaciones']]
        .map(([k, l]) => `<button class="tab-btn ${tab === k ? 'active' : ''}" onclick="renderCapacitaciones('${k}')">${l}</button>`).join('')}
    </div>
    <div id="cap-contenido"></div>`;
  const panel = document.getElementById('cap-contenido');
  if (tab === 'estadisticas') {
    const aprobadasAnio = (DB.capacitaciones || []).filter((c) => c.estado === 'Dictada' && c.resultado === 'Aprobado' && (c.fecha || '').startsWith(String(new Date().getFullYear()))).length;
    const sinNinguna = (DB.legajos || []).filter((l) => l.estado === 'Activo' && !(DB.capacitaciones || []).some((c) => c.nroSocio === l.nro && c.estado === 'Dictada')).length;
    panel.innerHTML = `<div class="stats">
      <div class="stat"><div class="num">${aprobadasAnio}</div><div class="lbl">Capacitados en el año</div></div>
      <div class="stat"><div class="num">${sinNinguna}</div><div class="lbl">Activos sin ninguna capacitación</div></div>
    </div>`;
    return;
  }
  if (tab === 'repositorio') {
    panel.innerHTML = `<div class="card"><h3>Repositorio de materiales</h3>
      <div class="grid3">${(DB.materialesCapacitacion || []).map((m) => `<div class="stat"><div class="lbl">${esc(m.nombre || '')}</div><div class="num" style="font-size:14px">${esc(m.tipoCapacitacion || '')}</div></div>`).join('') || '<div class="empty">Sin materiales cargados.</div>'}</div>
    </div>`;
    return;
  }
  if (tab === 'evaluaciones') {
    panel.innerHTML = `<div class="card"><h3>Evaluaciones</h3><p class="muted">Las evaluaciones se cargan al dictar la capacitación (método, resultado y puntaje).</p></div>`;
    return;
  }
  if (tab === 'calendario') {
    const mes = new Date().toISOString().slice(0, 7);
    const delMes = (DB.capacitaciones || []).filter((c) => (c.fecha || '').startsWith(mes)).sort((a, b) => a.fecha.localeCompare(b.fecha));
    panel.innerHTML = `<div class="card"><h3>Plan del mes ${fechaISOToDisplay(mes + '-01')}</h3>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Fecha</th><th>Asociado</th><th>Tipo</th><th>Lugar</th><th>Instructor</th><th>Estado</th></tr></thead><tbody>
      ${delMes.length ? delMes.map((c) => `<tr><td>${esc(fechaISOToDisplay(c.fecha))}</td><td>${esc(c.nombreAsociado)}</td><td>${esc(c.tipo)}</td><td>${esc(c.lugar)}</td><td>${esc(c.instructor)}</td><td>${esc(c.estado)}</td></tr>`).join('') : '<tr><td colspan="6" class="empty">Sin capacitaciones este mes.</td></tr>'}
      </tbody></table></div></div>`;
    return;
  }
  panel.innerHTML = `
    <div class="toolbar">
      <input type="text" id="cap-buscar" placeholder="Buscar asociado / tipo…" oninput="filtrarCapacitaciones()" />
      <div class="spacer"></div>
      <button class="btn" onclick="abrirNuevaCapacitacion()">+ Programar capacitación</button>
    </div>
    <div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>Asociado</th><th>N°</th><th>Fecha</th><th>Tipo</th><th>Lugar</th><th>Servicio</th><th>Instructor</th><th>Método</th><th>Resultado</th><th>Acciones</th></tr></thead>
      <tbody>
        ${pendientes.length ? pendientes.map(filaCap).join('') : '<tr><td colspan="10" class="empty">Sin capacitaciones pendientes.</td></tr>'}
      </tbody>
    </table></div>`;
}

export function filtrarCapacitaciones() {
  const term = document.getElementById('cap-buscar')?.value.toLowerCase() || '';
  const filas = document.querySelectorAll('#cap-contenido tbody tr');
  filas.forEach((tr) => tr.classList.toggle('hidden', !tr.textContent.toLowerCase().includes(term)));
}

function filaCap(c) {
  return `<tr>
    <td>${esc(c.nombreAsociado || '')}</td>
    <td>${esc(c.nroSocio || '')}</td>
    <td>${esc(fechaISOToDisplay(c.fecha))}</td>
    <td><span class="chip chip-azul">${esc(c.tipo || '')}</span></td>
    <td>${esc(c.lugar || '')}</td>
    <td>${esc(c.servicio || '')}</td>
    <td>${esc(c.instructor || '')}</td>
    <td>${esc(c.metodoEvaluacion || '')}</td>
    <td>${chipResultadoCap(c)}</td>
    <td class="acciones">
      <button class="btn btn-secondary btn-sm" onclick="abrirEditarCapacitacionPorId('${esc(String(c.id))}')">Editar</button>
      ${c.estado === 'Programada' ? `<button class="btn btn-success btn-sm" onclick="abrirDictarCapacitacionPorId('${esc(String(c.id))}')">Dictar</button><button class="btn btn-danger btn-sm" onclick="cancelarCap('${esc(String(c.id))}')">Cancelar</button>` : ''}
      ${c.estado === 'Dictada' ? `<button class="btn btn-success btn-sm" onclick="abrirDictarCapacitacionPorId('${esc(String(c.id))}')">Cargar resultado</button>` : ''}
      <button class="btn btn-danger btn-sm" onclick="anularCapacitacionPorId('${esc(String(c.id))}')">Anular</button>
    </td>
  </tr>`;
}

function chipResultadoCap(c) {
  const r = c.resultado || 'Pendiente evaluación';
  const cls = r === 'Aprobado' ? 'chip-verde' : r === 'Desaprobado' ? 'chip-rojo' : 'chip-gris';
  return `<span class="chip ${cls}">${esc(r)}</span>`;
}

export function poblarSelectsCapacitaciones() {
  /* hook de auth */
}

function camposCap(c) {
  return `
    <div class="form-grid">
      <div class="field"><label>N° de socio *</label><input name="nroSocio" id="cap-nro-socio" value="${esc(c?.nroSocio || '')}" onchange="autocompletarCap()" required /></div>
      <div class="field"><label>Asociado</label><input name="nombreAsociado" id="cap-nombre" value="${esc(c?.nombreAsociado || '')}" /></div>
      <div class="field"><label>Tipo *</label>
        <select name="tipo">${(DB.tiposCapacitacion || []).map((t) => `<option ${c?.tipo === t.nombre ? 'selected' : ''}>${esc(t.nombre)}</option>`).join('') || '<option>Seguridad e higiene</option><option>Manejo de máquinas</option><option>Atención al cliente</option>'}</select></div>
      <div class="field"><label>Fecha *</label><input type="date" name="fecha" value="${esc(c?.fecha || hoyISO())}" required /></div>
      <div class="field"><label>Lugar *</label>
        <select name="lugar">${LUGARES_CAP.map((l) => `<option ${c?.lugar === l ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      <div class="field"><label>Servicio</label><input name="servicio" id="cap-servicio" value="${esc(c?.servicio || '')}" /></div>
      <div class="field"><label>Instructor</label>
        <select name="instructor">${(DB.instructores || []).map((i) => `<option ${c?.instructor === i.nombre ? 'selected' : ''}>${esc(i.nombre)}</option>`).join('') || '<option>Instructor interno</option>'}</select></div>
      <div class="field"><label>Método de evaluación</label>
        <select name="metodoEvaluacion">${(DB.metodosEval || []).map((m) => `<option ${c?.metodoEvaluacion === m.nombre ? 'selected' : ''}>${esc(m.nombre)}</option>`).join('') || '<option>Examen escrito</option><option>Práctica</option><option>Sin evaluación</option>'}</select></div>
      <div class="field full"><label>Observaciones</label><textarea name="observaciones" rows="2">${esc(c?.observaciones || '')}</textarea></div>
    </div>`;
}

export function abrirNuevaCapacitacion() {
  ensureModal('modal-cap', `
    <div class="modal-head"><h2>Programar capacitación</h2><button class="modal-close" onclick="cerrarModal('modal-cap')">×</button></div>
    <form id="form-cap">
      <div class="modal-body">${camposCap(null)}</div>
      <div class="modal-foot"><button type="button" class="btn btn-secondary" onclick="cerrarModal('modal-cap')">Cancelar</button><button type="submit" class="btn">Programar</button></div>
    </form>`, { size: 'modal-lg' });
  document.getElementById('form-cap').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const datos = capturar(ev);
    const error = validarCap(datos);
    if (error) { showToast(error, 'err'); return; }
    const c = {
      id: Date.now().toString(),
      ...datos,
      nroSocio: Number(datos.nroSocio) || null,
      legajoIdLocal: String(datos.nroSocio),
      estado: 'Programada',
      resultado: 'Pendiente evaluación',
      puntaje: 0,
      editadoPor: getCurrentUser()?.nombre || '',
      editadoEn: new Date().toISOString(),
    };
    DB.capacitaciones.push(c);
    supaSync('capacitaciones', c)
      .then(() => { cerrarModal('modal-cap'); showToast('Capacitación programada', 'ok'); renderCapacitaciones('registro'); })
      .catch((e) => showToast(e.message, 'err'));
  });
}

export function validarCap(datos) {
  if (!datos.nroSocio) return 'El N° de socio es obligatorio.';
  const leg = (DB.legajos || []).find((l) => String(l.nro) === String(datos.nroSocio));
  if (!leg) return 'No existe ese socio.';
  if (leg.estado !== 'Activo') return 'No se agenda para un asociado no activo.';
  if (datos.fecha < hoyISO()) return 'La fecha no puede ser anterior a hoy.';
  if (datos.lugar === 'Servicio' && !datos.servicio) return 'Si el lugar es Servicio, completá el servicio.';
  return null;
}

export function abrirEditarCapacitacionPorId(id) {
  const c = getCapById(id);
  if (!c) return;
  ensureModal('modal-cap', `
    <div class="modal-head"><h2>Editar capacitación</h2><button class="modal-close" onclick="cerrarModal('modal-cap')">×</button></div>
    <form id="form-cap-edit">
      <div class="modal-body">${camposCap(c)}</div>
      <div class="modal-foot"><button type="button" class="btn btn-secondary" onclick="cerrarModal('modal-cap')">Cancelar</button><button type="submit" class="btn">Guardar</button></div>
    </form>`, { size: 'modal-lg' });
  document.getElementById('form-cap-edit').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const datos = capturar(ev);
    Object.assign(c, datos, { nroSocio: Number(datos.nroSocio), legajoIdLocal: String(datos.nroSocio), editadoPor: getCurrentUser()?.nombre, editadoEn: new Date().toISOString() });
    supaSync('capacitaciones', c)
      .then(() => { cerrarModal('modal-cap'); showToast('Capacitación actualizada', 'ok'); renderCapacitaciones('registro'); })
      .catch((e) => showToast(e.message, 'err'));
  });
}

export function guardarCapacitacion(datos) {
  const c = getCapById(datos.id);
  if (c) Object.assign(c, datos);
  else DB.capacitaciones.push(datos);
  return supaSync('capacitaciones', datos);
}

export function cancelarCap(id) {
  const c = getCapById(id);
  if (!c) return;
  if (c.estado !== 'Programada') { showToast('Solo se cancela una capacitación Programada.', 'warn'); return; }
  c.estado = 'Cancelada';
  supaSync('capacitaciones', c)
    .then(() => { showToast('Capacitación cancelada', 'warn'); renderCapacitaciones('registro'); })
    .catch((e) => showToast(e.message, 'err'));
}

export function anularCapacitacionPorId(id) {
  const c = getCapById(id);
  if (!c) return;
  c.anulado = true;
  supaSync('capacitaciones', c)
    .then(() => { showToast('Capacitación anulada', 'warn'); renderCapacitaciones('registro'); })
    .catch((e) => showToast(e.message, 'err'));
}

export function abrirDictarCapacitacionPorId(id) {
  const c = getCapById(id);
  if (!c) return;
  ensureModal('modal-cap-dictado', `
    <div class="modal-head"><h2>Dictar capacitación — ${esc(c.nombreAsociado || '')} (${esc(c.tipo)})</h2><button class="modal-close" onclick="cerrarModal('modal-cap-dictado')">×</button></div>
    <form id="form-cap-dictado">
      <div class="modal-body">
        <div class="form-grid">
          <div class="field"><label>Resultado *</label>
            <select name="resultado">${RESULTADOS_CAP.map((r) => `<option ${c.resultado === r ? 'selected' : ''}>${r}</option>`).join('')}</select></div>
          <div class="field"><label>Puntaje (0-100)</label><input type="number" name="puntaje" min="0" max="100" value="${c.puntaje || 0}" /></div>
          <div class="field full"><label>Materiales</label>
            <select name="materialesIds" multiple size="3">${(DB.materialesCapacitacion || []).map((m) => `<option value="${esc(String(m.id))}">${esc(m.nombre)}</option>`).join('')}</select></div>
          <div class="field full"><label>Adjunto certificado (PDF)</label><input type="file" id="cap-adjunto" accept="application/pdf" /></div>
        </div>
      </div>
      <div class="modal-foot">
        <button type="button" class="btn btn-secondary" onclick="cerrarModal('modal-cap-dictado')">Cancelar</button>
        <button type="submit" class="btn btn-success">Guardar dictado</button>
      </div>
    </form>`, { size: 'modal-lg' });
  document.getElementById('form-cap-dictado').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const datos = capturar(ev);
    guardarDictadoCap(id, datos);
  });
}

export function guardarDictadoCap(id, datos) {
  const c = getCapById(id);
  if (!c) return;
  const leg = (DB.legajos || []).find((l) => String(l.nro) === String(c.nroSocio));
  if (c.estado === 'Programada' || c.resultado === 'Pendiente evaluación') {
    if (datos.resultado === 'Aprobado' && leg && !esAdministrativo(leg)) {
      const evento = c.lugar === 'Servicio' ? 'capacitacion_servicio' : c.lugar === 'Virtual' ? 'capacitacion_virtual' : 'capacitacion_presencial';
      registrarEvento({
        reglaCodigo: evento,
        fecha: c.fecha || hoyISO(),
        protagonista: leg.nro,
        referenciaExterna: c.id,
        origenModulo: 'capacitaciones',
        observaciones: `Capacitación aprobada: ${c.tipo}`,
        generadoPor: getCurrentUser()?.nombre || '',
      });
    }
  }
  c.estado = 'Dictada';
  c.resultado = datos.resultado;
  c.puntaje = Number(datos.puntaje) || 0;
  c.editadoPor = getCurrentUser()?.nombre || '';
  c.editadoEn = new Date().toISOString();
  const archivo = document.getElementById('cap-adjunto')?.files?.[0];
  const guardar = () => {
    supaSync('capacitaciones', c)
      .then(() => { cerrarModal('modal-cap-dictado'); showToast('Dictado guardado', 'ok'); renderCapacitaciones('registro'); })
      .catch((e) => showToast(e.message, 'err'));
  };
  if (archivo) {
    import('../../shared/adjuntos.js').then(async ({ subirAdjunto }) => {
      try {
        const adj = await subirAdjunto({ etapa: 'capacitaciones', tipo: 'certificado', refIdLocal: c.id, file: archivo });
        c.adjuntoIdLocal = adj?.id || c.adjuntoIdLocal;
      } catch (e) { showToast(e.message, 'err'); }
      guardar();
    });
  } else guardar();
}

export function subirAdjuntoDictarCap(id, file) {
  const c = getCapById(id);
  if (!c || !file) return Promise.resolve();
  return import('../../shared/adjuntos.js').then(({ subirAdjunto }) => subirAdjunto({ etapa: 'capacitaciones', tipo: 'certificado', refIdLocal: c.id, file }));
}

export function verAdjuntoDictarCap(id) {
  const c = getCapById(id);
  if (!c?.adjuntoIdLocal) { showToast('Sin adjunto.', 'warn'); return; }
  const adj = (DB.adjuntos || []).find((a) => String(a.id) === String(c.adjuntoIdLocal));
  if (!adj) { showToast('Adjunto no encontrado.', 'warn'); return; }
  import('../../shared/adjuntos.js').then(({ verAdjunto }) => verAdjunto(adj.archivo).catch((e) => showToast(e.message, 'err')));
}

export function analizarCapacitacionesIA() {
  showToast('Análisis de capacitaciones con IA (mock): sin datos suficientes.', 'warn');
}
