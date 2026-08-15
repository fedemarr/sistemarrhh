// Competencia Anual — index.

export * from './movimientos.js';
export * from './resultados.js';
export * from './configuracion.js';

export const competenciaScreenConfig = {
  reglas_comp: {
    title: 'Reglas de competencia',
    btn: '+ Nueva regla',
    fn: agregarReglaComp,
    render: renderReglasComp,
  },
  resultados: {
    title: 'Resultados de competencia',
    btn: 'Exportar CSV',
    fn: exportarResultadosCSV,
    render: () => renderResultados('detalle'),
  },
};

window.renderReglasComp = renderReglasComp;
window.agregarReglaComp = agregarReglaComp;
window.editarReglaComp = editarReglaComp;
window.toggleReglaComp = toggleReglaComp;
window.anularReglaComp = anularReglaComp;
window.resetearReglasDefault = resetearReglasDefault;
window.renderResultados = renderResultados;
window.filtrarResultados = filtrarResultados;
window.seleccionarResultadoAnio = seleccionarResultadoAnio;
window.verDetalleResultado = verDetalleResultado;
window.aprobarResultadoConclusion = aprobarResultadoConclusion;
window.exportarResultadosCSV = exportarResultadosCSV;
