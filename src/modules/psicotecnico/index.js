// Psicotécnico — index.

export * from './psicotecnico.js';

import { renderPsico, tabPsico, abrirNuevoPsico, abrirGestionPsico, guardarEtapasPsico, guardarPsico, aprobarPsico, rechazarPsico, revertirPsico, analizarInformePsicoIA, usarDatosIAInformePsico, subirInformePsicoInline } from './psicotecnico.js';

export const psicotecnicoScreenConfig = {
  psicotecnico: {
    title: 'Psicotécnico',
    btn: '+ Nueva evaluación',
    fn: abrirNuevoPsico,
    render: renderPsico,
  },
};

window.renderPsico = renderPsico;
window.tabPsico = tabPsico;
window.abrirNuevoPsico = abrirNuevoPsico;
window.abrirGestionPsico = abrirGestionPsico;
window.guardarEtapasPsico = guardarEtapasPsico;
window.guardarPsico = guardarPsico;
window.aprobarPsico = aprobarPsico;
window.rechazarPsico = rechazarPsico;
window.revertirPsico = revertirPsico;
window.analizarInformePsicoIA = analizarInformePsicoIA;
window.usarDatosIAInformePsico = usarDatosIAInformePsico;
window.subirInformePsicoInline = subirInformePsicoInline;
