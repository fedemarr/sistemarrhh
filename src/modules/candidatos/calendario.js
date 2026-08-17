// Calendario de entrevistas — grilla semanal de turnos + configuración del
// agente de agendamiento (días/horarios/duración/cupo), editable por empresa
// y persistida en Supabase (tabla calendario_config). Esa misma config la
// lee la Edge Function agendar-turno para armar la grilla que ve el
// candidato en /agendar-entrevista.

import { DB } from '../../state.js';
import { supaSync } from '../../shared/supabase.js';
import { ensureModal, cerrarModal, showToast, capturar } from '../../shared/modal.js';
import { esc } from '../../shared/helpers.js';
import { getCurrentUser } from '../../shared/auth.js';
import { getCandById } from './candidatos.js';

const CONFIG_DEFAULT = {
  diasHabilitados: [1, 2, 3, 4, 5],
  horaDesde: '09:00',
  horaHasta: '17:00',
  duracion: 20,
  maxPorTurno: 2,
  responsable: '',
};

function filaConfig() {
  const empresaId = getCurrentUser()?.empresaId;
  return (DB.calendarioConfig || []).find((c) => String(c.empresaId) === String(empresaId));
}

// Config "en vivo" que usan getFranjas()/horaAFranja() — se recalcula cada
// vez que se guarda o se carga la pantalla.
export function getConfigAgente() {
  const fila = filaConfig();
  if (!fila) return { ...CONFIG_DEFAULT };
  return {
    diasHabilitados: fila.diasHabilitados || CONFIG_DEFAULT.diasHabilitados,
    horaDesde: fila.horaDesde || CONFIG_DEFAULT.horaDesde,
    horaHasta: fila.horaHasta || CONFIG_DEFAULT.horaHasta,
    duracion: fila.duracionMin || CONFIG_DEFAULT.duracion,
    maxPorTurno: fila.maxPorFranja || CONFIG_DEFAULT.maxPorTurno,
    responsable: fila.responsable || '',
  };
}

export function getFranjas() {
  const cfg = getConfigAgente();
  const [hDesde, mDesde] = cfg.horaDesde.split(':').map(Number);
  const [hHasta, mHasta] = cfg.horaHasta.split(':').map(Number);
  const out = [];
  let t = hDesde * 60 + mDesde;
  const fin = hHasta * 60 + mHasta;
  while (t + cfg.duracion <= fin) {
    const h = Math.floor(t / 60);
    const m = t % 60;
    out.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    t += cfg.duracion;
  }
  return out;
}

// Normaliza una hora cualquiera a su franja (al piso de la grilla).
export function horaAFranja(h) {
  const [hh, mm] = String(h || '').split(':').map(Number);
  if (!Number.isFinite(hh)) return null;
  const t = hh * 60 + mm;
  const dur = getConfigAgente().duracion;
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

const DIAS_LABEL = [
  { v: 1, l: 'Lun' }, { v: 2, l: 'Mar' }, { v: 3, l: 'Mié' }, { v: 4, l: 'Jue' },
  { v: 5, l: 'Vie' }, { v: 6, l: 'Sáb' }, { v: 0, l: 'Dom' },
];

function panelConfig() {
  const cfg = getConfigAgente();
  return `
    <div class="card" style="min-width:260px;max-width:280px">
      <h3>Configuración del agente</h3>
      <form id="form-config-calendario">
        <div class="field"><label>Días habilitados</label>
          <div style="display:flex;flex-wrap:wrap;gap:8px">
            ${DIAS_LABEL.map((d) => `<label style="display:flex;align-items:center;gap:4px;font-weight:normal">
              <input type="checkbox" name="dia-${d.v}" ${cfg.diasHabilitados.includes(d.v) ? 'checked' : ''} /> ${d.l}
            </label>`).join('')}
          </div>
        </div>
        <div class="form-grid">
          <div class="field"><label>Desde</label><input type="time" name="horaDesde" value="${esc(cfg.horaDesde)}" required /></div>
          <div class="field"><label>Hasta</label><input type="time" name="horaHasta" value="${esc(cfg.horaHasta)}" required /></div>
          <div class="field"><label>Duración</label>
            <select name="duracion">
              ${[15, 20, 30, 45, 60].map((m) => `<option value="${m}" ${cfg.duracion === m ? 'selected' : ''}>${m} min</option>`).join('')}
            </select>
          </div>
          <div class="field"><label>Máx por franja</label>
            <select name="maxPorTurno">
              ${[1, 2, 3, 4, 5].map((n) => `<option value="${n}" ${cfg.maxPorTurno === n ? 'selected' : ''}>${n}</option>`).join('')}
            </select>
          </div>
          <div class="field full"><label>Responsable por defecto</label><input name="responsable" value="${esc(cfg.responsable)}" placeholder="Nombre" /></div>
        </div>
        <button type="submit" class="btn" style="width:100%">Guardar configuración</button>
      </form>
    </div>`;
}

function panelResumen(dias) {
  const fechas = new Set(dias.map((d) => d.fecha));
  const turnosSemana = (DB.turnos || []).filter((t) => t.estado !== 'Cancelado' && fechas.has(t.fecha));
  const confirmados = turnosSemana.filter((t) => t.estado === 'Confirmado').length;
  const pendientes = turnosSemana.filter((t) => t.estado === 'Pendiente').length;
  const cfg = getConfigAgente();
  const franjas = getFranjas();
  const slotsHabilitados = dias.filter((d) => cfg.diasHabilitados.includes(d.diaSemana)).length * franjas.length * cfg.maxPorTurno;
  const slotsLibres = Math.max(0, slotsHabilitados - turnosSemana.length);
  return `
    <div class="card" style="min-width:220px;max-width:240px">
      <h3>Resumen semanal</h3>
      <p>Turnos esta semana<br/><strong style="font-size:1.4em">${turnosSemana.length}</strong></p>
      <p>Confirmados<br/><strong style="font-size:1.4em;color:#167c3f">${confirmados}</strong></p>
      <p>Pendientes<br/><strong style="font-size:1.4em;color:#b26a00">${pendientes}</strong></p>
      <p class="muted">Slots libres: ${slotsLibres} de ${slotsHabilitados}</p>
      <p class="muted">
        <span class="chip chip-rojo">Ocupado</span> <span class="chip chip-azul">Pendiente</span> <span class="chip chip-verde">Libre</span>
      </p>
    </div>`;
}

export function renderCalendario(container) {
  const lunes = lunesDeSemana(_offsetSemana);
  const dias = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(lunes);
    d.setDate(lunes.getDate() + i);
    dias.push({ fecha: iso(d), diaSemana: d.getDay(), label: d.toLocaleDateString('es-AR', { weekday: 'short', day: '2-digit', month: '2-digit' }) });
  }
  const cfg = getConfigAgente();
  const franjas = getFranjas();
  const semLabel = `${dias[0].fecha} → ${dias[6].fecha}`;

  const turnosPorSlot = {};
  for (const t of DB.turnos || []) {
    if (t.estado === 'Cancelado') continue;
    const key = `${t.fecha}|${t.hora}`;
    (turnosPorSlot[key] = turnosPorSlot[key] || []).push(t);
  }

  let grilla = `
    <div class="toolbar">
      <button class="btn btn-secondary" onclick="cambiarSemana(-1)">← Semana anterior</button>
      <strong>${semLabel}</strong>
      <button class="btn btn-secondary" onclick="cambiarSemana(1)">Semana siguiente →</button>
      <button class="btn" onclick="irHoy()">Hoy</button>
      <div class="spacer"></div>
      <button class="btn btn-success" onclick="agendarTurnoLibre()">+ Agendar turno</button>
    </div>
    <div class="tbl-wrap">
    <table class="tbl"><thead><tr><th>Hora</th>${dias.map((d) => `<th>${esc(d.label)}</th>`).join('')}</tr></thead><tbody>`;

  for (const f of franjas) {
    grilla += `<tr><td><strong>${f}</strong></td>`;
    for (const d of dias) {
      if (!cfg.diasHabilitados.includes(d.diaSemana) && !tieneTurnos(turnosPorSlot, d.fecha, f)) {
        grilla += '<td class="muted" style="background:#f4f6f8">—</td>';
        continue;
      }
      const key = `${d.fecha}|${f}`;
      const turnos = turnosPorSlot[key] || [];
      const lleno = turnos.length >= cfg.maxPorTurno;
      const clase = turnos.length ? (turnos.some((t) => t.estado === 'Confirmado') ? 'chip-rojo' : 'chip-azul') : 'chip-verde';
      const texto = turnos.length ? turnos.map((t) => (t.nombre || 'Turno').split(',')[0]).join(' + ') : '+ Libre';
      grilla += `<td style="cursor:pointer" onclick="agendarTurno('${d.fecha}','${f}')">
        <span class="chip ${clase}" style="display:block;text-align:center">${esc(texto)} ${lleno ? '<b>●</b>' : ''}</span>
      </td>`;
    }
    grilla += '</tr>';
  }
  grilla += '</tbody></table></div>';

  container.innerHTML = `
    <div style="display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap">
      <div style="display:flex;flex-direction:column;gap:16px">
        ${panelConfig()}
        ${panelResumen(dias)}
      </div>
      <div style="flex:1;min-width:320px">${grilla}</div>
    </div>`;

  document.getElementById('form-config-calendario')?.addEventListener('submit', (ev) => {
    ev.preventDefault();
    guardarConfigCalendario(ev);
  });
}

export function guardarConfigCalendario(ev) {
  const datos = capturar(ev);
  const diasHabilitados = DIAS_LABEL.map((d) => d.v).filter((v) => datos[`dia-${v}`]);
  if (!diasHabilitados.length) { showToast('Habilitá al menos un día.', 'err'); return; }
  if (datos.horaDesde >= datos.horaHasta) { showToast('El horario "Desde" tiene que ser antes que "Hasta".', 'err'); return; }

  const empresaId = getCurrentUser()?.empresaId;
  if (!empresaId) { showToast('No se pudo determinar la empresa.', 'err'); return; }
  const existente = filaConfig();

  const fila = {
    id: existente?.id || crypto.randomUUID(),
    empresaId,
    diasHabilitados,
    horaDesde: datos.horaDesde,
    horaHasta: datos.horaHasta,
    duracionMin: Number(datos.duracion) || CONFIG_DEFAULT.duracion,
    maxPorFranja: Number(datos.maxPorTurno) || CONFIG_DEFAULT.maxPorTurno,
    responsable: (datos.responsable || '').trim(),
  };

  supaSync('calendarioConfig', fila)
    .then(() => { showToast('Configuración guardada', 'ok'); renderCalendario(document.getElementById('cand-contenido')); })
    .catch((e) => showToast(e.message, 'err'));
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
  const cfg = getConfigAgente();
  const lleno = (DB.turnos || []).filter((t) => t.estado !== 'Cancelado' && t.fecha === fecha && horaAFranja(t.hora) === hora).length >= cfg.maxPorTurno;
  if (lleno) { showToast(`El turno ${fecha} ${hora} está lleno (máx ${cfg.maxPorTurno}).`, 'err'); return; }
  ensureModal('modal-turno', `
    <div class="modal-head"><h2>Agendar turno — ${fecha} ${hora}</h2><button class="modal-close" onclick="cerrarModal('modal-turno')">×</button></div>
    <form id="form-turno">
      <div class="modal-body">
        <div class="form-grid">
          <div class="field"><label>Candidato (id)</label><input name="candidatoId" placeholder="id_local del candidato" /></div>
          <div class="field"><label>Nombre *</label><input name="nombre" required placeholder="Apellido, Nombre" /></div>
          <div class="field"><label>Responsable</label><input name="responsable" value="${esc(getCurrentUser()?.nombre || cfg.responsable || '')}" /></div>
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
  const cfg = getConfigAgente();
  const lunes = lunesDeSemana(0);
  const franjas = getFranjas();
  for (let i = 0; i < 7; i++) {
    const d = new Date(lunes);
    d.setDate(lunes.getDate() + i);
    if (!cfg.diasHabilitados.includes(d.getDay())) continue;
    for (const f of franjas) {
      const cant = (DB.turnos || []).filter((t) => t.estado !== 'Cancelado' && t.fecha === iso(d) && t.hora === f).length;
      if (cant < cfg.maxPorTurno) return { fecha: iso(d), hora: f };
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
