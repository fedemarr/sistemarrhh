// Navegación SPA: muestra/oculta div.screen, render dinámico desde screenConfig.

import { SCREEN_CONFIG, APP, PERFILES } from '../state.js';
import { getCurrentUser } from './auth.js';
import { esc } from './helpers.js';
import { ensureModal, cerrarModal, showToast } from './modal.js';
import { getGeminiKey, setGeminiKey, analizarConGemini } from './ai.js';
import { getClient } from './supabase.js';

export function navTo(key) {
  if (!SCREEN_CONFIG[key]) return;
  for (const k of Object.keys(SCREEN_CONFIG)) {
    const d = document.getElementById('screen-' + k);
    if (d) d.classList.remove('active');
  }
  let d = document.getElementById('screen-' + key);
  if (!d) {
    d = document.createElement('div');
    d.id = 'screen-' + key;
    d.className = 'screen';
    document.getElementById('screens').appendChild(d);
  }
  d.classList.add('active');
  const cfg = SCREEN_CONFIG[key];
  if (cfg?.render) cfg.render();
  actualizarMenu(key);
  actualizarTopbar(key);
}

function actualizarTopbar(key) {
  const cfg = SCREEN_CONFIG[key];
  const titulo = document.getElementById('topbar-title');
  const btnWrap = document.getElementById('topbar-btn');
  if (!titulo) return;
  titulo.textContent = cfg?.title || APP.nombre;
  const rolBadge = document.getElementById('topbar-rol');
  if (rolBadge) rolBadge.textContent = getCurrentUser()?.perfil || '';
  btnWrap.innerHTML = '';
  if (cfg?.btn && cfg?.fn) {
    const b = document.createElement('button');
    b.className = 'btn';
    b.textContent = cfg.btn;
    b.onclick = () => cfg.fn();
    btnWrap.appendChild(b);
  }
}

function actualizarMenu(key) {
  const u = getCurrentUser();
  const items = document.querySelectorAll('#sidebar .menu-item');
  items.forEach((i) => i.classList.toggle('active', i.dataset.key === key));
  document.querySelector('#sidebar .sidebar-user') &&
    (document.querySelector('#sidebar .sidebar-user').textContent = u ? `${u.nombre} (${u.perfil})` : '');
}

export function construirMenu() {
  const u = getCurrentUser();
  const sb = document.getElementById('sidebar');
  // El superadmin de la plataforma tiene su propio set fijo de módulos,
  // independiente de lo que diga PERFILES para su perfil (que también lo
  // usan los admins de cada empresa, que sí deben ver todo lo demás).
  const mods = u?.esSuperadmin
    ? ['empresas', 'usuarios_admin', 'dashboard_empresas', 'auditorias']
    : (u && PERFILES[u.perfil] ? PERFILES[u.perfil].modulos : []);
  const todas = Object.keys(SCREEN_CONFIG);
  // 'inicio' siempre visible: ningún PERFILES lo lista explícitamente.
  const habilitados = mods === '*' ? todas : todas.filter((k) => k === 'inicio' || (mods || []).includes(k));

  const grupos = [
    { label: 'Inicio', keys: ['inicio'] },
    { label: 'Selección e ingreso', keys: ['pedidos', 'candidatos', 'psicotecnico', 'preocupacional', 'documentacion', 'altas', 'legajos', 'reasignaciones'] },
    { label: 'Personal', keys: ['capacitaciones', 'vacaciones', 'descansos', 'competencia', 'sanciones', 'enfermos', 'legales', 'uniformes'] },
    { label: 'Liquidación', keys: ['categorias', 'smvm', 'liquidacion_horas', 'liq_admin', 'mantenimiento', 'retenes', 'liquidaciones', 'monotributos', 'retenciones', 'descuentos', 'paritarias', 'feriados'] },
    { label: 'Adelantos', keys: ['pedidos_adelantos', 'gestion_adelantos', 'mis_adelantos'] },
    { label: 'Transversales', keys: ['sugerencias', 'comunicaciones'] },
    ...(u?.esSuperadmin ? [{ label: 'Administración', keys: ['empresas', 'usuarios_admin', 'dashboard_empresas', 'auditorias'] }] : []),
    ...((u?.esSuperadmin || u?.perfil === 'RRHH' || u?.perfil === 'Administrador total') ? [{ label: 'Configuración', keys: ['config_form_postulacion', 'config_form_entrevista', 'usuarios_empresa'] }] : []),
  ];

  let html = '<div class="brand"><div class="logo">G</div><div>' + esc(APP.nombre) + '</div></div><div class="menu">';
  for (const g of grupos) {
    const keys = g.keys.filter((k) => habilitados.includes(k));
    if (!keys.length) continue;
    html += `<div class="menu-section">${g.label}</div>`;
    for (const k of keys) {
      html += `<button class="menu-item" data-key="${k}" onclick="navTo('${k}')">${esc(SCREEN_CONFIG[k]?.title || k)}</button>`;
    }
  }
  html += '</div>';
  html += `<div class="sidebar-foot"><div class="sidebar-user">${esc(u?.nombre || '')}</div>`;
  html += `<button class="btn btn-secondary btn-sm" style="width:100%;margin-bottom:6px" onclick="abrirCambiarPassword()">Cambiar contraseña</button>`;
  if (u && u.perfil === 'Administrador total') {
    html += `<button class="btn btn-secondary btn-sm" style="width:100%;margin-bottom:6px" onclick="abrirConfigIA()">Configuración IA</button>`;
  }
  html += `<button class="btn-logout" onclick="cerrarSesion()">Cerrar sesión</button></div>`;
  sb.innerHTML = html;
}

export function abrirConfigIA() {
  const key = getGeminiKey();
  ensureModal('modal-config-ia', `
    <div class="modal-head"><h2>Configuración IA — Gemini</h2><button class="modal-close" onclick="cerrarModal('modal-config-ia')">×</button></div>
    <div class="modal-body">
      <div class="form-grid">
        <div class="field full"><label>API Key de Google Gemini</label>
          <input type="password" id="config-ia-key" value="${esc(key)}" placeholder="AIzaSy..." />
        </div>
      </div>
      <p class="muted">Obtené tu key en <a href="https://aistudio.google.com/app/apikey" target="_blank">Google AI Studio</a>. Se guarda en el navegador (localStorage).</p>
    </div>
    <div class="modal-foot">
      <button type="button" class="btn btn-secondary" onclick="cerrarModal('modal-config-ia')">Cancelar</button>
      <button type="button" class="btn btn-warning" onclick="probarConfigIA()">Probar conexión</button>
      <button type="button" class="btn" onclick="guardarConfigIA()">Guardar</button>
    </div>
  `, {});
}

export function guardarConfigIA() {
  const val = document.getElementById('config-ia-key')?.value?.trim() || '';
  setGeminiKey(val);
  showToast('API key guardada', 'ok');
  cerrarModal('modal-config-ia');
}

export async function probarConfigIA() {
  const val = document.getElementById('config-ia-key')?.value?.trim() || '';
  if (!val) { showToast('Ingresá una API key', 'err'); return; }
  setGeminiKey(val);
  try {
    const res = await analizarConGemini('Respondé solo: OK');
    showToast('Conexión exitosa: ' + res.slice(0, 60), 'ok');
  } catch (e) { showToast('Error: ' + e.message, 'err'); }
}

export function abrirCambiarPassword() {
  ensureModal('modal-cambiar-pass', `
    <div class="modal-head"><h2>Cambiar contraseña</h2><button class="modal-close" onclick="cerrarModal('modal-cambiar-pass')">×</button></div>
    <form id="form-cambiar-pass">
      <div class="modal-body">
        <div class="form-grid">
          <div class="field full"><label>Nueva contraseña *</label><input type="password" name="nuevaPass" required minlength="6" placeholder="Mínimo 6 caracteres" /></div>
          <div class="field full"><label>Repetir contraseña *</label><input type="password" name="repetirPass" required minlength="6" /></div>
        </div>
      </div>
      <div class="modal-foot">
        <button type="button" class="btn btn-secondary" onclick="cerrarModal('modal-cambiar-pass')">Cancelar</button>
        <button type="submit" class="btn">Guardar</button>
      </div>
    </form>`, {});

  document.getElementById('form-cambiar-pass').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const pass = ev.target.elements.nuevaPass.value;
    const pass2 = ev.target.elements.repetirPass.value;
    if (pass !== pass2) { showToast('Las contraseñas no coinciden', 'err'); return; }
    if (pass.length < 6) { showToast('Mínimo 6 caracteres', 'err'); return; }

    const client = getClient();
    const { error } = await client.auth.updateUser({ password: pass });
    if (error) { showToast(error.message, 'err'); return; }
    showToast('Contraseña actualizada', 'ok');
    cerrarModal('modal-cambiar-pass');
  });
}
