// Agendar entrevista — formulario público que registra candidatos con estado "Citado".

import { getPublicClient, hayConfigSupabase, _toSnakeRow } from './shared/supabase.js';

const $ = (id) => document.getElementById(id);

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const DEFAULT_CAMPOS = [
  { key: 'nombre', label: 'Nombre', type: 'text', required: true, order: 1 },
  { key: 'apellido', label: 'Apellido', type: 'text', required: true, order: 2 },
  { key: 'dni', label: 'DNI', type: 'text', required: true, order: 3 },
  { key: 'observaciones', label: 'Observaciones', type: 'textarea', required: false, order: 4 },
];

function getUrlParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name) || '';
}

function mostrarEstado(ok, msg) {
  const err = $('agendar-err');
  if (err) {
    err.textContent = msg;
    err.style.color = ok ? '#167c3f' : '#b00020';
  }
}

function renderCampo(c, defaults) {
  const val = defaults?.[c.key] || '';
  const req = c.required ? ' required' : '';
  const reqLabel = c.required ? ' *' : '';
  const id = `campo-${c.key}`;
  if (c.type === 'select') {
    const opts = (c.options || '').split(',').map((o) => o.trim()).filter(Boolean);
    return `<div class="field"><label for="${id}">${esc(c.label)}${reqLabel}</label><select name="${esc(c.key)}" id="${id}"${req}><option value="">Seleccionar…</option>${opts.map((o) => `<option value="${esc(o)}" ${val === o ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select></div>`;
  }
  if (c.type === 'textarea') {
    return `<div class="field full"><label for="${id}">${esc(c.label)}${reqLabel}</label><textarea name="${esc(c.key)}" id="${id}" rows="3"${req}>${esc(val)}</textarea></div>`;
  }
  if (c.type === 'file') {
    return `<div class="field full"><label for="${id}">${esc(c.label)}${reqLabel}</label><input type="file" name="${esc(c.key)}" id="${id}"${req} /></div>`;
  }
  return `<div class="field"><label for="${id}">${esc(c.label)}${reqLabel}</label><input type="${esc(c.type || 'text')}" name="${esc(c.key)}" id="${id}" value="${esc(val)}"${req} /></div>`;
}

function renderForm(campos, instrucciones, defaults) {
  const cont = $('agendar-form-container');
  const sorted = [...campos].sort((a, b) => (a.order || 0) - (b.order || 0));
  cont.innerHTML = `
    <div id="agendar-err" class="login-err"></div>
    ${instrucciones ? `<div class="card" style="margin-bottom:16px;padding:12px"><p>${esc(instrucciones)}</p></div>` : ''}
    <form id="form-agendar">
      <div class="form-grid">
        ${sorted.map((c) => renderCampo(c, defaults)).join('')}
      </div>
      <button type="submit" class="btn">Enviar datos</button>
    </form>`;
  $('form-agendar').addEventListener('submit', (ev) => { ev.preventDefault(); enviar(campos); });
}

async function enviar(campos) {
  const form = $('form-agendar');
  if (!form) return;
  const btn = form.querySelector('button[type=submit]');
  const fd = new FormData(form);
  const datos = {};
  fd.forEach((v, k) => { datos[k] = v; });

  const nombre = (datos.nombre || '').trim();
  const apellido = (datos.apellido || '').trim();
  const dni = String(datos.dni || '').trim();
  if (!nombre || !apellido || !dni) { mostrarEstado(false, 'Nombre, apellido y DNI son obligatorios.'); return; }

  btn.disabled = true;
  btn.textContent = 'Enviando…';
  try {
    const candidato = {
      id: Date.now().toString(),
      nombre,
      apellido,
      dni,
      telefono: (datos.telefono || '').trim(),
      email: (datos.email || '').trim(),
      observaciones: (datos.observaciones || '').trim(),
      estado: 'Citado',
      fecha: new Date().toISOString(),
      origen: 'agendar-entrevista',
    };
    const client = getPublicClient();
    const { error } = await client.from('candidatos').insert([_toSnakeRow(candidato)]);
    if (error) throw new Error(error.message);
    mostrarEstado(true, '¡Datos enviados! Te contactaremos para confirmar la entrevista.');
    form.reset();
  } catch (e) {
    mostrarEstado(false, `No se pudo enviar: ${e.message}`);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Enviar datos';
  }
}

async function cargarConfig() {
  if (!hayConfigSupabase()) return null;
  try {
    const client = getPublicClient();
    const { data, error } = await client.from('config_form_entrevista').select('*').limit(1);
    if (error || !data || !data.length) return null;
    const row = data[0];
    let campos = row.campos;
    if (typeof campos === 'string') {
      try { campos = JSON.parse(campos); } catch { campos = null; }
    }
    if (!campos || !campos.length) return null;
    return { campos, instrucciones: row.instrucciones || '' };
  } catch {
    return null;
  }
}

window.addEventListener('DOMContentLoaded', async () => {
  if (!hayConfigSupabase()) {
    mostrarEstado(false, 'El sistema todavía no está configurado (falta Supabase).');
    return;
  }
  const defaults = {};
  const dni = getUrlParam('dni');
  const nombre = getUrlParam('nombre');
  if (dni) defaults.dni = dni;
  if (nombre) defaults.nombre = nombre;

  const config = await cargarConfig();
  renderForm(
    config?.campos || DEFAULT_CAMPOS,
    config?.instrucciones || '',
    defaults
  );
});
