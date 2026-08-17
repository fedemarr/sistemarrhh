// Usuarios de mi empresa — autoservicio para el admin de cada empresa
// (perfil 'Administrador total', no superadmin). Misma Edge Function que
// usuarios_admin (gestionar-usuario), pero acá no hay selector de empresa:
// siempre opera sobre la propia (la función valida el tenant server-side).

import { DB, PERFILES } from '../../state.js';
import { getClient, _toCamelRow } from '../../shared/supabase.js';
import { ensureModal, cerrarModal, showToast, capturar } from '../../shared/modal.js';
import { esc } from '../../shared/helpers.js';
import { getCurrentUser, esSuperadmin } from '../../shared/auth.js';

function empresaPropia() {
  const u = getCurrentUser();
  if (!u || esSuperadmin()) return null;
  return u.empresaId || null;
}

export function renderUsuariosEmpresa() {
  const cont = document.getElementById('screen-usuarios_empresa');
  const empresaId = empresaPropia();
  if (!empresaId) {
    cont.innerHTML = '<div class="alert alert-warn">Esta pantalla es para el administrador de una empresa.</div>';
    return;
  }

  const usuarios = (DB.usuarios || []).filter((u) => String(u.empresaId) === String(empresaId));

  cont.innerHTML = `
    <div class="toolbar">
      <div class="spacer"></div>
      <button class="btn" onclick="abrirNuevoUsuarioEmpresa()">+ Nuevo usuario</button>
    </div>
    <div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>Email</th><th>Nombre</th><th>Perfil</th><th>Estado</th><th>Acciones</th></tr></thead>
      <tbody>
        ${usuarios.map((u) => {
          const activo = u.activo !== false;
          return `<tr>
            <td>${esc(u.email || '')}</td>
            <td>${esc(u.nombre || '')}</td>
            <td>${esc(u.perfil || '')}</td>
            <td>${activo ? '<span class="chip chip-verde">Activo</span>' : '<span class="chip chip-rojo">Inactivo</span>'}</td>
            <td class="acciones">
              <button class="btn btn-sm" onclick="editarUsuarioEmpresa('${esc(String(u.id))}')">Editar</button>
              <button class="btn btn-secondary btn-sm" onclick="resetPasswordEmpresa('${esc(String(u.id))}')">Reset pass</button>
              <button class="btn btn-${activo ? 'warning' : 'success'} btn-sm" onclick="toggleActivoUsuarioEmpresa('${esc(String(u.id))}')">${activo ? 'Desactivar' : 'Activar'}</button>
              <button class="btn btn-danger btn-sm" onclick="eliminarUsuarioEmpresa('${esc(String(u.id))}')">Eliminar</button>
            </td>
          </tr>`;
        }).join('') || '<tr><td colspan="5" class="empty">Todavía no creaste usuarios para tu empresa.</td></tr>'}
      </tbody>
    </table></div>
    <p class="muted">Solo ves y gestionás usuarios de tu propia empresa.</p>`;
}

export function abrirNuevoUsuarioEmpresa() {
  const empresaId = empresaPropia();
  if (!empresaId) return;

  ensureModal('modal-nuevo-usuario-empresa', `
    <div class="modal-head"><h2>Nuevo usuario</h2><button class="modal-close" onclick="cerrarModal('modal-nuevo-usuario-empresa')">×</button></div>
    <form id="form-nuevo-usuario-empresa">
      <div class="modal-body">
        <div class="form-grid">
          <div class="field"><label>Email *</label><input type="email" name="email" required placeholder="usuario@empresa.com" /></div>
          <div class="field"><label>Nombre *</label><input name="nombre" required placeholder="Nombre completo" /></div>
          <div class="field"><label>Contraseña *</label><input type="password" name="password" required minlength="6" placeholder="Mínimo 6 caracteres" /></div>
          <div class="field"><label>Perfil *</label>
            <select name="perfil" required>
              ${Object.keys(PERFILES).map((k) => `<option value="${esc(k)}">${esc(k)}</option>`).join('')}
            </select>
          </div>
          <div class="field"><label>Nro Socio</label><input name="nroSocio" placeholder="(Solo para Asociado)" /></div>
        </div>
      </div>
      <div class="modal-foot">
        <button type="button" class="btn btn-secondary" onclick="cerrarModal('modal-nuevo-usuario-empresa')">Cancelar</button>
        <button type="submit" class="btn">Crear usuario</button>
      </div>
    </form>`, { size: 'modal-lg' });

  document.getElementById('form-nuevo-usuario-empresa').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const datos = capturar(ev);
    if (!datos.email || !datos.nombre || !datos.password) { showToast('Completá todos los campos.', 'err'); return; }
    if (datos.password.length < 6) { showToast('La contraseña debe tener al menos 6 caracteres', 'err'); return; }

    const btn = ev.target.querySelector('button[type=submit]');
    btn.disabled = true;
    btn.textContent = 'Creando…';

    try {
      const client = getClient();
      const { data, error } = await client.functions.invoke('gestionar-usuario', {
        body: { action: 'create', ...datos },
      });
      if (error) throw new Error(error.context?.message || error.message);
      if (data?.error) throw new Error(data.error);

      cerrarModal('modal-nuevo-usuario-empresa');
      showToast(`Usuario creado: ${datos.email}`, 'ok');
      showToast(`Credenciales: ${datos.email} / ${datos.password}`, 'ok');

      const client2 = getClient();
      const { data: rows } = await client2.from('usuarios').select('*');
      if (rows) DB.usuarios = rows.map(_toCamelRow);
      renderUsuariosEmpresa();
    } catch (e) {
      showToast(e.message, 'err');
    } finally {
      if (document.getElementById('form-nuevo-usuario-empresa')) {
        const b = document.getElementById('form-nuevo-usuario-empresa').querySelector('button[type=submit]');
        b.disabled = false;
        b.textContent = 'Crear usuario';
      }
    }
  });
}

export function editarUsuarioEmpresa(id) {
  const empresaId = empresaPropia();
  const u = (DB.usuarios || []).find((x) => String(x.id) === String(id) && String(x.empresaId) === String(empresaId));
  if (!u) return;

  ensureModal('modal-editar-usuario-empresa', `
    <div class="modal-head"><h2>Editar: ${esc(u.nombre)}</h2><button class="modal-close" onclick="cerrarModal('modal-editar-usuario-empresa')">×</button></div>
    <form id="form-editar-usuario-empresa">
      <div class="modal-body">
        <div class="form-grid">
          <div class="field full"><label>Email</label><input readonly value="${esc(u.email || '')}" /></div>
          <div class="field"><label>Nombre *</label><input name="nombre" value="${esc(u.nombre || '')}" required /></div>
          <div class="field"><label>Perfil *</label>
            <select name="perfil" required>
              ${Object.keys(PERFILES).map((k) => `<option value="${esc(k)}" ${u.perfil === k ? 'selected' : ''}>${esc(k)}</option>`).join('')}
            </select>
          </div>
        </div>
      </div>
      <div class="modal-foot">
        <button type="button" class="btn btn-secondary" onclick="cerrarModal('modal-editar-usuario-empresa')">Cancelar</button>
        <button type="submit" class="btn">Guardar cambios</button>
      </div>
    </form>`, { size: 'modal-lg' });

  document.getElementById('form-editar-usuario-empresa').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const datos = capturar(ev);
    try {
      const client = getClient();
      const { data, error } = await client.functions.invoke('gestionar-usuario', {
        body: { action: 'update', userId: id, ...datos },
      });
      if (error) throw new Error(error.context?.message || error.message);
      if (data?.error) throw new Error(data.error);

      Object.assign(u, datos);
      cerrarModal('modal-editar-usuario-empresa');
      showToast('Usuario actualizado', 'ok');
      renderUsuariosEmpresa();
    } catch (e) {
      showToast(e.message, 'err');
    }
  });
}

export function resetPasswordEmpresa(id) {
  const empresaId = empresaPropia();
  const u = (DB.usuarios || []).find((x) => String(x.id) === String(id) && String(x.empresaId) === String(empresaId));
  if (!u) return;

  ensureModal('modal-reset-pass-empresa', `
    <div class="modal-head"><h2>Resetear contraseña: ${esc(u.email)}</h2><button class="modal-close" onclick="cerrarModal('modal-reset-pass-empresa')">×</button></div>
    <form id="form-reset-pass-empresa">
      <div class="modal-body">
        <div class="form-grid">
          <div class="field full"><label>Nueva contraseña *</label><input type="password" name="password" required minlength="6" placeholder="Mínimo 6 caracteres" /></div>
        </div>
      </div>
      <div class="modal-foot">
        <button type="button" class="btn btn-secondary" onclick="cerrarModal('modal-reset-pass-empresa')">Cancelar</button>
        <button type="submit" class="btn btn-warning">Resetear</button>
      </div>
    </form>`, {});

  document.getElementById('form-reset-pass-empresa').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const datos = capturar(ev);
    if (datos.password.length < 6) { showToast('Mínimo 6 caracteres', 'err'); return; }

    try {
      const client = getClient();
      const { data, error } = await client.functions.invoke('gestionar-usuario', {
        body: { action: 'resetPassword', userId: id, password: datos.password },
      });
      if (error) throw new Error(error.context?.message || error.message);
      if (data?.error) throw new Error(data.error);

      cerrarModal('modal-reset-pass-empresa');
      showToast(`Contraseña actualizada para ${u.email}: ${datos.password}`, 'ok');
    } catch (e) {
      showToast(e.message, 'err');
    }
  });
}

export function toggleActivoUsuarioEmpresa(id) {
  const empresaId = empresaPropia();
  const u = (DB.usuarios || []).find((x) => String(x.id) === String(id) && String(x.empresaId) === String(empresaId));
  if (!u) return;
  const nuevoEstado = u.activo === false ? true : false;

  getClient().functions.invoke('gestionar-usuario', {
    body: { action: 'update', userId: id, activo: nuevoEstado },
  }).then(({ data, error }) => {
    if (error) throw new Error(error.context?.message || error.message);
    if (data?.error) throw new Error(data.error);
    u.activo = nuevoEstado;
    showToast(nuevoEstado ? 'Usuario activado' : 'Usuario desactivado', 'ok');
    renderUsuariosEmpresa();
  }).catch((e) => showToast(e.message, 'err'));
}

export function eliminarUsuarioEmpresa(id) {
  const empresaId = empresaPropia();
  const u = (DB.usuarios || []).find((x) => String(x.id) === String(id) && String(x.empresaId) === String(empresaId));
  if (!u) return;
  if (!confirm(`¿Eliminar permanentemente al usuario ${u.email}?`)) return;

  getClient().functions.invoke('gestionar-usuario', {
    body: { action: 'delete', userId: id },
  }).then(({ data, error }) => {
    if (error) throw new Error(error.context?.message || error.message);
    if (data?.error) throw new Error(data.error);

    const idx = DB.usuarios.findIndex((x) => String(x.id) === String(id));
    if (idx >= 0) DB.usuarios.splice(idx, 1);
    showToast('Usuario eliminado', 'ok');
    renderUsuariosEmpresa();
  }).catch((e) => showToast(e.message, 'err'));
}
