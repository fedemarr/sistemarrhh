// Empresas — módulo de superadmin multitenant.
// Crea, edita y gestiona empresas + sus admins. El alta real se hace en la
// Edge Function `crear-empresa` (usa service_role para crear el usuario de Auth).

import { DB } from '../../state.js';
import { getClient, supaSync, supaInit } from '../../shared/supabase.js';
import { ensureModal, cerrarModal, showToast, capturar } from '../../shared/modal.js';
import { esc } from '../../shared/helpers.js';
import { esSuperadmin } from '../../shared/auth.js';

export function renderEmpresas() {
  const cont = document.getElementById('screen-empresas');
  if (!esSuperadmin()) {
    cont.innerHTML = '<div class="alert alert-warn">Acceso restringido: se requiere un usuario superadmin.</div>';
    return;
  }
  const empresas = DB.empresas || [];
  cont.innerHTML = `
    <div class="toolbar">
      <div class="spacer"></div>
      <button class="btn" onclick="abrirNuevaEmpresa()">+ Nueva empresa</button>
    </div>
    <div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>Empresa</th><th>Estado</th><th>Usuarios</th><th>Alta</th><th>Acciones</th></tr></thead>
      <tbody>
        ${empresas.map((e) => {
          const usuarios = (DB.usuarios || []).filter((u) => String(u.empresaId) === String(e.id));
          const activa = e.activa !== false;
          return `<tr>
            <td><strong>${esc(e.nombre)}</strong><br/><code>${esc(e.id)}</code></td>
            <td>${activa ? '<span class="chip chip-verde">Activa</span>' : '<span class="chip chip-rojo">Inactiva</span>'}</td>
            <td>${usuarios.length}</td>
            <td>${esc(e.fechaAlta || e.fecha_alta || '—')}</td>
            <td class="acciones">
              <button class="btn btn-secondary btn-sm" onclick="verEmpresa('${esc(String(e.id))}')">Ver</button>
              <button class="btn btn-sm" onclick="editarEmpresa('${esc(String(e.id))}')">Editar</button>
              <button class="btn btn-${activa ? 'warning' : 'success'} btn-sm" onclick="toggleActivaEmpresa('${esc(String(e.id))}')">${activa ? 'Desactivar' : 'Activar'}</button>
            </td>
          </tr>`;
        }).join('') || '<tr><td colspan="5" class="empty">Sin empresas creadas.</td></tr>'}
      </tbody>
    </table></div>
    <p class="muted">El formulario público <code>/postularme</code> registra candidatos; asigná manualmente la empresa desde el legajo/alta.</p>`;
}

export function abrirNuevaEmpresa() {
  if (!esSuperadmin()) return;
  ensureModal('modal-empresa', `
    <div class="modal-head"><h2>Nueva empresa</h2><button class="modal-close" onclick="cerrarModal('modal-empresa')">×</button></div>
    <form id="form-empresa">
      <div class="modal-body">
        <div class="form-grid">
          <div class="field"><label>Nombre de la empresa *</label><input name="nombre" required placeholder="Cooperativa de limpieza 2" /></div>
          <div class="field"><label>Nombre del admin *</label><input name="nombreAdmin" required placeholder="Admin Empresa" /></div>
          <div class="field"><label>Email del admin *</label><input type="email" name="email" required placeholder="admin@empresa.com" /></div>
          <div class="field"><label>Contraseña del admin *</label><input type="password" name="password" required minlength="6" placeholder="••••••••" /></div>
          <div class="field"><label>CUIT</label><input name="cuit" placeholder="XX-XXXXXXXX-X" /></div>
          <div class="field"><label>Dirección</label><input name="direccion" /></div>
          <div class="field"><label>Teléfono</label><input name="telefono" /></div>
          <div class="field"><label>Email de contacto</label><input type="email" name="emailContacto" /></div>
        </div>
      </div>
      <div class="modal-foot"><button type="button" class="btn btn-secondary" onclick="cerrarModal('modal-empresa')">Cancelar</button><button type="submit" class="btn">Crear empresa</button></div>
    </form>`, { size: 'modal-lg' });
  document.getElementById('form-empresa').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const datos = capturar(ev);
    if (!datos.nombre || !datos.nombreAdmin || !datos.email || !datos.password) { showToast('Completá todos los campos.', 'err'); return; }
    const btn = ev.target.querySelector('button[type=submit]');
    btn.disabled = true;
    btn.textContent = 'Creando…';
    getClient().functions.invoke('crear-empresa', { body: datos })
      .then(({ data, error }) => {
        if (error) throw new Error(error.context?.message || error.message);
        if (data?.error) throw new Error(data.error);
        cerrarModal('modal-empresa');
        showToast(`Empresa creada: ${data.nombre || ''}`, 'ok');
        return supaInit().then(() => renderEmpresas());
      })
      .catch((e) => showToast(e.message, 'err'))
      .finally(() => { if (document.getElementById('form-empresa')) { const b = document.getElementById('form-empresa').querySelector('button[type=submit]'); b.disabled = false; b.textContent = 'Crear empresa'; } });
  });
}

export function editarEmpresa(id) {
  const e = (DB.empresas || []).find((x) => String(x.id) === String(id));
  if (!e || !esSuperadmin()) return;
  ensureModal('modal-empresa-edit', `
    <div class="modal-head"><h2>Editar: ${esc(e.nombre)}</h2><button class="modal-close" onclick="cerrarModal('modal-empresa-edit')">×</button></div>
    <form id="form-empresa-edit">
      <div class="modal-body">
        <div class="form-grid">
          <div class="field"><label>Nombre *</label><input name="nombre" value="${esc(e.nombre || '')}" required /></div>
          <div class="field"><label>CUIT</label><input name="cuit" value="${esc(e.cuit || '')}" /></div>
          <div class="field full"><label>Dirección</label><input name="direccion" value="${esc(e.direccion || '')}" /></div>
          <div class="field"><label>Teléfono</label><input name="telefono" value="${esc(e.telefono || '')}" /></div>
          <div class="field"><label>Email de contacto</label><input type="email" name="emailContacto" value="${esc(e.emailContacto || '')}" /></div>
        </div>
      </div>
      <div class="modal-foot"><button type="button" class="btn btn-secondary" onclick="cerrarModal('modal-empresa-edit')">Cancelar</button><button type="submit" class="btn">Guardar cambios</button></div>
    </form>`, { size: 'modal-lg' });
  document.getElementById('form-empresa-edit').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const datos = capturar(ev);
    Object.assign(e, datos);
    supaSync('empresas', e)
      .then(() => { cerrarModal('modal-empresa-edit'); showToast('Empresa actualizada', 'ok'); renderEmpresas(); })
      .catch((err) => showToast(err.message, 'err'));
  });
}

export function toggleActivaEmpresa(id) {
  const e = (DB.empresas || []).find((x) => String(x.id) === String(id));
  if (!e || !esSuperadmin()) return;
  const nueva = e.activa === false ? true : false;
  e.activa = nueva;
  supaSync('empresas', e)
    .then(() => { showToast(nueva ? 'Empresa activada' : 'Empresa desactivada', 'ok'); renderEmpresas(); })
    .catch((err) => showToast(err.message, 'err'));
}

export function verEmpresa(id) {
  const e = (DB.empresas || []).find((x) => String(x.id) === String(id));
  if (!e) return;
  const usuarios = (DB.usuarios || []).filter((u) => String(u.empresaId) === String(id));
  ensureModal('modal-empresa-ver', `
    <div class="modal-head"><h2>${esc(e.nombre)}</h2><button class="modal-close" onclick="cerrarModal('modal-empresa-ver')">×</button></div>
    <div class="modal-body">
      <div class="form-grid">
        <div class="field"><label>ID</label><input readonly value="${esc(e.id)}" /></div>
        <div class="field"><label>Estado</label><input readonly value="${e.activa !== false ? 'Activa' : 'Inactiva'}" /></div>
        <div class="field"><label>CUIT</label><input readonly value="${esc(e.cuit || '—')}" /></div>
        <div class="field"><label>Dirección</label><input readonly value="${esc(e.direccion || '—')}" /></div>
        <div class="field"><label>Teléfono</label><input readonly value="${esc(e.telefono || '—')}" /></div>
        <div class="field"><label>Email contacto</label><input readonly value="${esc(e.emailContacto || '—')}" /></div>
      </div>
      <h3 style="margin-top:16px">Usuarios (${usuarios.length})</h3>
      <table class="tbl">
        <thead><tr><th>Email</th><th>Nombre</th><th>Perfil</th><th>Superadmin</th></tr></thead>
        <tbody>
          ${usuarios.map((u) => `<tr><td>${esc(u.email || '')}</td><td>${esc(u.nombre || '')}</td><td>${esc(u.perfil || '')}</td><td>${u.esSuperadmin ? 'Sí' : '—'}</td></tr>`).join('') || '<tr><td colspan="4" class="empty">Sin usuarios.</td></tr>'}
        </tbody>
      </table>
    </div>
    <div class="modal-foot"><button class="btn" onclick="cerrarModal('modal-empresa-ver')">Cerrar</button></div>`, { size: 'modal-lg' });
}
