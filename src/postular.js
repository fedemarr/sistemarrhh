// Postularme — formulario público dinámico que inserta en candidatos (política RLS de inserción anónima).
// Los campos se cargan desde config_form_postulacion (Supabase) y caen a defaults si no hay config.

import { getPublicClient, hayConfigSupabase, _toSnakeRow } from './shared/supabase.js';

const $ = (id) => document.getElementById(id);

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const DEFAULT_CAMPOS = [
  { key: 'nombre', label: 'Nombre', type: 'text', required: true, order: 1 },
  { key: 'apellido', label: 'Apellido', type: 'text', required: true, order: 2 },
  { key: 'dni', label: 'DNI', type: 'text', required: true, order: 3 },
  { key: 'email', label: 'Email', type: 'email', required: false, order: 4 },
  { key: 'telefono', label: 'Teléfono', type: 'tel', required: false, order: 5 },
  { key: 'fecNac', label: 'Fecha de nacimiento', type: 'date', required: false, order: 6 },
  { key: 'zona', label: 'Zona / Localidad', type: 'text', required: false, order: 7 },
  { key: 'servicioDeseado', label: 'Servicio deseado', type: 'text', required: false, order: 8 },
  { key: 'disponibilidad', label: 'Disponibilidad', type: 'select', required: false, options: 'Full time,Part time,Solo mañanas,Solo tardes', order: 9 },
  { key: 'experiencia', label: 'Experiencia', type: 'textarea', required: false, order: 10 },
];

function renderCampo(c) {
  const req = c.required ? ' required' : '';
  const reqLabel = c.required ? ' *' : '';
  const id = `campo-${c.key}`;
  if (c.type === 'select') {
    const opts = (c.options || '').split(',').map((o) => o.trim()).filter(Boolean);
    return `<div class="field"><label for="${id}">${esc(c.label)}${reqLabel}</label><select name="${esc(c.key)}" id="${id}"${req}><option value="">Seleccionar…</option>${opts.map((o) => `<option value="${esc(o)}">${esc(o)}</option>`).join('')}</select></div>`;
  }
  if (c.type === 'textarea') {
    return `<div class="field full"><label for="${id}">${esc(c.label)}${reqLabel}</label><textarea name="${esc(c.key)}" id="${id}" rows="3"${req}></textarea></div>`;
  }
  if (c.type === 'file') {
    return `<div class="field full"><label for="${id}">${esc(c.label)}${reqLabel}</label><input type="file" name="${esc(c.key)}" id="${id}"${req} /></div>`;
  }
  return `<div class="field"><label for="${id}">${esc(c.label)}${reqLabel}</label><input type="${esc(c.type || 'text')}" name="${esc(c.key)}" id="${id}"${req} /></div>`;
}

function mostrarEstado(ok, msg) {
  const err = $('postular-err');
  err.textContent = msg;
  err.style.color = ok ? '#167c3f' : '#b00020';
}

async function cargarConfig() {
  if (!hayConfigSupabase()) return null;
  try {
    const client = getPublicClient();
    const { data, error } = await client.from('config_form_postulacion').select('*').limit(1);
    if (error || !data || !data.length) return null;
    const row = data[0];
    let campos = row.campos;
    if (typeof campos === 'string') {
      try { campos = JSON.parse(campos); } catch { campos = null; }
    }
    if (!campos || !campos.length) return null;
    return { campos, speech: row.speech || '' };
  } catch {
    return null;
  }
}

async function enviar() {
  const form = $('form-postular');
  if (!form) return;
  const f = form.elements;
  const btn = form.querySelector('button[type=submit]');
  btn.disabled = true;
  btn.textContent = 'Enviando…';
  try {
    const fd = new FormData(form);
    const datos = {};
    fd.forEach((v, k) => { datos[k] = v; });

    const nombre = (datos.nombre || '').trim();
    const apellido = (datos.apellido || '').trim();
    const dni = String(datos.dni || '').trim();
    if (!nombre || !apellido || !dni) { mostrarEstado(false, 'Nombre, apellido y DNI son obligatorios.'); return; }
    if (!/^\d{6,8}$/.test(dni)) { mostrarEstado(false, 'El DNI debe tener entre 6 y 8 dígitos.'); return; }

    const candidato = {
      id: Date.now().toString(),
      nombre,
      apellido,
      dni,
      telefono: (datos.telefono || '').trim(),
      email: (datos.email || '').trim(),
      fecNac: datos.fecNac || '',
      zona: (datos.zona || '').trim(),
      servicioDeseado: (datos.servicioDeseado || '').trim(),
      disponibilidad: datos.disponibilidad || '',
      experiencia: (datos.experiencia || '').trim(),
      // Entra como Precandidato: alguien de RRHH lo revisa y lo aprueba/rechaza
      // desde la pestaña "Pre-candidatos" antes de que entre al flujo normal.
      estado: 'Precandidato',
      fecha: new Date().toISOString(),
      origen: 'postularme',
    };

    const client = getPublicClient();
    const { error } = await client.from('candidatos').insert([_toSnakeRow(candidato)]);
    if (error) throw new Error(error.message);
    mostrarEstado(true, '¡Postulación enviada! Te contactaremos a la brevedad.');
    form.reset();
  } catch (e) {
    mostrarEstado(false, `No se pudo enviar: ${e.message}`);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Enviar postulación';
  }
}

function renderForm(campos, speech) {
  const cont = $('screen-postular');
  const sorted = [...campos].sort((a, b) => (a.order || 0) - (b.order || 0));
  cont.innerHTML = `
    <div class="login-card" style="max-width:720px">
      <div class="logo">G</div>
      <h1>Postulación laboral</h1>
      ${speech ? `<div class="card" style="margin-bottom:16px;padding:12px"><p>${esc(speech)}</p></div>` : ''}
      <p class="sub">Completá el formulario y tu candidatura queda registrada.</p>
      <form id="form-postular">
        <div id="postular-err" class="login-err"></div>
        <div class="form-grid">
          ${sorted.map(renderCampo).join('')}
        </div>
        <button type="submit" class="btn">Enviar postulación</button>
      </form>
      <p class="muted" style="text-align:center;margin-top:12px"><a href="/">← Volver al inicio</a></p>
    </div>`;
  $('form-postular').addEventListener('submit', (ev) => { ev.preventDefault(); enviar(); });
}

window.addEventListener('DOMContentLoaded', async () => {
  const config = await cargarConfig();
  renderForm(
    config?.campos || DEFAULT_CAMPOS,
    config?.speech || ''
  );
});
