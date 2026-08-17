// Auditorías — pantalla y bindings (solo superadmin).

export * from './auditorias.js';

import { renderAuditorias } from './auditorias.js';

export const auditoriasScreenConfig = {
  auditorias: {
    title: 'Auditorías',
    btn: null,
    render: () => renderAuditorias(),
  },
};

window.renderAuditorias = renderAuditorias;
