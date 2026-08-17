// Dashboard empresas — pantalla y bindings (solo superadmin).

export * from './dashboard_empresas.js';

import { renderDashboardEmpresas } from './dashboard_empresas.js';

export const dashboardEmpresasScreenConfig = {
  dashboard_empresas: {
    title: 'Dashboard empresas',
    btn: null,
    render: () => renderDashboardEmpresas(),
  },
};

window.renderDashboardEmpresas = renderDashboardEmpresas;
