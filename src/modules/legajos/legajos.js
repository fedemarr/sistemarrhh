// Legajos — vista y gestión del legajo del asociado (tabla, detalle, impresión, importadores).
// Fuente de verdad: 01_Flujo_Ingreso.md §1.7.

import { DB } from '../../state.js';
import { supaSync } from '../../shared/supabase.js';
import { ensureModal, cerrarModal, showToast, capturar } from '../../shared/modal.js';
import { esc, fechaISOToDisplay, hoyISO, calcularEstadoVencimiento } from '../../shared/helpers.js';
import { getCurrentUser, esRol } from '../../shared/auth.js';
import { crearNotificacion } from '../../shared/notificaciones.js';

export const SECTORES_ADMIN = ['Administrativo'];

export function getLegajo(nro) {
  return (DB.legajos || []).find((l) => String(l.nro) === String(nro));
}

export function calcularPrueba(l) {
  const diasTotales = (Number(l.periodoPrueba) || 6) * 30;
  const ingreso = l.ingreso || l.fechaIngresoPrueba || '';
  const hoy = hoyISO();
  const diasPasados = ingreso ? Math.max(0, Math.floor((new Date(hoy) - new Date(ingreso)) / 86400000)) : 0;
  const pct = Math.min(100, Math.round((diasPasados / diasTotales) * 100));
  const enPrueba = diasPasados < diasTotales;
  const color = pct > 80 ? 'rojo' : pct > 50 ? 'naranja' : '';
  return { diasTotales, diasPasados, pct, enPrueba, color, diaLabel: `Día ${Math.min(diasPasados + 1, diasTotales)}/${diasTotales}` };
}

export function barraPrueba(l) {
  const p = calcularPrueba(l);
  if (!p.enPrueba) return '<span class="chip chip-verde">Completado</span>';
  return `<div class="bar"><div class="progress ${p.color}"><div style="width:${p.pct}%"></div></div><span class="muted">${p.diaLabel} (${p.pct}%)</span></div>`;
}

export function puedeVerMedico() { return esRol('Administrador total', 'RRHH', 'Operaciones'); }
export function puedeVerCC() { return esRol('Administrador total', 'RRHH', 'Finanzas'); }
export function puedeVerClaveFiscal() { return esRol('Administrador total', 'RRHH'); }

export function renderLegajos() {
  const cont = document.getElementById('screen-legajos');
  const buscar = document.getElementById('leg-buscar')?.value || '';
  const fEstado = document.getElementById('leg-filtro-estado')?.value || '';
  const lista = (DB.legajos || [])
    .filter((l) => !fEstado || l.estado === fEstado)
    .filter((l) => !buscar || [l.nombre, l.dni, String(l.nro), l.servicio].some((v) => String(v || '').toLowerCase().includes(buscar.toLowerCase())))
    .sort((a, b) => Number(a.nro) - Number(b.nro));

  cont.innerHTML = `
    <div class="toolbar">
      <input type="text" id="leg-buscar" placeholder="Buscar N° / DNI / nombre / servicio…" value="${esc(buscar)}" oninput="filtrarLegajos()" />
      <select id="leg-filtro-estado" onchange="filtrarLegajos()">
        <option value="">Estado: todos</option>
        <option>Activo</option><option>Baja</option>
      </select>
      <div class="spacer"></div>
      <button class="btn btn-secondary" onclick="abrirImportadorLegajos()">Importar CSV</button>
      <button class="btn btn-secondary" onclick="abrirImportarCbu()">Importar CBU</button>
    </div>
    <div class="tbl-wrap"><table class="tbl">
      <thead><tr>
        <th><input type="checkbox" onclick="toggleTodosLegajos(this.checked)" /></th>
        <th>N°</th><th>Nombre</th><th>DNI</th><th>Función</th><th>Servicio</th><th>Supervisor</th>
        <th>Ingreso</th><th>Período de prueba</th><th>Estado</th><th>Obra social</th><th>Acciones</th>
      </tr></thead>
      <tbody>
        ${lista.length ? lista.map(filaLegajo).join('') : '<tr><td colspan="12" class="empty">Sin legajos.</td></tr>'}
      </tbody>
    </table></div>`;
}

export function filtrarLegajos() { renderLegajos(); }

function filaLegajo(l) {
  const cbuFaltante = !l.cbu ? '<span class="chip chip-naranja">Sin CBU</span>' : '';
  return `<tr>
    <td><input type="checkbox" class="leg-check" value="${esc(String(l.nro))}" /></td>
    <td><strong>${esc(String(l.nro))}</strong></td>
    <td><span class="avatar">${esc((l.nombre || '?').slice(0, 1).toUpperCase())}</span> ${esc(l.nombre || '')}</td>
    <td>${esc(l.dni || '')}</td>
    <td>${esc(l.funcion || '')}</td>
    <td>${esc(l.servicio || '')}</td>
    <td>${esc(l.supervisor || '')}</td>
    <td>${esc(fechaISOToDisplay(l.ingreso))}</td>
    <td>${barraPrueba(l)}</td>
    <td><span class="chip ${l.estado === 'Activo' ? 'chip-verde' : 'chip-rojo'}">${esc(l.estado || 'Activo')}</span> ${cbuFaltante}</td>
    <td>${l.obraSocialInicioTramite ? esc(fechaISOToDisplay(l.obraSocialInicioTramite)) : '<span class="muted">—</span>'}</td>
    <td class="acciones">
      <button class="btn btn-sm" onclick="verLegajo('${esc(String(l.nro))}')">Ver</button>
      ${esRol('Administrador total', 'RRHH') ? `<button class="btn btn-secondary btn-sm" onclick="editarLegajo('${esc(String(l.nro))}')">Editar</button>` : ''}
    </td>
  </tr>`;
}

export function toggleTodosLegajos(checked) {
  document.querySelectorAll('#screen-legajos .leg-check').forEach((c) => { c.checked = checked; });
}

export function verLegajo(nro) {
  const l = getLegajo(nro);
  if (!l) return;
  _legajoActual = l;
  _tabLegIdx = 0;
  const p = calcularPrueba(l);
  ensureModal('modal-legajo', `
    <div class="modal-head">
      <h2>Legajo N° ${esc(String(l.nro))} — ${esc(l.nombre || '')}</h2>
      <button class="modal-close" onclick="cerrarModal('modal-legajo')">×</button>
    </div>
    <div class="modal-body">
      <div class="grupo" style="display:flex;gap:16px;align-items:center;flex-wrap:wrap">
        <span class="chip ${l.estado === 'Activo' ? 'chip-verde' : 'chip-rojo'}">${esc(l.estado || 'Activo')}</span>
        ${l.estado === 'Activo' ? barraPrueba(l) : `<span class="chip chip-gris">Baja: ${esc(fechaISOToDisplay(l.fechaBaja))}</span>`}
      </div>
      <div class="tabs" id="leg-tabs"></div>
      <div id="leg-panel"></div>
    </div>
    <div class="modal-foot">
      <button class="btn btn-secondary" onclick="imprimirLegajo('${esc(String(l.nro))}')">🖨 Imprimir ficha</button>
      ${esRol('Administrador total', 'RRHH') ? `<button class="btn btn-warning" onclick="eliminarLegajo('${esc(String(l.nro))}')">Dar de baja</button>` : ''}
      <button class="btn btn-secondary" onclick="cerrarModal('modal-legajo')">Cerrar</button>
    </div>`, { size: 'modal-xl' });
  tabLeg(0);
}

let _legajoActual = null;
let _tabLegIdx = 0;

export function tabLeg(idx) {
  _tabLegIdx = idx;
  const l = _legajoActual;
  if (!l) return;
  const tabs = ['Datos personales', 'Operativo', 'Movimientos', 'Historial'];
  document.getElementById('leg-tabs').innerHTML = tabs
    .map((t, i) => `<button class="tab-btn ${i === idx ? 'active' : ''}" onclick="tabLeg(${i})">${t}</button>`)
    .join('');
  const panel = document.getElementById('leg-panel');

  const detalleDoc = detalleDocumentacion(l);
  const detalleAdelantos = movimientosAdelantos(l);

  if (idx === 0) {
    panel.innerHTML = `
      <div class="grid3">
        ${[['DNI', l.dni], ['CUIT', l.cuit], ['Tel', l.tel], ['Email', l.mail], ['Dirección', l.direccion], ['Zona', l.zona], ['Localidad', l.localidad], ['Partido', l.partido], ['CP', l.codigoPostal], ['Estado civil', l.estadoCivil], ['Nacionalidad', l.nac], ['Género', l.genero], ['Nacimiento', l.fecNac ? fechaISOToDisplay(l.fecNac) : ''], ['Banco', l.banco], ['CBU', l.cbu]]
          .map(([k, v]) => `<div><strong>${k}:</strong><br/>${esc(v || '—')}</div>`).join('')}
      </div>
      <div class="grupo"><legend>Documentación</legend>${detalleDoc}</div>
      <div class="grupo"><legend>Obra social</legend>
        <p>Obra social: ${esc(l.obraSocial || '—')} · Inicio de trámite: ${esc(fechaISOToDisplay(l.obraSocialInicioTramite))}</p>
        ${esRol('Administrador total', 'RRHH') ? `<button class="btn btn-secondary btn-sm" onclick="toggleAltaObraSocial('${esc(String(l.nro))}')">Editar inicio de trámite</button>` : ''}
      </div>`;
  } else if (idx === 1) {
    panel.innerHTML = `
      <div class="grid3">
        ${[['Función', l.funcion], ['Servicio', l.servicio], ['Supervisor', l.supervisor], ['Sector', l.sector], ['Categoría', l.categoria], ['Ingreso', l.ingreso ? fechaISOToDisplay(l.ingreso) : ''], ['Período de prueba', l.periodoPrueba ? l.periodoPrueba + ' meses' : ''], ['Integración', l.integracion], ['Forma de pago', l.formaPago], ['Talles uniforme', JSON.stringify(l.tallesUniforme || {}).slice(0, 40)]]
          .map(([k, v]) => `<div><strong>${k}:</strong><br/>${esc(String(v ?? ''))}</div>`).join('')}
      </div>
      <div class="grupo"><legend>Seguros y pólizas</legend>
        <p>Seguro: ${esc(l.seguro || '—')}</p>
        ${(l.polizas || []).filter((p) => p.numero).map((p) => `<div class="chip chip-azul">${esc(p.numero)} · ${esc(p.compania)} · ${esc(p.tipo)}</div>`).join(' ') || '<span class="muted">Sin pólizas</span>'}
      </div>`;
  } else if (idx === 2) {
    panel.innerHTML = `
      <div class="grupo"><legend>Adelantos y préstamos</legend>${detalleAdelantos}</div>
      <div class="grupo"><legend>Cuotas de uniforme pendientes</legend>${cuotasUniforme(l)}</div>`;
  } else {
    const movs = [];
    movs.push(['Ingreso', l.ingreso ? fechaISOToDisplay(l.ingreso) : '']);
    if (l.fechaReincorp) movs.push(['Reincorporación', fechaISOToDisplay(l.fechaReincorp)]);
    if (l.fechaBaja) movs.push(['Baja', fechaISOToDisplay(l.fechaBaja)]);
    panel.innerHTML = `
      <div class="grid3">${movs.map(([k, v]) => `<div><strong>${k}:</strong><br/>${esc(v || '—')}</div>`).join('')}</div>
      <div class="grupo"><legend>Reasignaciones</legend>${historialReasignaciones(l)}</div>`;
  }
}

function detalleDocumentacion(l) {
  const doc = (DB.documentacionIngreso || []).find((d) => d.dni === l.dni);
  if (!doc) return '<span class="muted">Sin expediente de documentación.</span>';
  const rows = [];
  if (doc.antecVencimiento) {
    const { estado, cls } = calcularEstadoVencimiento(doc.antecVencimiento);
    rows.push(`<p>Antecedentes: vence ${esc(fechaISOToDisplay(doc.antecVencimiento))} <span class="chip ${cls}">${esc(estado)}</span></p>`);
  }
  if (doc.libretaAplica && doc.libretaVencimiento) {
    const { estado, cls } = calcularEstadoVencimiento(doc.libretaVencimiento);
    rows.push(`<p>Libreta sanitaria: vence ${esc(fechaISOToDisplay(doc.libretaVencimiento))} <span class="chip ${cls}">${esc(estado)}</span></p>`);
  }
  if (doc.cursoTiene && doc.cursoVencimiento) {
    const { estado, cls } = calcularEstadoVencimiento(doc.cursoVencimiento);
    rows.push(`<p>Curso: vence ${esc(fechaISOToDisplay(doc.cursoVencimiento))} <span class="chip ${cls}">${esc(estado)}</span></p>`);
  }
  return rows.length ? rows.join('') : '<span class="muted">Sin vencimientos cargados.</span>';
}

function movimientosAdelantos(l) {
  const items = [];
  for (const pl of DB.planillasAdelantos || []) {
    for (const it of pl.items || []) {
      if (String(it.nroSocio) === String(l.nro)) items.push({ tipo: 'Adelanto', periodo: pl.periodo, monto: it.monto, estado: it.estado || pl.estado });
    }
  }
  for (const pl of DB.planillasInformales || []) {
    for (const it of pl.items || []) {
      if (String(it.nroSocio) === String(l.nro)) items.push({ tipo: 'Adelanto informal', periodo: pl.periodo, monto: it.monto, estado: it.estado || pl.estado });
    }
  }
  for (const p of DB.prestamos || []) {
    if (String(p.nroSocio) === String(l.nro)) items.push({ tipo: 'Préstamo', periodo: p.periodo, monto: p.monto || p.montoTotal, estado: p.estado });
  }
  for (const p of DB.solicitudesPrestamos || []) {
    if (String(p.nroSocio) === String(l.nro)) items.push({ tipo: 'Préstamo solicitado', periodo: '', monto: p.montoSolicitado, estado: p.estado });
  }
  if (!items.length) return '<span class="muted">Sin movimientos.</span>';
  return `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Tipo</th><th>Período</th><th>Monto</th><th>Estado</th></tr></thead><tbody>
    ${items.map((i) => `<tr><td>${esc(i.tipo)}</td><td>${esc(i.periodo)}</td><td>${esc(String(i.monto || ''))}</td><td>${esc(i.estado || '')}</td></tr>`).join('')}
  </tbody></table></div>`;
}

function cuotasUniforme(l) {
  const cuotas = (DB.descuentosUniformePendientes || []).filter((d) => String(d.legajoIdLocal) === String(l.nro));
  if (!cuotas.length) return '<span class="muted">Sin cuotas de uniforme.</span>';
  return cuotas
    .map(
      (c) => `
    <div class="chip ${c.estado === 'Terminado' ? 'chip-verde' : c.estado === 'Cancelado' ? 'chip-rojo' : 'chip-naranja'}">
      ${esc(c.motivoGeneracion || '')} · $${esc(String(c.montoTotal))} · ${esc(String(c.cuotasCobradas || 0))}/${esc(String(c.cuotasTotales))} cuotas · ${esc(c.estado || '')}
    </div>`
    )
    .join(' ');
}

function historialReasignaciones(l) {
  const reas = (DB.reasignaciones || []).filter((r) => String(r.nro) === String(l.nro));
  if (!reas.length) return '<span class="muted">Sin reasignaciones.</span>';
  return reas.map((r) => `<p>${esc(r.servicioOrigen)} → ${esc(r.servicioDestino)} · ${esc(r.estado)} · ${esc(fechaISOToDisplay(r.fechaSolicitud))}</p>`).join('');
}

export function editarLegajo(nro) {
  const l = getLegajo(nro);
  if (!l) return;
  ensureModal('modal-legajo-edit', `
    <div class="modal-head"><h2>Editar legajo N° ${esc(String(l.nro))}</h2><button class="modal-close" onclick="cerrarModal('modal-legajo-edit')">×</button></div>
    <form id="form-legajo-edit">
      <div class="modal-body">
        <div class="form-grid">
          <div class="field"><label>Nombre</label><input name="nombre" value="${esc(l.nombre || '')}" /></div>
          <div class="field"><label>DNI</label><input name="dni" value="${esc(l.dni || '')}" /></div>
          <div class="field"><label>Función</label><input name="funcion" value="${esc(l.funcion || '')}" /></div>
          <div class="field"><label>Servicio</label><input name="servicio" value="${esc(l.servicio || '')}" /></div>
          <div class="field"><label>Supervisor</label><input name="supervisor" value="${esc(l.supervisor || '')}" /></div>
          <div class="field"><label>Estado</label><select name="estado"><option>Activo</option><option>Baja</option></select></div>
          <div class="field"><label>Fecha de ingreso</label><input type="date" name="ingreso" value="${esc(l.ingreso || '')}" /></div>
          <div class="field"><label>Período de prueba (meses)</label><input name="periodoPrueba" type="number" value="${l.periodoPrueba || 6}" /></div>
          <div class="field"><label>CBU</label><input name="cbu" value="${esc(l.cbu || '')}" /></div>
          <div class="field"><label>Categoría</label><input name="categoria" value="${esc(l.categoria || '')}" /></div>
        </div>
      </div>
      <div class="modal-foot"><button type="button" class="btn btn-secondary" onclick="cerrarModal('modal-legajo-edit')">Cancelar</button><button type="submit" class="btn">Guardar</button></div>
    </form>`, { size: 'modal-lg' });
  const form = document.getElementById('form-legajo-edit');
  form.elements['estado'].value = l.estado || 'Activo';
  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const datos = capturar(ev);
    Object.assign(l, datos, { periodoPrueba: Number(datos.periodoPrueba) || 6 });
    if (l.estado === 'Baja' && !l.fechaBaja) l.fechaBaja = hoyISO();
    supaSync('legajos', l)
      .then(() => { cerrarModal('modal-legajo-edit'); showToast('Legajo actualizado', 'ok'); renderLegajos(); })
      .catch((e) => showToast(e.message, 'err'));
  });
}

export function eliminarLegajo(nro) {
  const l = getLegajo(nro);
  if (!l) return;
  if (!window.confirm(`¿Dar de baja el legajo N° ${nro} (${l.nombre})?`)) return;
  l.estado = 'Baja';
  l.fechaBaja = l.fechaBaja || hoyISO();
  supaSync('legajos', l)
    .then(() => { showToast('Legajo dado de baja', 'warn'); cerrarModal('modal-legajo'); renderLegajos(); })
    .catch((e) => showToast(e.message, 'err'));
}

export function editarLegajoActual() { editarLegajo(_legajoActual?.nro); }
export function eliminarLegajoActual() { eliminarLegajo(_legajoActual?.nro); }

export function imprimirLegajo(nro) {
  const l = getLegajo(nro);
  if (!l) return;
  const w = window.open('', '_blank');
  if (!w) { showToast('Permití pop-ups para imprimir.', 'err'); return; }
  w.document.write(`
    <html><head><title>Ficha legajo ${l.nro}</title><style>
      body{font-family:Segoe UI,Arial,sans-serif;padding:24px;color:#111}
      h1{font-size:20px}table{width:100%;border-collapse:collapse;margin-top:12px}
      td,th{border:1px solid #ccc;padding:6px 8px;font-size:12px;text-align:left}
      th{background:#eef}@media print{body{print-color-adjust:exact}}
    </style></head><body>
    <h1>Ficha de asociado — N° ${l.nro}</h1>
    <p>${l.nombre} · DNI ${l.dni || '—'} · ${l.funcion || ''} · ${l.servicio || ''}</p>
    <table>
      <tr><th>Ingreso</th><td>${fechaISOToDisplay(l.ingreso)}</td><th>Estado</th><td>${l.estado}</td></tr>
      <tr><th>CUIT</th><td>${l.cuit || '—'}</td><th>Supervisor</th><td>${l.supervisor || '—'}</td></tr>
      <tr><th>Tel</th><td>${l.tel || '—'}</td><th>Email</th><td>${l.mail || '—'}</td></tr>
      <tr><th>Dirección</th><td>${l.direccion || '—'}</td><th>Zona</th><td>${l.zona || '—'}</td></tr>
      <tr><th>Banco</th><td>${l.banco || '—'}</td><th>CBU</th><td>${l.cbu || '—'}</td></tr>
      <tr><th>Obra social</th><td>${l.obraSocial || '—'}</td><th>Inicio trámite OS</th><td>${fechaISOToDisplay(l.obraSocialInicioTramite)}</td></tr>
      <tr><th>Integración</th><td>${l.integracion || '—'}</td><th>Período de prueba</th><td>${l.periodoPrueba || '—'} meses</td></tr>
    </table>
    <script>window.onload=()=>window.print()<\/script></body></html>`);
  w.document.close();
}

export function toggleAltaObraSocial(nro) {
  const l = getLegajo(nro);
  if (!l) return;
  const nueva = window.prompt('Fecha de inicio de trámite (DD/MM/AAAA):', l.obraSocialInicioTramite ? fechaISOToDisplay(l.obraSocialInicioTramite) : '');
  if (!nueva) return;
  const [dd, mm, aaaa] = nueva.split('/');
  l.obraSocialInicioTramite = `${aaaa}-${mm}-${dd}`;
  supaSync('legajos', l)
    .then(() => { showToast('Obra social actualizada', 'ok'); verLegajo(l.nro); })
    .catch((e) => showToast(e.message, 'err'));
}

export function toggleSeccionVacacionesLegajo() { /* hook */ }

export function _notificarRRHH(legajo, mensaje) {
  const destinatarios = (DB.usuarios || []).filter((u) => u.perfil === 'RRHH' || u.perfil === 'Administrador total').map((u) => u.nombre);
  crearNotificacion({ tipo: 'legajo_monotributo_pendiente', mensaje: `${legajo.nombre}: ${mensaje}`, destinatarios });
}
