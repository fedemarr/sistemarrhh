// Legajos — index.

export * from './legajos.js';
export * from './importador.js';
export * from './importarCbu.js';

import { renderLegajos, filtrarLegajos, verLegajo, tabLeg, editarLegajo, editarLegajoActual, eliminarLegajo, eliminarLegajoActual, imprimirLegajo, toggleAltaObraSocial, toggleSeccionVacacionesLegajo, toggleTodosLegajos, calcularPrueba, barraPrueba } from './legajos.js';
import { abrirImportadorLegajos, descargarPlantillaLegajos, confirmarImportacionLegajos } from './importador.js';
import { abrirImportarCbu, confirmarImportarCbu } from './importarCbu.js';

export const legajosScreenConfig = {
  legajos: {
    title: 'Legajos',
    btn: '',
    fn: null,
    render: renderLegajos,
  },
};

window.renderLegajos = renderLegajos;
window.filtrarLegajos = filtrarLegajos;
window.verLegajo = verLegajo;
window.tabLeg = tabLeg;
window.editarLegajo = editarLegajo;
window.editarLegajoActual = editarLegajoActual;
window.eliminarLegajo = eliminarLegajo;
window.eliminarLegajoActual = eliminarLegajoActual;
window.imprimirLegajo = imprimirLegajo;
window.toggleAltaObraSocial = toggleAltaObraSocial;
window.toggleSeccionVacacionesLegajo = toggleSeccionVacacionesLegajo;
window.toggleTodosLegajos = toggleTodosLegajos;
window.abrirImportadorLegajos = abrirImportadorLegajos;
window.descargarPlantillaLegajos = descargarPlantillaLegajos;
window.confirmarImportacionLegajos = confirmarImportacionLegajos;
window.abrirImportarCbu = abrirImportarCbu;
window.confirmarImportarCbu = confirmarImportarCbu;
window.calcularPrueba = calcularPrueba;
window.barraPrueba = barraPrueba;
