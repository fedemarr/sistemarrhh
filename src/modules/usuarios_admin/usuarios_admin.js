// Usuarios — gestión de usuarios por superadmin (CRUD vía Edge Function).

import { DB, PERFILES } from '../../state.js';
import { getClient, _toCamelRow } from '../../shared/supabase.js';
import { ensureModal, cerrarModal, showToast, capturar } from '../../shared/modal.js';
import { esc } from '../../shared/helpers.js';
import { esSuperadmin } from '../../shared/auth.js';

let empresaSeleccionada = null;

export function renderUsuariosAdmin() {
  const cont = document.getElementById('screen-usuarios_admin');
  if (!esSuperadmin()) {
    cont.innerHTML = '<div class="alert alert-warn">Acceso restringido: se requiere un usuario superadmin.</div>';
    return;
  }

  const empresas = DB.empresas || [];
  const empresaId = empresaSeleccionada || (empresas[0]?.id || null);
  empresaSeleccionada = empresaId;

  const usuarios = (DB.usuarios || []).filter((u) => {
    if (!empresaId) return false;
    return String(u.empresaId) === String(empresaId);
  });

  cont.innerHTML = `
    <div class="toolbar">
      <div class="field" style="margin:0">
        <label>Empresa</label>
        <select id="select-empresa-usuarios">
          ${empresas.map((e) => `<option value="${esc(e.id)}" ${String(e.id) === String(empresaId) ? 'selected' : ''}>${esc(e.nombre)}</option>`).join('')}
        </select>
      </div>
      <div class="spacer"></div>
      <button class="btn" onclick="abrirNuevoUsuario()">+ Nuevo usuario</button>
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
              <button class="btn btn-sm" onclick="editarUsuario('${esc(String(u.id))}')">Editar</button>
              <button class="btn btn-secondary btn-sm" onclick="resetPassword('${esc(String(u.id))}')">Reset pass</button>
              <button class="btn btn-${activo ? 'warning' : 'success'} btn-sm" onclick="toggleActivoUsuario('${esc(String(u.id))}')">${activo ? 'Desactivar' : 'Activar'}</button>
              <button class="btn btn-danger btn-sm" onclick="eliminarUsuario('${esc(String(u.id))}')">Eliminar</button>
            </td>
          </tr>`;
        }).join('') || '<tr><td colspan="5" class="empty">Sin usuarios para esta empresa.</td></tr>'}
      </tbody>
    </table></div>`;

  document.getElementById('select-empresa-usuarios').addEventListener('change', (ev) => {
    empresaSeleccionada = ev.target.value;
    renderUsuariosAdmin();
  });
}

export function abrirNuevoUsuario() {
  if (!esSuperadmin()) return;
  const empresaId = empresaSeleccionada;
  if (!empresaId) { showToast('Seleccioná una empresa primero', 'err'); return; }
  const empresa = (DB.empresas || []).find((e) => String(e.id) === String(empresaId));

  ensureModal('modal-nuevo-usuario', `
    <div class="modal-head"><h2>Nuevo usuario</h2><button class="modal-close" onclick="cerrarModal('modal-nuevo-usuario')">×</button></div>
    <form id="form-nuevo-usuario">
      <div class="modal-body">
        <div class="form-grid">
          <div class="field full"><label>Empresa</label><input readonly value="${esc(empresa?.nombre || '')}" /></div>
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
        <button type="button" class="btn btn-secondary" onclick="cerrarModal('modal-nuevo-usuario')">Cancelar</button>
        <button type="submit" class="btn">Crear usuario</button>
      </div>
    </form>`, { size: 'modal-lg' });

  document.getElementById('form-nuevo-usuario').addEventListener('submit', async (ev) => {
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
        body: { action: 'create', ...datos, empresaId },
      });
      if (error) throw new Error(error.context?.message || error.message);
      if (data?.error) throw new Error(data.error);

      cerrarModal('modal-nuevo-usuario');
      showToast(`Usuario creado: ${datos.email}`, 'ok');
      showToast(`Credenciales: ${datos.email} / ${datos.password}`, 'ok');

      // Refrescar usuarios desde DB
      const client2 = getClient();
      const { data: rows } = await client2.from('usuarios').select('*');
      if (rows) {
        DB.usuarios = rows.map(_toCamelRow);
      }
      renderUsuariosAdmin();
    } catch (e) {
      showToast(e.message, 'err');
    } finally {
      if (document.getElementById('form-nuevo-usuario')) {
        const b = document.getElementById('form-nuevo-usuario').querySelector('button[type=submit]');
        b.disabled = false;
        b.textContent = 'Crear usuario';
      }
    }
  });
}

export function editarUsuario(id) {
  const u = (DB.usuarios || []).find((x) => String(x.id) === String(id));
  if (!u || !esSuperadmin()) return;

  ensureModal('modal-editar-usuario', `
    <div class="modal-head"><h2>Editar: ${esc(u.nombre)}</h2><button class="modal-close" onclick="cerrarModal('modal-editar-usuario')">×</button></div>
    <form id="form-editar-usuario">
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
        <button type="button" class="btn btn-secondary" onclick="cerrarModal('modal-editar-usuario')">Cancelar</button>
        <button type="submit" class="btn">Guardar cambios</button>
      </div>
    </form>`, { size: 'modal-lg' });

  document.getElementById('form-editar-usuario').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const datos = capturar(ev);
    try {
      const client = getClient();
      const { data, error } = await client.functions.invoke('gestionar-usuario', {
        body: { action: 'update', userId: id, ...datos },
      });
      if (error) throw new Error(error.context?.message || error.message);
      if (data?.error) throw new Error(data.error);

      // Actualizar en memoria
      Object.assign(u, datos);
      cerrarModal('modal-editar-usuario');
      showToast('Usuario actualizado', 'ok');
      renderUsuariosAdmin();
    } catch (e) {
      showToast(e.message, 'err');
    }
  });
}

export function resetPassword(id) {
  const u = (DB.usuarios || []).find((x) => String(x.id) === String(id));
  if (!u || !esSuperadmin()) return;

  ensureModal('modal-reset-pass', `
    <div class="modal-head"><h2>Resetear contraseña: ${esc(u.email)}</h2><button class="modal-close" onclick="cerrarModal('modal-reset-pass')">×</button></div>
    <form id="form-reset-pass">
      <div class="modal-body">
        <div class="form-grid">
          <div class="field full"><label>Nueva contraseña *</label><input type="password" name="password" required minlength="6" placeholder="Mínimo 6 caracteres" /></div>
        </div>
      </div>
      <div class="modal-foot">
        <button type="button" class="btn btn-secondary" onclick="cerrarModal('modal-reset-pass')">Cancelar</button>
        <button type="submit" class="btn btn-warning">Resetear</button>
      </div>
    </form>`, {});

  document.getElementById('form-reset-pass').addEventListener('submit', async (ev) => {
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

      cerrarModal('modal-reset-pass');
      showToast(`Contraseña actualizada para ${u.email}: ${datos.password}`, 'ok');
    } catch (e) {
      showToast(e.message, 'err');
    }
  });
}

export function toggleActivoUsuario(id) {
  const u = (DB.usuarios || []).find((x) => String(x.id) === String(id));
  if (!u || !esSuperadmin()) return;
  const nuevoEstado = u.activo === false ? true : false;

  getClient().functions.invoke('gestionar-usuario', {
    body: { action: 'update', userId: id, activo: nuevoEstado },
  }).then(({ data, error }) => {
    if (error) throw new Error(error.context?.message || error.message);
    if (data?.error) throw new Error(data.error);
    u.activo = nuevoEstado;
    showToast(nuevoEstado ? 'Usuario activado' : 'Usuario desactivado', 'ok');
    renderUsuariosAdmin();
  }).catch((e) => showToast(e.message, 'err'));
}

export function eliminarUsuario(id) {
  const u = (DB.usuarios || []).find((x) => String(x.id) === String(id));
  if (!u || !esSuperadmin()) return;
  if (!confirm(`¿Eliminar permanentemente al usuario ${u.email}?`)) return;

  getClient().functions.invoke('gestionar-usuario', {
    body: { action: 'delete', userId: id },
  }).then(({ data, error }) => {
    if (error) throw new Error(error.context?.message || error.message);
    if (data?.error) throw new Error(data.error);

    // Quitar de memoria
    const idx = DB.usuarios.findIndex((x) => String(x.id) === String(id));
    if (idx >= 0) DB.usuarios.splice(idx, 1);
    showToast('Usuario eliminado', 'ok');
    renderUsuariosAdmin();
  }).catch((e) => showToast(e.message, 'err'));
}
