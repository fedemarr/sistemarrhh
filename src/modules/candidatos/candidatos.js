// Candidatos — módulo principal (ABM, estados, citas, link público, importador).
// Fuente de verdad: 01_Flujo_Ingreso.md §1.2.

import { DB } from '../../state.js';
import { supaSync } from '../../shared/supabase.js';
import { ensureModal, cerrarModal, showToast, capturar } from '../../shared/modal.js';
import { esc, esDniValido, fechaISOToDisplay, displayToISO, calcularEdad } from '../../shared/helpers.js';
import { getCurrentUser } from '../../shared/auth.js';

export const ESTADOS_ACTIVOS_CAND = ['Precandidato', 'Sin citar', 'Citado', 'Entrevistado', 'Aprobado'];
export const ESTADOS_HISTORICO_CAND = ['Rechazado', 'Baja', 'Caducado', 'MT Social', 'MT con deuda'];
export const MOTIVOS_RECHAZO = ['No cubre perfil', 'Falta de disponibilidad', 'No asistió', 'Perfil laboral', 'Otro'];
export const MEDIOS = ['Redes', 'Referido', 'Web', 'Volante', 'Otro'];

export function getCandById(id) {
  return (DB.candidatos || []).find((c) => String(c.id) === String(id));
}

export function getIdxById(id) {
  return (DB.candidatos || []).findIndex((c) => String(c.id) === String(id));
}

export function esHistoricoCand(c) {
  return ESTADOS_HISTORICO_CAND.includes(c.estado);
}

export function tabCandPrincipal(tab) {
  const seccion = tab || 'base';
  const container = document.getElementById('screen-candidatos');
  container.innerHTML = `
    <div class="tabs">
      <button class="tab-btn ${seccion === 'precandidatos' ? 'active' : ''}" onclick="tabCandPrincipal('precandidatos')">Pre-candidatos</button>
      <button class="tab-btn ${seccion === 'base' ? 'active' : ''}" onclick="tabCandPrincipal('base')">Candidatos</button>
      <button class="tab-btn ${seccion === 'calendario' ? 'active' : ''}" onclick="tabCandPrincipal('calendario')">Calendario</button>
      <button class="tab-btn ${seccion === 'link' ? 'active' : ''}" onclick="tabCandPrincipal('link')">Link de postulación</button>
      <button class="tab-btn ${seccion === 'importar' ? 'active' : ''}" onclick="tabCandPrincipal('importar')">Importar histórico</button>
    </div>
    <div id="cand-contenido"></div>`;
  const cont = document.getElementById('cand-contenido');
  if (seccion === 'precandidatos') renderPrecandidatos();
  else if (seccion === 'calendario') renderCalendario(cont);
  else if (seccion === 'link') renderLinkPublico(cont);
  else if (seccion === 'importar') renderImportadorHistorico(cont);
  else renderCandidatos();
}

export function renderCandidatos() {
  const cont = document.getElementById('cand-contenido');
  const ver = document.getElementById('cand-ver')?.value || 'activos';
  const buscar = document.getElementById('cand-buscar')?.value || '';
  const fZona = document.getElementById('cand-filtro-zona')?.value || '';
  const fEstado = document.getElementById('cand-filtro-estado')?.value || '';

  const lista = (DB.candidatos || []).filter((c) => {
    const activos = ver === 'activos' ? !esHistoricoCand(c) : esHistoricoCand(c);
    const matchB = !buscar || [c.apellido, c.nombre, c.dni, c.telefono].some((v) => String(v || '').toLowerCase().includes(buscar.toLowerCase()));
    const matchZ = !fZona || c.zona === fZona;
    const matchE = !fEstado || c.estado === fEstado;
    return activos && matchB && matchZ && matchE;
  }).sort((a, b) => String(b.id).localeCompare(String(a.id)));

  cont.innerHTML = `
    <div class="toolbar">
      <button class="btn btn-secondary ${ver === 'activos' ? '' : ''}" onclick="toggleVerCandidatos('activos')">Activos (${(DB.candidatos || []).filter((c) => !esHistoricoCand(c)).length})</button>
      <button class="btn btn-secondary" onclick="toggleVerCandidatos('historico')">Histórico (${(DB.candidatos || []).filter((c) => esHistoricoCand(c)).length})</button>
      <input type="text" id="cand-buscar" placeholder="Buscar apellido / DNI…" value="${esc(buscar)}" oninput="renderCandidatos()" />
      <select id="cand-filtro-zona" onchange="renderCandidatos()">
        <option value="">Zona: todas</option>
        ${[...new Set((DB.candidatos || []).map((c) => c.zona).filter(Boolean))].map((z) => `<option ${fZona === z ? 'selected' : ''}>${esc(z)}</option>`).join('')}
      </select>
      <select id="cand-filtro-estado" onchange="renderCandidatos()">
        <option value="">Estado: todos</option>
        ${ESTADOS_ACTIVOS_CAND.concat(ESTADOS_HISTORICO_CAND).map((e) => `<option ${fEstado === e ? 'selected' : ''}>${e}</option>`).join('')}
      </select>
    </div>
    <div class="tbl-wrap">
      <table class="tbl">
        <thead><tr><th>Apellido</th><th>Nombre</th><th>DNI</th><th>Edad</th><th>Tel</th><th>Zona</th><th>Estado</th><th>Cita</th><th>Acciones</th></tr></thead>
        <tbody>
          ${lista.length ? lista.map(filaCandidato).join('') : '<tr><td colspan="9" class="empty">Sin candidatos.</td></tr>'}
        </tbody>
      </table>
    </div>`;
}

export function toggleVerCandidatos(ver) {
  const cont = document.getElementById('cand-contenido');
  cont.dataset.ver = ver;
  renderCandidatos();
}

function chipEstadoCand(e) {
  const cls = e === 'Aprobado' ? 'chip-verde' : e === 'Rechazado' || e === 'Baja' ? 'chip-rojo' : e === 'Entrevistado' ? 'chip-naranja' : e === 'Citado' ? 'chip-azul' : e === 'Precandidato' ? 'chip-gris' : 'chip-gris';
  return `<span class="chip ${cls}">${esc(e)}</span>`;
}

function filaCandidato(c) {
  const acciones = accionesCandidato(c);
  const edad = c.fecNac ? calcularEdad(c.fecNac) : null;
  return `<tr>
    <td>${esc(c.apellido || '')}</td>
    <td>${esc(c.nombre || '')}</td>
    <td>${esc(c.dni || '')}</td>
    <td>${edad ?? '—'}</td>
    <td>${esc(c.telefono || c.tel || '')}</td>
    <td>${esc(c.zona || '')}</td>
    <td>${chipEstadoCand(c.estado)}</td>
    <td>${esc(c.fechaCita ? fechaISOToDisplay(c.fechaCita) + ' ' + (c.horaCita || '') : '—')}</td>
    <td class="acciones">${acciones}</td>
  </tr>`;
}

function accionesCandidato(c) {
  const u = getCurrentUser();
  if (!u || (u.perfil !== 'RRHH' && u.perfil !== 'Administrador total')) return '<span class="muted">—</span>';
  const a = [];
  a.push(`<button class="btn btn-secondary btn-sm" onclick="abrirDetalleCandidatoPorId('${esc(String(c.id))}')">Ver</button>`);
  if (esHistoricoCand(c)) return a.join('');
  if (c.estado === 'Sin citar') {
    a.push(`<button class="btn btn-sm" onclick="abrirCitarPorId('${esc(String(c.id))}')">Citar</button>`);
    a.push(`<button class="btn btn-secondary btn-sm" onclick="abrirMensajeEntrevista('${esc(String(c.id))}')">Enviar mensaje</button>`);
  }
  if (c.estado === 'Citado') {
    a.push(`<button class="btn btn-warning btn-sm" onclick="abrirAsistenciaPorId('${esc(String(c.id))}')">¿Asistió?</button>`);
    a.push(`<button class="btn btn-secondary btn-sm" onclick="abrirMensajeEntrevista('${esc(String(c.id))}')">Enviar mensaje</button>`);
  }
  if (c.estado === 'Entrevistado') {
    a.push(`<button class="btn btn-sm" onclick="abrirResultadoPorId('${esc(String(c.id))}')">Resultado</button>`);
  }
  if (c.estado === 'Aprobado') a.push(`<button class="btn btn-success btn-sm" onclick="pasarAPsicoPorId('${esc(String(c.id))}')">Pasar a Psicotécnico</button>`);
  a.push(`<button class="btn btn-secondary btn-sm" onclick="editarCandidatoPorId('${esc(String(c.id))}')">Editar</button>`);
  a.push(`<button class="btn btn-danger btn-sm" onclick="abrirBajaCandidatoPorId('${esc(String(c.id))}')">Baja</button>`);
  return a.join('');
}

export function filtrarCandidatos() { renderCandidatos(); }

export function poblarFiltrosColumnasCandidatos() {
  /* Filtros de columnas accesibles desde el buscador global — sin cambios. */
}

function selectZonas() {
  const zonas = [...new Set((DB.candidatos || []).map((c) => c.zona).filter(Boolean))];
  return zonas.map((z) => `<option value="${esc(z)}">${esc(z)}</option>`).join('');
}

function camposCandidato(c) {
  return `
    <div class="form-grid">
      <div class="field"><label>Apellido *</label><input name="apellido" value="${esc(c?.apellido || '')}" required /></div>
      <div class="field"><label>Nombre *</label><input name="nombre" value="${esc(c?.nombre || '')}" required /></div>
      <div class="field"><label>DNI *</label><input name="dni" value="${esc(c?.dni || '')}" required inputmode="numeric" /></div>
      <div class="field"><label>CUIT</label><input name="cuit" value="${esc(c?.cuit || '')}" /></div>
      <div class="field"><label>Fecha de nacimiento</label><input type="date" name="fecNac" value="${esc(c?.fecNac || '')}" /></div>
      <div class="field"><label>Edad</label><input readonly value="${c?.fecNac ? (calcularEdad(c.fecNac) ?? '') : ''}" /></div>
      <div class="field"><label>Estado civil</label><select name="estadoCivil"><option></option><option>Soltero/a</option><option>Casado/a</option><option>Divorciado/a</option><option>Viudo/a</option></select></div>
      <div class="field"><label>Género</label><select name="genero"><option></option><option>Femenino</option><option>Masculino</option><option>Otro</option></select></div>
      <div class="field"><label>Nacionalidad</label><input name="nacionalidad" value="${esc(c?.nacionalidad || '')}" /></div>
      <div class="field"><label>Teléfono *</label><input name="telefono" value="${esc(c?.telefono || c?.tel || '')}" required /></div>
      <div class="field"><label>Email</label><input type="email" name="email" value="${esc(c?.email || '')}" /></div>
      <div class="field full"><label>Calle</label><input name="calle" value="${esc(c?.calle || '')}" /></div>
      <div class="field"><label>Piso/Dpto</label><input name="piso" value="${esc(c?.piso || '')}" /></div>
      <div class="field"><label>Zona</label><select name="zona"><option value="">Seleccionar…</option>${selectZonas()}</select></div>
      <div class="field"><label>Partido</label><input name="partido" value="${esc(c?.partido || '')}" /></div>
      <div class="field"><label>Localidad</label><input name="localidad" value="${esc(c?.localidad || '')}" /></div>
      <div class="field full"><label>Disponibilidad horaria</label><input name="disponibilidadHoraria" value="${esc(c?.disponibilidadHoraria || '')}" placeholder="Ej: full time / turno noche" /></div>
      <div class="field"><label>Medio de contacto</label><select name="medio">${MEDIOS.map((m) => `<option ${c?.medio === m ? 'selected' : ''}>${m}</option>`).join('')}</select></div>
      <div class="field"><label>Referido por</label><input name="nombreReferido" value="${esc(c?.nombreReferido || '')}" /></div>
      <div class="field full"><label>Observaciones</label><textarea name="obs" rows="3">${esc(c?.obs || '')}</textarea></div>
    </div>`;
}

export function abrirNuevoCandidato() {
  const autosave = localStorage.getItem('candidatos:nuevo');
  ensureModal('modal-candidato', `
    <div class="modal-head"><h2>Nuevo candidato</h2><button class="modal-close" onclick="cerrarModal('modal-candidato')">×</button></div>
    <form id="form-candidato">
      <div class="modal-body">${camposCandidato(autosave ? JSON.parse(autosave) : null)}</div>
      <div class="modal-foot"><button type="button" class="btn btn-secondary" onclick="cerrarModal('modal-candidato')">Cancelar</button><button type="submit" class="btn">Guardar candidato</button></div>
    </form>`, { size: 'modal-lg' });
  const form = document.getElementById('form-candidato');
  if (autosave) {
    const a = JSON.parse(autosave);
    for (const [k, v] of Object.entries(a)) {
      const el = form.elements[k];
      if (el && k !== 'fecNac') el.value = v;
    }
  }
  form.addEventListener('input', () => {
    localStorage.setItem('candidatos:nuevo', JSON.stringify(capturar(form)));
  });
  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const datos = capturar(ev);
    const error = validarCandidato(datos);
    if (error) { showToast(error, 'err'); return; }
    datos.id = Date.now().toString();
    datos.estado = 'Precandidato';
    datos.creadoPor = getCurrentUser()?.nombre || '';
    DB.candidatos.push(datos);
    supaSync('candidatos', datos)
      .then(() => { localStorage.removeItem('candidatos:nuevo'); cerrarModal('modal-candidato'); showToast('Candidato guardado', 'ok'); renderCandidatos(); })
      .catch((e) => showToast(e.message, 'err'));
  });
}

export function editarCandidatoPorId(id) {
  const c = getCandById(id);
  if (!c) return;
  const autosave = localStorage.getItem(`candidatos:edit:${id}`);
  ensureModal('modal-candidato', `
    <div class="modal-head"><h2>Editar candidato</h2><button class="modal-close" onclick="cerrarModal('modal-candidato')">×</button></div>
    <form id="form-candidato-edit">
      <div class="modal-body">${camposCandidato(c)}</div>
      <div class="modal-foot"><button type="button" class="btn btn-secondary" onclick="cerrarModal('modal-candidato')">Cancelar</button><button type="submit" class="btn">Guardar cambios</button></div>
    </form>`, { size: 'modal-lg' });
  const form = document.getElementById('form-candidato-edit');
  if (autosave) {
    const a = JSON.parse(autosave);
    for (const [k, v] of Object.entries(a)) {
      const el = form.elements[k];
      if (el) el.value = v;
    }
  }
  form.addEventListener('input', () => {
    localStorage.setItem(`candidatos:edit:${id}`, JSON.stringify(capturar(form)));
  });
  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const datos = capturar(ev);
    const error = validarCandidato(datos, id);
    if (error) { showToast(error, 'err'); return; }
    Object.assign(c, datos);
    supaSync('candidatos', c)
      .then(() => { localStorage.removeItem(`candidatos:edit:${id}`); cerrarModal('modal-candidato'); showToast('Candidato actualizado', 'ok'); renderCandidatos(); })
      .catch((e) => showToast(e.message, 'err'));
  });
}

export function validarCandidato(datos, idEditar) {
  if (!esDniValido(datos.dni)) return 'El DNI debe tener entre 6 y 8 dígitos.';
  const duplicado = (DB.candidatos || []).some((c) => c.dni === datos.dni && String(c.id) !== String(idEditar));
  if (duplicado) return `Ya existe un candidato con DNI ${datos.dni}.`;
  return null;
}

export function guardarCandidato(datos) {
  const error = validarCandidato(datos, datos.id);
  if (error) return Promise.reject(new Error(error));
  const idx = getIdxById(datos.id);
  if (idx >= 0) DB.candidatos[idx] = datos;
  else DB.candidatos.push(datos);
  return supaSync('candidatos', datos);
}

export function abrirCitarPorId(id) {
  const c = getCandById(id);
  if (!c) return;
  ensureModal('modal-cita', `
    <div class="modal-head"><h2>Citar entrevista — ${esc(c.apellido)}, ${esc(c.nombre)}</h2><button class="modal-close" onclick="cerrarModal('modal-cita')">×</button></div>
    <form id="form-cita">
      <div class="modal-body">
        <div class="form-grid">
          <div class="field"><label>Fecha de la cita</label><input type="date" name="fechaCita" value="${c.fechaCita || ''}" required /></div>
          <div class="field"><label>Hora</label><input type="time" name="horaCita" value="${c.horaCita || ''}" required /></div>
        </div>
      </div>
      <div class="modal-foot"><button type="button" class="btn btn-secondary" onclick="cerrarModal('modal-cita')">Cancelar</button><button type="submit" class="btn">Guardar cita</button></div>
    </form>`, {});
  document.getElementById('form-cita').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const datos = capturar(ev);
    c.fechaCita = datos.fechaCita;
    c.horaCita = datos.horaCita;
    c.estado = 'Citado';
    supaSync('candidatos', c)
      .then(() => { cerrarModal('modal-cita'); showToast('Cita guardada', 'ok'); renderCandidatos(); })
      .catch((e) => showToast(e.message, 'err'));
  });
}

export function guardarCita(id, fechaCita, horaCita) {
  const c = getCandById(id);
  if (!c) return Promise.resolve();
  c.fechaCita = fechaCita;
  c.horaCita = horaCita;
  c.estado = 'Citado';
  return supaSync('candidatos', c);
}

export function abrirAsistenciaPorId(id) {
  const c = getCandById(id);
  if (!c) return;
  ensureModal('modal-asistencia', `
    <div class="modal-head"><h2>¿Asistió a la entrevista? — ${esc(c.apellido)}, ${esc(c.nombre)}</h2><button class="modal-close" onclick="cerrarModal('modal-asistencia')">×</button></div>
    <div class="modal-body">
      <p>Cita: ${esc(c.fechaCita ? fechaISOToDisplay(c.fechaCita) + ' ' + (c.horaCita || '') : '—')}</p>
    </div>
    <div class="modal-foot">
      <button type="button" class="btn btn-secondary" onclick="cerrarModal('modal-asistencia')">Cancelar</button>
      <button type="button" class="btn btn-danger" onclick="registrarAsistenciaPorId('${esc(String(c.id))}', false)">No asistió</button>
      <button type="button" class="btn btn-success" onclick="registrarAsistenciaPorId('${esc(String(c.id))}', true)">Sí, asistió</button>
    </div>`, {});
}

export function registrarAsistenciaPorId(id, asistio) {
  const c = getCandById(id);
  if (!c) return;
  c.asistio = asistio;
  if (asistio) {
    c.estado = 'Entrevistado';
  } else {
    // No asistió: no tiene sentido seguir el flujo, se rechaza directo con
    // el motivo correspondiente (ya existe en el catálogo de motivos).
    c.estado = 'Rechazado';
    c.motivoRechazo = 'No asistió';
  }
  supaSync('candidatos', c)
    .then(() => {
      cerrarModal('modal-asistencia');
      showToast(asistio ? 'Asistencia registrada — pasa a Entrevistado' : 'Marcado como no asistió — rechazado', asistio ? 'ok' : 'warn');
      renderCandidatos();
    })
    .catch((e) => showToast(e.message, 'err'));
}

export function abrirResultadoPorId(id) {
  const c = getCandById(id);
  if (!c) return;
  ensureModal('modal-resultado', `
    <div class="modal-head"><h2>Resultado de entrevista — ${esc(c.nombre)} ${esc(c.apellido)}</h2><button class="modal-close" onclick="cerrarModal('modal-resultado')">×</button></div>
    <form id="form-resultado">
      <div class="modal-body">
        <div class="form-grid">
          <div class="field full"><label>Resultado *</label>
            <select name="resultado" required onchange="onChangeResultadoCand(this)">
              <option value="">Seleccionar…</option>
              <option value="Aprobado">Aprobar</option>
              <option value="Rechazado">Rechazar</option>
            </select>
          </div>
          <div class="field full hidden" id="cand-motivo-rechazo-wrap"><label>Motivo de rechazo *</label>
            <select name="motivoRechazo">
              <option value="">Seleccionar…</option>
              ${MOTIVOS_RECHAZO.map((m) => `<option>${m}</option>`).join('')}
            </select>
          </div>
          <div class="field full"><label>Observaciones</label><textarea name="obsEntrevista" rows="3"></textarea></div>
        </div>
      </div>
      <div class="modal-foot"><button type="button" class="btn btn-secondary" onclick="cerrarModal('modal-resultado')">Cancelar</button><button type="submit" class="btn">Guardar</button></div>
    </form>`, {});
  document.getElementById('form-resultado').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const datos = capturar(ev);
    if (datos.resultado === 'Rechazado' && !datos.motivoRechazo) {
      showToast('El motivo de rechazo es obligatorio', 'err');
      return;
    }
    c.estado = datos.resultado;
    c.motivoRechazo = datos.resultado === 'Rechazado' ? datos.motivoRechazo : '';
    c.obs = c.obs || '';
    c.obs = (c.obs + (c.obs ? ' ' : '') + (datos.obsEntrevista || '')).trim();
    supaSync('candidatos', c)
      .then(() => { cerrarModal('modal-resultado'); showToast(datos.resultado === 'Aprobado' ? 'Candidato aprobado' : 'Candidato rechazado', datos.resultado === 'Aprobado' ? 'ok' : 'warn'); renderCandidatos(); })
      .catch((e) => showToast(e.message, 'err'));
  });
}

export function onChangeResultadoCand(sel) {
  const wrap = document.getElementById('cand-motivo-rechazo-wrap');
  if (!wrap) return;
  wrap.classList.toggle('hidden', sel.value !== 'Rechazado');
}

export function guardarResultadoEntrevista(id, resultado, motivoRechazo) {
  const c = getCandById(id);
  if (!c) return Promise.reject(new Error('Candidato no encontrado'));
  if (resultado === 'Rechazado' && !motivoRechazo) return Promise.reject(new Error('El motivo de rechazo es obligatorio'));
  c.estado = resultado;
  c.motivoRechazo = resultado === 'Rechazado' ? motivoRechazo : '';
  return supaSync('candidatos', c);
}

export function aprobarCandidatoPorId(id) {
  const c = getCandById(id);
  if (!c) return;
  if (c.estado !== 'Entrevistado') {
    showToast('No se puede aprobar sin entrevista registrada (estado Entrevistado).', 'err');
    return;
  }
  c.estado = 'Aprobado';
  supaSync('candidatos', c)
    .then(() => { showToast('Candidato aprobado', 'ok'); renderCandidatos(); })
    .catch((e) => showToast(e.message, 'err'));
}

export function rechazarCandidatoPorId(id, motivo) {
  const c = getCandById(id);
  if (!c) return Promise.reject(new Error('Candidato no encontrado'));
  if (!motivo) return Promise.reject(new Error('El motivo de rechazo es obligatorio'));
  c.estado = 'Rechazado';
  c.motivoRechazo = motivo;
  return supaSync('candidatos', c);
}

// Guard de idempotencia: no duplicar psico para un DNI ya ingresado.
export function yaTienePsicoActivo(dni) {
  return (DB.psicos || []).some((p) => p.dni === dni && p.estado !== 'Rechazado' && p.estado !== 'Ingreso');
}

export function pasarAPsicoPorId(id) {
  const c = getCandById(id);
  if (!c) return;
  if (c.estado !== 'Aprobado') {
    showToast('El candidato debe estar Aprobado para pasar a psicotécnico.', 'err');
    return;
  }
  if (!confirm(`¿Pasar a ${c.apellido}, ${c.nombre} a la etapa de Psicotécnico?`)) return;
  if (yaTienePsicoActivo(c.dni)) {
    showToast(`Ya existe una evaluación psicotécnica activa para el DNI ${c.dni}.`, 'warn');
    return;
  }
  const psico = {
    id: Date.now().toString(),
    dni: c.dni,
    candidatoId: c.id,
    nombre: `${c.apellido}, ${c.nombre}`,
    fechaRealizacion: '',
    resultado: 'Pendiente',
    etapas: { psicotecnico: false, prelaboral: false, antecedentes: false, libreta: false },
    estado: 'En proceso',
    observaciones: '',
  };
  DB.psicos.push(psico);
  supaSync('psicos', psico)
    .then(() => { showToast('Candidato enviado a Psicotécnico', 'ok'); renderCandidatos(); })
    .catch((e) => showToast(e.message, 'err'));
}

export function abrirDetalleCandidatoPorId(id) {
  const c = getCandById(id);
  if (!c) return;
  ensureModal('modal-cand-detalle', `
    <div class="modal-head"><h2>${esc(c.apellido)}, ${esc(c.nombre)}</h2><button class="modal-close" onclick="cerrarModal('modal-cand-detalle')">×</button></div>
    <div class="modal-body">
      <div class="grupo"><legend>Datos</legend>
        <div class="grid3">
          ${[['DNI', c.dni], ['CUIT', c.cuit], ['Tel', c.telefono || c.tel], ['Email', c.email], ['Nacimiento', c.fecNac ? fechaISOToDisplay(c.fecNac) : ''], ['Edad', c.fecNac ? calcularEdad(c.fecNac) : ''], ['Estado civil', c.estadoCivil], ['Género', c.genero], ['Nacionalidad', c.nacionalidad], ['Zona', c.zona], ['Localidad', c.localidad], ['Disponibilidad', c.disponibilidadHoraria], ['Medio', c.medio], ['Referido', c.nombreReferido], ['Estado', c.estado], ['Motivo rechazo', c.motivoRechazo]]
            .map(([k, v]) => `<div><strong>${k}:</strong><br/>${esc(v || '—')}</div>`).join('')}
        </div>
      </div>
      <div class="grupo"><legend>Entrevista</legend>
        <p>Fecha cita: ${esc(c.fechaCita ? fechaISOToDisplay(c.fechaCita) + ' ' + (c.horaCita || '') : '—')} · Asistió: ${c.asistio ? 'Sí' : 'No'}</p>
        <p class="muted">${esc(c.obs || '')}</p>
      </div>
    </div>
    <div class="modal-foot"><button class="btn btn-secondary" onclick="cerrarModal('modal-cand-detalle')">Cerrar</button></div>
  `, {});
}

export function abrirBajaCandidatoPorId(id) {
  const c = getCandById(id);
  if (!c) return;
  ensureModal('modal-baja-cand', `
    <div class="modal-head"><h2>Dar de baja — ${esc(c.nombre)} ${esc(c.apellido)}</h2><button class="modal-close" onclick="cerrarModal('modal-baja-cand')">×</button></div>
    <form id="form-baja-cand">
      <div class="modal-body">
        <div class="form-grid">
          <div class="field"><label>Motivo de baja *</label>
            <select name="motivoBaja" required>
              <option value="">Seleccionar…</option>
              ${['Renunció al proceso', 'Consiguió otro trabajo', 'No contesta', 'Duplicado', 'Otro'].map((m) => `<option>${m}</option>`).join('')}
            </select>
          </div>
          <div class="field"><label>Detalle</label><input name="obsBaja" /></div>
        </div>
      </div>
      <div class="modal-foot"><button type="button" class="btn btn-secondary" onclick="cerrarModal('modal-baja-cand')">Cancelar</button><button type="submit" class="btn btn-danger">Confirmar baja</button></div>
    </form>`, {});
  document.getElementById('form-baja-cand').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const datos = capturar(ev);
    if (!datos.motivoBaja) { showToast('El motivo de baja es obligatorio', 'err'); return; }
    c.estado = 'Baja';
    c.motivoBaja = datos.motivoBaja;
    c.obs = (c.obs || '') + ' [Baja: ' + datos.motivoBaja + ']';
    supaSync('candidatos', c)
      .then(() => { cerrarModal('modal-baja-cand'); showToast('Candidato dado de baja', 'warn'); renderCandidatos(); })
      .catch((e) => showToast(e.message, 'err'));
  });
}

export function confirmarBajaCandidato(id, motivo) {
  const c = getCandById(id);
  if (!c) return Promise.reject(new Error('Candidato no encontrado'));
  c.estado = 'Baja';
  c.motivoBaja = motivo;
  return supaSync('candidatos', c);
}

// El link lleva SIEMPRE la empresa en la URL (?empresa=<id>): el formulario
// público es uno solo para todo el sistema, y sin ese dato el candidato se
// guarda sin empresa asignada -> queda invisible para tu usuario (las
// políticas de RLS solo te dejan ver candidatos de tu propia empresa).
export function linkPublicoPostulacion() {
  const empresaId = getCurrentUser()?.empresaId || '';
  return `${location.origin}/postularme?empresa=${encodeURIComponent(empresaId)}`;
}

export function renderLinkPublico(container) {
  const link = linkPublicoPostulacion();
  container.innerHTML = `
    <div class="card" style="max-width:720px">
      <h3>Link público de postulación</h3>
      <p>Compartí este enlace para que los postulantes carguen sus datos directamente (entran como "Pre-candidato" a la pestaña Pre-candidatos, para que los revises antes de que sigan el flujo).</p>
      <div class="toolbar">
        <input type="text" readonly value="${esc(link)}" style="flex:1;font-family:Consolas,monospace" />
        <button class="btn" onclick="copiarLinkPostulacion()">Copiar</button>
      </div>
      <p class="muted">Usá siempre este link (con el <code>?empresa=</code> incluido) para compartirlo — sin eso, las postulaciones no se van a ver.</p>
    </div>`;
}

export function copiarLinkPostulacion() {
  const link = linkPublicoPostulacion();
  navigator.clipboard?.writeText(link)
    .then(() => showToast('Link copiado', 'ok'))
    .catch(() => showToast('No se pudo copiar', 'err'));
}

export function renderPrecandidatos() {
  const cont = document.getElementById('cand-contenido');
  const buscar = document.getElementById('cand-buscar-pre')?.value || '';
  const fZona = document.getElementById('cand-filtro-zona-pre')?.value || '';
  const todos = (DB.candidatos || []).filter((c) => c.estado === 'Precandidato');
  const lista = todos
    .filter((c) => !buscar || [c.apellido, c.nombre, c.dni, c.telefono].some((v) => String(v || '').toLowerCase().includes(buscar.toLowerCase())))
    .filter((c) => !fZona || c.zona === fZona)
    .sort((a, b) => String(b.id).localeCompare(String(a.id)));

  cont.innerHTML = `
    <div class="toolbar">
      <input type="text" id="cand-buscar-pre" placeholder="Buscar apellido / DNI…" value="${esc(buscar)}" oninput="renderPrecandidatos()" />
      <select id="cand-filtro-zona-pre" onchange="renderPrecandidatos()">
        <option value="">Zona: todas</option>
        ${[...new Set(todos.map((c) => c.zona).filter(Boolean))].map((z) => `<option ${fZona === z ? 'selected' : ''}>${esc(z)}</option>`).join('')}
      </select>
      <span class="muted">${lista.length} precandidato(s)</span>
    </div>
    <div class="tbl-wrap">
      <table class="tbl">
        <thead><tr><th>Apellido</th><th>Nombre</th><th>DNI</th><th>Edad</th><th>Tel</th><th>Zona</th><th>Medio</th><th>Acciones</th></tr></thead>
        <tbody>
          ${lista.length ? lista.map(filaPrecandidato).join('') : '<tr><td colspan="8" class="empty">Sin precandidatos pendientes.</td></tr>'}
        </tbody>
      </table>
    </div>`;
}

function filaPrecandidato(c) {
  const edad = c.fecNac ? calcularEdad(c.fecNac) : null;
  return `<tr>
    <td>${esc(c.apellido || '')}</td>
    <td>${esc(c.nombre || '')}</td>
    <td>${esc(c.dni || '')}</td>
    <td>${edad ?? '—'}</td>
    <td>${esc(c.telefono || c.tel || '')}</td>
    <td>${esc(c.zona || '')}</td>
    <td>${esc(c.medio || '')}</td>
    <td class="acciones">
      <button class="btn btn-success btn-sm" onclick="aprobarPrecandidato('${esc(String(c.id))}')">Aprobar</button>
      <button class="btn btn-secondary btn-sm" onclick="abrirMensajeEntrevista('${esc(String(c.id))}')">Enviar link entrevista</button>
      <button class="btn btn-danger btn-sm" onclick="rechazarPrecandidato('${esc(String(c.id))}')">Rechazar</button>
      <button class="btn btn-secondary btn-sm" onclick="abrirDetalleCandidatoPorId('${esc(String(c.id))}')">Ver</button>
    </td>
  </tr>`;
}

export function aprobarPrecandidato(id) {
  const c = getCandById(id);
  if (!c) return;
  c.estado = 'Sin citar';
  supaSync('candidatos', c)
    .then(() => { showToast('Precandidato aprobado — ingresa al flujo', 'ok'); renderPrecandidatos(); })
    .catch((e) => showToast(e.message, 'err'));
}

export function rechazarPrecandidato(id) {
  const c = getCandById(id);
  if (!c) return;
  ensureModal('modal-rechazar-pre', `
    <div class="modal-head"><h2>Rechazar precandidato — ${esc(c.apellido)}, ${esc(c.nombre)}</h2><button class="modal-close" onclick="cerrarModal('modal-rechazar-pre')">×</button></div>
    <form id="form-rechazar-pre">
      <div class="modal-body">
        <div class="form-grid">
          <div class="field full"><label>Motivo de rechazo *</label>
            <select name="motivoRechazo" required>
              <option value="">Seleccionar…</option>
              ${MOTIVOS_RECHAZO.map((m) => `<option>${m}</option>`).join('')}
            </select>
          </div>
          <div class="field full"><label>Observaciones</label><textarea name="obsRechazo" rows="2"></textarea></div>
        </div>
      </div>
      <div class="modal-foot"><button type="button" class="btn btn-secondary" onclick="cerrarModal('modal-rechazar-pre')">Cancelar</button><button type="submit" class="btn btn-danger">Confirmar rechazo</button></div>
    </form>`, {});
  document.getElementById('form-rechazar-pre').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const datos = capturar(ev);
    if (!datos.motivoRechazo) { showToast('El motivo de rechazo es obligatorio', 'err'); return; }
    c.estado = 'Rechazado';
    c.motivoRechazo = datos.motivoRechazo;
    c.obs = (c.obs || '') + ' [Rechazo pre-candidato: ' + datos.motivoRechazo + ']';
    supaSync('candidatos', c)
      .then(() => { cerrarModal('modal-rechazar-pre'); showToast('Precandidato rechazado', 'warn'); renderPrecandidatos(); })
      .catch((e) => showToast(e.message, 'err'));
  });
}

export function abrirMensajeEntrevista(id) {
  const c = getCandById(id);
  if (!c) return;
  const tel = c.telefono || c.tel || '';
  const nombre = c.nombre || '';
  const fecha = c.fechaCita || '';
  const hora = c.horaCita || '';
  // La empresa del candidato viaja en el link (igual que en el de postulación):
  // sin eso, lo que complete en /agendar-entrevista tampoco se va a ver.
  const empresaId = c.empresaId || getCurrentUser()?.empresaId || '';
  const linkAgendar = `${location.origin}/agendar-entrevista?dni=${encodeURIComponent(c.dni || '')}&nombre=${encodeURIComponent(c.nombre || '')}&empresa=${encodeURIComponent(empresaId)}`;
  const templates = [
    `Hola ${nombre}, te contactamos de [empresa]. ¿Podrías confirmarnos tu disponibilidad para una entrevista presencial? ¿Qué día y horario te viene mejor?`,
    `Hola ${nombre}, quedamos en coordinar una entrevista. Te paso el link para que completes tus datos: ${linkAgendar}`,
    `Hola ${nombre}, pasaste a la etapa de pre-selección. Te citamos el ${fecha} a las ${hora}. ¿Confirmas asistencia?`,
  ];
  ensureModal('modal-mensaje-entrevista', `
    <div class="modal-head"><h2>Enviar mensaje — ${esc(c.apellido)}, ${esc(c.nombre)}</h2><button class="modal-close" onclick="cerrarModal('modal-mensaje-entrevista')">×</button></div>
    <div class="modal-body">
      <div class="form-grid">
        <div class="field"><label>Teléfono</label><input id="msg-entrevista-tel" value="${esc(tel)}" /></div>
        <div class="field full"><label>Plantilla</label>
          <select id="msg-entrevista-tpl" onchange="seleccionarPlantillaEntrevista()">
            <option value="0">Confirmación de disponibilidad</option>
            <option value="1">Link para elegir turno</option>
            <option value="2">Confirmación de cita</option>
          </select>
        </div>
        <div class="field full"><label>Mensaje</label><textarea id="msg-entrevista-texto" rows="5">${esc(templates[0])}</textarea></div>
      </div>
    </div>
    <div class="modal-foot">
      <button type="button" class="btn btn-secondary" onclick="cerrarModal('modal-mensaje-entrevista')">Cancelar</button>
      <button type="button" class="btn" onclick="copiarMensajeEntrevista()">Copiar mensaje</button>
      <button type="button" class="btn btn-success" onclick="abrirWhatsAppEntrevista()">WhatsApp</button>
    </div>
  `, { size: 'modal-lg' });
  window._msgEntrevistaTemplates = templates;
  window._msgEntrevistaId = id;
}

export function seleccionarPlantillaEntrevista() {
  const idx = Number(document.getElementById('msg-entrevista-tpl').value);
  const texto = document.getElementById('msg-entrevista-texto');
  if (texto && window._msgEntrevistaTemplates?.[idx] != null) {
    texto.value = window._msgEntrevistaTemplates[idx];
  }
}

export function copiarMensajeEntrevista() {
  const texto = document.getElementById('msg-entrevista-texto')?.value || '';
  navigator.clipboard?.writeText(texto)
    .then(() => showToast('Mensaje copiado', 'ok'))
    .catch(() => showToast('No se pudo copiar', 'err'));
}

export function abrirWhatsAppEntrevista() {
  const tel = (document.getElementById('msg-entrevista-tel')?.value || '').replace(/\D/g, '');
  const texto = document.getElementById('msg-entrevista-texto')?.value || '';
  if (!tel) { showToast('Ingresá un número de teléfono', 'err'); return; }
  window.open(`https://wa.me/${tel}?text=${encodeURIComponent(texto)}`, '_blank');
}

// Adjuntos de candidato (entrevista/proceso) — helper por si se usa desde el detalle.
export function etapaAdjuntosCandidato() { return 'candidatos'; }

import { renderCalendario } from './calendario.js';
import { renderImportadorHistorico } from './importadorHistorico.js';
