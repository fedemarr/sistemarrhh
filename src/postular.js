// Postularme — formulario público que inserta en candidatos (política RLS de inserción anónima).

import { getClient, hayConfigSupabase, _toSnakeRow } from './shared/supabase.js';

const $ = (id) => document.getElementById(id);

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function mostrarEstado(ok, msg) {
  const err = $('postular-err');
  err.textContent = msg;
  err.style.color = ok ? '#167c3f' : '#b00020';
}

async function enviar() {
  const form = $('form-postular');
  if (!form) return;
  const f = form.elements;
  const nombre = f.nombre.value.trim();
  const apellido = f.apellido.value.trim();
  const dni = String(f.dni.value || '').trim();
  if (!nombre || !apellido || !dni) { mostrarEstado(false, 'Nombre, apellido y DNI son obligatorios.'); return; }
  if (!/^\d{6,8}$/.test(dni)) { mostrarEstado(false, 'El DNI debe tener entre 6 y 8 dígitos.'); return; }

  const candidato = {
    id: Date.now().toString(),
    nombre: `${nombre} ${apellido}`,
    dni,
    telefono: f.telefono.value.trim(),
    email: f.email.value.trim(),
    fechaNacimiento: f.fechaNacimiento.value || '',
    servicioDeseado: f.servicioDeseado.value.trim(),
    disponibilidad: f.disponibilidad.value,
    experiencia: f.experiencia.value.trim(),
    estado: 'Sin citar',
    fecha: new Date().toISOString(),
    origen: 'postularme',
  };

  const btn = form.querySelector('button[type=submit]');
  btn.disabled = true;
  btn.textContent = 'Enviando…';
  try {
    const client = getClient();
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

window.addEventListener('DOMContentLoaded', () => {
  if (!hayConfigSupabase()) {
    mostrarEstado(false, 'El sistema todavía no está configurado (falta Supabase). Contactate con RRHH.');
    return;
  }
  $('form-postular').addEventListener('submit', (ev) => { ev.preventDefault(); enviar(); });
});
