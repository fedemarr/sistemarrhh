// Sugerencias — index.

export * from './sugerencias.js';

import { renderSugerencias, abrirModalNuevaSugerencia, guardarSugerencia, verSugerencia, cerrarSugerencia, eliminarSugerencia, sugerenciasScreenInicio } from './sugerencias.js';

export const sugerenciasScreenConfig = {
  sugerencias: {
    title: 'Sugerencias',
    btn: '+ Nueva sugerencia',
    fn: abrirModalNuevaSugerencia,
    render: renderSugerencias,
  },
};

window.renderSugerencias = renderSugerencias;
window.abrirModalNuevaSugerencia = abrirModalNuevaSugerencia;
window.guardarSugerencia = guardarSugerencia;
window.verSugerencia = verSugerencia;
window.cerrarSugerencia = cerrarSugerencia;
window.eliminarSugerencia = eliminarSugerencia;
window.sugerenciasScreenInicio = sugerenciasScreenInicio;
