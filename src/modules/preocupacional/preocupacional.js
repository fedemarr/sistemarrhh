// Preocupacional — examen pre-ocupacional médico.
// Fuente de verdad: 01_Flujo_Ingreso.md §1.4.

import { DB } from '../../state.js';
import { supaSync } from '../../shared/supabase.js';
import { ensureModal, cerrarModal, showToast, capturar } from '../../shared/modal.js';
import { esc, fechaISOToDisplay } from '../../shared/helpers.js';

export const PRESTADORES = ['MEDE', 'Grupo CMC', 'IDT'];
export const RESULTADOS_PREOCUP = ['Apto', 'Apto con observaciones', 'No Apto'];

export function documVivoParaDni(dni) {
  return (DB.documentacionIngreso || []).some(
    (d) => d.dni === dni && !d.anulado && (d.estado === 'En proceso' || d.estado === 'Aprobado')
  );
}

export function getPreocupById(id) {
  return (DB.preocupacionales || []).find((p) => String(p.id) === String(id));
}

export function renderPreocup() {
  const cont = document.getElementById('screen-preocupacional');
  const ver = document.getElementById('preocup-ver')?.value || 'activos';
  const buscar = document.getElementById('preocup-buscar')?.value || '';

  const lista = (DB.preocupacionales || [])
    .filter((p) => (ver === 'activos' ? p.estado !== 'Rechazado' && !p.anulado : p.estado === 'Rechazado' || p.anulado))
    .filter((p) => !buscar || String(p.nombre || '').toLowerCase().includes(buscar.toLowerCase()) || String(p.dni).includes(buscar));

  const stats = {
    total: (DB.preocupacionales || []).length,
    enProceso: (DB.preocupacionales || []).filter((p) => p.estado === 'En proceso').length,
    aprobados: (DB.preocupacionales || []).filter((p) => p.estado === 'Aprobado').length,
    conDocum: (DB.preocupacionales || []).filter((p) => documVivoParaDni(p.dni)).length,
  };

  cont.innerHTML = `
    <div class="stats">
      <div class="stat"><div class="num">${stats.total}</div><div class="lbl">Exámenes</div></div>
      <div class="stat"><div class="num">${stats.enProceso}</div><div class="lbl">En proceso</div></div>
      <div class="stat"><div class="num">${stats.aprobados}</div><div class="lbl">Aprobados</div></div>
      <div class="stat"><div class="num">${stats.conDocum}</div><div class="lbl">Con documentación activa</div></div>
    </div>
    <div class="toolbar">
      <button class="btn btn-secondary" onclick="tabPreocup('activos')">Activos</button>
      <button class="btn btn-secondary" onclick="tabPreocup('historico')">Histórico</button>
      <input type="text" id="preocup-buscar" placeholder="Buscar por DNI / nombre…" value="${esc(buscar)}" oninput="filtrarPreocup()" />
      <div class="spacer"></div>
      <button class="btn" onclick="abrirNuevoPreocup()">+ Nuevo examen</button>
    </div>
    <div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>Nombre</th><th>DNI</th><th>Fecha turno</th><th>Prestador</th><th>Resultado</th><th>Estado</th><th>Acciones</th></tr></thead>
      <tbody>
        ${lista.length ? lista.map(filaPreocup).join('') : '<tr><td colspan="7" class="empty">Sin exámenes.</td></tr>'}
      </tbody>
    </table></div>`;
}

export function tabPreocup(ver) {
  const cont = document.getElementById('screen-preocupacional');
  cont.dataset.ver = ver;
  renderPreocup();
}

export function filtrarPreocup() {
  renderPreocup();
}

export function poblarFiltrosColumnasPreocup() {
  /* hook: no-op */
}

function filaPreocup(p) {
  const tieneDocum = documVivoParaDni(p.dni);
  let accion;
  if (p.estado === 'En proceso') {
    accion = `<button class="btn btn-sm" onclick="abrirGestionPreocup('${esc(String(p.id))}')">Gestionar</button>`;
  } else if (tieneDocum) {
    accion = '<span class="chip chip-gris">Cerrado</span>';
  } else {
    accion = `<button class="btn btn-secondary btn-sm" onclick="abrirGestionPreocup('${esc(String(p.id))}')">Ver</button> <button class="btn btn-secondary btn-sm" onclick="revertirPreocup('${esc(String(p.id))}')">Revertir</button>`;
  }
  return `<tr>
    <td>${esc(p.nombre || '')}</td>
    <td>${esc(p.dni || '')}</td>
    <td>${p.fechaTurno ? esc(fechaISOToDisplay(p.fechaTurno)) : '—'}</td>
    <td>${esc(p.prestador || '—')}</td>
    <td><span class="chip ${p.resultado === 'No Apto' ? 'chip-rojo' : p.resultado === 'Apto' ? 'chip-verde' : 'chip-naranja'}">${esc(p.resultado || 'Pendiente')}</span></td>
    <td>${esc(p.estado || 'En proceso')}</td>
    <td class="acciones">${accion}</td>
  </tr>`;
}

export function abrirNuevoPreocup() {
  ensureModal('modal-preocup', `
    <div class="modal-head"><h2>Nuevo preocupacional</h2><button class="modal-close" onclick="cerrarModal('modal-preocup')">×</button></div>
    <form id="form-preocup">
      <div class="modal-body">
        <div class="form-grid">
          <div class="field"><label>DNI *</label><input name="dni" required inputmode="numeric" /></div>
          <div class="field"><label>Candidato (id)</label><input name="candidatoId" /></div>
          <div class="field full"><label>Nombre *</label><input name="nombre" required /></div>
          <div class="field"><label>Fecha del turno</label><input type="date" name="fechaTurno" /></div>
          <div class="field"><label>Prestador</label><select name="prestador">${PRESTADORES.map((p) => `<option>${p}</option>`).join('')}</select></div>
          <div class="field full"><label>Observaciones</label><textarea name="observaciones" rows="3"></textarea></div>
        </div>
      </div>
      <div class="modal-foot"><button type="button" class="btn btn-secondary" onclick="cerrarModal('modal-preocup')">Cancelar</button><button type="submit" class="btn">Guardar</button></div>
    </form>`, {});
  document.getElementById('form-preocup').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const datos = capturar(ev);
    const p = {
      id: Date.now().toString(),
      dni: datos.dni,
      candidatoId: datos.candidatoId || null,
      nombre: datos.nombre,
      fechaTurno: datos.fechaTurno || '',
      prestador: datos.prestador || '',
      fechaResultado: '',
      resultado: 'Pendiente',
      motivo: '',
      estado: 'En proceso',
      observaciones: datos.observaciones,
    };
    DB.preocupacionales.push(p);
    supaSync('preocupacionales', p)
      .then(() => { cerrarModal('modal-preocup'); showToast('Examen guardado', 'ok'); renderPreocup(); })
      .catch((e) => showToast(e.message, 'err'));
  });
}

export function abrirGestionPreocup(id) {
  const p = getPreocupById(id);
  if (!p) return;
  ensureModal('modal-preocup-gestion', `
    <div class="modal-head"><h2>Preocupacional — ${esc(p.nombre || '')}</h2><button class="modal-close" onclick="cerrarModal('modal-preocup-gestion')">×</button></div>
    <form id="form-preocup-gestion">
      <div class="modal-body">
        <div class="form-grid">
          <div class="field"><label>DNI</label><input value="${esc(p.dni)}" readonly /></div>
          <div class="field"><label>Prestador</label><select name="prestador">${PRESTADORES.map((pr) => `<option ${p.prestador === pr ? 'selected' : ''}>${pr}</option>`).join('')}</select></div>
          <div class="field"><label>Fecha del turno</label><input type="date" name="fechaTurno" value="${esc(p.fechaTurno || '')}" /></div>
          <div class="field"><label>Fecha del resultado</label><input type="date" name="fechaResultado" value="${esc(p.fechaResultado || '')}" /></div>
          <div class="field"><label>Resultado</label>
            <select name="resultado">${['Pendiente', ...RESULTADOS_PREOCUP].map((r) => `<option ${p.resultado === r ? 'selected' : ''}>${r}</option>`).join('')}</select>
          </div>
          <div class="field full"><label>Observaciones</label><textarea name="observaciones" rows="2">${esc(p.observaciones || '')}</textarea></div>
        </div>
        <div class="toolbar">
          <button type="button" class="btn btn-success" onclick="aprobarPreocup('${esc(String(p.id))}')">Aprobar</button>
          <button type="button" class="btn btn-danger" onclick="rechazarPreocup('${esc(String(p.id))}')">Rechazar</button>
          <button type="button" class="btn btn-warning" onclick="bajaPreocup('${esc(String(p.id))}')">Desvincular</button>
          <button type="button" class="btn btn-secondary" onclick="analizarAptoMedicoIA('${esc(String(p.id))}')">🤖 IA</button>
        </div>
      </div>
      <div class="modal-foot"><button type="button" class="btn btn-secondary" onclick="cerrarModal('modal-preocup-gestion')">Cerrar</button><button type="submit" class="btn">Guardar cambios</button></div>
    </form>`, {});
  document.getElementById('form-preocup-gestion').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const datos = capturar(ev);
    Object.assign(p, { prestador: datos.prestador, fechaTurno: datos.fechaTurno, fechaResultado: datos.fechaResultado, resultado: datos.resultado, observaciones: datos.observaciones });
    supaSync('preocupacionales', p)
      .then(() => { showToast('Cambios guardados', 'ok'); abrirGestionPreocup(p.id); })
      .catch((e) => showToast(e.message, 'err'));
  });
}

export function guardarPreocup(datos) {
  const p = getPreocupById(datos.id);
  if (p) Object.assign(p, datos);
  else DB.preocupacionales.push(datos);
  return supaSync('preocupacionales', datos);
}

export function aprobarPreocup(id) {
  const p = getPreocupById(id);
  if (!p) return;
  if (p.estado !== 'En proceso') { showToast('Solo se aprueban exámenes En proceso.', 'warn'); return; }
  // Guard de idempotencia: no duplicar documentación para un DNI ya con documento vivo.
  if (documVivoParaDni(p.dni)) { showToast('Ya existe documentación de ingreso activa para este DNI.', 'warn'); return; }
  p.estado = 'Aprobado';
  p.resultado = p.resultado === 'Pendiente' ? 'Apto' : p.resultado;
  p.fechaResultado = p.fechaResultado || new Date().toISOString().slice(0, 10);

  const docum = {
    id: Date.now().toString(),
    dni: p.dni,
    candidatoId: p.candidatoId,
    nombre: p.nombre,
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
  DB.documentacionIngreso.push(docum);

  Promise.all([supaSync('preocupacionales', p), supaSync('documentacionIngreso', docum)])
    .then(() => { showToast('Preocupacional aprobado — se creó la documentación de ingreso', 'ok'); cerrarModal('modal-preocup-gestion'); renderPreocup(); })
    .catch((e) => showToast(e.message, 'err'));
}

export function rechazarPreocup(id, motivo) {
  const p = getPreocupById(id);
  if (!p) return Promise.reject(new Error('Examen no encontrado'));
  if (!motivo) {
    motivo = window.prompt('Motivo del rechazo (obligatorio):', '')?.trim();
    if (!motivo) return Promise.reject(new Error('El motivo del rechazo es obligatorio'));
  }
  p.estado = 'Rechazado';
  p.resultado = p.resultado === 'Pendiente' ? 'No Apto' : p.resultado;
  p.motivo = motivo;
  return supaSync('preocupacionales', p).then(() => { showToast('Examen rechazado', 'warn'); cerrarModal('modal-preocup-gestion'); renderPreocup(); });
}

export function revertirPreocup(id) {
  const p = getPreocupById(id);
  if (!p) return;
  if (documVivoParaDni(p.dni)) { showToast('No se puede revertir: existe documentación de ingreso activa para este DNI.', 'err'); return; }
  p.estado = 'En proceso';
  p.resultado = 'Pendiente';
  p.motivo = '';
  supaSync('preocupacionales', p)
    .then(() => { showToast('Examen revertido a En proceso', 'ok'); renderPreocup(); })
    .catch((e) => showToast(e.message, 'err'));
}

export function bajaPreocup(id) {
  const p = getPreocupById(id);
  if (!p) return;
  p.anulado = true;
  p.estado = 'Anulado';
  supaSync('preocupacionales', p)
    .then(() => { showToast('Examen desvinculado', 'warn'); cerrarModal('modal-preocup-gestion'); renderPreocup(); })
    .catch((e) => showToast(e.message, 'err'));
}

export function analizarAptoMedicoIA(id) {
  const p = getPreocupById(id);
  if (!p) return;
  showToast('Analizando apto médico con IA (mock)…', 'warn');
  setTimeout(() => {
    p.resultado = 'Apto';
    supaSync('preocupacionales', p)
      .then(() => { showToast('IA sugirió: Apto', 'ok'); abrirGestionPreocup(p.id); })
      .catch((e) => showToast(e.message, 'err'));
  }, 1500);
}

export function usarDatosIAApto(id, resultado) {
  const p = getPreocupById(id);
  if (!p) return;
  p.resultado = resultado || 'Apto';
  supaSync('preocupacionales', p);
}
