// Documentación de ingreso — index.

export * from './documentacion.js';

export const documentacionScreenConfig = {
  documentacion: {
    title: 'Documentación de ingreso',
    btn: '+ Nueva documentación',
    fn: abrirNuevaDocum,
    render: renderDocum,
  },
};

window.renderDocum = renderDocum;
window.tabDocum = tabDocum;
window.filtrarDocum = filtrarDocum;
window.abrirNuevaDocum = abrirNuevaDocum;
window.abrirGestionDocum = abrirGestionDocum;
window.guardarDocum = guardarDocum;
window.recalcularVencAntec = recalcularVencAntec;
window.recalcularVencLibreta = recalcularVencLibreta;
window.toggleSeccionLibreta = toggleSeccionLibreta;
window.toggleSeccionCurso = toggleSeccionCurso;
window.aprobarDocum = aprobarDocum;
window.excepcionDocum = excepcionDocum;
window.bajaDocum = bajaDocum;
window.rechazarDocum = rechazarDocum;
window.revertirDocum = revertirDocum;
window.analizarAntecedentesIA = analizarAntecedentesIA;
