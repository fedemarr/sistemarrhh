// Pedidos de personal — módulo (render, filtros, CRUD).
// Fuente de verdad: 01_Flujo_Ingreso.md §1.1.

import { DB } from '../../state.js';
import { supaSync } from '../../shared/supabase.js';
import { ensureModal, cerrarModal, showToast, capturar } from '../../shared/modal.js';
import { esc, hoyISO, fechaISOToDisplay } from '../../shared/helpers.js';
import { getCurrentUser } from '../../shared/auth.js';

export const ESTADOS_PEDIDO = ['Pendiente', 'En proceso', 'Cubierto', 'Cancelado'];
export const PUESTOS = ['Operario', 'Operario especializado', 'Supervisor', 'Administrativo', 'Mantenimiento'];

export function perfilAtributosDe(puesto) {
  return (DB.perfilPersonalAtributos || []).filter((a) => !a.puesto || a.puesto === puesto);
}

export function pedidosVisiblesParaUsuario() {
  const u = getCurrentUser();
  if (!u) return [];
  if (u.perfil === 'Administrador total' || u.perfil === 'RRHH' || u.perfil === 'Operaciones') return DB.pedidos;
  if (u.perfil === 'Supervisor') {
    const misServicios = (DB.legajos || [])
      .filter((l) => l.estado === 'Activo' && l.supervisor === u.nombre)
      .map((l) => l.servicio);
    return DB.pedidos.filter(
      (p) => p.supervisor === u.nombre || misServicios.includes(p.servicio)
    );
  }
  return [];
}

let _filtro = '';
let _filtroEstado = '';
function filtroPedidosActual() { return _filtro; }

function pedidosFiltrados() {
  const t = _filtro.toLowerCase();
  return pedidosVisiblesParaUsuario().filter((p) => {
    const matchTxt = !t || [p.servicio, p.zona, p.supervisor, p.puesto, p.detalle].some((v) => String(v || '').toLowerCase().includes(t));
    const matchEst = !_filtroEstado || p.estado === _filtroEstado;
    return matchTxt && matchEst;
  });
}

export function renderPedidos() {
  const container = document.getElementById('screen-pedidos');
  if (!container) return;
  const lista = pedidosFiltrados();
  container.innerHTML = `
    <div class="toolbar">
      <input type="text" id="ped-filtro" placeholder="Buscar por servicio / zona / supervisor…" oninput="filtrarPedidos(event.target.value)" />
      <select id="ped-filtro-estado" onchange="filtrarPedidos('__estado__')">
        <option value="">Todos los estados</option>
        ${ESTADOS_PEDIDO.map((e) => `<option${e === _filtroEstado ? ' selected' : ''}>${e}</option>`).join('')}
      </select>
      <div class="spacer"></div>
    </div>
    <div class="tbl-wrap">
      <table class="tbl">
        <thead><tr><th>Fecha</th><th>Supervisor</th><th>Servicio</th><th>Zona</th><th>Puesto</th><th>Perfil</th><th>Horario</th><th>Estado</th><th>Acciones</th></tr></thead>
        <tbody>
          ${lista.length ? lista.map(filaPedido).join('') : '<tr><td colspan="9" class="empty">Sin pedidos de personal.</td></tr>'}
        </tbody>
      </table>
    </div>`;
}

export function filtrarPedidos(term) {
  if (term === '__estado__') {
    _filtroEstado = document.getElementById('ped-filtro-estado')?.value || '';
  } else if (typeof term === 'string') {
    _filtro = term;
  }
  renderPedidos();
}

function chipEstado(e) {
  const cls = e === 'Cubierto' ? 'chip-verde' : e === 'Cancelado' ? 'chip-rojo' : e === 'En proceso' ? 'chip-naranja' : 'chip-azul';
  return `<span class="chip ${cls}">${esc(e)}</span>`;
}

function filaPedido(p) {
  return `<tr>
    <td>${esc(fechaISOToDisplay(p.fecha || p.fechaSolicitud))}</td>
    <td>${esc(p.supervisor || '')}</td>
    <td>${esc(p.servicio || '')}</td>
    <td>${esc(p.zona || '')}</td>
    <td><span class="chip chip-azul">${esc(p.puesto || '')}</span></td>
    <td>${esc(p.perfil || '')}</td>
    <td>${esc(p.horario || '')}</td>
    <td>${chipEstado(p.estado || 'Pendiente')}</td>
    <td class="acciones">
      <button class="btn btn-secondary btn-sm" onclick="verDetallePedido('${esc(String(p.id))}')">Ver</button>
      <button class="btn btn-secondary btn-sm" onclick="editarPedido('${esc(String(p.id))}')">Editar</button>
      <button class="btn btn-danger btn-sm" onclick="cerrarPedido('${esc(String(p.id))}')">Cerrar</button>
    </td>
  </tr>`;
}

export function renderPerfilInputs() {
  const puesto = document.getElementById('ped-puesto')?.value || '';
  const wrap = document.getElementById('ped-perfil-inputs');
  if (!wrap) return;
  const atributos = perfilAtributosDe(puesto);
  if (!atributos.length) {
    wrap.innerHTML = '<span class="muted">Sin atributos de perfil configurados para este puesto.</span>';
    return;
  }
  wrap.innerHTML = atributos
    .map((a, i) => `<label class="field checkbox"><input type="checkbox" name="perfil_${i}" value="${esc(a.nombre)}" /> ${esc(a.nombre)}</label>`)
    .join('');
}

export function abrirNuevoPedido() {
  ensureModal('modal-pedido', `
    <div class="modal-head"><h2>Nuevo pedido de personal</h2><button class="modal-close" onclick="cerrarModal('modal-pedido')">×</button></div>
    <form id="form-pedido">
      <div class="modal-body">
        <div class="form-grid">
          <div class="field"><label>Fecha</label><input type="date" name="fecha" value="${hoyISO()}" required /></div>
          <div class="field"><label>Supervisor</label><input type="text" name="supervisor" required /></div>
          <div class="field"><label>Servicio</label><input type="text" name="servicio" required /></div>
          <div class="field"><label>Zona</label><input type="text" name="zona" /></div>
          <div class="field"><label>Puesto</label>
            <select name="puesto" id="ped-puesto" onchange="renderPerfilInputs()" required>
              <option value="">Seleccionar…</option>
              ${PUESTOS.map((p) => `<option>${p}</option>`).join('')}
            </select>
          </div>
          <div class="field"><label>Horario</label><input type="text" name="horario" placeholder="Ej: 07:00 a 15:00" /></div>
          <div class="field full"><label>Estado</label>
            <select name="estado">${ESTADOS_PEDIDO.map((e) => `<option>${e}</option>`).join('')}</select>
          </div>
          <div class="field full" id="ped-perfil-inputs"></div>
          <div class="field full"><label>Detalle</label><textarea name="detalle" rows="3" placeholder="Descripción del puesto / tareas…"></textarea></div>
        </div>
      </div>
      <div class="modal-foot"><button type="button" class="btn btn-secondary" onclick="cerrarModal('modal-pedido')">Cancelar</button><button type="submit" class="btn">Guardar pedido</button></div>
    </form>`, {});
  renderPerfilInputs();
  document.getElementById('form-pedido').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const datos = capturar(ev);
    const perfil = Object.values(datos).filter((v, k) => String(k).startsWith('perfil_'));
    datos.perfil = Object.keys(datos).filter((k) => k.startsWith('perfil_') && datos[k]).map((k) => datos[k]).join(', ');
    datos.id = Date.now().toString();
    DB.pedidos.push(datos);
    supaSync('pedidos', datos)
      .then(() => { cerrarModal('modal-pedido'); showToast('Pedido guardado', 'ok'); renderPedidos(); })
      .catch((e) => showToast(e.message, 'err'));
  });
}

export function editarPedido(id) {
  const p = DB.pedidos.find((x) => String(x.id) === String(id));
  if (!p) return;
  ensureModal('modal-pedido', `
    <div class="modal-head"><h2>Editar pedido</h2><button class="modal-close" onclick="cerrarModal('modal-pedido')">×</button></div>
    <form id="form-pedido-edit">
      <div class="modal-body">
        <div class="form-grid">
          <div class="field"><label>Fecha</label><input type="date" name="fecha" value="${esc(p.fecha || '')}" /></div>
          <div class="field"><label>Supervisor</label><input type="text" name="supervisor" value="${esc(p.supervisor || '')}" /></div>
          <div class="field"><label>Servicio</label><input type="text" name="servicio" value="${esc(p.servicio || '')}" /></div>
          <div class="field"><label>Zona</label><input type="text" name="zona" value="${esc(p.zona || '')}" /></div>
          <div class="field"><label>Puesto</label><input type="text" name="puesto" value="${esc(p.puesto || '')}" /></div>
          <div class="field"><label>Horario</label><input type="text" name="horario" value="${esc(p.horario || '')}" /></div>
          <div class="field"><label>Estado</label>
            <select name="estado">${ESTADOS_PEDIDO.map((e) => `<option ${p.estado === e ? 'selected' : ''}>${e}</option>`).join('')}</select>
          </div>
          <div class="field full"><label>Perfil</label><input type="text" name="perfil" value="${esc(p.perfil || '')}" /></div>
          <div class="field full"><label>Detalle</label><textarea name="detalle" rows="3">${esc(p.detalle || '')}</textarea></div>
        </div>
      </div>
      <div class="modal-foot"><button type="button" class="btn btn-secondary" onclick="cerrarModal('modal-pedido')">Cancelar</button><button type="submit" class="btn">Guardar</button></div>
    </form>`, {});
  document.getElementById('form-pedido-edit').addEventListener('submit', (ev) => {
    ev.preventDefault();
    Object.assign(p, capturar(ev));
    supaSync('pedidos', p)
      .then(() => { cerrarModal('modal-pedido'); showToast('Pedido actualizado', 'ok'); renderPedidos(); })
      .catch((e) => showToast(e.message, 'err'));
  });
}

export function verDetallePedido(id) {
  const p = DB.pedidos.find((x) => String(x.id) === String(id));
  if (!p) return;
  ensureModal('modal-pedido-detalle', `
    <div class="modal-head"><h2>Pedido de personal</h2><button class="modal-close" onclick="cerrarModal('modal-pedido-detalle')">×</button></div>
    <div class="modal-body">
      <div class="grupo">
        <dl>${Object.entries({
          Fecha: fechaISOToDisplay(p.fecha || ''), Supervisor: p.supervisor, Servicio: p.servicio,
          Zona: p.zona, Puesto: p.puesto, Perfil: p.perfil, Horario: p.horario, Estado: p.estado || 'Pendiente',
          Detalle: p.detalle,
        }).map(([k, v]) => `<dt style="font-weight:600;color:var(--gris)">${k}</dt><dd>${esc(v || '')}</dd>`).join('')}</dl>
      </div>
    </div>
    <div class="modal-foot"><button class="btn btn-secondary" onclick="cerrarModal('modal-pedido-detalle')">Cerrar</button></div>
  `, {});
}

export function cerrarPedido(id) {
  const p = DB.pedidos.find((x) => String(x.id) === String(id));
  if (!p) return;
  p.estado = 'Cubierto';
  supaSync('pedidos', p)
    .then(() => { showToast('Pedido cerrado', 'ok'); renderPedidos(); })
    .catch((e) => showToast(e.message, 'err'));
}

export function guardarPedido(datos) {
  datos.id = datos.id || Date.now().toString();
  DB.pedidos.push(datos);
  return supaSync('pedidos', datos);
}
