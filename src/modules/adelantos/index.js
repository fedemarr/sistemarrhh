// Adelantos — index.

export * from './adelantosShared.js';
export * from './pedidos_adelantos.js';
export * from './gestion_adelantos.js';
export * from './mis_adelantos.js';

export const adelantosScreenConfig = {
  pedidos_adelantos: {
    title: 'Pedidos de adelanto',
    btn: '+ Nuevo pedido',
    fn: abrirNuevoPedidoAdelanto,
    render: renderPedidosAdelantos,
  },
  gestion_adelantos: {
    title: 'Gestión de adelantos',
    btn: '',
    fn: null,
    render: () => renderGestionAdelantos('pendientes'),
  },
  mis_adelantos: {
    title: 'Mis adelantos',
    btn: '+ Pedir adelanto',
    fn: abrirModalMisAdelanto,
    render: renderMisAdelantos,
  },
};

window.renderPedidosAdelantos = renderPedidosAdelantos;
window.filtrarPedidosAdelantos = filtrarPedidosAdelantos;
window.verPedidoAdelanto = verPedidoAdelanto;
window.abrirNuevoPedidoAdelanto = abrirNuevoPedidoAdelanto;
window.autocompletarPedidoAdelanto = autocompletarPedidoAdelanto;
window.previewCuota = previewCuota;
window.guardarAdelantoBorrador = guardarAdelantoBorrador;
window.enviarPedidoAdelanto = enviarPedidoAdelanto;
window.cancelarPedidoAdelanto = cancelarPedidoAdelanto;
window.renderGestionAdelantos = renderGestionAdelantos;
window.verGestionAdelanto = verGestionAdelanto;
window.aprobarAdelantoSup = aprobarAdelantoSup;
window.rechazarAdelantoSup = rechazarAdelantoSup;
window.aprobarAdelantoFin = aprobarAdelantoFin;
window.rechazarAdelantoFin = rechazarAdelantoFin;
window.entregarAdelanto = entregarAdelanto;
window.renderMisAdelantos = renderMisAdelantos;
window.verMisAdelanto = verMisAdelanto;
window.abrirModalMisAdelanto = abrirModalMisAdelanto;
window.previewMisCuota = previewMisCuota;
