// Descansos — index.

export * from './descansos.js';

import { renderDescansosInicial, abrirNuevoDescanso, editarDescansoPorId, marcarDescansoTomado, anularDescansoPorId, autocompletarDesc, abrirModalConfigDescanso, editarConfigDescanso, anularConfigDescanso, emitirReposoMensual, confirmarEmitirReposo } from './descansos.js';

export const descansosScreenConfig = {
  descansos: {
    title: 'Descansos',
    btn: '+ Nuevo descanso',
    fn: abrirNuevoDescanso,
    render: () => renderDescansosInicial('descansos'),
  },
};

window.renderDescansosInicial = renderDescansosInicial;
window.abrirNuevoDescanso = abrirNuevoDescanso;
window.editarDescansoPorId = editarDescansoPorId;
window.marcarDescansoTomado = marcarDescansoTomado;
window.anularDescansoPorId = anularDescansoPorId;
window.autocompletarDesc = autocompletarDesc;
window.abrirModalConfigDescanso = abrirModalConfigDescanso;
window.editarConfigDescanso = editarConfigDescanso;
window.anularConfigDescanso = anularConfigDescanso;
window.emitirReposoMensual = emitirReposoMensual;
window.confirmarEmitirReposo = confirmarEmitirReposo;
