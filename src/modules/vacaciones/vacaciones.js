// Vacaciones — solicitud anticipada, comienzo, cierre y cancelación.
// Fuente de verdad: 02_Gestion_Personal.md §2.3.

import { DB } from '../../state.js';
import { supaSync } from '../../shared/supabase.js';
import { ensureModal, cerrarModal, showToast, capturar } from '../../shared/modal.js';
import { esc, hoyISO, fechaISOToDisplay } from '../../shared/helpers.js';
import { getCurrentUser } from '../../shared/auth.js';

export function getVacacionById(id) {
  return (DB.vacaciones || []).find((v) => String(v.id) === String(id));
}

export function diasSegunParametrosServicio(d) {
  const params = DB.parametrosServicio || [];
  const esServicio1 = params.some((p) => String(p.servicio) === '1');
  return esServicio1 ? d + 1 : d + 2;
}

export function enServicio1(nroSocio) {
  const leg = (DB.legajos || []).find((l) => String(l.nro) === String(nroSocio));
  return leg?.servicio === '1' && (DB.parametrosServicio || []).some((p) => String(p.servicio) === '1');
}

export function renderVacacionesInicial(tab = 'pendientes') {
  const cont = document.getElementById('screen-vacaciones');
  const lista = DB.vacaciones || [];

  const tabs = [
    ['pendientes', `Pendientes (${lista.filter((v) => v.estado === 'Anticipada').length})`],
    ['historial', `Historial (${lista.filter((v) => v.estado !== 'Anticipada').length})`],
    ['canceladas', `Canceladas (${lista.filter((v) => v.estado === 'Cancelada').length})`],
    ['resumen', 'Resumen'],
  ];
  cont.innerHTML = `
    <div class="stats">
      <div class="stat"><div class="num">${lista.filter((v) => v.estado === 'Anticipada').length}</div><div class="lbl">Anticipadas</div></div>
      <div class="stat"><div class="num">${lista.filter((v) => v.estado === 'Empezada').length}</div><div class="lbl">Empezadas</div></div>
      <div class="stat"><div class="num">${lista.filter((v) => v.estado === 'Terminada').length}</div><div class="lbl">Terminadas</div></div>
      <div class="stat"><div class="num">${lista.filter((v) => v.estado === 'Cancelada').length}</div><div class="lbl">Canceladas</div></div>
    </div>
    <div class="tabs">
      ${tabs.map(([k, l]) => `<button class="tab-btn ${tab === k ? 'active' : ''}" onclick="renderVacacionesInicial('${k}')">${l}</button>`).join('')}
    </div>
    <div class="toolbar">
      <input type="text" id="buscar-vac" placeholder="Buscar…" oninput="filtrarVacaciones()" />
      <div class="spacer"></div>
      <button class="btn" onclick="abrirNuevaSolicitudVacaciones()">+ Nueva solicitud</button>
    </div>
    <div id="vac-contenido"></div>`;

  const panel = document.getElementById('vac-contenido');
  if (tab === 'pendientes') {
    const pendientes = lista.filter((v) => v.estado === 'Anticipada');
    panel.innerHTML = tablaVacaciones(pendientes, 'Sin solicitudes anticipadas.');
  } else if (tab === 'historial') {
    const hist = lista.filter((v) => v.estado !== 'Anticipada').sort((a, b) => String(b.fechaInicio).localeCompare(String(a.fechaInicio)));
    panel.innerHTML = tablaVacaciones(hist, 'Sin historial.');
  } else if (tab === 'canceladas') {
    const canc = lista.filter((v) => v.estado === 'Cancelada');
    panel.innerHTML = tablaVacaciones(canc, 'Sin cancelaciones.');
  } else {
    renderVacacionesResumenInicial();
  }
}

export function renderVacacionesInterno(tab) {
  renderVacacionesInicial(tab);
}

export function tabVacaciones(tab) {
  renderVacacionesInicial(tab);
}

export function filtrarVacaciones() {
  const term = document.getElementById('buscar-vac')?.value.toLowerCase() || '';
  document.querySelectorAll('#vac-contenido tbody tr').forEach((tr) => {
    tr.classList.toggle('hidden', !tr.textContent.toLowerCase().includes(term));
  });
}

function chipEstadoVac(e) {
  const cls = e === 'Terminada' ? 'chip-verde' : e === 'Empezada' ? 'chip-azul' : e === 'Cancelada' ? 'chip-rojo' : 'chip-naranja';
  return `<span class="chip ${cls}">${esc(e)}</span>`;
}

function tablaVacaciones(lista, vacio) {
  if (!lista.length) return `<div class="empty">${vacio}</div>`;
  return `<div class="tbl-wrap"><table class="tbl">
    <thead><tr><th>N°</th><th>Asociado</th><th>Inicio</th><th>Final</th><th>Días</th><th>Motivo</th><th>Estado</th><th>Acciones</th></tr></thead>
    <tbody>${lista.map((v) => {
      const n = (v.fechasTomadas || []).length;
      let acciones = `<button class="btn btn-secondary btn-sm" onclick="verDetalleVacacion('${esc(String(v.id))}')">Ver</button>`;
      if (v.estado === 'Anticipada') {
        acciones += `<button class="btn btn-success btn-sm" onclick="comenzarVacacionesPorId('${esc(String(v.id))}')">Comenzar</button>`;
        acciones += `<button class="btn btn-secondary btn-sm" onclick="abrirEditarSolicitudVacacionesPorId('${esc(String(v.id))}')">Editar</button>`;
        acciones += `<button class="btn btn-danger btn-sm" onclick="cancelarVacacionesPorId('${esc(String(v.id))}')">Cancelar</button>`;
      }
      if (v.estado === 'Empezada') acciones += `<button class="btn btn-success btn-sm" onclick="abrirCierreVacacionesPorId('${esc(String(v.id))}')">Finalizar</button>`;
      return `<tr>
        <td>${esc(String(v.nroSocio || ''))}</td>
        <td>${esc(v.nombreAsociado || '')}</td>
        <td>${esc(fechaISOToDisplay(v.fechaInicio))}</td>
        <td>${esc(fechaISOToDisplay(v.fechaFinal))}</td>
        <td>${n}</td>
        <td>${esc(v.motivo || '')}</td>
        <td>${chipEstadoVac(v.estado)}</td>
        <td class="acciones">${acciones}</td>
      </tr>`;
    }).join('')}
    </tbody></table></div>`;
}

export function verDetalleVacacion(id) {
  const v = getVacacionById(id);
  if (!v) return;
  ensureModal('modal-vac-ver', `
    <div class="modal-head"><h2>Vacaciones — ${esc(v.nombreAsociado || '')}</h2><button class="modal-close" onclick="cerrarModal('modal-vac-ver')">×</button></div>
    <div class="modal-body">
      <div class="grid3">
        ${[['N° socio', v.nroSocio], ['Inicio', v.fechaInicio ? fechaISOToDisplay(v.fechaInicio) : ''], ['Final', v.fechaFinal ? fechaISOToDisplay(v.fechaFinal) : ''], ['Días tomados', (v.fechasTomadas || []).length], ['Motivo', v.motivo], ['Detalle', v.detalleMotivo], ['Supervisor', v.supervisorCargo], ['Autorizador', v.autorizador], ['Estado', v.estado], ['Fecha solicitud', v.fechaSolicitud ? fechaISOToDisplay(v.fechaSolicitud) : '']]
          .map(([k, val]) => `<div><strong>${k}:</strong><br/>${esc(val === null || val === undefined || val === '' ? '—' : String(val))}</div>`).join('')}
      </div>
    </div>
    <div class="modal-foot"><button class="btn btn-secondary" onclick="cerrarModal('modal-vac-ver')">Cerrar</button></div>
  `, {});
}

export function vacacionesDeSocio(nro) {
  return (DB.vacaciones || []).filter((v) => String(v.nroSocio) === String(nro));
}

export function fechasTomadasDe(nro, sinId) {
  return (DB.vacaciones || []).filter((v) => String(v.nroSocio) === String(nro) && String(v.id) !== String(sinId)).flatMap((v) => v.fechasTomadas || []);
}

export function abrirNuevaSolicitudVacaciones() {
  abrirSolicitudVacaciones(null);
}

export function abrirBorradorSolicitudVacacionesPorId(id) {
  abrirSolicitudVacaciones(getVacacionById(id));
}

export function abrirEditarSolicitudVacacionesPorId(id) {
  const v = getVacacionById(id);
  if (v?.estado !== 'Anticipada') { showToast('Solo se edita una solicitud Anticipada.', 'warn'); return; }
  abrirSolicitudVacaciones(v);
}

function motivosVac() {
  const cfg = DB.motivosVacacionesCfg || [];
  const list = cfg.filter((m) => !m.anulado).map((m) => m.nombre);
  return list.length ? list : ['Sin motivo', 'Vacaciones en la misma fecha de otro año'];
}

function autorizadoresV() {
  const cfg = DB.usuariosVacacionesCfg || [];
  const list = cfg.filter((a) => !a.anulado).map((a) => a.nombre);
  return list.length ? list : ['Gerente de RRHH'];
}

function abrirSolicitudVacaciones(v) {
  ensureModal('modal-vac', `
    <div class="modal-head"><h2>${v ? 'Editar solicitud' : 'Nueva solicitud'} de vacaciones</h2><button class="modal-close" onclick="cerrarModal('modal-vac')">×</button></div>
    <form id="form-vac">
      <div class="modal-body">
        <div class="form-grid">
          <div class="field"><label>N° de socio *</label><input name="nroSocio" value="${esc(v?.nroSocio || '')}" onchange="autocompletarVac()" required /></div>
          <div class="field"><label>Asociado</label><input name="nombreAsociado" id="vac-nombre" value="${esc(v?.nombreAsociado || '')}" /></div>
          <div class="field"><label>Fecha de inicio *</label><input type="date" name="fechaInicio" id="vac-inicio" value="${esc(v?.fechaInicio || '')}" onchange="diasSegunParametrosServicioPreview()" required /></div>
          <div class="field"><label>Fecha final *</label><input type="date" name="fechaFinal" id="vac-final" value="${esc(v?.fechaFinal || '')}" required /></div>
          <div class="field"><label>Motivo</label>
            <select name="motivo" id="vac-motivo">${motivosVac().map((m) => `<option ${v?.motivo === m ? 'selected' : ''}>${esc(m)}</option>`).join('')}</select></div>
          <div class="field"><label>Detalle del motivo</label><input name="detalleMotivo" value="${esc(v?.detalleMotivo || '')}" /></div>
          <div class="field"><label>Supervisor a cargo</label><input name="supervisorCargo" value="${esc(v?.supervisorCargo || '')}" /></div>
          <div class="field"><label>Autorizador</label>
            <select name="autorizador">${autorizadoresV().map((a) => `<option ${v?.autorizador === a ? 'selected' : ''}>${esc(a)}</option>`).join('')}</select></div>
        </div>
        <p id="vac-preview" class="muted"></p>
      </div>
      <div class="modal-foot"><button type="button" class="btn btn-secondary" onclick="cerrarModal('modal-vac')">Cancelar</button><button type="submit" class="btn">Guardar solicitud</button></div>
    </form>`, { size: 'modal-lg' });
  diasSegunParametrosServicioPreview();
  document.getElementById('form-vac').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const datos = capturar(ev);
    guardarSolicitudVacaciones(datos, v);
  });
}

export function autocompletarVac() {
  const nro = document.getElementById('form-vac')?.elements?.nroSocio?.value;
  const leg = (DB.legajos || []).find((l) => String(l.nro) === String(nro));
  if (!leg) { showToast('Socio no encontrado.', 'warn'); return; }
  const el = document.getElementById('vac-nombre');
  if (el) el.value = leg.nombre || '';
}

export function diasSegunParametrosServicioPreview() {
  const ini = document.getElementById('vac-inicio')?.value;
  const fin = document.getElementById('vac-final')?.value;
  const preview = document.getElementById('vac-preview');
  if (!ini || !fin || !preview) return;
  const d = Math.round((new Date(fin) - new Date(ini)) / 86400000);
  preview.textContent = d >= 0 ? `Días: ${d} (${diasSegunParametrosServicio(d)} según parámetros de servicio).` : 'Fecha final anterior al inicio.';
}

export function validarVacaciones(datos, v) {
  const nro = datos.nroSocio;
  if (!nro) return 'El N° de socio es obligatorio.';
  const leg = (DB.legajos || []).find((l) => String(l.nro) === String(nro));
  if (!leg) return 'No existe ese socio.';
  if (!datos.fechaInicio || !datos.fechaFinal) return 'Inicio y final son obligatorios.';
  if (datos.fechaInicio < hoyISO()) return 'La fecha de inicio no puede ser anterior a hoy.';
  if (datos.fechaFinal < datos.fechaInicio) return 'La fecha final no puede ser anterior al inicio.';
  const tomo = (DB.vacaciones || []).some((x) => String(x.nroSocio) === String(nro) && x.estado !== 'Cancelada' && String(x.id) !== String(v?.id) && fechasSolapan(x, datos.fechaInicio, datos.fechaFinal));
  if (tomo) return 'Ya existe una solicitud de vacaciones que se solapa con esas fechas.';
  return null;
}

function fechasSolapan(x, ini, fin) {
  return ini <= (x.fechaFinal || '') && fin >= (x.fechaInicio || '');
}

export function guardarSolicitudVacaciones(datos, v) {
  const error = validarVacaciones(datos, v);
  if (error) { showToast(error, 'err'); return; }
  if (!v) {
    const fechasTomadas = [];
    let d = new Date(datos.fechaInicio + 'T00:00:00');
    const fin = new Date(datos.fechaFinal + 'T00:00:00');
    while (d <= fin) {
      fechasTomadas.push(d.toISOString().slice(0, 10));
      d.setDate(d.getDate() + 1);
    }
    const nueva = {
      id: Date.now().toString(),
      ...datos,
      fechasTomadas,
      estado: 'Anticipada',
      fechaSolicitud: hoyISO(),
      historial: [],
      editadoPor: getCurrentUser()?.nombre || '',
      editadoEn: new Date().toISOString(),
    };
    DB.vacaciones.push(nueva);
    supaSync('vacaciones', nueva)
      .then(() => { cerrarModal('modal-vac'); showToast('Solicitud guardada', 'ok'); renderVacacionesInicial('pendientes'); })
      .catch((e) => showToast(e.message, 'err'));
  } else {
    const fechasTomadas = [];
    let d = new Date(datos.fechaInicio + 'T00:00:00');
    const fin = new Date(datos.fechaFinal + 'T00:00:00');
    while (d <= fin) {
      fechasTomadas.push(d.toISOString().slice(0, 10));
      d.setDate(d.getDate() + 1);
    }
    Object.assign(v, datos, { fechasTomadas, editadoPor: getCurrentUser()?.nombre, editadoEn: new Date().toISOString() });
    supaSync('vacaciones', v)
      .then(() => { cerrarModal('modal-vac'); showToast('Solicitud actualizada', 'ok'); renderVacacionesInicial('pendientes'); })
      .catch((e) => showToast(e.message, 'err'));
  }
}

export function comenzarVacacionesPorId(id) {
  const v = getVacacionById(id);
  if (!v) return;
  const leg = (DB.legajos || []).find((l) => String(l.nro) === String(v.nroSocio));
  if (!leg || leg.estado !== 'Activo') { showToast('El asociado no está activo.', 'err'); return; }
  if (v.estado === 'Anticipada' && hoyISO() > v.fechaInicio) {
    showToast('El asociado tiene apercibimiento: la fecha de inicio ya pasó.', 'warn');
  }
  v.estado = 'Empezada';
  v.historial = v.historial || [];
  v.historial.push({ fecha: hoyISO(), tipo: 'comienzo', usuario: getCurrentUser()?.nombre || '' });
  supaSync('vacaciones', v)
    .then(() => { showToast('Vacaciones comenzadas', 'ok'); renderVacacionesInicial('pendientes'); })
    .catch((e) => showToast(e.message, 'err'));
}

export function abrirComienzoVacacionesPorId(id) {
  comenzarVacacionesPorId(id);
}

export function abrirCierreVacacionesPorId(id) {
  const v = getVacacionById(id);
  if (!v) return;
  const previas = (DB.vacaciones || []).filter((x) => x.estado === 'Empezada' && String(x.id) !== String(id));
  if (previas.some((x) => x.fechaInicio <= v.fechaInicio)) {
    showToast('Existe otra vacación Empezada con inicio anterior que debe cerrarse primero.', 'warn');
  }
  ensureModal('modal-vac-cierre', `
    <div class="modal-head"><h2>Finalizar vacaciones — ${esc(v.nombreAsociado || '')}</h2><button class="modal-close" onclick="cerrarModal('modal-vac-cierre')">×</button></div>
    <form id="form-vac-cierre">
      <div class="modal-body">
        <div class="form-grid">
          <div class="field"><label>Fecha de cierre *</label><input type="date" name="fechaCierre" value="${hoyISO()}" required /></div>
          <div class="field"><label>Comentario</label><input name="comentario" /></div>
        </div>
      </div>
      <div class="modal-foot"><button type="button" class="btn btn-secondary" onclick="cerrarModal('modal-vac-cierre')">Cancelar</button><button type="submit" class="btn btn-success">Confirmar cierre</button></div>
    </form>`, {});
  document.getElementById('form-vac-cierre').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const datos = capturar(ev);
    v.estado = 'Terminada';
    v.fechaUltimoCierre = datos.fechaCierre;
    v.historial = v.historial || [];
    v.historial.push({ fecha: hoyISO(), tipo: 'cierre', usuario: getCurrentUser()?.nombre || '', comentario: datos.comentario || '' });
    supaSync('vacaciones', v)
      .then(() => { cerrarModal('modal-vac-cierre'); showToast('Vacaciones finalizadas', 'ok'); renderVacacionesInicial('historial'); })
      .catch((e) => showToast(e.message, 'err'));
  });
}

export function cerrarVacacionesPorId(id) {
  abrirCierreVacacionesPorId(id);
}

export function cancelarVacacionesPorId(id) {
  const v = getVacacionById(id);
  if (!v) return;
  v.estado = 'Cancelada';
  v.historial = v.historial || [];
  v.historial.push({ fecha: hoyISO(), tipo: 'cancelacion', usuario: getCurrentUser()?.nombre || '' });
  supaSync('vacaciones', v)
    .then(() => { showToast('Vacaciones canceladas', 'warn'); renderVacacionesInicial('canceladas'); })
    .catch((e) => showToast(e.message, 'err'));
}

export function renderVacacionesCanceladasInicial() {
  renderVacacionesInicial('canceladas');
}

export function renderVacacionesResumenInicial() {
  const panel = document.getElementById('vac-contenido');
  const porSocio = {};
  for (const v of DB.vacaciones || []) {
    if (v.estado === 'Cancelada') continue;
    porSocio[v.nroSocio] = (porSocio[v.nroSocio] || 0) + (v.fechasTomadas || []).length;
  }
  const filas = Object.entries(porSocio).map(([nro, dias]) => {
    const leg = (DB.legajos || []).find((l) => String(l.nro) === String(nro));
    return `<tr><td>${esc(nro)}</td><td>${esc(leg?.nombre || '')}</td><td>${dias}</td></tr>`;
  }).sort((a, b) => a.localeCompare(b));
  panel.innerHTML = `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>N°</th><th>Nombre</th><th>Días tomados</th></tr></thead>
    <tbody>${filas.join('') || '<tr><td colspan="3" class="empty">Sin datos.</td></tr>'}</tbody></table></div>`;
}

export function poblarSelectsVacaciones() {
  /* hook de auth */
}

export function agregarMotivoV() { abrirModalAgregarMotivo(); }
export function agregarAutorizadorV() { abrirModalAgregarAutorizador(); }

export function abrirModalAgregarMotivo() {
  ensureModal('modal-motivo-v', `
    <div class="modal-head"><h2>Nuevo motivo de vacaciones</h2><button class="modal-close" onclick="cerrarModal('modal-motivo-v')">×</button></div>
    <form id="form-motivo-v">
      <div class="modal-body"><div class="field"><label>Motivo</label><input name="nombre" required /></div></div>
      <div class="modal-foot"><button type="button" class="btn btn-secondary" onclick="cerrarModal('modal-motivo-v')">Cancelar</button><button type="submit" class="btn">Guardar</button></div>
    </form>`, {});
  document.getElementById('form-motivo-v').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const datos = capturar(ev);
    (DB.motivosVacacionesCfg ||= []).push({ id: Date.now().toString(), nombre: datos.nombre, anulado: false });
    supaSync('motivosVacacionesCfg', DB.motivosVacacionesCfg[DB.motivosVacacionesCfg.length - 1])
      .then(() => { cerrarModal('modal-motivo-v'); showToast('Motivo agregado', 'ok'); });
  });
}

export function guardarMotivoV() { abrirModalAgregarMotivo(); }

export function eliminarMotivoV(nombre) {
  const m = (DB.motivosVacacionesCfg || []).find((x) => x.nombre === nombre);
  if (!m) return;
  m.anulado = true;
  supaSync('motivosVacacionesCfg', m)
    .then(() => showToast('Motivo anulado', 'warn'))
    .catch((e) => showToast(e.message, 'err'));
}

export function abrirModalAgregarAutorizador() {
  ensureModal('modal-autorizador-v', `
    <div class="modal-head"><h2>Nuevo autorizador</h2><button class="modal-close" onclick="cerrarModal('modal-autorizador-v')">×</button></div>
    <form id="form-autorizador-v">
      <div class="modal-body"><div class="field"><label>Nombre</label><input name="nombre" required /></div></div>
      <div class="modal-foot"><button type="button" class="btn btn-secondary" onclick="cerrarModal('modal-autorizador-v')">Cancelar</button><button type="submit" class="btn">Guardar</button></div>
    </form>`, {});
  document.getElementById('form-autorizador-v').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const datos = capturar(ev);
    (DB.usuariosVacacionesCfg ||= []).push({ id: Date.now().toString(), nombre: datos.nombre, anulado: false });
    supaSync('usuariosVacacionesCfg', DB.usuariosVacacionesCfg[DB.usuariosVacacionesCfg.length - 1])
      .then(() => { cerrarModal('modal-autorizador-v'); showToast('Autorizador agregado', 'ok'); });
  });
}

export function guardarAutorizadorV() { abrirModalAgregarAutorizador(); }

export function eliminarAutorizadorV(nombre) {
  const a = (DB.usuariosVacacionesCfg || []).find((x) => x.nombre === nombre);
  if (!a) return;
  a.anulado = true;
  supaSync('usuariosVacacionesCfg', a)
    .then(() => showToast('Autorizador anulado', 'warn'))
    .catch((e) => showToast(e.message, 'err'));
}

export function seleccionarMotivoVacaciones(v) {
  const el = document.getElementById('vac-motivo');
  if (el && v) el.value = v;
}

export function seleccionarAutorizadorV(v) {
  const el = document.getElementById('form-vac')?.elements?.autorizador;
  if (el && v) el.value = v;
}

export function filtrosDinamicosVacaciones() {
  renderVacacionesInicial('pendientes');
}
