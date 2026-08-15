// Altas de asociados — index.

export * from './altas.js';

export const altasScreenConfig = {
  altas: {
    title: 'Altas de asociados',
    btn: '+ Alta manual',
    fn: abrirAltaVacia,
    render: renderAltas,
  },
};

window.renderAltas = renderAltas;
window.filtrarAltas = filtrarAltas;
window.abrirModalAlta = abrirModalAlta;
window.abrirAltaVacia = abrirAltaVacia;
window.rechazarAlta = rechazarAlta;
window.confirmarAlta = confirmarAlta;
window.tabAlta = tabAlta;
window.tabAltaSiguiente = tabAltaSiguiente;
window.tabAltaAnterior = tabAltaAnterior;
window.onChangeZonaAlta = onChangeZonaAlta;
window.onChangePartidoAlta = onChangePartidoAlta;
window.onChangeLocalidadAlta = onChangeLocalidadAlta;
window.onChangeServicioAlta = onChangeServicioAlta;
window.toggleReingresante = toggleReingresante;
window.buscarLegajoReingresante = buscarLegajoReingresante;
window.agregarFilaPoliza = agregarFilaPoliza;
window.eliminarFilaPoliza = eliminarFilaPoliza;
window.leerPolizas = leerPolizas;
window.renderPolizas = renderPolizas;
window.recalcularInicioObraSocial = recalcularInicioObraSocial;
window.poblarSelectsAltas = poblarSelectsAltas;
window.integracionSugerida = integracionSugerida;
