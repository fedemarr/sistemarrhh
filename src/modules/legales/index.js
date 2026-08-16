// Situaciones legales — index.

export * from './legales.js';

import { renderSituacionesLegalesInicial, filtrarSituaciones, verSituacionLegal, abrirNuevaSituacionLegal, abrirEditarSituacionPorId, marcarVencidaSituacion, anularSituacionLegalPorId, autocompletarSL, abrirModalConfigTipoSL, guardarTipoSL, eliminarTipoSL } from './legales.js';

export const legalesScreenConfig = {
  situaciones_legales: {
    title: 'Situaciones legales',
    btn: '+ Nueva situación legal',
    fn: abrirNuevaSituacionLegal,
    render: renderSituacionesLegalesInicial,
  },
};

window.renderSituacionesLegalesInicial = renderSituacionesLegalesInicial;
window.filtrarSituaciones = filtrarSituaciones;
window.verSituacionLegal = verSituacionLegal;
window.abrirNuevaSituacionLegal = abrirNuevaSituacionLegal;
window.abrirEditarSituacionPorId = abrirEditarSituacionPorId;
window.marcarVencidaSituacion = marcarVencidaSituacion;
window.anularSituacionLegalPorId = anularSituacionLegalPorId;
window.autocompletarSL = autocompletarSL;
window.abrirModalConfigTipoSL = abrirModalConfigTipoSL;
window.guardarTipoSL = guardarTipoSL;
window.eliminarTipoSL = eliminarTipoSL;
