// Mis adelantos — vista del asociado: pedir y seguir estado.
// Fuente de verdad: 04_Adelantos.md §4.3.

import { DB } from '../../state.js';
import { supaSync } from '../../shared/supabase.js';
import { ensureModal, cerrarModal, showToast, capturar } from '../../shared/modal.js';
import { esc, fechaISOToDisplay } from '../../shared/helpers.js';
import { getCurrentUser } from '../../shared/auth.js';
import { adelantosDeSocio, totalDeuda, cuotaMensual, getAdelantoById } from './adelantosShared.js';
import { motivosAdelanto } from './adelantosShared.js';

export function renderMisAdelantos() {
  const cont = document.getElementById('screen-mis-adelantos');
  const u = getCurrentUser();
  const nro = u?.nroSocio || u?.usuario || '';
  const lista = adelantosDeSocio(nro);
  cont.innerHTML = `
    <div class="stats">
      <div class="stat"><div class="num">$${totalDeuda(nro)}</div><div class="lbl">Monto aprobado en curso</div></div>
      <div class="stat"><div class="num">${lista.filter((a) => a.estado === 'Entregado').length}</div><div class="lbl">Entregados</div></div>
      <div class="stat"><div class="num">${lista.filter((a) => ['Enviado', 'En proceso', 'Aprobado'].includes(a.estado)).length}</div><div class="lbl">En trámite</div></div>
    </div>
    <div class="toolbar"><div class="spacer"></div><button class="btn" onclick="abrirModalMisAdelanto()">+ Pedir adelanto</button></div>
    <div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>Fecha</th><th>Monto</th><th>Cuotas</th><th>Cuota mensual</th><th>Motivo</th><th>Estado</th><th>Acciones</th></tr></thead>
      <tbody>
        ${lista.sort((a, b) => String(b.fechaPedido).localeCompare(String(a.fechaPedido))).map((a) => `<tr>
          <td>${esc(fechaISOToDisplay(a.fechaPedido))}</td>
          <td><strong>$${a.monto || 0}</strong></td>
          <td>${esc(String(a.cuotas || 0))}</td>
          <td>$${cuotaMensual(a.monto, a.cuotas)}</td>
          <td>${esc(a.motivo || '')}</td>
          <td>${chipEstadoAdelanto(a.estado)}</td>
          <td class="acciones"><button class="btn btn-secondary btn-sm" onclick="verMisAdelanto('${esc(String(a.id))}')">Ver</button></td>
        </tr>`).join('') || '<tr><td colspan="7" class="empty">No tenés pedidos de adelanto.</td></tr>'}
      </tbody>
    </table></div>`;
}

export function verMisAdelanto(id) {
  const a = getAdelantoById(id);
  if (!a) return;
  ensureModal('modal-mis-adelanto', `
    <div class="modal-head"><h2>Mi adelanto</h2><button class="modal-close" onclick="cerrarModal('modal-mis-adelanto')">×</button></div>
    <div class="modal-body">
      <div class="grid3">
        ${[['Monto', `$${a.monto}`], ['Cuotas', a.cuotas], ['Cuota mensual', `$${cuotaMensual(a.monto, a.cuotas)}`], ['Motivo', a.motivo], ['Detalle', a.detalleMotivo], ['Fecha pedido', a.fechaPedido ? fechaISOToDisplay(a.fechaPedido) : ''], ['Estado', a.estado], ['Supervisor', a.aprobadoPorSup || 'Pendiente'], ['Finanzas', a.aprobadoPorFin || 'Pendiente'], ['Entrega', a.entregadoPor || 'Pendiente']]
          .map(([k, val]) => `<div><strong>${k}:</strong><br/>${esc(val === null || val === undefined || val === '' ? '—' : String(val))}</div>`).join('')}
      </div>
    </div>
    <div class="modal-foot"><button class="btn btn-secondary" onclick="cerrarModal('modal-mis-adelanto')">Cerrar</button></div>
  `, {});
}

export function abrirModalMisAdelanto() {
  const u = getCurrentUser();
  if (!u?.nroSocio && !u?.usuario) { showToast('Tu usuario no tiene un N° de socio asociado.', 'err'); return; }
  ensureModal('modal-mis-adelanto-nuevo', `
    <div class="modal-head"><h2>Pedir adelanto</h2><button class="modal-close" onclick="cerrarModal('modal-mis-adelanto-nuevo')">×</button></div>
    <form id="form-mis-adelanto">
      <div class="modal-body">
        <div class="form-grid">
          <div class="field"><label>Monto ($) *</label><input type="number" name="monto" min="1" oninput="previewMisCuota()" required /></div>
          <div class="field"><label>Cuotas *</label><input type="number" name="cuotas" min="1" max="12" value="1" oninput="previewMisCuota()" required /></div>
          <div class="field"><label>Motivo</label>
            <select name="motivo">${motivosAdelanto().map((m) => `<option>${esc(m)}</option>`).join('')}</select></div>
          <div class="field full"><label>Detalle</label><textarea name="detalleMotivo" rows="2"></textarea></div>
        </div>
        <p id="mis-adelanto-preview" class="muted"></p>
      </div>
      <div class="modal-foot"><button type="button" class="btn btn-secondary" onclick="cerrarModal('modal-mis-adelanto-nuevo')">Cancelar</button><button type="submit" class="btn btn-success">Enviar pedido</button></div>
    </form>`, {});
  previewMisCuota();
  document.getElementById('form-mis-adelanto').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const datos = capturar(ev);
    if (!datos.monto || Number(datos.monto) <= 0) { showToast('Monto inválido.', 'err'); return; }
    const a = {
      id: Date.now().toString(),
      nroSocio: Number(u.nroSocio || u.usuario),
      nombreAsociado: u.nombre || '',
      servicio: u.servicio || '',
      monto: Number(datos.monto),
      cuotas: Number(datos.cuotas) || 1,
      montoCuota: cuotaMensual(datos.monto, datos.cuotas),
      motivo: datos.motivo,
      detalleMotivo: datos.detalleMotivo || '',
      fechaPedido: new Date().toISOString().slice(0, 10),
      estado: 'Enviado',
      historial: [{ fecha: new Date().toISOString(), tipo: 'enviado', comentario: '', usuario: u.nombre || '' }],
    };
    DB.adelantos.push(a);
    supaSync('adelantos', a)
      .then(() => { cerrarModal('modal-mis-adelanto-nuevo'); showToast('Pedido enviado', 'ok'); renderMisAdelantos(); })
      .catch((e) => showToast(e.message, 'err'));
  });
}

export function previewMisCuota() {
  const form = document.getElementById('form-mis-adelanto');
  if (!form) return;
  const monto = Number(form.elements.monto.value) || 0;
  const cuotas = Number(form.elements.cuotas.value) || 1;
  const preview = document.getElementById('mis-adelanto-preview');
  if (preview) preview.textContent = cuotas > 0 ? `Cuota mensual estimada: $${cuotaMensual(monto, cuotas)}` : '';
}
