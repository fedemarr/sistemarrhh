// Uniformes — index.

export * from './uniformes.js';

import { renderUniformesInicial, filtrarUniformes, verEntrega, abrirNuevaEntrega, marcarEntregado, anularEntregaPorId, autocompletarUniforme, pintarTalles, abrirModalPrenda, guardarPrenda, anularPrenda, abrirModalPrueba, guardarPrueba, crearEntregaUniformeDesdeAlta } from './uniformes.js';

export const uniformesScreenConfig = {
  uniformes: {
    title: 'Uniformes',
    btn: '+ Nueva entrega',
    fn: abrirNuevaEntrega,
    render: () => renderUniformesInicial('uniformes'),
  },
};

window.renderUniformesInicial = renderUniformesInicial;
window.filtrarUniformes = filtrarUniformes;
window.verEntrega = verEntrega;
window.abrirNuevaEntrega = abrirNuevaEntrega;
window.marcarEntregado = marcarEntregado;
window.anularEntregaPorId = anularEntregaPorId;
window.autocompletarUniforme = autocompletarUniforme;
window.pintarTalles = pintarTalles;
window.abrirModalPrenda = abrirModalPrenda;
window.guardarPrenda = guardarPrenda;
window.anularPrenda = anularPrenda;
window.abrirModalPrueba = abrirModalPrueba;
window.guardarPrueba = guardarPrueba;
window.crearEntregaUniformeDesdeAlta = crearEntregaUniformeDesdeAlta;
