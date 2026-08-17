// Empresas — pantalla y bindings (solo superadmin).

export * from './empresas.js';

import { renderEmpresas, abrirNuevaEmpresa, verEmpresa, editarEmpresa, toggleActivaEmpresa } from './empresas.js';

export const empresasScreenConfig = {
  empresas: {
    title: 'Empresas',
    btn: null,
    render: () => renderEmpresas(),
  },
};

window.renderEmpresas = renderEmpresas;
window.abrirNuevaEmpresa = abrirNuevaEmpresa;
window.verEmpresa = verEmpresa;
window.editarEmpresa = editarEmpresa;
window.toggleActivaEmpresa = toggleActivaEmpresa;
