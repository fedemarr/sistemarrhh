// Enfermos — aislamientos, controles, altas e informes; guard de duplicados por DNI.
// Fuente de verdad: 02_Gestion_Personal.md §2.6.

import { DB } from '../../state.js';
import { supaSync } from '../../shared/supabase.js';
import { ensureModal, cerrarModal, showToast, capturar } from '../../shared/modal.js';
import { esc, hoyISO, fechaISOToDisplay } from '../../shared/helpers.js';
import { getCurrentUser } from '../../shared/auth.js';
import { crearNotificacion } from '../../shared/notificaciones.js';

export function getEnfermoById(id) {
  return (DB.enfermos || []).find((e) => String(e.id) === String(id));
}

export function enfermosDeSocio(nro) {
  return (DB.enfermos || []).filter((e) => String(e.nroSocio) === String(nro));
}

export function diasAislados(fechaInicio, fechaFin) {
  if (!fechaInicio || !fechaFin) return 0;
  const d = Math.round((new Date(fechaFin) - new Date(fechaInicio)) / 86400000);
  return d >= 0 ? d + 1 : 0;
}

export function reincidentes(limite = 3) {
  const conteo = {};
  for (const e of DB.enfermos || []) {
    if (e.estado === 'Anulado') continue;
    conteo[e.nroSocio] = (conteo[e.nroSocio] || 0) + 1;
  }
  return Object.entries(conteo).filter(([, n]) => n >= limite).sort((a, b) => b[1] - a[1]);
}

export function renderEnfermosInicial(tab = 'activos') {
  const cont = document.getElementById('screen-enfermos');
  const lista = DB.enfermos || [];
  const activos = lista.filter((e) => e.estado === 'Aislado');
  cont.innerHTML = `
    <div class="stats">
      <div class="stat"><div class="num">${activos.length}</div><div class="lbl">Aislados</div></div>
      <div class="stat"><div class="num">${lista.filter((e) => e.estado === 'Controlado').length}</div><div class="lbl">En control</div></div>
      <div class="stat"><div class="num">${reincidentes().length}</div><div class="lbl">Reincidentes</div></div>
    </div>
    <div class="tabs">
      ${[['activos', `Aislados (${activos.length})`], ['controles', 'Controles'], ['historial', 'Historial'], ['informes', 'Informes']]
        .map(([k, l]) => `<button class="tab-btn ${tab === k ? 'active' : ''}" onclick="renderEnfermosInicial('${k}')">${l}</button>`).join('')}
    </div>
    <div class="toolbar">
      <input type="text" id="buscar-enfermo" placeholder="Buscar…" oninput="filtrarEnfermos()" />
      <div class="spacer"></div>
      <button class="btn" onclick="abrirNuevoEnfermo()">+ Nuevo enfermo</button>
    </div>
    <div id="enfermo-contenido"></div>`;
  const panel = document.getElementById('enfermo-contenido');
  if (tab === 'informes') {
    panel.innerHTML = `
      <div class="toolbar">
        <select id="informe-servicio" onchange="renderInformeEnfermos()"><option value="">Todos los servicios</option>${[...new Set((DB.legajos || []).filter((l) => l.estado === 'Activo' && l.servicio).map((l) => l.servicio))].map((s) => `<option>${esc(s)}</option>`).join('')}</select>
        <select id="informe-estado" onchange="renderInformeEnfermos()"><option value="">Todos los estados</option><option>Aislado</option><option>Controlado</option><option>Alta</option></select>
      </div>
      <div id="informe-contenido"></div>`;
    renderInformeEnfermos();
    return;
  }
  const estadosFiltro = tab === 'activos' ? ['Aislado'] : tab === 'controles' ? ['Controlado'] : ['Alta', 'Anulado'];
  const listaFiltrada = lista.filter((e) => estadosFiltro.includes(e.estado));
  panel.innerHTML = tablaEnfermos(listaFiltrada, 'Sin registros.');
}

export function renderInformeEnfermos() {
  const cont = document.getElementById('informe-contenido');
  if (!cont) return;
  const servicio = document.getElementById('informe-servicio')?.value || '';
  const estado = document.getElementById('informe-estado')?.value || '';
  const lista = (DB.enfermos || []).filter((e) => (!servicio || e.servicio === servicio) && (!estado || e.estado === estado));
  cont.innerHTML = `
    <div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>Asociado</th><th>Servicio</th><th>Inicio</th><th>Fin aislamiento</th><th>Días</th><th>Estado</th></tr></thead>
      <tbody>${lista.map((e) => {
        const leg = (DB.legajos || []).find((l) => String(l.nro) === String(e.nroSocio));
        return `<tr><td>${esc(e.nombreAsociado || leg?.nombre || '')}</td><td>${esc(e.servicio || '')}</td><td>${esc(fechaISOToDisplay(e.fechaInicio))}</td><td>${esc(fechaISOToDisplay(e.fechaFin))}</td><td>${diasAislados(e.fechaInicio, e.fechaFin)}</td><td>${esc(e.estado)}</td></tr>`;
      }).join('') || '<tr><td colspan="6" class="empty">Sin datos.</td></tr>'}
      </tbody></table></div>`;
}

export function filtrarEnfermos() {
  const term = document.getElementById('buscar-enfermo')?.value.toLowerCase() || '';
  document.querySelectorAll('#enfermo-contenido tbody tr').forEach((tr) => tr.classList.toggle('hidden', !tr.textContent.toLowerCase().includes(term)));
}

function tablaEnfermos(lista, vacio) {
  if (!lista.length) return `<div class="empty">${vacio}</div>`;
  return `<div class="tbl-wrap"><table class="tbl">
    <thead><tr><th>N°</th><th>Asociado</th><th>Servicio</th><th>Inicio</th><th>Fin aislamiento</th><th>Días</th><th>Motivo</th><th>Estado</th><th>Acciones</th></tr></thead>
    <tbody>${lista.map((e) => {
      let acciones = `<button class="btn btn-secondary btn-sm" onclick="verEnfermo('${esc(String(e.id))}')">Ver</button>`;
      if (e.estado === 'Aislado') {
        acciones += `<button class="btn btn-secondary btn-sm" onclick="marcarControladoEnfermo('${esc(String(e.id))}')">Controlar</button>`;
        acciones += `<button class="btn btn-success btn-sm" onclick="darAltaEnfermo('${esc(String(e.id))}')">Dar de alta</button>`;
        acciones += `<button class="btn btn-danger btn-sm" onclick="anularEnfermoPorId('${esc(String(e.id))}')">Anular</button>`;
      }
      if (e.estado === 'Controlado') acciones += `<button class="btn btn-success btn-sm" onclick="darAltaEnfermo('${esc(String(e.id))}')">Dar de alta</button>`;
      return `<tr>
        <td>${esc(String(e.nroSocio || ''))}</td>
        <td>${esc(e.nombreAsociado || '')}</td>
        <td>${esc(e.servicio || '')}</td>
        <td>${esc(fechaISOToDisplay(e.fechaInicio))}</td>
        <td>${esc(fechaISOToDisplay(e.fechaFin))}</td>
        <td>${diasAislados(e.fechaInicio, e.fechaFin)}</td>
        <td>${esc(e.motivo || '')}</td>
        <td><span class="chip ${e.estado === 'Alta' ? 'chip-verde' : e.estado === 'Aislado' ? 'chip-rojo' : 'chip-naranja'}">${esc(e.estado)}</span></td>
        <td class="acciones">${acciones}</td>
      </tr>`;
    }).join('')}
    </tbody></table></div>`;
}

export function verEnfermo(id) {
  const e = getEnfermoById(id);
  if (!e) return;
  ensureModal('modal-enfermo-ver', `
    <div class="modal-head"><h2>Enfermo — ${esc(e.nombreAsociado || '')}</h2><button class="modal-close" onclick="cerrarModal('modal-enfermo-ver')">×</button></div>
    <div class="modal-body">
      <div class="grid3">
        ${[['N°', e.nroSocio], ['Servicio', e.servicio], ['Inicio', e.fechaInicio ? fechaISOToDisplay(e.fechaInicio) : ''], ['Fin aislamiento', e.fechaFin ? fechaISOToDisplay(e.fechaFin) : ''], ['Días aislado', diasAislados(e.fechaInicio, e.fechaFin)], ['Motivo', e.motivo], ['Detalle', e.detalleMotivo], ['Estado', e.estado], ['Obra social', e.obraSocial], ['Notificado', e.notificado ? 'Sí' : 'No']]
          .map(([k, val]) => `<div><strong>${k}:</strong><br/>${esc(val === null || val === undefined || val === '' ? '—' : String(val))}</div>`).join('')}
      </div>
    </div>
    <div class="modal-foot"><button class="btn btn-secondary" onclick="cerrarModal('modal-enfermo-ver')">Cerrar</button></div>
  `, {});
}

export function abrirNuevoEnfermo() {
  ensureModal('modal-enfermo', `
    <div class="modal-head"><h2>Nuevo enfermo</h2><button class="modal-close" onclick="cerrarModal('modal-enfermo')">×</button></div>
    <form id="form-enfermo">
      <div class="modal-body">
        <div class="form-grid">
          <div class="field"><label>N° de socio *</label><input name="nroSocio" onchange="autocompletarEnfermo()" required /></div>
          <div class="field"><label>Asociado</label><input name="nombreAsociado" id="enfermo-nombre" /></div>
          <div class="field"><label>Servicio</label><input name="servicio" id="enfermo-servicio" /></div>
          <div class="field"><label>Inicio aislamiento *</label><input type="date" name="fechaInicio" value="${hoyISO()}" required /></div>
          <div class="field"><label>Fin aislamiento</label><input type="date" name="fechaFin" /></div>
          <div class="field"><label>Motivo</label><input name="motivo" /></div>
          <div class="field full"><label>Detalle</label><textarea name="detalleMotivo" rows="2"></textarea></div>
        </div>
        <p id="enfermo-aviso" class="muted"></p>
      </div>
      <div class="modal-foot"><button type="button" class="btn btn-secondary" onclick="cerrarModal('modal-enfermo')">Cancelar</button><button type="submit" class="btn">Guardar</button></div>
    </form>`, { size: 'modal-lg' });
  document.getElementById('form-enfermo').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const datos = capturar(ev);
    guardarEnfermo(datos, null);
  });
}

export function autocompletarEnfermo() {
  const form = document.getElementById('form-enfermo');
  if (!form) return;
  const nro = form.elements.nroSocio.value;
  const leg = (DB.legajos || []).find((l) => String(l.nro) === String(nro));
  if (leg) {
    document.getElementById('enfermo-nombre').value = leg.nombre || '';
    document.getElementById('enfermo-servicio').value = leg.servicio || '';
  }
  const aviso = document.getElementById('enfermo-aviso');
  if (aviso) {
    const rec = reincidentes(2).find(([n]) => String(n) === String(nro));
    if (rec) aviso.innerHTML = `<span class="alert alert-warn">Reincidente: ${rec[1]} registros previos. Se notificará a RRHH.</span>`;
    else aviso.innerHTML = '';
  }
}

export function abrirEditarEnfermoPorId(id) {
  const e = getEnfermoById(id);
  if (!e) return;
  ensureModal('modal-enfermo', `
    <div class="modal-head"><h2>Editar enfermo</h2><button class="modal-close" onclick="cerrarModal('modal-enfermo')">×</button></div>
    <form id="form-enfermo">
      <div class="modal-body">
        <div class="form-grid">
          <div class="field"><label>N° de socio</label><input name="nroSocio" value="${esc(e.nroSocio)}" /></div>
          <div class="field"><label>Asociado</label><input name="nombreAsociado" value="${esc(e.nombreAsociado || '')}" /></div>
          <div class="field"><label>Servicio</label><input name="servicio" value="${esc(e.servicio || '')}" /></div>
          <div class="field"><label>Inicio aislamiento</label><input type="date" name="fechaInicio" value="${esc(e.fechaInicio)}" /></div>
          <div class="field"><label>Fin aislamiento</label><input type="date" name="fechaFin" value="${esc(e.fechaFin || '')}" /></div>
          <div class="field"><label>Motivo</label><input name="motivo" value="${esc(e.motivo || '')}" /></div>
        </div>
      </div>
      <div class="modal-foot"><button type="button" class="btn btn-secondary" onclick="cerrarModal('modal-enfermo')">Cancelar</button><button type="submit" class="btn">Guardar</button></div>
    </form>`, {});
  document.getElementById('form-enfermo').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const datos = capturar(ev);
    Object.assign(e, datos, { nroSocio: Number(datos.nroSocio), editadoEn: new Date().toISOString() });
    supaSync('enfermos', e)
      .then(() => { cerrarModal('modal-enfermo'); showToast('Registro actualizado', 'ok'); renderEnfermosInicial('activos'); })
      .catch((err) => showToast(err.message, 'err'));
  });
}

export function guardarEnfermo(datos, _e) {
  if (!datos.nroSocio) { showToast('N° de socio obligatorio.', 'err'); return; }
  const nro = Number(datos.nroSocio);
  if (datos.fechaFin && datos.fechaInicio > datos.fechaFin) { showToast('El fin del aislamiento no puede ser anterior al inicio.', 'err'); return; }
  const dup = (DB.enfermos || []).find((x) => String(x.nroSocio) === String(nro) && x.estado === 'Aislado' && x.fechaInicio === datos.fechaInicio);
  if (dup) { showToast('Ya existe un aislamiento con la misma fecha para este asociado.', 'err'); return; }
  const leg = (DB.legajos || []).find((l) => String(l.nro) === nro);
  const e = {
    id: Date.now().toString(),
    nroSocio: nro,
    nombreAsociado: datos.nombreAsociado || leg?.nombre || '',
    servicio: datos.servicio || leg?.servicio || '',
    fechaInicio: datos.fechaInicio,
    fechaFin: datos.fechaFin || '',
    diasAislado: diasAislados(datos.fechaInicio, datos.fechaFin),
    motivo: datos.motivo || '',
    detalleMotivo: datos.detalleMotivo || '',
    obraSocial: leg?.obraSocial || '',
    estado: 'Aislado',
    notificado: false,
    editadoEn: new Date().toISOString(),
  };
  DB.enfermos.push(e);
  if (reincidentes(2).some(([n]) => String(n) === String(nro))) {
    e.notificado = true;
    crearNotificacion({
      tipo: 'enfermo_reincidente',
      mensaje: `Enfermo reincidente: ${e.nombreAsociado}`,
      destinatarios: (DB.usuarios || []).filter((u) => u.perfil === 'RRHH' || u.perfil === 'Administrador total').map((u) => u.nombre),
    });
  }
  supaSync('enfermos', e)
    .then(() => { cerrarModal('modal-enfermo'); showToast('Enfermo registrado', 'ok'); renderEnfermosInicial('activos'); })
    .catch((err) => showToast(err.message, 'err'));
}

export function marcarControladoEnfermo(id) {
  const e = getEnfermoById(id);
  if (!e) return;
  e.estado = 'Controlado';
  e.fechaControl = hoyISO();
  supaSync('enfermos', e)
    .then(() => { showToast('En control', 'ok'); renderEnfermosInicial('controles'); })
    .catch((err) => showToast(err.message, 'err'));
}

export function darAltaEnfermo(id) {
  const e = getEnfermoById(id);
  if (!e) return;
  e.estado = 'Alta';
  e.fechaAlta = hoyISO();
  crearNotificacion({
    tipo: 'enfermo_alta',
    mensaje: `Alta de enfermo: ${e.nombreAsociado} (control post-alta)`,
    destinatarios: (DB.usuarios || []).filter((u) => u.perfil === 'RRHH' || u.perfil === 'Administrador total').map((u) => u.nombre),
  });
  supaSync('enfermos', e)
    .then(() => { showToast('Alta registrada (se notifica control)', 'ok'); renderEnfermosInicial('historial'); })
    .catch((err) => showToast(err.message, 'err'));
}

export function cerrarEnfermo(id) { darAltaEnfermo(id); }

export function anularEnfermoPorId(id) {
  const e = getEnfermoById(id);
  if (!e) return;
  e.estado = 'Anulado';
  supaSync('enfermos', e)
    .then(() => { showToast('Registro anulado', 'warn'); renderEnfermosInicial('activos'); })
    .catch((err) => showToast(err.message, 'err'));
}
