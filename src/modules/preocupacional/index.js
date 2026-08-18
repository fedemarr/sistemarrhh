// Preocupacional — index.

export * from './preocupacional.js';

import { renderPreocup, tabPreocup, filtrarPreocup, abrirNuevoPreocup, abrirGestionPreocup, guardarPreocup, aprobarPreocup, rechazarPreocup, revertirPreocup, bajaPreocup, analizarAptoMedicoIA, usarDatosIAApto, subirAptoPreocupInline, subirEstudiosPreocupInline } from './preocupacional.js';

export const preocupacionalScreenConfig = {
  preocupacional: {
    title: 'Preocupacional',
    btn: '+ Nuevo examen',
    fn: abrirNuevoPreocup,
    render: renderPreocup,
  },
};

window.renderPreocup = renderPreocup;
window.tabPreocup = tabPreocup;
window.filtrarPreocup = filtrarPreocup;
window.abrirNuevoPreocup = abrirNuevoPreocup;
window.abrirGestionPreocup = abrirGestionPreocup;
window.guardarPreocup = guardarPreocup;
window.aprobarPreocup = aprobarPreocup;
window.rechazarPreocup = rechazarPreocup;
window.revertirPreocup = revertirPreocup;
window.bajaPreocup = bajaPreocup;
window.analizarAptoMedicoIA = analizarAptoMedicoIA;
window.usarDatosIAApto = usarDatosIAApto;
window.subirAptoPreocupInline = subirAptoPreocupInline;
window.subirEstudiosPreocupInline = subirEstudiosPreocupInline;
