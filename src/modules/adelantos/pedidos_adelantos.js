// Pedidos de adelanto — alta de solicitudes.
// Fuente de verdad: 04_Adelantos.md §4.1.

import { DB } from '../../state.js';
import { supaSync } from '../../shared/supabase.js';
import { ensureModal, cerrarModal, showToast, capturar } from '../../shared/modal.js';
import { esc, hoyISO, fechaISOToDisplay } from '../../shared/helpers.js';
import { getCurrentUser, esRol } from '../../shared/auth.js';
import { ESTADOS_ADELANTO, MOTIVOS_ADELANTO_DEFAULT, motivosAdelanto, cuotaMensual, puedePedir, getAdelantoById } from './adelantosShared.js';

export function renderPedidosAdelantos() {
  const cont = document.getElementById('screen-pedidos_adelantos');
  if (!cont) return;
  const u = getCurrentUser();
  const soloPropios = u && (esRol('Asociado') || (u.nroSocio && !esRol('Administrador total', 'RRHH', 'Finanzas', 'Operaciones', 'Supervisor')));
  const lista = (DB.adelantos || []).filter((a) => !soloPropios || String(a.nroSocio) === String(u?.nroSocio)).sort((a, b) => String(b.fechaPedido).localeCompare(String(a.fechaPedido)));

  cont.innerHTML = `
    <div class="toolbar">
      <input type="text" id="buscar-pedido-adelanto" placeholder="Buscar…" oninput="filtrarPedidosAdelantos()" />
      <div class="spacer"></div>
      <button class="btn" onclick="abrirNuevoPedidoAdelanto()">+ Nuevo pedido</button>
    </div>
    <div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>N°</th><th>Asociado</th><th>Monto</th><th>Cuotas</th><th>Motivo</th><th>Fecha</th><th>Estado</th><th>Acciones</th></tr></thead>
      <tbody>
        ${lista.map((a) => {
          let acciones = `<button class="btn btn-secondary btn-sm" onclick="verPedidoAdelanto('${esc(String(a.id))}')">Ver</button>`;
          if (a.estado === 'Borrador') acciones += `<button class="btn btn-success btn-sm" onclick="enviarPedidoAdelanto('${esc(String(a.id))}')">Enviar</button>`;
          if (a.estado === 'Borrador' || a.estado === 'Enviado') acciones += `<button class="btn btn-danger btn-sm" onclick="cancelarPedidoAdelanto('${esc(String(a.id))}')">Cancelar</button>`;
          return `<tr>
            <td>${esc(String(a.nroSocio || ''))}</td>
            <td>${esc(a.nombreAsociado || '')}</td>
            <td><strong>$${a.monto || 0}</strong></td>
            <td>${esc(String(a.cuotas || 0))}</td>
            <td>${esc(a.motivo || '')}</td>
            <td>${esc(fechaISOToDisplay(a.fechaPedido))}</td>
            <td>${chipEstadoAdelanto(a.estado)}</td>
            <td class="acciones">${acciones}</td>
          </tr>`;
        }).join('') || '<tr><td colspan="8" class="empty">Sin pedidos de adelanto.</td></tr>'}
      </tbody>
    </table></div>`;
}

export function filtrarPedidosAdelantos() {
  const term = document.getElementById('buscar-pedido-adelanto')?.value.toLowerCase() || '';
  document.querySelectorAll('#screen-pedidos-adelantos tbody tr').forEach((tr) => tr.classList.toggle('hidden', !tr.textContent.toLowerCase().includes(term)));
}

export function verPedidoAdelanto(id) {
  const a = getAdelantoById(id);
  if (!a) return;
  ensureModal('modal-adelanto-ver', `
    <div class="modal-head"><h2>Pedido de adelanto — ${esc(a.nombreAsociado || '')}</h2><button class="modal-close" onclick="cerrarModal('modal-adelanto-ver')">×</button></div>
    <div class="modal-body">
      <div class="grid3">
        ${[['N°', a.nroSocio], ['Monto', `$${a.monto}`], ['Cuotas', a.cuotas], ['Cuota mensual', `$${cuotaMensual(a.monto, a.cuotas)}`], ['Motivo', a.motivo], ['Detalle', a.detalleMotivo], ['Fecha pedido', a.fechaPedido ? fechaISOToDisplay(a.fechaPedido) : ''], ['Estado', a.estado], ['Observaciones', a.observaciones]]
          .map(([k, val]) => `<div><strong>${k}:</strong><br/>${esc(val === null || val === undefined || val === '' ? '—' : String(val))}</div>`).join('')}
      </div>
      ${(a.historial || []).length ? `<h3>Historial</h3><ul>${a.historial.map((h) => `<li>${esc(h.tipo)} — ${esc(h.comentario || '')} (${esc(h.usuario || '')})</li>`).join('')}</ul>` : ''}
    </div>
    <div class="modal-foot"><button class="btn btn-secondary" onclick="cerrarModal('modal-adelanto-ver')">Cerrar</button></div>
  `, { size: 'modal-lg' });
}

export function abrirNuevoPedidoAdelanto() {
  if (!puedePedir()) { showToast('No tenés permiso para pedir adelantos.', 'err'); return; }
  ensureModal('modal-adelanto', `
    <div class="modal-head"><h2>Nuevo pedido de adelanto</h2><button class="modal-close" onclick="cerrarModal('modal-adelanto')">×</button></div>
    <form id="form-adelanto">
      <div class="modal-body">
        <div class="form-grid">
          <div class="field"><label>N° de socio *</label><input name="nroSocio" onchange="autocompletarPedidoAdelanto()" required /></div>
          <div class="field"><label>Asociado</label><input name="nombreAsociado" id="adelanto-nombre" /></div>
          <div class="field"><label>Servicio</label><input name="servicio" id="adelanto-servicio" /></div>
          <div class="field"><label>Monto ($) *</label><input type="number" name="monto" id="adelanto-monto" min="1" oninput="previewCuota()" required /></div>
          <div class="field"><label>Cuotas *</label><input type="number" name="cuotas" id="adelanto-cuotas" min="1" max="12" value="1" oninput="previewCuota()" required /></div>
          <div class="field"><label>Motivo</label>
            <select name="motivo">${motivosAdelanto().map((m) => `<option>${esc(m)}</option>`).join('')}</select></div>
          <div class="field full"><label>Detalle del motivo</label><textarea name="detalleMotivo" rows="2"></textarea></div>
        </div>
        <p id="adelanto-preview" class="muted"></p>
      </div>
      <div class="modal-foot">
        <button type="button" class="btn btn-secondary" onclick="cerrarModal('modal-adelanto')">Cancelar</button>
        <button type="button" class="btn" onclick="guardarAdelantoBorrador()">Guardar borrador</button>
        <button type="submit" class="btn btn-success">Enviar pedido</button>
      </div>
    </form>`, { size: 'modal-lg' });
  previewCuota();
  document.getElementById('form-adelanto').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const datos = capturar(ev);
    guardarAdelanto(datos, true);
  });
}

export function autocompletarPedidoAdelanto() {
  const form = document.getElementById('form-adelanto');
  if (!form) return;
  const nro = form.elements.nroSocio.value;
  const leg = (DB.legajos || []).find((l) => String(l.nro) === String(nro));
  if (leg) {
    const n = document.getElementById('adelanto-nombre'); if (n) n.value = leg.nombre || '';
    const s = document.getElementById('adelanto-servicio'); if (s) s.value = leg.servicio || '';
  }
}

export function previewCuota() {
  const monto = Number(document.getElementById('adelanto-monto')?.value) || 0;
  const cuotas = Number(document.getElementById('adelanto-cuotas')?.value) || 1;
  const preview = document.getElementById('adelanto-preview');
  if (preview) preview.textContent = cuotas > 0 ? `Cuota mensual estimada: $${cuotaMensual(monto, cuotas)}` : '';
}

export function validarAdelanto(datos) {
  if (!datos.nroSocio) return 'N° de socio obligatorio.';
  const leg = (DB.legajos || []).find((l) => String(l.nro) === String(datos.nroSocio));
  if (!leg) return 'Socio inexistente.';
  if (leg.estado !== 'Activo') return 'El socio no está activo.';
  if (!datos.monto || Number(datos.monto) <= 0) return 'El monto debe ser mayor a cero.';
  if (!datos.cuotas || Number(datos.cuotas) < 1 || Number(datos.cuotas) > 12) return 'Cuotas entre 1 y 12.';
  return null;
}

export function guardarAdelanto(datos, enviar) {
  const error = validarAdelanto(datos);
  if (error) { showToast(error, 'err'); return; }
  const a = {
    id: Date.now().toString(),
    nroSocio: Number(datos.nroSocio),
    nombreAsociado: datos.nombreAsociado || '',
    servicio: datos.servicio || '',
    monto: Number(datos.monto),
    cuotas: Number(datos.cuotas),
    montoCuota: cuotaMensual(datos.monto, datos.cuotas),
    motivo: datos.motivo,
    detalleMotivo: datos.detalleMotivo || '',
    fechaPedido: hoyISO(),
    estado: enviar ? 'Enviado' : 'Borrador',
    historial: [{ fecha: new Date().toISOString(), tipo: enviar ? 'enviado' : 'borrador', comentario: '', usuario: getCurrentUser()?.nombre || '' }],
  };
  DB.adelantos.push(a);
  supaSync('adelantos', a)
    .then(() => { cerrarModal('modal-adelanto'); showToast(enviar ? 'Pedido enviado' : 'Borrador guardado', 'ok'); renderPedidosAdelantos(); })
    .catch((e) => showToast(e.message, 'err'));
}

export function guardarAdelantoBorrador() {
  const form = document.getElementById('form-adelanto');
  if (!form) return;
  const datos = capturar(form);
  guardarAdelanto(datos, false);
}

export function enviarPedidoAdelanto(id) {
  const a = getAdelantoById(id);
  if (!a) return;
  a.estado = 'Enviado';
  a.historial = a.historial || [];
  a.historial.push({ fecha: new Date().toISOString(), tipo: 'enviado', comentario: '', usuario: getCurrentUser()?.nombre || '' });
  supaSync('adelantos', a)
    .then(() => { showToast('Pedido enviado', 'ok'); renderPedidosAdelantos(); })
    .catch((e) => showToast(e.message, 'err'));
}

export function cancelarPedidoAdelanto(id) {
  const a = getAdelantoById(id);
  if (!a) return;
  a.estado = 'Cancelado';
  a.historial = a.historial || [];
  a.historial.push({ fecha: new Date().toISOString(), tipo: 'cancelado', comentario: '', usuario: getCurrentUser()?.nombre || '' });
  supaSync('adelantos', a)
    .then(() => { showToast('Pedido cancelado', 'warn'); renderPedidosAdelantos(); })
    .catch((e) => showToast(e.message, 'err'));
}
