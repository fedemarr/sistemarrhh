// Reasignaciones — index.

export * from './reasignaciones.js';

export const reasignacionesScreenConfig = {
  reasignaciones: {
    title: 'Reasignaciones',
    btn: '+ Nueva reasignación',
    fn: abrirNuevaReasignacion,
    render: () => renderReasignacionesInicial('pendientes'),
  },
};

window.renderReasignacionesInicial = renderReasignacionesInicial;
window.abrirNuevaReasignacion = abrirNuevaReasignacion;
window.abrirModalReasDesde = abrirModalReasDesde;
window.abrirBorradorReasignacionPorId = abrirBorradorReasignacionPorId;
window.buscarLegajoReas = buscarLegajoReas;
window.sugerirServicioDestino = sugerirServicioDestino;
window.elegirSugerenciaDestino = elegirSugerenciaDestino;
window.guardarReasBorrador = guardarReasBorrador;
window.guardarReas = guardarReas;
window.verReasignacion = verReasignacion;
window.aprobarReas = aprobarReas;
window.rechazarReas = rechazarReas;
window.anularReas = anularReas;
window.ejecutarReas = ejecutarReas;
