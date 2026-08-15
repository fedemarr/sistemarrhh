// Reasignaciones — cambio de servicio/supervisor con aprobación y sugeridor de destino.
// Fuente de verdad: 01_Flujo_Ingreso.md §1.8.

import { DB } from '../../state.js';
import { supaSync } from '../../shared/supabase.js';
import { ensureModal, cerrarModal, showToast, capturar } from '../../shared/modal.js';
import { esc, fechaISOToDisplay, hoyISO } from '../../shared/helpers.js';
import { getCurrentUser, esRol } from '../../shared/auth.js';
import { crearNotificacion } from '../../shared/notificaciones.js';

export const ESTADOS_REAS = ['Borrador', 'Pendiente', 'Aprobada esperando fecha efectiva', 'Aprobada ejecutada', 'Rechazada', 'Anulada'];

export const MOTIVOS_REAS_DEFAULT = [
  'Baja del servicio', 'Conflicto con cliente', 'Conflicto con supervisor', 'Pedido del asociado',
  'Bajo rendimiento', 'Necesidad de otro servicio', 'Cierre de servicio', 'Reducción de personal',
  'Rotación interna', 'Vacante en otro servicio', 'Motivo personal', 'Otro',
];

export function motivosReas() {
  const cfg = DB.motivosReasignacionCfg || [];
  const list = cfg.filter((m) => !m.anulado).map((m) => m.nombre);
  return list.length ? list : MOTIVOS_REAS_DEFAULT;
}

export function aprobadoresReas() {
  const cfg = DB.aprobadoresReasCfg || [];
  const list = cfg.filter((a) => !a.anulado).map((a) => a.nombre || a.cargo);
  return list.length ? list : ['Gerente de Operaciones', 'Gerente de RRHH'];
}

export function getReasById(id) {
  return (DB.reasignaciones || []).find((r) => String(r.id) === String(id));
}

export function renderReasignacionesInicial(tab = 'pendientes') {
  const cont = document.getElementById('screen-reasignaciones');
  const lista = DB.reasignaciones || [];

  const tabs = [
    ['pendientes', `Pendientes (${lista.filter((r) => r.estado === 'Pendiente').length})`],
    ['historial', `Historial (${lista.filter((r) => !['Borrador', 'Pendiente'].includes(r.estado)).length})`],
    ['rotacion', 'Rotación'],
  ];
  cont.innerHTML = `
    <div class="tabs">
      ${tabs.map(([k, l]) => `<button class="tab-btn ${tab === k ? 'active' : ''}" onclick="renderReasignacionesInicial('${k}')">${l}</button>`).join('')}
    </div>
    <div class="toolbar">
      ${esRol('Administrador total', 'RRHH', 'Operaciones', 'Supervisor') ? '<button class="btn" onclick="abrirNuevaReasignacion()">+ Nueva reasignación</button>' : ''}
    </div>
    <div id="reas-contenido"></div>`;

  const panel = document.getElementById('reas-contenido');
  if (tab === 'pendientes') {
    const pendientes = lista.filter((r) => r.estado === 'Pendiente' || r.estado === 'Aprobada esperando fecha efectiva');
    panel.innerHTML = tablaReas(pendientes, 'Sin reasignaciones pendientes.');
  } else if (tab === 'historial') {
    const hist = lista.filter((r) => !['Borrador', 'Pendiente'].includes(r.estado)).sort((a, b) => String(b.fechaSolicitud).localeCompare(String(a.fechaSolicitud)));
    panel.innerHTML = tablaReas(hist, 'Sin historial.');
  } else {
    const rot = rotacionPorServicio();
    panel.innerHTML = `
      <div class="tbl-wrap"><table class="tbl">
        <thead><tr><th>Servicio</th><th>Asociados activos</th><th>Reasignaciones últimos 12 meses</th></tr></thead>
        <tbody>
          ${rot.map(([serv, info]) => `<tr><td>${esc(serv)}</td><td>${info.asociados}</td><td>${info.reas}</td></tr>`).join('')}
        </tbody>
      </table></div>`;
  }
}

function rotacionPorServicio() {
  const mapa = {};
  for (const l of DB.legajos || []) {
    if (l.estado !== 'Activo') continue;
    mapa[l.servicio] = mapa[l.servicio] || { asociados: 0, reas: 0 };
    mapa[l.servicio].asociados++;
  }
  const haceUnAnio = new Date();
  haceUnAnio.setFullYear(haceUnAnio.getFullYear() - 1);
  for (const r of DB.reasignaciones || []) {
    if (r.fechaSolicitud && new Date(r.fechaSolicitud) > haceUnAnio) {
      mapa[r.servicioDestino] = mapa[r.servicioDestino] || { asociados: 0, reas: 0 };
      mapa[r.servicioDestino].reas++;
    }
  }
  return Object.entries(mapa).sort((a, b) => a[0].localeCompare(b[0]));
}

function tablaReas(lista, vacio) {
  if (!lista.length) return `<div class="empty">${vacio}</div>`;
  return `<div class="tbl-wrap"><table class="tbl">
    <thead><tr><th>N°</th><th>Nombre</th><th>Origen → Destino</th><th>Motivo</th><th>Fecha solicitud</th><th>Estado</th><th>Acciones</th></tr></thead>
    <tbody>${lista.map(filaReas).join('')}</tbody>
  </table></div>`;
}

function chipEstadoReas(e) {
  const cls = e === 'Aprobada ejecutada' ? 'chip-verde' : e === 'Rechazada' || e === 'Anulada' ? 'chip-rojo' : e === 'Aprobada esperando fecha efectiva' ? 'chip-naranja' : e === 'Pendiente' ? 'chip-azul' : 'chip-gris';
  return `<span class="chip ${cls}">${esc(e)}</span>`;
}

function filaReas(r) {
  const u = getCurrentUser();
  let acciones = `<button class="btn btn-secondary btn-sm" onclick="verReasignacion('${esc(String(r.id))}')">Ver</button>`;
  const esAprobador = u && (esRol('Administrador total', 'RRHH'));
  const esSolicitante = u && (esRol('Operaciones', 'Supervisor') || esRol('Administrador total', 'RRHH'));
  if (r.estado === 'Borrador' && esSolicitante) acciones += `<button class="btn btn-sm" onclick="abrirBorradorReasignacionPorId('${esc(String(r.id))}')">Enviar</button>`;
  if (r.estado === 'Pendiente' && esAprobador) acciones += `<button class="btn btn-success btn-sm" onclick="aprobarReas('${esc(String(r.id))}')">Aprobar</button><button class="btn btn-danger btn-sm" onclick="rechazarReas('${esc(String(r.id))}')">Rechazar</button>`;
  if (r.estado === 'Aprobada esperando fecha efectiva' && esAprobador) acciones += `<button class="btn btn-success btn-sm" onclick="ejecutarReas('${esc(String(r.id))}')">Ejecutar</button>`;
  if (['Borrador', 'Pendiente', 'Aprobada esperando fecha efectiva'].includes(r.estado) && esAprobador) acciones += `<button class="btn btn-danger btn-sm" onclick="anularReas('${esc(String(r.id))}')">Anular</button>`;
  return `<tr>
    <td>${esc(String(r.nro || ''))}</td>
    <td>${esc(r.nombre || '')}</td>
    <td>${esc(r.servicioOrigen || '—')} → <strong>${esc(r.servicioDestino || '—')}</strong></td>
    <td>${esc(r.motivo || '')}</td>
    <td>${esc(fechaISOToDisplay(r.fechaSolicitud))}</td>
    <td>${chipEstadoReas(r.estado)}</td>
    <td class="acciones">${acciones}</td>
  </tr>`;
}

function serviciosActivos() {
  const set = new Set();
  for (const l of DB.legajos || []) {
    if (l.estado === 'Activo' && l.servicio) set.add(l.servicio);
  }
  for (const p of DB.pedidos || []) if (p.servicio) set.add(p.servicio);
  return [...set].sort();
}

export function abrirNuevaReasignacion() {
  ensureModal('modal-reas', `
    <div class="modal-head"><h2>Nueva reasignación</h2><button class="modal-close" onclick="cerrarModal('modal-reas')">×</button></div>
    <form id="form-reas">
      <div class="modal-body">
        <div class="form-grid">
          <div class="field"><label>N° de socio</label><input name="nro" id="reas-nro" inputmode="numeric" onchange="buscarLegajoReas()" /></div>
          <div class="field"><label>Nombre</label><input name="nombre" id="reas-nombre" readonly /></div>
          <div class="field"><label>Servicio de origen</label><input name="servicioOrigen" id="reas-origen" readonly /></div>
          <div class="field"><label>Supervisor de origen</label><input name="supervisorOrigen" id="reas-sup-origen" readonly /></div>
          <div class="field"><label>Servicio de destino</label>
            <select name="servicioDestino" id="reas-destino">${serviciosActivos().map((s) => `<option>${esc(s)}</option>`).join('')}</select></div>
          <div class="field"><label>Supervisor de destino</label><input name="supervisorDestino" /></div>
          <div class="field"><label>Motivo</label>
            <select name="motivo" id="reas-motivo">${motivosReas().map((m) => `<option>${esc(m)}</option>`).join('')}</select></div>
          <div class="field"><label>Detalle del motivo</label><input name="motivoDetalle" /></div>
          <div class="field"><label>Fecha efectiva</label><input type="date" name="fechaEfectiva" /></div>
        </div>
        <div class="grupo"><legend>🤖 Sugeridor de servicio destino</legend>
          <button type="button" class="btn btn-secondary" onclick="sugerirServicioDestino()">Sugerir destino</button>
          <div id="reas-sugerencias"></div>
        </div>
      </div>
      <div class="modal-foot">
        <button type="button" class="btn btn-secondary" onclick="cerrarModal('modal-reas')">Cancelar</button>
        <button type="button" class="btn" onclick="guardarReasBorrador()">Guardar borrador</button>
        <button type="submit" class="btn btn-success">Enviar solicitud</button>
      </div>
    </form>`, { size: 'modal-lg' });
  document.getElementById('form-reas').addEventListener('submit', (ev) => {
    ev.preventDefault();
    guardarReas(true);
  });
}

export function abrirModalReasDesde(nro) {
  const leg = (DB.legajos || []).find((l) => String(l.nro) === String(nro));
  if (leg) {
    abrirNuevaReasignacion();
    setTimeout(() => {
      document.getElementById('reas-nro').value = leg.nro;
      buscarLegajoReas();
    }, 50);
  } else {
    abrirNuevaReasignacion();
  }
}

export function buscarLegajoReas() {
  const nro = document.getElementById('reas-nro')?.value;
  const leg = (DB.legajos || []).find((l) => String(l.nro) === String(nro));
  if (!leg) { showToast('No se encontró el socio.', 'warn'); return; }
  document.getElementById('reas-nombre').value = leg.nombre || '';
  document.getElementById('reas-origen').value = leg.servicio || '';
  document.getElementById('reas-sup-origen').value = leg.supervisor || '';
}

export function sugerirServicioDestino() {
  const nro = document.getElementById('reas-nro')?.value;
  const leg = (DB.legajos || []).find((l) => String(l.nro) === String(nro));
  const origen = document.getElementById('reas-origen')?.value || leg?.servicio || '';
  // Sugeridor local (heurístico): servicios donde ya hay asociados con la misma función y menor carga.
  const candidatos = [];
  for (const l of DB.legajos || []) {
    if (l.estado !== 'Activo' || !l.servicio || l.servicio === origen) continue;
    const mismoPerfil = leg?.funcion ? l.funcion === leg.funcion : true;
    if (!mismoPerfil) continue;
    const carga = (DB.legajos || []).filter((x) => x.estado === 'Activo' && x.servicio === l.servicio).length;
    candidatos.push({ servicio: l.servicio, supervisor: l.supervisor, carga });
  }
  const unicos = {};
  for (const c of candidatos) {
    if (!unicos[c.servicio] || c.carga < unicos[c.servicio].carga) unicos[c.servicio] = c;
  }
  const sugerencias = Object.values(unicos).sort((a, b) => a.carga - b.carga).slice(0, 3);
  const wrap = document.getElementById('reas-sugerencias');
  if (!sugerencias.length) {
    wrap.innerHTML = '<span class="muted">No hay sugerencias para esta función.</span>';
    return;
  }
  wrap.innerHTML = sugerencias
    .map(
      (s, i) => `<button type="button" class="btn btn-secondary btn-sm" onclick="elegirSugerenciaDestino(${i})">${esc(s.servicio)} (${s.carga} asoc.)</button> `
    )
    .join('');
  window.__sugerenciasReas = sugerencias;
}

export function elegirSugerenciaDestino(idx) {
  const s = window.__sugerenciasReas?.[idx];
  if (!s) return;
  document.getElementById('reas-destino').value = s.servicio;
  document.getElementById('reas-supervisorDestino').value = s.supervisor || '';
  showToast('Sugerencia aplicada', 'ok');
}

function leerReasForm() {
  const datos = {};
  const form = document.getElementById('form-reas');
  if (!form) return datos;
  for (const el of form.elements) {
    if (el.name) datos[el.name] = el.value;
  }
  return datos;
}

export function guardarReasBorrador() {
  const datos = leerReasForm();
  const r = {
    id: Date.now().toString(),
    nro: datos.nro,
    nombre: datos.nombre || (DB.legajos || []).find((l) => String(l.nro) === String(datos.nro))?.nombre || '',
    servicioOrigen: datos.servicioOrigen,
    servicioDestino: datos.servicioDestino,
    supervisorOrigen: datos.supervisorOrigen,
    supervisorDestino: datos.supervisorDestino,
    categoria: '',
    motivo: datos.motivo,
    motivoDetalle: datos.motivoDetalle,
    fechaSolicitud: hoyISO(),
    fechaEfectiva: datos.fechaEfectiva || '',
    estado: 'Borrador',
    observaciones: '',
    creadoPor: getCurrentUser()?.nombre || '',
  };
  DB.reasignaciones.push(r);
  supaSync('reasignaciones', r)
    .then(() => { cerrarModal('modal-reas'); showToast('Borrador guardado', 'ok'); renderReasignacionesInicial('pendientes'); })
    .catch((e) => showToast(e.message, 'err'));
}

export function guardarReas(enviar = true) {
  const datos = leerReasForm();
  if (!datos.nro || !datos.servicioDestino) { showToast('Completá N° de socio y servicio de destino.', 'err'); return; }
  const r = {
    id: Date.now().toString(),
    nro: datos.nro,
    nombre: datos.nombre || (DB.legajos || []).find((l) => String(l.nro) === String(datos.nro))?.nombre || '',
    servicioOrigen: datos.servicioOrigen,
    servicioDestino: datos.servicioDestino,
    supervisorOrigen: datos.supervisorOrigen,
    supervisorDestino: datos.supervisorDestino,
    categoria: '',
    motivo: datos.motivo,
    motivoDetalle: datos.motivoDetalle,
    fechaSolicitud: hoyISO(),
    fechaEfectiva: datos.fechaEfectiva || '',
    estado: enviar ? 'Pendiente' : 'Borrador',
    observaciones: '',
    creadoPor: getCurrentUser()?.nombre || '',
  };
  DB.reasignaciones.push(r);
  supaSync('reasignaciones', r)
    .then(() => {
      crearNotificacion({
        tipo: 'reasignacion_solicitada',
        mensaje: `Reasignación de ${r.nombre} (${r.servicioOrigen} → ${r.servicioDestino})`,
        destinatarios: (DB.usuarios || []).filter((u) => u.perfil === 'RRHH' || u.perfil === 'Administrador total').map((u) => u.nombre),
      });
      cerrarModal('modal-reas');
      showToast('Reasignación enviada a aprobación', 'ok');
      renderReasignacionesInicial('pendientes');
    })
    .catch((e) => showToast(e.message, 'err'));
}

export function abrirBorradorReasignacionPorId(id) {
  const r = getReasById(id);
  if (!r) return;
  ensureModal('modal-reas-edit', `
    <div class="modal-head"><h2>Editar borrador de reasignación</h2><button class="modal-close" onclick="cerrarModal('modal-reas-edit')">×</button></div>
    <form id="form-reas-edit">
      <div class="modal-body">
        <div class="form-grid">
          <div class="field"><label>Servicio de destino</label>
            <select name="servicioDestino">${serviciosActivos().map((s) => `<option ${r.servicioDestino === s ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select></div>
          <div class="field"><label>Supervisor de destino</label><input name="supervisorDestino" value="${esc(r.supervisorDestino || '')}" /></div>
          <div class="field"><label>Motivo</label>
            <select name="motivo">${motivosReas().map((m) => `<option ${r.motivo === m ? 'selected' : ''}>${esc(m)}</option>`).join('')}</select></div>
          <div class="field"><label>Fecha efectiva</label><input type="date" name="fechaEfectiva" value="${esc(r.fechaEfectiva || '')}" /></div>
        </div>
      </div>
      <div class="modal-foot">
        <button type="button" class="btn btn-secondary" onclick="cerrarModal('modal-reas-edit')">Cancelar</button>
        <button type="submit" class="btn btn-success">Enviar solicitud</button>
      </div>
    </form>`, {});
  document.getElementById('form-reas-edit').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const datos = capturar(ev);
    Object.assign(r, datos);
    r.estado = 'Pendiente';
    supaSync('reasignaciones', r)
      .then(() => { cerrarModal('modal-reas-edit'); showToast('Reasignación enviada', 'ok'); renderReasignacionesInicial('pendientes'); })
      .catch((e) => showToast(e.message, 'err'));
  });
}

export function verReasignacion(id) {
  const r = getReasById(id);
  if (!r) return;
  ensureModal('modal-reas-ver', `
    <div class="modal-head"><h2>Reasignación — ${esc(r.nombre || '')}</h2><button class="modal-close" onclick="cerrarModal('modal-reas-ver')">×</button></div>
    <div class="modal-body">
      <div class="grid3">
        ${[['N° socio', r.nro], ['Origen', r.servicioOrigen], ['Destino', r.servicioDestino], ['Supervisor origen', r.supervisorOrigen], ['Supervisor destino', r.supervisorDestino], ['Motivo', r.motivo], ['Detalle', r.motivoDetalle], ['Fecha solicitud', r.fechaSolicitud ? fechaISOToDisplay(r.fechaSolicitud) : ''], ['Fecha efectiva', r.fechaEfectiva ? fechaISOToDisplay(r.fechaEfectiva) : ''], ['Estado', r.estado], ['Creado por', r.creadoPor]]
          .map(([k, v]) => `<div><strong>${k}:</strong><br/>${esc(v || '—')}</div>`).join('')}
      </div>
    </div>
    <div class="modal-foot"><button class="btn btn-secondary" onclick="cerrarModal('modal-reas-ver')">Cerrar</button></div>
  `, {});
}

export function aprobarReas(id) {
  const r = getReasById(id);
  if (!r) return;
  r.estado = 'Aprobada esperando fecha efectiva';
  r.aprobadoPorRrhh = getCurrentUser()?.nombre || '';
  r.fechaAprobacionRrhh = hoyISO();
  supaSync('reasignaciones', r)
    .then(() => { showToast('Reasignación aprobada — esperando fecha efectiva', 'ok'); renderReasignacionesInicial('pendientes'); })
    .catch((e) => showToast(e.message, 'err'));
}

export function rechazarReas(id, motivo) {
  const r = getReasById(id);
  if (!r) return Promise.reject(new Error('Reasignación no encontrada'));
  if (!motivo) {
    motivo = window.prompt('Motivo del rechazo:', '')?.trim();
    if (!motivo) return Promise.reject(new Error('El motivo es obligatorio'));
  }
  r.estado = 'Rechazada';
  r.motivoRechazoRrhh = motivo;
  return supaSync('reasignaciones', r).then(() => { showToast('Reasignación rechazada', 'warn'); renderReasignacionesInicial('pendientes'); });
}

export function anularReas(id) {
  const r = getReasById(id);
  if (!r) return;
  r.estado = 'Anulada';
  supaSync('reasignaciones', r)
    .then(() => { showToast('Reasignación anulada', 'warn'); renderReasignacionesInicial('pendientes'); })
    .catch((e) => showToast(e.message, 'err'));
}

export function ejecutarReas(id) {
  const r = getReasById(id);
  if (!r) return;
  r.estado = 'Aprobada ejecutada';
  // Aplica el cambio al legajo
  const leg = (DB.legajos || []).find((l) => String(l.nro) === String(r.nro));
  if (leg) {
    leg.servicio = r.servicioDestino;
    if (r.supervisorDestino) leg.supervisor = r.supervisorDestino;
    supaSync('legajos', leg).catch((e) => showToast(e.message, 'err'));
  }
  supaSync('reasignaciones', r)
    .then(() => { showToast('Reasignación ejecutada', 'ok'); renderReasignacionesInicial('pendientes'); })
    .catch((e) => showToast(e.message, 'err'));
}
