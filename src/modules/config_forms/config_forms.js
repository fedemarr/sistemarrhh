// Configuración de formularios — postulación y entrevista.
// Permite al admin customizar los campos del formulario público y de entrevista.

import { DB, SESSION } from '../../state.js';
import { supaSync } from '../../shared/supabase.js';
import { ensureModal, cerrarModal, showToast, capturar } from '../../shared/modal.js';
import { esc } from '../../shared/helpers.js';

const DEFAULT_CAMPOS_POSTULACION = [
  { key: 'nombre', label: 'Nombre', type: 'text', required: true, order: 1 },
  { key: 'apellido', label: 'Apellido', type: 'text', required: true, order: 2 },
  { key: 'dni', label: 'DNI', type: 'text', required: true, order: 3 },
  { key: 'email', label: 'Email', type: 'email', required: false, order: 4 },
  { key: 'telefono', label: 'Teléfono', type: 'tel', required: false, order: 5 },
  { key: 'fechaNacimiento', label: 'Fecha de nacimiento', type: 'date', required: false, order: 6 },
  { key: 'servicioDeseado', label: 'Servicio deseado', type: 'text', required: false, order: 7 },
  { key: 'disponibilidad', label: 'Disponibilidad', type: 'select', required: false, options: 'Full time,Part time,Solo mañanas,Solo tardes', order: 8 },
  { key: 'experiencia', label: 'Experiencia', type: 'textarea', required: false, order: 9 },
];

const DEFAULT_CAMPOS_ENTREVISTA = [
  { key: 'nombre', label: 'Nombre', type: 'text', required: true, order: 1 },
  { key: 'apellido', label: 'Apellido', type: 'text', required: true, order: 2 },
  { key: 'dni', label: 'DNI', type: 'text', required: true, order: 3 },
  { key: 'observaciones', label: 'Observaciones', type: 'textarea', required: false, order: 4 },
];

function getCfg(tipo) {
  const key = tipo === 'postulacion' ? 'configFormPostulacion' : 'configFormEntrevista';
  const arr = DB[key];
  if (arr && arr.length > 0) return arr[0];
  return null;
}

function getCfgCampos(tipo) {
  const cfg = getCfg(tipo);
  if (cfg && cfg.campos && cfg.campos.length > 0) return cfg.campos;
  return tipo === 'postulacion' ? DEFAULT_CAMPOS_POSTULACION : DEFAULT_CAMPOS_ENTREVISTA;
}

function getCfgSpeech(tipo) {
  const cfg = getCfg(tipo);
  return cfg?.speech || cfg?.instrucciones || '';
}

function toKebab(str) {
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function renderTablaCampos(campos, tipo) {
  const sorted = [...campos].sort((a, b) => (a.order || 0) - (b.order || 0));
  return `<div class="tbl-wrap"><table class="tbl">
    <thead><tr><th>Orden</th><th>Etiqueta</th><th>Clave</th><th>Tipo</th><th>Obligatorio</th><th>Opciones</th><th>Acciones</th></tr></thead>
    <tbody>
      ${sorted.length ? sorted.map((c) => `<tr>
        <td>${c.order || '—'}</td>
        <td>${esc(c.label)}</td>
        <td><code>${esc(c.key)}</code></td>
        <td>${esc(c.type)}</td>
        <td>${c.required ? 'Sí' : 'No'}</td>
        <td>${c.type === 'select' ? esc(c.options || '') : '—'}</td>
        <td class="acciones">
          <button class="btn btn-secondary btn-sm" onclick="editarCampoForm('${esc(tipo)}','${esc(c.key)}')">Editar</button>
          <button class="btn btn-danger btn-sm" onclick="eliminarCampoForm('${esc(tipo)}','${esc(c.key)}')">Eliminar</button>
        </td>
      </tr>`).join('') : '<tr><td colspan="7" class="empty">Sin campos configurados.</td></tr>'}
    </tbody>
  </table></div>`;
}

export function renderConfigFormPostulacion() {
  const cont = document.getElementById('screen-config_form_postulacion');
  const campos = getCfgCampos('postulacion');
  const speech = getCfgSpeech('postulacion');
  cont.innerHTML = `
    <div class="card" style="max-width:900px">
      <h3>Formulario de postulación pública</h3>
      <p class="muted">Configurá los campos que aparecen en <code>/postularme</code>.</p>
      <div class="form-grid">
        <div class="field full"><label>Speech / Descripción del puesto</label>
          <textarea id="cfg-form-speech-post" rows="3" placeholder="Texto que se muestra arriba del formulario...">${esc(speech)}</textarea>
        </div>
      </div>
      <div class="toolbar" style="margin-top:12px">
        <button class="btn" onclick="agregarCampoForm('postulacion')">+ Agregar campo</button>
        <button class="btn btn-success" onclick="guardarCfgFormPostulacion()">Guardar configuración</button>
      </div>
      ${renderTablaCampos(campos, 'postulacion')}
    </div>`;
}

export function renderConfigFormEntrevista() {
  const cont = document.getElementById('screen-config_form_entrevista');
  const campos = getCfgCampos('entrevista');
  const instrucciones = getCfgSpeech('entrevista');
  cont.innerHTML = `
    <div class="card" style="max-width:900px">
      <h3>Formulario de entrevista</h3>
      <p class="muted">Configurá los campos que aparecen en <code>/agendar-entrevista</code>.</p>
      <div class="form-grid">
        <div class="field full"><label>Instrucciones para el candidato</label>
          <textarea id="cfg-form-speech-ent" rows="3" placeholder="Instrucciones que se muestran al candidato...">${esc(instrucciones)}</textarea>
        </div>
      </div>
      <div class="toolbar" style="margin-top:12px">
        <button class="btn" onclick="agregarCampoForm('entrevista')">+ Agregar campo</button>
        <button class="btn btn-success" onclick="guardarCfgFormEntrevista()">Guardar configuración</button>
      </div>
      ${renderTablaCampos(campos, 'entrevista')}
    </div>`;
}

export function agregarCampoForm(tipo) {
  const campos = getCfgCampos(tipo);
  const maxOrder = campos.reduce((m, c) => Math.max(m, c.order || 0), 0);
  ensureModal('modal-campo-form', `
    <div class="modal-head"><h2>Agregar campo — ${esc(tipo)}</h2><button class="modal-close" onclick="cerrarModal('modal-campo-form')">×</button></div>
    <form id="form-campo-form">
      <div class="modal-body">
        <div class="form-grid">
          <div class="field"><label>Etiqueta *</label><input name="label" required id="campo-form-label" oninput="autoKeyCampoForm()" /></div>
          <div class="field"><label>Clave (key) *</label><input name="key" required id="campo-form-key" /></div>
          <div class="field"><label>Tipo *</label>
            <select name="type" id="campo-form-type">
              <option value="text">Texto</option>
              <option value="email">Email</option>
              <option value="tel">Teléfono</option>
              <option value="date">Fecha</option>
              <option value="select">Selección</option>
              <option value="textarea">Textarea</option>
              <option value="file">Archivo</option>
            </select>
          </div>
          <div class="field"><label>Obligatorio</label>
            <select name="required"><option value="false">No</option><option value="true">Sí</option></select>
          </div>
          <div class="field"><label>Orden</label><input type="number" name="order" value="${maxOrder + 1}" /></div>
          <div class="field full" id="campo-form-options-wrap" style="display:none"><label>Opciones (separadas por coma)</label><input name="options" placeholder="Opción 1,Opción 2,Opción 3" /></div>
        </div>
      </div>
      <div class="modal-foot"><button type="button" class="btn btn-secondary" onclick="cerrarModal('modal-campo-form')">Cancelar</button><button type="submit" class="btn">Agregar</button></div>
    </form>`, {});
  document.getElementById('campo-form-type').addEventListener('change', (e) => {
    document.getElementById('campo-form-options-wrap').style.display = e.target.value === 'select' ? '' : 'none';
  });
  document.getElementById('form-campo-form').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const datos = capturar(ev);
    if (!datos.label || !datos.key) { showToast('Etiqueta y clave son obligatorias.', 'err'); return; }
    const existe = campos.some((c) => c.key === datos.key);
    if (existe) { showToast('Ya existe un campo con esa clave.', 'err'); return; }
    campos.push({
      key: datos.key,
      label: datos.label,
      type: datos.type,
      required: datos.required === 'true',
      order: Number(datos.order) || campos.length + 1,
      options: datos.type === 'select' ? (datos.options || '') : undefined,
    });
    cerrarModal('modal-campo-form');
    if (tipo === 'postulacion') renderConfigFormPostulacion();
    else renderConfigFormEntrevista();
    showToast('Campo agregado', 'ok');
  });
}

export function autoKeyCampoForm() {
  const label = document.getElementById('campo-form-label')?.value || '';
  const key = document.getElementById('campo-form-key');
  if (key && label) key.value = toKebab(label);
}

export function editarCampoForm(tipo, campoKey) {
  const campos = getCfgCampos(tipo);
  const campo = campos.find((c) => c.key === campoKey);
  if (!campo) return;
  ensureModal('modal-campo-form', `
    <div class="modal-head"><h2>Editar campo — ${esc(campo.label)}</h2><button class="modal-close" onclick="cerrarModal('modal-campo-form')">×</button></div>
    <form id="form-campo-form">
      <div class="modal-body">
        <div class="form-grid">
          <div class="field"><label>Etiqueta *</label><input name="label" value="${esc(campo.label)}" required /></div>
          <div class="field"><label>Clave (key) *</label><input name="key" value="${esc(campo.key)}" required /></div>
          <div class="field"><label>Tipo *</label>
            <select name="type" id="campo-form-type">
              ${['text', 'email', 'tel', 'date', 'select', 'textarea', 'file'].map((t) => `<option value="${t}" ${campo.type === t ? 'selected' : ''}>${t}</option>`).join('')}
            </select>
          </div>
          <div class="field"><label>Obligatorio</label>
            <select name="required"><option value="false" ${!campo.required ? 'selected' : ''}>No</option><option value="true" ${campo.required ? 'selected' : ''}>Sí</option></select>
          </div>
          <div class="field"><label>Orden</label><input type="number" name="order" value="${campo.order || 0}" /></div>
          <div class="field full" id="campo-form-options-wrap" style="${campo.type === 'select' ? '' : 'display:none'}"><label>Opciones (separadas por coma)</label><input name="options" value="${esc(campo.options || '')}" /></div>
        </div>
      </div>
      <div class="modal-foot"><button type="button" class="btn btn-secondary" onclick="cerrarModal('modal-campo-form')">Cancelar</button><button type="submit" class="btn">Guardar</button></div>
    </form>`, {});
  document.getElementById('campo-form-type').addEventListener('change', (e) => {
    document.getElementById('campo-form-options-wrap').style.display = e.target.value === 'select' ? '' : 'none';
  });
  document.getElementById('form-campo-form').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const datos = capturar(ev);
    if (!datos.label || !datos.key) { showToast('Etiqueta y clave son obligatorias.', 'err'); return; }
    const idx = campos.findIndex((c) => c.key === campoKey);
    if (idx >= 0) {
      campos[idx] = {
        ...campos[idx],
        key: datos.key,
        label: datos.label,
        type: datos.type,
        required: datos.required === 'true',
        order: Number(datos.order) || 0,
        options: datos.type === 'select' ? (datos.options || '') : undefined,
      };
    }
    cerrarModal('modal-campo-form');
    if (tipo === 'postulacion') renderConfigFormPostulacion();
    else renderConfigFormEntrevista();
    showToast('Campo actualizado', 'ok');
  });
}

export function eliminarCampoForm(tipo, campoKey) {
  const key = tipo === 'postulacion' ? 'configFormPostulacion' : 'configFormEntrevista';
  const arr = DB[key] || [];
  const cfg = arr[0];
  if (cfg && cfg.campos) {
    cfg.campos = cfg.campos.filter((c) => c.key !== campoKey);
  } else {
    const campos = tipo === 'postulacion' ? [...DEFAULT_CAMPOS_POSTULACION] : [...DEFAULT_CAMPOS_ENTREVISTA];
    const nuevos = campos.filter((c) => c.key !== campoKey);
    if (tipo === 'postulacion') {
      DB.configFormPostulacion = [{ id: 'cfg', campos: nuevos, speech: '', empresaId: SESSION.currentUser?.empresaId }];
    } else {
      DB.configFormEntrevista = [{ id: 'cfg', campos: nuevos, instrucciones: '', empresaId: SESSION.currentUser?.empresaId }];
    }
  }
  if (tipo === 'postulacion') renderConfigFormPostulacion();
  else renderConfigFormEntrevista();
  showToast('Campo eliminado', 'ok');
}

export function guardarCfgFormPostulacion() {
  const speech = document.getElementById('cfg-form-speech-post')?.value || '';
  const campos = getCfgCampos('postulacion');
  const existing = DB.configFormPostulacion?.[0];
  const cfg = {
    id: existing?.id || Date.now().toString(),
    campos,
    speech,
    empresaId: SESSION.currentUser?.empresaId,
  };
  if (existing) {
    existing.campos = campos;
    existing.speech = speech;
  } else {
    DB.configFormPostulacion = [cfg];
  }
  supaSync('configFormPostulacion', cfg)
    .then(() => showToast('Configuración guardada', 'ok'))
    .catch((e) => showToast(e.message, 'err'));
}

export function guardarCfgFormEntrevista() {
  const instrucciones = document.getElementById('cfg-form-speech-ent')?.value || '';
  const campos = getCfgCampos('entrevista');
  const existing = DB.configFormEntrevista?.[0];
  const cfg = {
    id: existing?.id || Date.now().toString(),
    campos,
    instrucciones,
    empresaId: SESSION.currentUser?.empresaId,
  };
  if (existing) {
    existing.campos = campos;
    existing.instrucciones = instrucciones;
  } else {
    DB.configFormEntrevista = [cfg];
  }
  supaSync('configFormEntrevista', cfg)
    .then(() => showToast('Configuración guardada', 'ok'))
    .catch((e) => showToast(e.message, 'err'));
}

export { getCfgCampos, getCfgSpeech, DEFAULT_CAMPOS_POSTULACION, DEFAULT_CAMPOS_ENTREVISTA };
