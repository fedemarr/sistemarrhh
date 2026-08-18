// Documentación de ingreso — carga y aprobación de documentación obligatoria.
// Fuente de verdad: 01_Flujo_Ingreso.md §1.5.

import { DB } from '../../state.js';
import { supaSync } from '../../shared/supabase.js';
import { ensureModal, cerrarModal, showToast, capturar } from '../../shared/modal.js';
import { esc, fechaISOToDisplay, calcularEstadoVencimiento } from '../../shared/helpers.js';
import { analizarConGemini } from '../../shared/ai.js';
import { subirAdjunto, htmlAdjuntos, verAdjunto } from '../../shared/adjuntos.js';

export { calcularEstadoVencimiento };

export function documAltaCompletada(dni) {
  return (DB.catAltPendientes || []).some((c) => c.dni === dni && c.estado === 'Alta completada');
}

export function getDocumById(id) {
  return (DB.documentacionIngreso || []).find((d) => String(d.id) === String(id));
}

// Guard de idempotencia por DNI: crea el alta pendiente solo si no existe.
// Devuelve true si creó el registro (los llamadores gatean el toast de éxito).
export function _crearAltaDesdeDocum(d) {
  const yaExiste = (DB.catAltPendientes || []).some((c) => c.dni === d.dni);
  if (yaExiste) return false;
  const alt = {
    id: Date.now().toString(),
    dni: d.dni,
    nombre: d.nombre,
    candidatoId: d.candidatoId,
    psicoId: null,
    estado: 'Pendiente de alta',
    creadoDesde: 'documentacion',
  };
  DB.catAltPendientes.push(alt);
  supaSync('catAltPendientes', alt).catch((e) => showToast(e.message, 'err'));
  return true;
}

let _verDocum = 'activos';

function documFiltrados() {
  const ver = _verDocum;
  const buscar = document.getElementById('docum-buscar')?.value || '';
  return (DB.documentacionIngreso || [])
    .filter((d) => (ver === 'activos' ? !d.anulado && d.estado !== 'Rechazado' : d.anulado || d.estado === 'Rechazado'))
    .filter((d) => !buscar || String(d.nombre || '').toLowerCase().includes(buscar.toLowerCase()) || String(d.dni).includes(buscar));
}

export function renderDocum() {
  const cont = document.getElementById('screen-documentacion');
  if (!cont) return;
  const buscar = document.getElementById('docum-buscar')?.value || '';

  const lista = documFiltrados();

  const stats = {
    total: (DB.documentacionIngreso || []).length,
    enProceso: (DB.documentacionIngreso || []).filter((d) => d.estado === 'En proceso' && !d.anulado).length,
    aprobados: (DB.documentacionIngreso || []).filter((d) => d.estado === 'Aprobado' && !d.anulado).length,
    rechazados: (DB.documentacionIngreso || []).filter((d) => d.estado === 'Rechazado' || d.anulado).length,
  };

  cont.innerHTML = `
    <div class="stats">
      <div class="stat"><div class="num">${stats.total}</div><div class="lbl">Expedientes</div></div>
      <div class="stat"><div class="num">${stats.enProceso}</div><div class="lbl">En proceso</div></div>
      <div class="stat"><div class="num">${stats.aprobados}</div><div class="lbl">Aprobados</div></div>
      <div class="stat"><div class="num">${stats.rechazados}</div><div class="lbl">Rechazados / anulados</div></div>
    </div>
    <div class="toolbar">
      <button class="btn ${_verDocum === 'activos' ? '' : 'btn-secondary'}" onclick="tabDocum('activos')">Activos</button>
      <button class="btn ${_verDocum === 'historico' ? '' : 'btn-secondary'}" onclick="tabDocum('historico')">Histórico</button>
      <input type="text" id="docum-buscar" placeholder="Buscar por DNI / nombre…" value="${esc(buscar)}" oninput="filtrarDocum()" />
      <div class="spacer"></div>
      <button class="btn" onclick="abrirNuevaDocum()">+ Nueva documentación</button>
    </div>
    <div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>Nombre</th><th>DNI</th><th>Antecedentes</th><th>Libreta</th><th>Curso</th><th>Estado</th><th>Acciones</th></tr></thead>
      <tbody>
        ${lista.length ? lista.map(filaDocum).join('') : '<tr><td colspan="7" class="empty">Sin expedientes.</td></tr>'}
      </tbody>
    </table></div>`;
}

export function tabDocum(ver) {
  _verDocum = ver;
  renderDocum();
}

export function filtrarDocum() { renderDocum(); }

export function poblarFiltrosColumnasDocum() { /* hook */ }

function vencChip(vencimiento) {
  const { estado, cls } = calcularEstadoVencimiento(vencimiento);
  return `<span class="chip ${cls}">${esc(estado)}</span>`;
}

function filaDocum(d) {
  let accion;
  if (d.anulado) {
    accion = '<span class="chip chip-gris">Anulado</span>';
  } else if (d.estado === 'En proceso') {
    accion = `<button class="btn btn-sm" onclick="abrirGestionDocum('${esc(String(d.id))}')">Gestionar</button>`;
  } else if (d.estado === 'Rechazado') {
    accion = `<button class="btn btn-secondary btn-sm" onclick="revertirDocum('${esc(String(d.id))}')">Revertir</button>`;
  } else if (documAltaCompletada(d.dni)) {
    accion = '<span class="chip chip-verde">Cerrado</span>';
  } else {
    accion = `<button class="btn btn-secondary btn-sm" onclick="revertirDocum('${esc(String(d.id))}')">Revertir</button>`;
  }
  return `<tr>
    <td>${esc(d.nombre || '')}</td>
    <td>${esc(d.dni || '')}</td>
    <td>${d.antecVencimiento ? vencChip(d.antecVencimiento) : '<span class="muted">—</span>'}</td>
    <td>${d.libretaAplica ? vencChip(d.libretaVencimiento) : '<span class="muted">No aplica</span>'}</td>
    <td>${d.cursoTiene ? vencChip(d.cursoVencimiento) : '<span class="muted">—</span>'}</td>
    <td>${chipEstadoDocum(d)}</td>
    <td class="acciones">${accion}</td>
  </tr>`;
}

function chipEstadoDocum(d) {
  const cls = d.estado === 'Aprobado' ? 'chip-verde' : d.estado === 'Rechazado' || d.anulado ? 'chip-rojo' : 'chip-naranja';
  return `<span class="chip ${cls}">${d.anulado ? 'Anulado' : esc(d.estado)}</span>`;
}

export function abrirNuevaDocum() {
  ensureModal('modal-docum', `
    <div class="modal-head"><h2>Nueva documentación de ingreso</h2><button class="modal-close" onclick="cerrarModal('modal-docum')">×</button></div>
    <form id="form-docum">
      <div class="modal-body">
        <div class="form-grid">
          <div class="field"><label>DNI *</label><input name="dni" required inputmode="numeric" /></div>
          <div class="field"><label>Candidato (id)</label><input name="candidatoId" /></div>
          <div class="field full"><label>Nombre *</label><input name="nombre" required /></div>
          <div class="field"><label>Antecedentes penales (PDF/IMG)</label><input type="file" id="docum-antecedentes" accept=".pdf,.jpg,.png" /></div>
          <div class="field"><label>Libreta sanitaria (PDF/IMG)</label><input type="file" id="docum-libreta" accept=".pdf,.jpg,.png" /></div>
          <div class="field"><label>Certificado curso (PDF/IMG)</label><input type="file" id="docum-curso" accept=".pdf,.jpg,.png" /></div>
        </div>
      </div>
      <div class="modal-foot"><button type="button" class="btn btn-secondary" onclick="cerrarModal('modal-docum')">Cancelar</button><button type="submit" class="btn">Guardar</button></div>
    </form>`, {});
  document.getElementById('form-docum').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const datos = capturar(ev);
    const d = {
      id: Date.now().toString(),
      dni: datos.dni,
      candidatoId: datos.candidatoId || null,
      nombre: datos.nombre,
      antecVencimiento: '',
      libretaAplica: false,
      libretaVencimiento: '',
      cursoTiene: false,
      cursoVencimiento: '',
      estado: 'En proceso',
      anulado: false,
      motivo: '',
      observaciones: '',
    };
    DB.documentacionIngreso.push(d);
    supaSync('documentacionIngreso', d)
      .then(async () => {
        const fAnt = document.getElementById('docum-antecedentes')?.files?.[0];
        if (fAnt) await subirAdjunto({ etapa: 'documentacion', tipo: 'antecedentes', refIdLocal: d.id, file: fAnt }).catch(e => showToast(e.message, 'err'));
        const fLib = document.getElementById('docum-libreta')?.files?.[0];
        if (fLib) await subirAdjunto({ etapa: 'documentacion', tipo: 'libreta', refIdLocal: d.id, file: fLib }).catch(e => showToast(e.message, 'err'));
        const fCur = document.getElementById('docum-curso')?.files?.[0];
        if (fCur) await subirAdjunto({ etapa: 'documentacion', tipo: 'curso', refIdLocal: d.id, file: fCur }).catch(e => showToast(e.message, 'err'));
        cerrarModal('modal-docum'); showToast('Expediente creado', 'ok'); renderDocum();
      })
      .catch((e) => showToast(e.message, 'err'));
  });
}

export function abrirGestionDocum(id) {
  const d = getDocumById(id);
  if (!d) return;
  ensureModal('modal-docum-gestion', `
    <div class="modal-head accent documentacion"><h2>📁 Documentación — ${esc(d.nombre || '')}</h2><button class="modal-close" onclick="cerrarModal('modal-docum-gestion')">×</button></div>
    <form id="form-docum-gestion">
      <div class="modal-body">
        <div class="form-grid">
          <div class="field"><label>DNI</label><input value="${esc(d.dni)}" readonly /></div>
          <div class="field"><label>Estado</label><input value="${esc(d.estado)}${d.anulado ? ' (anulado)' : ''}" readonly /></div>
        </div>

        <div class="grupo"><legend>📄 Antecedentes penales (obligatorio)</legend>
          <div class="form-grid">
            <div class="field"><label>Fecha de emisión</label><input type="date" id="docum-fec-emision-antec" /></div>
            <div class="field"><label>Vence (auto, +12 meses)</label><input type="date" name="antecVencimiento" value="${esc(d.antecVencimiento || '')}" /></div>
          </div>
          <div class="adjunto-box documentacion">
            <h4>🎙️ Certificados de antecedentes (se conserva historial)</h4>
            ${htmlAdjuntos('documentacion', 'antecedentes', d.id)}
            <div class="field"><input type="file" id="docum-gest-antecedentes" accept=".pdf,.jpg,.png" /></div>
            <button type="button" class="btn btn-secondary" onclick="analizarAntecedentesIA('${esc(String(d.id))}')">🤖 Analizar con IA</button>
          </div>
        </div>

        <div class="grupo"><legend>🟢 Libreta sanitaria</legend>
          <div class="field checkbox"><input type="checkbox" id="docum-togle-libreta" ${d.libretaAplica ? 'checked' : ''} /><label>¿Requiere libreta sanitaria?</label></div>
          <div class="field"><label>Vence</label><input type="date" name="libretaVencimiento" value="${esc(d.libretaVencimiento || '')}" /></div>
          <div class="field"><label>Libreta sanitaria</label>${htmlAdjuntos('documentacion', 'libreta', d.id)}<input type="file" id="docum-gest-libreta" accept=".pdf,.jpg,.png" /></div>
        </div>

        <div class="grupo"><legend>🧢 Curso de manipulación de alimentos</legend>
          <div class="field checkbox"><input type="checkbox" id="docum-togle-curso" ${d.cursoTiene ? 'checked' : ''} /><label>¿Tiene el curso?</label></div>
          <div class="field"><label>Vence</label><input type="date" name="cursoVencimiento" value="${esc(d.cursoVencimiento || '')}" /></div>
          <div class="field"><label>Certificado curso</label>${htmlAdjuntos('documentacion', 'curso', d.id)}<input type="file" id="docum-gest-curso" accept=".pdf,.jpg,.png" /></div>
        </div>

        <div class="form-grid">
          <div class="field full"><label>Observaciones</label><textarea name="observaciones" rows="3">${esc(d.observaciones || '')}</textarea></div>
          <div class="field full"><label>Motivo (rechazo/alta con excepción)</label><input name="motivo" value="${esc(d.motivo || '')}" /></div>
        </div>
        <div class="toolbar">
          <button type="button" class="btn btn-success" onclick="aprobarDocum('${esc(String(d.id))}')">✅ Aprobar</button>
          <button type="button" class="btn btn-warning" onclick="excepcionDocum('${esc(String(d.id))}')">Aprobar con excepción</button>
          <button type="button" class="btn btn-danger" onclick="rechazarDocum('${esc(String(d.id))}')">❌ Rechazar</button>
          <button type="button" class="btn btn-secondary" onclick="bajaDocum('${esc(String(d.id))}')">Anular</button>
        </div>
      </div>
      <div class="modal-foot"><button type="button" class="btn btn-secondary" onclick="cerrarModal('modal-docum-gestion')">Cerrar</button><button type="submit" class="btn">💾 Guardar</button></div>
    </form>`, { size: 'modal-lg' });
  document.getElementById('form-docum-gestion').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const datos = capturar(ev);
    d.antecVencimiento = datos.antecVencimiento || d.antecVencimiento;
    d.libretaVencimiento = datos.libretaVencimiento || d.libretaVencimiento;
    d.cursoVencimiento = datos.cursoVencimiento || d.cursoVencimiento;
    d.observaciones = datos.observaciones;
    d.motivo = datos.motivo;
    d.libretaAplica = document.getElementById('docum-togle-libreta').checked;
    d.cursoTiene = document.getElementById('docum-togle-curso').checked;
    supaSync('documentacionIngreso', d)
      .then(async () => {
        const fAnt = document.getElementById('docum-gest-antecedentes')?.files?.[0];
        if (fAnt) await subirAdjunto({ etapa: 'documentacion', tipo: 'antecedentes', refIdLocal: d.id, file: fAnt }).catch(e => showToast(e.message, 'err'));
        const fLib = document.getElementById('docum-gest-libreta')?.files?.[0];
        if (fLib) await subirAdjunto({ etapa: 'documentacion', tipo: 'libreta', refIdLocal: d.id, file: fLib }).catch(e => showToast(e.message, 'err'));
        const fCur = document.getElementById('docum-gest-curso')?.files?.[0];
        if (fCur) await subirAdjunto({ etapa: 'documentacion', tipo: 'curso', refIdLocal: d.id, file: fCur }).catch(e => showToast(e.message, 'err'));
        showToast('Cambios guardados', 'ok'); abrirGestionDocum(d.id);
      })
      .catch((e) => showToast(e.message, 'err'));
  });
}

export function guardarDocum(datos) {
  const d = getDocumById(datos.id);
  if (d) Object.assign(d, datos);
  else DB.documentacionIngreso.push(datos);
  return supaSync('documentacionIngreso', datos);
}

export function recalcularVencAntec() {
  const fechaBase = document.getElementById('docum-fec-emision-antec')?.value;
  if (!fechaBase) { showToast('Ingresá la fecha de emisión primero.', 'warn'); return; }
  const d = new Date(fechaBase + 'T00:00:00');
  d.setMonth(d.getMonth() + 12);
  const campo = document.getElementById('form-docum-gestion')?.elements['antecVencimiento'];
  if (campo) campo.value = d.toISOString().slice(0, 10);
}

export function recalcularVencLibreta() {
  const fechaBase = document.getElementById('docum-fec-emision-libreta')?.value;
  if (!fechaBase) return;
  const d = new Date(fechaBase + 'T00:00:00');
  d.setMonth(d.getMonth() + 12);
  const campo = document.getElementById('form-docum-gestion')?.elements['libretaVencimiento'];
  if (campo) campo.value = d.toISOString().slice(0, 10);
}

export function toggleSeccionLibreta() {
  /* la libreta se maneja con checkbox en el modal */
}

export function toggleSeccionCurso() { /* análogo */ }

function aprobarComun(id, conExcepcion) {
  const d = getDocumById(id);
  if (!d) return;
  if (conExcepcion) {
    const just = window.prompt('Justificación de la excepción (obligatoria):', '')?.trim();
    if (!just) { showToast('La justificación es obligatoria para aprobar con excepción.', 'err'); return; }
    d.motivo = 'Excepción: ' + just;
  }
  d.estado = 'Aprobado';
  const creado = _crearAltaDesdeDocum(d);
  supaSync('documentacionIngreso', d)
    .then(() => {
      if (creado) showToast('Documentación aprobada — el candidato queda Pendiente de alta', 'ok');
      else showToast('Documentación aprobada (el alta ya estaba registrada)', 'ok');
      cerrarModal('modal-docum-gestion');
      renderDocum();
    })
    .catch((e) => showToast(e.message, 'err'));
}

export function aprobarDocum(id) { aprobarComun(id, false); }

export function excepcionDocum(id) { aprobarComun(id, true); }

export function rechazarDocum(id, motivo) {
  const d = getDocumById(id);
  if (!d) return Promise.reject(new Error('Expediente no encontrado'));
  if (!motivo) {
    motivo = window.prompt('Motivo del rechazo (obligatorio):', '')?.trim();
    if (!motivo) return Promise.reject(new Error('El motivo del rechazo es obligatorio'));
  }
  d.estado = 'Rechazado';
  d.motivo = motivo;
  return supaSync('documentacionIngreso', d).then(() => { showToast('Documentación rechazada', 'warn'); cerrarModal('modal-docum-gestion'); renderDocum(); });
}

export function bajaDocum(id) {
  const d = getDocumById(id);
  if (!d) return;
  d.anulado = true;
  d.estado = 'Anulado';
  supaSync('documentacionIngreso', d)
    .then(() => { showToast('Expediente anulado', 'warn'); cerrarModal('modal-docum-gestion'); renderDocum(); })
    .catch((e) => showToast(e.message, 'err'));
}

export function revertirDocum(id) {
  const d = getDocumById(id);
  if (!d) return;
  if (documAltaCompletada(d.dni)) { showToast('No se puede revertir: el alta ya se completó.', 'err'); return; }
  d.estado = 'En proceso';
  d.anulado = false;
  d.motivo = '';
  supaSync('documentacionIngreso', d)
    .then(() => { showToast('Expediente revertido a En proceso', 'ok'); renderDocum(); })
    .catch((e) => showToast(e.message, 'err'));
}

export async function analizarAntecedentesIA(id) {
  const d = getDocumById(id);
  if (!d) return;
  showToast('Analizando antecedentes con IA… puede tardar hasta 1 minuto en documentos largos.', 'warn');
  try {
    const prompt = `Analizá el certificado de antecedentes penales adjunto (documento real, no inventes nada que no figure en él). Necesito puntualmente:\n1. La fecha de emisión que figura en el documento.\n2. El resultado real: ¿registra antecedentes o no (certificado positivo/negativo)?\n3. Cualquier observación relevante para decidir si hay algo que impida el alta del candidato.\nSi alguno de estos datos no aparece en el documento, decilo explícitamente en vez de inventarlo o suponerlo.\n\nDatos de referencia (para contexto, no reemplazan lo que diga el documento): ${d.nombre}, DNI ${d.dni}.`;
    const respuesta = await analizarConGemini({ etapa: 'documentacion', tipo: 'antecedentes', refIdLocal: d.id, prompt });
    ensureModal('modal-ia-resultado', `
      <div class="modal-head"><h2>Resultado IA — Antecedentes</h2><button class="modal-close" onclick="cerrarModal('modal-ia-resultado')">×</button></div>
      <div class="modal-body"><pre style="white-space:pre-wrap;font-size:0.9em">${esc(respuesta)}</pre></div>
      <div class="modal-foot"><button class="btn btn-secondary" onclick="cerrarModal('modal-ia-resultado')">Cerrar</button></div>
    `, { size: 'modal-lg' });
  } catch (e) { showToast(e.message, 'err'); }
}
