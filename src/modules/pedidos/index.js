// Pedidos de personal — index (re-exports + screenConfig + window bindings).

export * from './pedidos.js';

import { abrirNuevoPedido, renderPedidos, filtrarPedidos, renderPerfilInputs, verDetallePedido, editarPedido, cerrarPedido } from './pedidos.js';

export const pedidosScreenConfig = {
  pedidos: {
    title: 'Pedidos de personal',
    btn: '+ Nuevo pedido',
    fn: abrirNuevoPedido,
    render: renderPedidos,
  },
};

window.renderPedidos = renderPedidos;
window.filtrarPedidos = filtrarPedidos;
window.renderPerfilInputs = renderPerfilInputs;
window.verDetallePedido = verDetallePedido;
window.editarPedido = editarPedido;
window.cerrarPedido = cerrarPedido;
