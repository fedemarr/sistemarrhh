// Enfermos — index.

export * from './enfermos.js';

import { renderEnfermosInicial, renderInformeEnfermos, filtrarEnfermos, verEnfermo, abrirNuevoEnfermo, abrirEditarEnfermoPorId, marcarControladoEnfermo, darAltaEnfermo, cerrarEnfermo, anularEnfermoPorId, autocompletarEnfermo } from './enfermos.js';

export const enfermosScreenConfig = {
  enfermos: {
    title: 'Enfermos',
    btn: '+ Nuevo enfermo',
    fn: abrirNuevoEnfermo,
    render: () => renderEnfermosInicial('activos'),
  },
};

window.renderEnfermosInicial = renderEnfermosInicial;
window.renderInformeEnfermos = renderInformeEnfermos;
window.filtrarEnfermos = filtrarEnfermos;
window.verEnfermo = verEnfermo;
window.abrirNuevoEnfermo = abrirNuevoEnfermo;
window.abrirEditarEnfermoPorId = abrirEditarEnfermoPorId;
window.marcarControladoEnfermo = marcarControladoEnfermo;
window.darAltaEnfermo = darAltaEnfermo;
window.cerrarEnfermo = cerrarEnfermo;
window.anularEnfermoPorId = anularEnfermoPorId;
window.autocompletarEnfermo = autocompletarEnfermo;
