// Agendar entrevista — formulario público con grilla de horarios disponibles.
// El candidato elige día/hora de una grilla (como la de Candidatos → Calendario)
// y al confirmar, la Edge Function agendar-turno crea el turno y actualiza (o
// crea) su registro en candidatos con estado "Citado". La disponibilidad y la
// reserva pasan siempre por esa función: nunca se consultan ni actualizan
// candidatos/turnos directo desde el navegador, así no se filtran nombres de
// otros postulantes a un desconocido que abre el link.

import { getPublicClient, hayConfigSupabase } from './shared/supabase.js';

const $ = (id) => document.getElementById(id);

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function getUrlParam(name) {
  return new URLSearchParams(window.location.search).get(name) || '';
}

function mostrarEstado(ok, msg) {
  const err = $('agendar-err');
  if (err) {
    err.textContent = msg;
    err.style.color = ok ? '#167c3f' : '#b00020';
  }
}

let _slotElegido = null; // { fecha, hora }

function diasGrilla(desde, dias) {
  const out = [];
  const base = new Date(desde + 'T00:00:00');
  for (let i = 0; i < dias; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    out.push({
      fecha: d.toISOString().slice(0, 10),
      diaSemana: d.getDay(),
      label: d.toLocaleDateString('es-AR', { weekday: 'short', day: '2-digit', month: '2-digit' }),
    });
  }
  return out;
}

function renderGrilla(disponibilidad) {
  const { config, franjas, ocupados, desde } = disponibilidad;
  const dias = diasGrilla(desde, 10).filter((d) => (config.dias_habilitados || []).includes(d.diaSemana));
  if (!dias.length || !franjas.length) {
    return '<p class="muted">No hay horarios configurados todavía. Contactá a la empresa directamente.</p>';
  }
  let html = '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Hora</th>' +
    dias.map((d) => `<th>${esc(d.label)}</th>`).join('') + '</tr></thead><tbody>';
  for (const f of franjas) {
    html += `<tr><td><strong>${f}</strong></td>`;
    for (const d of dias) {
      const key = `${d.fecha}|${f}`;
      const ocupado = ocupados[key] || 0;
      const lleno = ocupado >= config.max_por_franja;
      const clase = lleno ? 'chip-rojo' : 'chip-verde';
      const texto = lleno ? 'Completo' : '+ Libre';
      html += lleno
        ? `<td><span class="chip ${clase}" style="display:block;text-align:center;opacity:0.6">${texto}</span></td>`
        : `<td style="cursor:pointer" data-fecha="${esc(d.fecha)}" data-hora="${esc(f)}" onclick="window.__seleccionarSlot('${esc(d.fecha)}','${esc(f)}')">
            <span class="chip ${clase}" style="display:block;text-align:center" id="slot-${esc(d.fecha)}-${esc(f)}">${texto}</span>
          </td>`;
    }
    html += '</tr>';
  }
  html += '</tbody></table></div>';
  return html;
}

function marcarSeleccion() {
  document.querySelectorAll('[id^="slot-"]').forEach((el) => el.classList.remove('chip-azul'));
  document.querySelectorAll('[id^="slot-"]').forEach((el) => { if (!el.classList.contains('chip-rojo')) el.classList.add('chip-verde'); });
  if (!_slotElegido) return;
  const el = $(`slot-${_slotElegido.fecha}-${_slotElegido.hora}`);
  if (el) { el.classList.remove('chip-verde'); el.classList.add('chip-azul'); el.textContent = 'Elegido ✓'; }
  const resumen = $('agendar-slot-elegido');
  if (resumen) resumen.textContent = `Turno elegido: ${_slotElegido.fecha} ${_slotElegido.hora}`;
}

window.__seleccionarSlot = (fecha, hora) => {
  _slotElegido = { fecha, hora };
  marcarSeleccion();
};

function renderPagina(disponibilidad, empresaId, defaults, instrucciones) {
  const cont = $('agendar-form-container');
  cont.innerHTML = `
    <div id="agendar-err" class="login-err"></div>
    ${instrucciones ? `<div class="card" style="margin-bottom:16px;padding:12px"><p>${esc(instrucciones)}</p></div>` : ''}
    <p class="sub">Elegí un día y horario, y completá tus datos.</p>
    ${renderGrilla(disponibilidad)}
    <p id="agendar-slot-elegido" class="muted" style="margin-top:8px">Todavía no elegiste un turno.</p>
    <form id="form-agendar">
      <div class="form-grid" style="margin-top:12px">
        <div class="field"><label>Nombre *</label><input name="nombre" required value="${esc(defaults.nombre || '')}" /></div>
        <div class="field"><label>Apellido *</label><input name="apellido" required /></div>
        <div class="field"><label>DNI *</label><input name="dni" required inputmode="numeric" value="${esc(defaults.dni || '')}" /></div>
        <div class="field"><label>Teléfono</label><input name="telefono" type="tel" /></div>
        <div class="field"><label>Email</label><input name="email" type="email" /></div>
        <div class="field full"><label>Observaciones</label><textarea name="observaciones" rows="2"></textarea></div>
      </div>
      <button type="submit" class="btn">Confirmar turno</button>
    </form>`;
  $('form-agendar').addEventListener('submit', (ev) => { ev.preventDefault(); enviar(empresaId); });
}

async function enviar(empresaId) {
  if (!_slotElegido) { mostrarEstado(false, 'Elegí un día y horario de la grilla antes de confirmar.'); return; }
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
  btn.textContent = 'Confirmando…';
  try {
    const client = getPublicClient();
    const { data, error } = await client.functions.invoke('agendar-turno', {
      body: {
        action: 'reservar',
        empresaId,
        fecha: _slotElegido.fecha,
        hora: _slotElegido.hora,
        nombre,
        apellido,
        dni,
        telefono: (datos.telefono || '').trim(),
        email: (datos.email || '').trim(),
        observaciones: (datos.observaciones || '').trim(),
      },
    });
    if (error) throw new Error(error.context?.message || error.message);
    if (data?.error) throw new Error(data.error);
    mostrarEstado(true, `¡Turno confirmado para el ${_slotElegido.fecha} a las ${_slotElegido.hora}! Te esperamos.`);
    form.reset();
    form.querySelector('button[type=submit]').remove();
  } catch (e) {
    mostrarEstado(false, `No se pudo confirmar: ${e.message}`);
    btn.disabled = false;
    btn.textContent = 'Confirmar turno';
  }
}

async function cargarDisponibilidad(empresaId) {
  const client = getPublicClient();
  const { data, error } = await client.functions.invoke('agendar-turno', {
    body: { action: 'disponibilidad', empresaId, dias: 14 },
  });
  if (error) throw new Error(error.context?.message || error.message);
  if (data?.error) throw new Error(data.error);
  return data;
}

// Solo el texto de "instrucciones" (configurable en Configuración → Form
// entrevista) se sigue usando acá; los "campos" personalizados de esa
// pantalla quedaron reemplazados por la grilla + los datos personales fijos.
async function cargarInstrucciones(empresaId) {
  if (!hayConfigSupabase()) return '';
  try {
    const client = getPublicClient();
    const { data } = await client.from('config_form_entrevista').select('instrucciones').eq('empresa_id', empresaId).limit(1);
    return data?.[0]?.instrucciones || '';
  } catch {
    return '';
  }
}

window.addEventListener('DOMContentLoaded', async () => {
  if (!hayConfigSupabase()) {
    mostrarEstado(false, 'El sistema todavía no está configurado (falta Supabase).');
    return;
  }
  const empresaId = getUrlParam('empresa');
  if (!empresaId) {
    mostrarEstado(false, 'Este link no es válido: falta identificar la empresa. Pedile a la empresa que te reenvíe el link.');
    return;
  }
  const defaults = { dni: getUrlParam('dni'), nombre: getUrlParam('nombre') };
  try {
    const [disponibilidad, instrucciones] = await Promise.all([
      cargarDisponibilidad(empresaId),
      cargarInstrucciones(empresaId),
    ]);
    renderPagina(disponibilidad, empresaId, defaults, instrucciones);
  } catch (e) {
    mostrarEstado(false, `No se pudo cargar la disponibilidad: ${e.message}`);
  }
});
