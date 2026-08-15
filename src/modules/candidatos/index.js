// Candidatos — index (re-exports + screenConfig + window bindings).

export * from './candidatos.js';
export * from './calendario.js';
export * from './importadorHistorico.js';

export const candidatosScreenConfig = {
  candidatos: {
    title: 'Candidatos',
    btn: '+ Nuevo candidato',
    fn: abrirNuevoCandidato,
    render: () => tabCandPrincipal('base'),
  },
};

window.tabCandPrincipal = tabCandPrincipal;
window.renderCandidatos = renderCandidatos;
window.filtrarCandidatos = filtrarCandidatos;
window.toggleVerCandidatos = toggleVerCandidatos;
window.abrirNuevoCandidato = abrirNuevoCandidato;
window.editarCandidatoPorId = editarCandidatoPorId;
window.abrirCitarPorId = abrirCitarPorId;
window.guardarCita = guardarCita;
window.registrarAsistencia = registrarAsistencia;
window.abrirResultadoPorId = abrirResultadoPorId;
window.guardarResultadoEntrevista = guardarResultadoEntrevista;
window.onChangeResultadoCand = onChangeResultadoCand;
window.aprobarCandidatoPorId = aprobarCandidatoPorId;
window.rechazarCandidatoPorId = rechazarCandidatoPorId;
window.pasarAPsicoPorId = pasarAPsicoPorId;
window.abrirDetalleCandidatoPorId = abrirDetalleCandidatoPorId;
window.abrirBajaCandidatoPorId = abrirBajaCandidatoPorId;
window.confirmarBajaCandidato = confirmarBajaCandidato;
window.copiarLinkPostulacion = copiarLinkPostulacion;
window.renderLinkPublico = renderLinkPublico;

window.renderCalendario = renderCalendario;
window.cambiarSemana = cambiarSemana;
window.irHoy = irHoy;
window.agendarTurno = agendarTurno;
window.agendarTurnoLibre = agendarTurnoLibre;
window.verTurno = verTurno;
window.confirmarCalTurno = confirmarCalTurno;
window.eliminarCalTurno = eliminarCalTurno;
window.vincularCandidatoTurno = vincularCandidatoTurno;

window.renderImportadorHistorico = renderImportadorHistorico;
window.descargarPlantillaHistorico = descargarPlantillaHistorico;
window.confirmarImportHistorico = confirmarImportHistorico;
