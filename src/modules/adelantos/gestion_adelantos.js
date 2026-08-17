// Gestión de adelantos — aprobación por supervisor y finanzas, entrega.
// Fuente de verdad: 04_Adelantos.md §4.2.

import { DB } from '../../state.js';
import { supaSync } from '../../shared/supabase.js';
import { ensureModal, cerrarModal, showToast } from '../../shared/modal.js';
import { esc, fechaISOToDisplay } from '../../shared/helpers.js';
import { getCurrentUser, esRol } from '../../shared/auth.js';
import { crearNotificacion } from '../../shared/notificaciones.js';
import { getAdelantoById, puedeAprobarSup, puedeAprobarFin, cuotaMensual } from './adelantosShared.js';

export function renderGestionAdelantos(tab = 'pendientes') {
  const cont = document.getElementById('screen-gestion_adelantos');
  if (!cont) return;
  const u = getCurrentUser();
  const pendientesSup = (DB.adelantos || []).filter((a) => a.estado === 'Enviado');
  const enProceso = (DB.adelantos || []).filter((a) => a.estado === 'En proceso');
  const aprobados = (DB.adelantos || []).filter((a) => a.estado === 'Aprobado');
  const historial = (DB.adelantos || []).filter((a) => ['Entregado', 'Rechazado por supervisor', 'Rechazado por finanzas', 'Cancelado'].includes(a.estado));

  cont.innerHTML = `
    <div class="stats">
      <div class="stat"><div class="num">${pendientesSup.length}</div><div class="lbl">Pendientes de supervisor</div></div>
      <div class="stat"><div class="num">${enProceso.length}</div><div class="lbl">En proceso (finanzas)</div></div>
      <div class="stat"><div class="num">${aprobados.length}</div><div class="lbl">Aprobados</div></div>
    </div>
    <div class="tabs">
      ${[['pendientes', `Pendientes (${pendientesSup.length})`], ['enproceso', `En proceso (${enProceso.length})`], ['aprobados', `Aprobados (${aprobados.length})`], ['historial', `Historial (${historial.length})`]]
        .map(([k, l]) => `<button class="tab-btn ${tab === k ? 'active' : ''}" onclick="renderGestionAdelantos('${k}')">${l}</button>`).join('')}
    </div>
    <div id="gestion-adelantos-contenido"></div>`;

  const panel = document.getElementById('gestion-adelantos-contenido');
  const lista = tab === 'pendientes' ? pendientesSup : tab === 'enproceso' ? enProceso : tab === 'aprobados' ? aprobados : historial;
  if (tab === 'historial') {
    const resumen = { entregados: historial.filter((a) => a.estado === 'Entregado').length, rechazados: historial.filter((a) => a.estado.startsWith('Rechazado')).length, total: historial.reduce((acc, a) => acc + (Number(a.monto) || 0), 0) };
    panel.innerHTML = `<div class="stats">
      <div class="stat"><div class="num">${resumen.entregados}</div><div class="lbl">Entregados</div></div>
      <div class="stat"><div class="num">${resumen.rechazados}</div><div class="lbl">Rechazados</div></div>
      <div class="stat"><div class="num">$${resumen.total}</div><div class="lbl">Monto total</div></div>
    </div>`;
  }
  panel.innerHTML += tablaGestion(lista, tab);
}

function tablaGestion(lista, tab) {
  if (!lista.length) return '<div class="empty">Sin adelantos en este estado.</div>';
  return `<div class="tbl-wrap"><table class="tbl">
    <thead><tr><th>N°</th><th>Asociado</th><th>Servicio</th><th>Monto</th><th>Cuotas</th><th>Motivo</th><th>Estado</th><th>Acciones</th></tr></thead>
    <tbody>${lista.map((a) => {
      let acciones = `<button class="btn btn-secondary btn-sm" onclick="verGestionAdelanto('${esc(String(a.id))}')">Ver</button>`;
      if (tab === 'pendientes' && puedeAprobarSup(a)) {
        acciones += `<button class="btn btn-success btn-sm" onclick="aprobarAdelantoSup('${esc(String(a.id))}')">Aprobar</button>`;
        acciones += `<button class="btn btn-danger btn-sm" onclick="rechazarAdelantoSup('${esc(String(a.id))}')">Rechazar</button>`;
      }
      if (tab === 'enproceso' && puedeAprobarFin()) {
        acciones += `<button class="btn btn-success btn-sm" onclick="aprobarAdelantoFin('${esc(String(a.id))}')">Aprobar</button>`;
        acciones += `<button class="btn btn-danger btn-sm" onclick="rechazarAdelantoFin('${esc(String(a.id))}')">Rechazar</button>`;
      }
      if (tab === 'aprobados' && puedeAprobarFin()) {
        acciones += `<button class="btn btn-success btn-sm" onclick="entregarAdelanto('${esc(String(a.id))}')">Marcar entregado</button>`;
      }
      return `<tr>
        <td>${esc(String(a.nroSocio || ''))}</td>
        <td>${esc(a.nombreAsociado || '')}</td>
        <td>${esc(a.servicio || '')}</td>
        <td><strong>$${a.monto || 0}</strong></td>
        <td>${esc(String(a.cuotas || 0))}</td>
        <td>${esc(a.motivo || '')}</td>
        <td>${chipEstadoAdelanto(a.estado)}</td>
        <td class="acciones">${acciones}</td>
      </tr>`;
    }).join('')}</tbody>
  </table></div>`;
}

export function verGestionAdelanto(id) {
  const a = getAdelantoById(id);
  if (!a) return;
  ensureModal('modal-gestion-adelanto', `
    <div class="modal-head"><h2>Adelanto — ${esc(a.nombreAsociado || '')}</h2><button class="modal-close" onclick="cerrarModal('modal-gestion-adelanto')">×</button></div>
    <div class="modal-body">
      <div class="grid3">
        ${[['N°', a.nroSocio], ['Servicio', a.servicio], ['Monto', `$${a.monto}`], ['Cuotas', a.cuotas], ['Cuota mensual', `$${cuotaMensual(a.monto, a.cuotas)}`], ['Motivo', a.motivo], ['Detalle', a.detalleMotivo], ['Fecha pedido', a.fechaPedido ? fechaISOToDisplay(a.fechaPedido) : ''], ['Estado', a.estado], ['Aprobado supervisor', a.aprobadoPorSup], ['Aprobado finanzas', a.aprobadoPorFin], ['Entrega', a.entregadoPor]]
          .map(([k, val]) => `<div><strong>${k}:</strong><br/>${esc(val === null || val === undefined || val === '' ? '—' : String(val))}</div>`).join('')}
      </div>
    </div>
    <div class="modal-foot"><button class="btn btn-secondary" onclick="cerrarModal('modal-gestion-adelanto')">Cerrar</button></div>
  `, { size: 'modal-lg' });
}

function notificarCambio(adelanto, msg) {
  crearNotificacion({
    tipo: 'adelanto_estado',
    mensaje: msg,
    destinatarios: [adelanto.nombreAsociado],
  });
}

export function aprobarAdelantoSup(id) {
  const a = getAdelantoById(id);
  if (!a) return;
  if (!puedeAprobarSup(a)) { showToast('No tenés permiso para aprobar este adelanto.', 'err'); return; }
  a.estado = 'En proceso';
  a.aprobadoPorSup = getCurrentUser()?.nombre || '';
  a.fechaAprobSup = new Date().toISOString();
  a.historial = a.historial || [];
  a.historial.push({ fecha: new Date().toISOString(), tipo: 'aprobado_supervisor', comentario: '', usuario: a.aprobadoPorSup });
  supaSync('adelantos', a)
    .then(() => {
      showToast('Adelanto aprobado por supervisor', 'ok');
      notificarCambio(a, `Tu adelanto de $${a.monto} fue aprobado por supervisor.`);
      DB.comunicaciones.push({
        id: Date.now().toString(),
        tipo: 'general',
        de: 'sistema',
        para: a.nombreAsociado,
        mensaje: `Tu pedido de adelanto de $${a.monto} fue APROBADO por supervisor.`,
        leido: false,
        fecha: new Date().toISOString(),
        refTipo: 'adelanto',
        refId: a.id,
      });
      supaSync('comunicaciones', DB.comunicaciones[DB.comunicaciones.length - 1]).catch(() => {});
      renderGestionAdelantos('enproceso');
    })
    .catch((e) => showToast(e.message, 'err'));
}

export function rechazarAdelantoSup(id) {
  const a = getAdelantoById(id);
  if (!a) return;
  const motivo = window.prompt('Motivo del rechazo (supervisor):', '')?.trim();
  if (!motivo) { showToast('El motivo es obligatorio.', 'warn'); return; }
  a.estado = 'Rechazado por supervisor';
  a.motivoRechazoSup = motivo;
  a.historial = a.historial || [];
  a.historial.push({ fecha: new Date().toISOString(), tipo: 'rechazado_supervisor', comentario: motivo, usuario: getCurrentUser()?.nombre || '' });
  supaSync('adelantos', a)
    .then(() => {
      showToast('Adelanto rechazado', 'warn');
      notificarCambio(a, 'Tu pedido de adelanto fue rechazado por el supervisor.');
      DB.comunicaciones.push({
        id: Date.now().toString(),
        tipo: 'general',
        de: 'sistema',
        para: a.nombreAsociado,
        mensaje: `Tu pedido de adelanto de $${a.monto} fue RECHAZADO por supervisor. Motivo: ${motivo}`,
        leido: false,
        fecha: new Date().toISOString(),
        refTipo: 'adelanto',
        refId: a.id,
      });
      supaSync('comunicaciones', DB.comunicaciones[DB.comunicaciones.length - 1]).catch(() => {});
      renderGestionAdelantos('pendientes');
    })
    .catch((e) => showToast(e.message, 'err'));
}

export function aprobarAdelantoFin(id) {
  const a = getAdelantoById(id);
  if (!a) return;
  if (!puedeAprobarFin()) { showToast('Solo finanzas puede aprobar.', 'err'); return; }
  a.estado = 'Aprobado';
  a.aprobadoPorFin = getCurrentUser()?.nombre || '';
  a.fechaAprobFin = new Date().toISOString();
  a.historial = a.historial || [];
  a.historial.push({ fecha: new Date().toISOString(), tipo: 'aprobado_finanzas', comentario: '', usuario: a.aprobadoPorFin });
  supaSync('adelantos', a)
    .then(() => {
      showToast('Adelanto aprobado por finanzas', 'ok');
      notificarCambio(a, `Tu adelanto de $${a.monto} fue aprobado por finanzas.`);
      DB.comunicaciones.push({
        id: Date.now().toString(),
        tipo: 'general',
        de: 'sistema',
        para: a.nombreAsociado,
        mensaje: `Tu pedido de adelanto de $${a.monto} fue APROBADO por finanzas. Ya puedes retirarlo.`,
        leido: false,
        fecha: new Date().toISOString(),
        refTipo: 'adelanto',
        refId: a.id,
      });
      supaSync('comunicaciones', DB.comunicaciones[DB.comunicaciones.length - 1]).catch(() => {});
      renderGestionAdelantos('aprobados');
    })
    .catch((e) => showToast(e.message, 'err'));
}

export function rechazarAdelantoFin(id) {
  const a = getAdelantoById(id);
  if (!a) return;
  const motivo = window.prompt('Motivo del rechazo (finanzas):', '')?.trim();
  if (!motivo) { showToast('El motivo es obligatorio.', 'warn'); return; }
  a.estado = 'Rechazado por finanzas';
  a.motivoRechazoFin = motivo;
  a.historial = a.historial || [];
  a.historial.push({ fecha: new Date().toISOString(), tipo: 'rechazado_finanzas', comentario: motivo, usuario: getCurrentUser()?.nombre || '' });
  supaSync('adelantos', a)
    .then(() => {
      showToast('Adelanto rechazado', 'warn');
      notificarCambio(a, 'Tu pedido de adelanto fue rechazado por finanzas.');
      DB.comunicaciones.push({
        id: Date.now().toString(),
        tipo: 'general',
        de: 'sistema',
        para: a.nombreAsociado,
        mensaje: `Tu pedido de adelanto de $${a.monto} fue RECHAZADO por finanzas. Motivo: ${motivo}`,
        leido: false,
        fecha: new Date().toISOString(),
        refTipo: 'adelanto',
        refId: a.id,
      });
      supaSync('comunicaciones', DB.comunicaciones[DB.comunicaciones.length - 1]).catch(() => {});
      renderGestionAdelantos('enproceso');
    })
    .catch((e) => showToast(e.message, 'err'));
}

export function entregarAdelanto(id) {
  const a = getAdelantoById(id);
  if (!a) return;
  a.estado = 'Entregado';
  a.entregadoPor = getCurrentUser()?.nombre || '';
  a.fechaEntrega = new Date().toISOString();
  a.historial = a.historial || [];
  a.historial.push({ fecha: new Date().toISOString(), tipo: 'entregado', comentario: '', usuario: a.entregadoPor });
  supaSync('adelantos', a)
    .then(() => { showToast('Adelanto marcado como entregado', 'ok'); notificarCambio(a, `Tu adelanto de $${a.monto} fue entregado.`); renderGestionAdelantos('historial'); })
    .catch((e) => showToast(e.message, 'err'));
}
