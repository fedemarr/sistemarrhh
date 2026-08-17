// Comunicaciones — index (re-exports + screenConfig + window bindings).

export * from './comunicaciones.js';

import {
  renderComunicaciones, abrirNuevoMensaje, abrirNuevaPregunta,
  enviarMensaje, marcarLeido, responderMensaje,
} from './comunicaciones.js';

export const comunicacionesScreenConfig = {
  comunicaciones: {
    title: 'Comunicaciones',
    btn: '',
    fn: null,
    render: () => renderComunicaciones('general'),
  },
};

window.renderComunicaciones = renderComunicaciones;
window.abrirNuevoMensaje = abrirNuevoMensaje;
window.abrirNuevaPregunta = abrirNuevaPregunta;
window.enviarMensaje = enviarMensaje;
window.marcarLeido = marcarLeido;
window.responderMensaje = responderMensaje;
