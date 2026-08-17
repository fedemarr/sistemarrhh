// Usuarios de mi empresa — pantalla y bindings (admin de empresa, no superadmin).

export * from './usuarios_empresa.js';

import {
  renderUsuariosEmpresa, abrirNuevoUsuarioEmpresa, editarUsuarioEmpresa,
  resetPasswordEmpresa, toggleActivoUsuarioEmpresa, eliminarUsuarioEmpresa,
} from './usuarios_empresa.js';

export const usuariosEmpresaScreenConfig = {
  usuarios_empresa: {
    title: 'Usuarios',
    btn: null,
    render: () => renderUsuariosEmpresa(),
  },
};

window.renderUsuariosEmpresa = renderUsuariosEmpresa;
window.abrirNuevoUsuarioEmpresa = abrirNuevoUsuarioEmpresa;
window.editarUsuarioEmpresa = editarUsuarioEmpresa;
window.resetPasswordEmpresa = resetPasswordEmpresa;
window.toggleActivoUsuarioEmpresa = toggleActivoUsuarioEmpresa;
window.eliminarUsuarioEmpresa = eliminarUsuarioEmpresa;
