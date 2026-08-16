// Sanciones — index.

export * from './sanciones.js';

import { renderSancionesInicial, renderSancionesInterno, tabSanciones, filtrarSanciones, verSancion, abrirNuevaSancion, abrirEditarSancionPorId, marcarCumplidaSancion, anularSancionPorId, autocompletarSancion, toggleTipoSancion } from './sanciones.js';

export const sancionesScreenConfig = {
  sanciones: {
    title: 'Sanciones',
    btn: '+ Nueva sanción',
    fn: abrirNuevaSancion,
    render: () => renderSancionesInicial('asociados'),
  },
};

window.renderSancionesInicial = renderSancionesInicial;
window.renderSancionesInterno = renderSancionesInterno;
window.tabSanciones = tabSanciones;
window.filtrarSanciones = filtrarSanciones;
window.verSancion = verSancion;
window.abrirNuevaSancion = abrirNuevaSancion;
window.abrirEditarSancionPorId = abrirEditarSancionPorId;
window.marcarCumplidaSancion = marcarCumplidaSancion;
window.anularSancionPorId = anularSancionPorId;
window.autocompletarSancion = autocompletarSancion;
window.toggleTipoSancion = toggleTipoSancion;
