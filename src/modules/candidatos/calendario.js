// Calendario de entrevistas — grilla semanal de turnos.
// Fuente de verdad: 01_Flujo_Ingreso.md §1.2 (configAgente, getFranjas).

import { DB } from '../../state.js';
import { supaSync } from '../../shared/supabase.js';
import { ensureModal, cerrarModal, showToast, capturar } from '../../shared/modal.js';
import { esc } from '../../shared/helpers.js';
import { getCurrentUser } from '../../shared/auth.js';
import { getCandById } from './candidatos.js';

export const configAgente = {
  diasHabilitados: [1, 2, 3, 4, 5],
  horaDesde: '09:00',
  horaHasta: '17:00',
  duracion: 20,
  maxPorTurno: 2,
};

export function getFranjas() {
  const [hDesde, mDesde] = configAgente.horaDesde.split(':').map(Number);
  const [hHasta, mHasta] = configAgente.horaHasta.split(':').map(Number);
  const out = [];
  let t = hDesde * 60 + mDesde;
  const fin = hHasta * 60 + mHasta;
  while (t + configAgente.duracion <= fin) {
    const h = Math.floor(t / 60);
    const m = t % 60;
    out.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    t += configAgente.duracion;
  }
  return out;
}

// Normaliza una hora cualquiera a su franja (al piso de la grilla).
export function horaAFranja(h) {
  const [hh, mm] = String(h || '').split(':').map(Number);
  if (!Number.isFinite(hh)) return null;
  const t = hh * 60 + mm;
  const dur = configAgente.duracion;
  const base = Math.floor(t / dur) * dur;
  return `${String(Math.floor(base / 60)).padStart(2, '0')}:${String(base % 60).padStart(2, '0')}`;
}

let _offsetSemana = 0;

function lunesDeSemana(offset) {
  const hoy = new Date();
  const lunes = new Date(hoy);
  lunes.setHours(0, 0, 0, 0);
  const dia = (lunes.getDay() + 6) % 7; // 0=lu..6=do
  lunes.setDate(lunes.getDate() - dia + offset * 7);
  return lunes;
}

function iso(d) {
  return d.toISOString().slice(0, 10);
}

export function renderCalendario(container) {
  const lunes = lunesDeSemana(_offsetSemana);
  const dias = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(lunes);
    d.setDate(lunes.getDate() + i);
    dias.push({ fecha: iso(d), diaSemana: d.getDay(), label: d.toLocaleDateString('es-AR', { weekday: 'short', day: '2-digit', month: '2-digit' }) });
  }
  const franjas = getFranjas();
  const hoy = new Date();
  const semLabel = `${dias[0].fecha} → ${dias[6].fecha}`;

  const turnosPorSlot = {};
  for (const t of DB.turnos || []) {
    if (t.estado === 'Cancelado') continue;
    const key = `${t.fecha}|${t.hora}`;
    (turnosPorSlot[key] = turnosPorSlot[key] || []).push(t);
  }

  let html = `
    <div class="toolbar">
      <button class="btn btn-secondary" onclick="cambiarSemana(-1)">← Semana anterior</button>
      <strong>${semLabel}</strong>
      <button class="btn btn-secondary" onclick="cambiarSemana(1)">Semana siguiente →</button>
      <button class="btn" onclick="irHoy()">Hoy</button>
      <div class="spacer"></div>
      <button class="btn btn-success" onclick="agendarTurnoLibre()">+ Agendar turno</button>
    </div>
    <div class="alert alert-warn">Rojo = Confirmado · Azul = Pendiente · Verde = libre (máx ${configAgente.maxPorTurno} por turno)</div>
    <div class="tbl-wrap">
    <table class="tbl"><thead><tr><th>Hora</th>${dias.map((d) => `<th>${esc(d.label)}</th>`).join('')}</tr></thead><tbody>`;

  for (const f of franjas) {
    html += `<tr><td><strong>${f}</strong></td>`;
    for (const d of dias) {
      if (!configAgente.diasHabilitados.includes(d.diaSemana) && !tieneTurnos(turnosPorSlot, d.fecha, f)) {
        html += '<td class="muted" style="background:#f4f6f8">—</td>';
        continue;
      }
      const key = `${d.fecha}|${f}`;
      const turnos = turnosPorSlot[key] || [];
      const lleno = turnos.length >= configAgente.maxPorTurno;
      const clase = turnos.length ? (turnos.some((t) => t.estado === 'Confirmado') ? 'chip-rojo' : 'chip-azul') : 'chip-verde';
      const texto = turnos.length ? turnos.map((t) => (t.nombre || 'Turno').split(',')[0]).join(' + ') : 'Libre';
      html += `<td style="cursor:pointer" onclick="agendarTurno('${d.fecha}','${f}')">
        <span class="chip ${clase}" style="display:block;text-align:center">${esc(texto)} ${lleno ? '<b>●</b>' : ''}</span>
      </td>`;
    }
    html += '</tr>';
  }
  html += '</tbody></table></div>';
  container.innerHTML = html;
}

function tieneTurnos(map, fecha, hora) {
  return (map[`${fecha}|${hora}`] || []).length > 0;
}

export function cambiarSemana(dir) {
  _offsetSemana += dir;
  renderCalendario(document.getElementById('cand-contenido'));
}

export function irHoy() {
  _offsetSemana = 0;
  renderCalendario(document.getElementById('cand-contenido'));
}

export function agendarTurno(fecha, hora) {
  const lleno = (DB.turnos || []).filter((t) => t.estado !== 'Cancelado' && t.fecha === fecha && horaAFranja(t.hora) === hora).length >= configAgente.maxPorTurno;
  if (lleno) { showToast(`El turno ${fecha} ${hora} está lleno (máx ${configAgente.maxPorTurno}).`, 'err'); return; }
  ensureModal('modal-turno', `
    <div class="modal-head"><h2>Agendar turno — ${fecha} ${hora}</h2><button class="modal-close" onclick="cerrarModal('modal-turno')">×</button></div>
    <form id="form-turno">
      <div class="modal-body">
        <div class="form-grid">
          <div class="field"><label>Candidato (id)</label><input name="candidatoId" placeholder="id_local del candidato" /></div>
          <div class="field"><label>Nombre *</label><input name="nombre" required placeholder="Apellido, Nombre" /></div>
          <div class="field"><label>Responsable</label><input name="responsable" value="${esc(getCurrentUser()?.nombre || '')}" /></div>
          <div class="field"><label>Observación</label><input name="observacion" /></div>
        </div>
      </div>
      <div class="modal-foot"><button type="button" class="btn btn-secondary" onclick="cerrarModal('modal-turno')">Cancelar</button><button type="submit" class="btn">Agendar</button></div>
    </form>`, {});
  document.getElementById('form-turno').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const datos = capturar(ev);
    if (datos.candidatoId) {
      const c = getCandById(datos.candidatoId);
      if (!c) { showToast('No existe un candidato con ese id.', 'err'); return; }
      datos.nombre = datos.nombre || `${c.apellido}, ${c.nombre}`;
    }
    const t = {
      id: Date.now().toString(),
      fecha,
      hora: horaAFranja(hora),
      estado: 'Pendiente',
      candidatoId: datos.candidatoId || null,
      nombre: datos.nombre,
      responsable: datos.responsable,
      observacion: datos.observacion,
    };
    DB.turnos.push(t);
    supaSync('turnos', t)
      .then(() => { cerrarModal('modal-turno'); showToast('Turno agendado', 'ok'); renderCalendario(document.getElementById('cand-contenido')); })
      .catch((e) => showToast(e.message, 'err'));
  });
}

export function agendarTurnoLibre() {
  const proximaLibre = proximoSlotLibre();
  if (proximaLibre) agendarTurno(proximaLibre.fecha, proximaLibre.hora);
  else showToast('No hay turnos libres en los próximos 7 días hábiles.', 'warn');
}

function proximoSlotLibre() {
  const lunes = lunesDeSemana(0);
  const franjas = getFranjas();
  for (let i = 0; i < 7; i++) {
    const d = new Date(lunes);
    d.setDate(lunes.getDate() + i);
    if (!configAgente.diasHabilitados.includes(d.getDay())) continue;
    for (const f of franjas) {
      const cant = (DB.turnos || []).filter((t) => t.estado !== 'Cancelado' && t.fecha === iso(d) && t.hora === f).length;
      if (cant < configAgente.maxPorTurno) return { fecha: iso(d), hora: f };
    }
  }
  return null;
}

export function verTurno(id) {
  const t = (DB.turnos || []).find((x) => String(x.id) === String(id));
  if (!t) return;
  ensureModal('modal-turno-ver', `
    <div class="modal-head"><h2>Turno</h2><button class="modal-close" onclick="cerrarModal('modal-turno-ver')">×</button></div>
    <div class="modal-body">
      <div class="grupo"><legend>${esc(t.nombre || '')}</legend>
        <p>Fecha: ${esc(t.fecha)} ${esc(t.hora)} · Estado: ${esc(t.estado)}</p>
        <p>Responsable: ${esc(t.responsable || '')} · Candidato id: ${esc(t.candidatoId || '—')}</p>
        <p class="muted">${esc(t.observacion || '')}</p>
      </div>
    </div>
    <div class="modal-foot">
      <button class="btn btn-secondary" onclick="cerrarModal('modal-turno-ver')">Cerrar</button>
      ${t.estado === 'Pendiente' ? `<button class="btn btn-success" onclick="confirmarCalTurno('${esc(String(t.id))}')">Confirmar</button>` : ''}
      ${t.estado !== 'Cancelado' ? `<button class="btn btn-danger" onclick="eliminarCalTurno('${esc(String(t.id))}')">Cancelar turno</button>` : ''}
    </div>`, {});
}

export function confirmarCalTurno(id) {
  const t = (DB.turnos || []).find((x) => String(x.id) === String(id));
  if (!t) return;
  const anterior = { ...t };
  t.estado = 'Confirmado';
  supaSync('turnos', t)
    .then(() => { showToast('Turno confirmado', 'ok'); renderCalendario(document.getElementById('cand-contenido')); })
    .catch((e) => {
      Object.assign(t, anterior);
      showToast('Error: ' + e.message, 'err');
    });
}

export function eliminarCalTurno(id) {
  const t = (DB.turnos || []).find((x) => String(x.id) === String(id));
  if (!t) return;
  t.estado = 'Cancelado';
  supaSync('turnos', t)
    .then(() => { showToast('Turno cancelado (soft)', 'warn'); renderCalendario(document.getElementById('cand-contenido')); })
    .catch((e) => showToast(e.message, 'err'));
}

export function vincularCandidatoTurno(idTurno, candidatoId) {
  const t = (DB.turnos || []).find((x) => String(x.id) === String(idTurno));
  const c = getCandById(candidatoId);
  if (!t || !c) return Promise.reject(new Error('Turno o candidato inexistente'));
  t.candidatoId = candidatoId;
  t.nombre = `${c.apellido}, ${c.nombre}`;
  return supaSync('turnos', t);
}
