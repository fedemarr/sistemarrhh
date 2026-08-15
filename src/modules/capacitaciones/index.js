// Capacitaciones — index.

export * from './capacitaciones.js';

export const capacitacionesScreenConfig = {
  capacitaciones: {
    title: 'Capacitaciones',
    btn: '+ Programar capacitación',
    fn: abrirNuevaCapacitacion,
    render: () => renderCapacitaciones('registro'),
  },
};

window.renderCapacitaciones = renderCapacitaciones;
window.filtrarCapacitaciones = filtrarCapacitaciones;
window.autocompletarCap = autocompletarCap;
window.abrirNuevaCapacitacion = abrirNuevaCapacitacion;
window.abrirEditarCapacitacionPorId = abrirEditarCapacitacionPorId;
window.cancelarCap = cancelarCap;
window.anularCapacitacionPorId = anularCapacitacionPorId;
window.abrirDictarCapacitacionPorId = abrirDictarCapacitacionPorId;
window.guardarDictadoCap = guardarDictadoCap;
window.analizarCapacitacionesIA = analizarCapacitacionesIA;
