// Config forms — index (re-exports + screenConfig + window bindings).

export * from './config_forms.js';

import {
  renderConfigFormPostulacion, renderConfigFormEntrevista,
  agregarCampoForm, editarCampoForm, eliminarCampoForm,
  autoKeyCampoForm, guardarCfgFormPostulacion, guardarCfgFormEntrevista,
} from './config_forms.js';

export const configFormsScreenConfig = {
  config_form_postulacion: {
    title: 'Config. formulario postulación',
    btn: '',
    fn: null,
    render: renderConfigFormPostulacion,
  },
  config_form_entrevista: {
    title: 'Config. formulario entrevista',
    btn: '',
    fn: null,
    render: renderConfigFormEntrevista,
  },
};

window.renderConfigFormPostulacion = renderConfigFormPostulacion;
window.renderConfigFormEntrevista = renderConfigFormEntrevista;
window.agregarCampoForm = agregarCampoForm;
window.editarCampoForm = editarCampoForm;
window.eliminarCampoForm = eliminarCampoForm;
window.autoKeyCampoForm = autoKeyCampoForm;
window.guardarCfgFormPostulacion = guardarCfgFormPostulacion;
window.guardarCfgFormEntrevista = guardarCfgFormEntrevista;
