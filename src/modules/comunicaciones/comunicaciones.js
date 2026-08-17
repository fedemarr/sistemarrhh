// Comunicaciones — messaging entre admin y asociados (aviso de pago, preguntas, general).

import { DB } from '../../state.js';
import { supaSync } from '../../shared/supabase.js';
import { ensureModal, cerrarModal, showToast, capturar } from '../../shared/modal.js';
import { esc, fechaISOToDisplay } from '../../shared/helpers.js';
import { getCurrentUser, esRol } from '../../shared/auth.js';

export const TIPOS_MSG = {
  aviso_pago: 'Aviso de pago',
  pregunta: 'Pregunta de asociado',
  general: 'General',
};

export function renderComunicaciones(tab = 'general') {
  const cont = document.getElementById('screen-comunicaciones');
  const u = getCurrentUser();
  const esAdmin = u && esRol('Administrador total', 'RRHH');

  const todos = (DB.comunicaciones || []).slice().sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
  const misMensajes = esAdmin ? todos : todos.filter((m) => m.para === '*' || m.para === u?.nombre || m.de === u?.nombre || m.de === 'sistema');
  const avisos = misMensajes.filter((m) => m.tipo === 'aviso_pago');
  const preguntas = misMensajes.filter((m) => m.tipo === 'pregunta');
  const general = misMensajes.filter((m) => m.tipo === 'general');

  const unread = misMensajes.filter((m) => !m.leido && m.de !== u?.nombre).length;

  cont.innerHTML = `
    <div class="stats">
      <div class="stat"><div class="num">${unread}</div><div class="lbl">Sin leer</div></div>
      <div class="stat"><div class="num">${avisos.length}</div><div class="lbl">Avisos de pago</div></div>
      <div class="stat"><div class="num">${preguntas.length}</div><div class="lbl">Preguntas</div></div>
      <div class="stat"><div class="num">${general.length}</div><div class="lbl">General</div></div>
    </div>
    <div class="tabs">
      ${[['general', `General (${general.length})`], ['aviso_pago', `Avisos de pago (${avisos.length})`], ['pregunta', `Preguntas (${preguntas.length})`]]
        .map(([k, l]) => `<button class="tab-btn ${tab === k ? 'active' : ''}" onclick="renderComunicaciones('${k}')">${l}</button>`).join('')}
    </div>
    <div class="toolbar">
      <div class="spacer"></div>
      ${esAdmin ? '<button class="btn" onclick="abrirNuevoMensaje()">+ Nuevo mensaje</button>' : '<button class="btn" onclick="abrirNuevaPregunta()">+ Hacer una pregunta</button>'}
    </div>
    <div id="comunicaciones-lista"></div>`;

  const listaCont = document.getElementById('comunicaciones-lista');
  const lista = tab === 'aviso_pago' ? avisos : tab === 'pregunta' ? preguntas : general;
  if (!lista.length) {
    listaCont.innerHTML = '<div class="empty">Sin mensajes en esta categoría.</div>';
    return;
  }
  listaCont.innerHTML = `<div class="tbl-wrap"><table class="tbl">
    <thead><tr><th>Fecha</th><th>Tipo</th><th>De</th><th>Para</th><th>Mensaje</th><th>Leído</th><th>Acciones</th></tr></thead>
    <tbody>
      ${lista.map((m) => `<tr style="${!m.leido && m.de !== u?.nombre ? 'font-weight:bold' : ''}">
        <td>${esc(fechaISOToDisplay(m.fecha?.slice(0, 10)))}</td>
        <td><span class="chip chip-azul">${esc(TIPOS_MSG[m.tipo] || m.tipo)}</span></td>
        <td>${esc(m.de)}</td>
        <td>${esc(m.para === '*' ? 'Todos' : m.para)}</td>
        <td style="max-width:300px">${esc(m.mensaje)}</td>
        <td>${m.leido ? '✓' : '○'}</td>
        <td class="acciones">
          ${!m.leido && m.de !== u?.nombre ? `<button class="btn btn-secondary btn-sm" onclick="marcarLeido('${esc(String(m.id))}')">Marcar leído</button>` : ''}
          ${esAdmin ? `<button class="btn btn-sm" onclick="responderMensaje('${esc(String(m.id))}')">Responder</button>` : ''}
        </td>
      </tr>`).join('')}
    </tbody>
  </table></div>`;
}

export function abrirNuevoMensaje() {
  ensureModal('modal-mensaje', `
    <div class="modal-head"><h2>Nuevo mensaje</h2><button class="modal-close" onclick="cerrarModal('modal-mensaje')">×</button></div>
    <form id="form-mensaje">
      <div class="modal-body">
        <div class="form-grid">
          <div class="field"><label>Tipo *</label>
            <select name="tipo">
              <option value="aviso_pago">Aviso de pago</option>
              <option value="general">General</option>
            </select>
          </div>
          <div class="field"><label>Para (nombre del asociado o * para todos)</label>
            <input name="para" placeholder="Nombre del asociado o *" /></div>
          <div class="field full"><label>Mensaje *</label><textarea name="mensaje" rows="4" required></textarea></div>
        </div>
      </div>
      <div class="modal-foot"><button type="button" class="btn btn-secondary" onclick="cerrarModal('modal-mensaje')">Cancelar</button><button type="submit" class="btn">Enviar</button></div>
    </form>`, {});
  document.getElementById('form-mensaje').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const datos = capturar(ev);
    if (!datos.mensaje) { showToast('El mensaje es obligatorio.', 'err'); return; }
    enviarMensaje(datos.tipo, datos.para || '*', datos.mensaje);
    cerrarModal('modal-mensaje');
  });
}

export function abrirNuevaPregunta() {
  ensureModal('modal-pregunta', `
    <div class="modal-head"><h2>Hacer una pregunta</h2><button class="modal-close" onclick="cerrarModal('modal-pregunta')">×</button></div>
    <form id="form-pregunta">
      <div class="modal-body">
        <div class="form-grid">
          <div class="field full"><label>Tu pregunta *</label><textarea name="mensaje" rows="4" required></textarea></div>
        </div>
      </div>
      <div class="modal-foot"><button type="button" class="btn btn-secondary" onclick="cerrarModal('modal-pregunta')">Cancelar</button><button type="submit" class="btn">Enviar</button></div>
    </form>`, {});
  document.getElementById('form-pregunta').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const datos = capturar(ev);
    if (!datos.mensaje) { showToast('La pregunta es obligatoria.', 'err'); return; }
    const u = getCurrentUser();
    enviarMensaje('pregunta', 'RRHH', datos.mensaje, null, null, u?.nombre || 'Asociado');
    cerrarModal('modal-pregunta');
  });
}

export function enviarMensaje(tipo, para, mensaje, refTipo = null, refId = null, deOverride = null) {
  const u = getCurrentUser();
  const m = {
    id: Date.now().toString(),
    tipo,
    de: deOverride || u?.nombre || 'sistema',
    para,
    mensaje,
    leido: false,
    fecha: new Date().toISOString(),
    refTipo: refTipo || null,
    refId: refId || null,
  };
  DB.comunicaciones.push(m);
  supaSync('comunicaciones', m)
    .then(() => showToast('Mensaje enviado', 'ok'))
    .catch((e) => showToast(e.message, 'err'));
  return m;
}

export function marcarLeido(id) {
  const m = (DB.comunicaciones || []).find((x) => String(x.id) === String(id));
  if (!m) return;
  m.leido = true;
  supaSync('comunicaciones', m)
    .then(() => renderComunicaciones())
    .catch((e) => showToast(e.message, 'err'));
}

export function responderMensaje(id) {
  const m = (DB.comunicaciones || []).find((x) => String(x.id) === String(id));
  if (!m) return;
  ensureModal('modal-respuesta', `
    <div class="modal-head"><h2>Responder — ${esc(TIPOS_MSG[m.tipo] || m.tipo)}</h2><button class="modal-close" onclick="cerrarModal('modal-respuesta')">×</button></div>
    <form id="form-respuesta">
      <div class="modal-body">
        <div class="form-grid">
          <div class="field full"><label>Mensaje original</label><div class="card" style="padding:8px">${esc(m.mensaje)}</div></div>
          <div class="field full"><label>Tu respuesta *</label><textarea name="respuesta" rows="4" required></textarea></div>
        </div>
      </div>
      <div class="modal-foot"><button type="button" class="btn btn-secondary" onclick="cerrarModal('modal-respuesta')">Cancelar</button><button type="submit" class="btn">Enviar respuesta</button></div>
    </form>`, {});
  document.getElementById('form-respuesta').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const datos = capturar(ev);
    if (!datos.respuesta) { showToast('La respuesta es obligatoria.', 'err'); return; }
    enviarMensaje(m.tipo, m.de, datos.respuesta, m.refTipo, m.refId);
    cerrarModal('modal-respuesta');
  });
}
