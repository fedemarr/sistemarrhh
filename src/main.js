// Punto de entrada: boot, login (Supabase Auth), registro de screens y callbacks.

import { initDB, APP, registerScreens, PERFILES, DB } from './state.js';
import { hayConfigSupabase, supaInit } from './shared/supabase.js';
import { login, logout, getCurrentUser, restaurarDesdeSesion } from './shared/auth.js';
import { navTo, construirMenu, abrirCambiarPassword } from './shared/nav.js';
import { showToast, cerrarModal, ensureModal, capturar } from './shared/modal.js';
import { esc } from './shared/helpers.js';
import { moduleScreenConfigs } from './modules/index.js';
import { notificacionesPara } from './shared/notificaciones.js';
import { verAdjunto } from './shared/adjuntos.js';

initDB();
registerScreens(moduleScreenConfigs);

window.navTo = navTo;
window.cerrarModal = cerrarModal;
window.ensureModal = ensureModal;
window.showToast = showToast;
window.capturar = capturar;
window.verAdjunto = async (archivo) => { try { await verAdjunto(archivo); } catch (e) { showToast(e.message, 'err'); } };
window.cerrarSesion = async () => {
  await logout();
  mostrarLogin();
};
window.abrirCambiarPassword = abrirCambiarPassword;

const CREDENCIALES_DEMO = [
  ['admin@rrhh.cliente.com', 'Admin123!', 'Administrador total'],
  ['rrhh@rrhh.cliente.com', 'Rrhh123!', 'RRHH'],
  ['operaciones@rrhh.cliente.com', 'Oper123!', 'Operaciones'],
  ['finanzas@rrhh.cliente.com', 'Fin123!', 'Finanzas'],
  ['supervisor@rrhh.cliente.com', 'Sup123!', 'Supervisor'],
  ['asociado@rrhh.cliente.com', 'Asoc123!', 'Asociado'],
];

export function mostrarLogin() {
  const screenLogin = document.getElementById('screen-login');
  const layout = document.getElementById('layout');
  screenLogin.classList.remove('hidden');
  layout.classList.add('hidden');
  screenLogin.innerHTML = `
    <div class="login-card">
      <div class="logo">R</div>
      <h1>${esc(APP.nombre)}</h1>
      <p class="sub">${esc(APP.subnombre)}</p>
      <form id="form-login">
        <div class="login-err" id="login-err"></div>
        <div class="field">
          <label>Email</label>
          <input type="email" id="login-email" required autocomplete="username" placeholder="usuario@rrhh.cliente.com" />
        </div>
        <div class="field">
          <label>Contraseña</label>
          <input type="password" id="login-pass" required autocomplete="current-password" />
        </div>
        <button type="submit" class="btn">Ingresar</button>
      </form>
      <details class="login-hint">
        <summary>Credenciales de prueba</summary>
        ${CREDENCIALES_DEMO.map(([e, p, r]) => `<div><code>${e}</code> · ${r}</div>`).join('')}
      </details>
    </div>`;
  document.getElementById('form-login').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const err = document.getElementById('login-err');
    err.textContent = '';
    const btn = ev.target.querySelector('button');
    btn.disabled = true;
    btn.textContent = 'Ingresando…';
    try {
      await login({
        email: document.getElementById('login-email').value.trim(),
        password: document.getElementById('login-pass').value,
      });
      await entrarAlSistema();
    } catch (e) {
      err.textContent = e.message;
    } finally {
      btn.disabled = false;
      btn.textContent = 'Ingresar';
    }
  });
}

export async function entrarAlSistema() {
  const screenLogin = document.getElementById('screen-login');
  const layout = document.getElementById('layout');
  const cfg = document.getElementById('screen-config');
  screenLogin.classList.add('hidden');
  cfg.classList.add('hidden');
  layout.classList.remove('hidden');
  await supaInit();
  construirMenu();
  navTo('inicio');
  showToast(`Bienvenido/a ${getCurrentUser()?.nombre}`, 'ok');
}

function mostrarConfigFaltante() {
  const cfg = document.getElementById('screen-config');
  cfg.classList.remove('hidden');
  cfg.innerHTML = `
    <div class="config-card">
      <h2>Configuración de Supabase requerida</h2>
      <p>Este sistema usa Supabase (PostgreSQL + Auth + Storage). Creá un proyecto en
      <a href="https://supabase.com" target="_blank" rel="noopener">supabase.com</a>, ejecutá
      el SQL de <code>supabase/schema.sql</code> (SQL Editor) y luego:</p>
      <ol>
        <li>Copiá <code>.env.example</code> a <code>.env</code></li>
        <li>Completá <code>VITE_SUPABASE_URL</code> y <code>VITE_SUPABASE_ANON_KEY</code></li>
        <li>Reiniciá <code>npm run dev</code></li>
      </ol>
      <pre>VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...  (Settings → API)</pre>
    </div>`;
}

export async function restaurarSesion() {
  if (!hayConfigSupabase()) { mostrarConfigFaltante(); return; }
  try {
    await restaurarDesdeSesion();
  } catch {
    /* sin sesión previa */
  }
  if (getCurrentUser()) await entrarAlSistema();
  else mostrarLogin();
}

export function screenInicio() {
  const u = getCurrentUser();
  const notis = notificacionesPara(u?.nombre).slice(0, 6);
  const totales = {
    pendientes: (DB.candidatos || []).filter((c) => c.estado === 'Sin citar' || c.estado === 'Citado').length,
    altas: (DB.catAltPendientes || []).filter((c) => c.estado === 'Pendiente de alta').length,
    legajosActivos: (DB.legajos || []).filter((l) => l.estado === 'Activo').length,
    adelantos: (DB.adelantos || []).filter((a) => ['Enviado', 'En proceso', 'Aprobado'].includes(a.estado)).length,
    sugerencias: (DB.sugerencias || []).filter((s) => s.estado === 'Nueva').length,
  };
  return `
    <div class="stats">
      <div class="stat"><div class="num">${totales.pendientes}</div><div class="lbl">Candidatos por gestionar</div></div>
      <div class="stat"><div class="num">${totales.altas}</div><div class="lbl">Altas pendientes</div></div>
      <div class="stat"><div class="num">${totales.legajosActivos}</div><div class="lbl">Asociados activos</div></div>
      <div class="stat"><div class="num">${totales.adelantos}</div><div class="lbl">Adelantos pendientes</div></div>
      <div class="stat"><div class="num">${totales.sugerencias}</div><div class="lbl">Sugerencias sin leer</div></div>
    </div>
    <div class="card">
      <h3>Notificaciones</h3>
      ${notis.length ? `<ul class="timeline">${notis.map((n) => `<li><strong>${esc(n.tipo.replace(/_/g, ' '))}</strong> — ${esc(n.mensaje)}<div class="muted">${esc(n.fecha || '')}</div></li>`).join('')}</ul>` : '<div class="empty">Sin notificaciones.</div>'}
    </div>`;
}

const inicioScreenConfig = {
  inicio: { title: 'Inicio', btn: '', fn: null, render: () => { document.getElementById('screen-inicio').innerHTML = screenInicio(); } },
};
registerScreens([inicioScreenConfig]);

window.addEventListener('DOMContentLoaded', () => restaurarSesion());
