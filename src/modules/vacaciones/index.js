// Vacaciones — index.

export * from './vacaciones.js';

import { renderVacacionesInicial, renderVacacionesInterno, tabVacaciones, filtrarVacaciones, verDetalleVacacion, autocompletarVac, abrirNuevaSolicitudVacaciones, abrirBorradorSolicitudVacacionesPorId, abrirEditarSolicitudVacacionesPorId, comenzarVacacionesPorId, abrirComienzoVacacionesPorId, abrirCierreVacacionesPorId, cerrarVacacionesPorId, cancelarVacacionesPorId, renderVacacionesCanceladasInicial, renderVacacionesResumenInicial, diasSegunParametrosServicioPreview, agregarMotivoV, abrirModalAgregarMotivo, guardarMotivoV, eliminarMotivoV, agregarAutorizadorV, abrirModalAgregarAutorizador, guardarAutorizadorV, eliminarAutorizadorV, seleccionarMotivoVacaciones, seleccionarAutorizadorV, filtrosDinamicosVacaciones } from './vacaciones.js';

export const vacacionesScreenConfig = {
  vacaciones: {
    title: 'Vacaciones',
    btn: '+ Nueva solicitud',
    fn: abrirNuevaSolicitudVacaciones,
    render: () => renderVacacionesInicial('pendientes'),
  },
};

window.renderVacacionesInicial = renderVacacionesInicial;
window.renderVacacionesInterno = renderVacacionesInterno;
window.tabVacaciones = tabVacaciones;
window.filtrarVacaciones = filtrarVacaciones;
window.verDetalleVacacion = verDetalleVacacion;
window.autocompletarVac = autocompletarVac;
window.abrirNuevaSolicitudVacaciones = abrirNuevaSolicitudVacaciones;
window.abrirBorradorSolicitudVacacionesPorId = abrirBorradorSolicitudVacacionesPorId;
window.abrirEditarSolicitudVacacionesPorId = abrirEditarSolicitudVacacionesPorId;
window.comenzarVacacionesPorId = comenzarVacacionesPorId;
window.abrirComienzoVacacionesPorId = abrirComienzoVacacionesPorId;
window.abrirCierreVacacionesPorId = abrirCierreVacacionesPorId;
window.cerrarVacacionesPorId = cerrarVacacionesPorId;
window.cancelarVacacionesPorId = cancelarVacacionesPorId;
window.renderVacacionesCanceladasInicial = renderVacacionesCanceladasInicial;
window.renderVacacionesResumenInicial = renderVacacionesResumenInicial;
window.diasSegunParametrosServicioPreview = diasSegunParametrosServicioPreview;
window.agregarMotivoV = agregarMotivoV;
window.abrirModalAgregarMotivo = abrirModalAgregarMotivo;
window.guardarMotivoV = guardarMotivoV;
window.eliminarMotivoV = eliminarMotivoV;
window.agregarAutorizadorV = agregarAutorizadorV;
window.abrirModalAgregarAutorizador = abrirModalAgregarAutorizador;
window.guardarAutorizadorV = guardarAutorizadorV;
window.eliminarAutorizadorV = eliminarAutorizadorV;
window.seleccionarMotivoVacaciones = seleccionarMotivoVacaciones;
window.seleccionarAutorizadorV = seleccionarAutorizadorV;
window.filtrosDinamicosVacaciones = filtrosDinamicosVacaciones;
