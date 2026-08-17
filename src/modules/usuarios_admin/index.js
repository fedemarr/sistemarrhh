// Usuarios admin — pantalla y bindings (solo superadmin).

export * from './usuarios_admin.js';

import { renderUsuariosAdmin, abrirNuevoUsuario, editarUsuario, resetPassword, toggleActivoUsuario, eliminarUsuario } from './usuarios_admin.js';

export const usuariosAdminScreenConfig = {
  usuarios_admin: {
    title: 'Usuarios',
    btn: null,
    render: () => renderUsuariosAdmin(),
  },
};

window.renderUsuariosAdmin = renderUsuariosAdmin;
window.abrirNuevoUsuario = abrirNuevoUsuario;
window.editarUsuario = editarUsuario;
window.resetPassword = resetPassword;
window.toggleActivoUsuario = toggleActivoUsuario;
window.eliminarUsuario = eliminarUsuario;
