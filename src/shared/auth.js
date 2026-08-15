// Autenticación con Supabase Auth (NO texto plano).
// Los perfiles se resuelven desde la tabla `usuarios` (id = auth.uid()).
// Multitenant: cada usuario pertenece a una empresa (empresa_id).

import { getClient } from './supabase.js';
import { PERFILES, SESSION } from '../state.js';

export function getCurrentUser() {
  return SESSION.currentUser;
}

export function puede(modulo) {
  const u = SESSION.currentUser;
  if (!u) return false;
  const perfil = PERFILES[u.perfil];
  if (!perfil) return false;
  return perfil.modulos === '*' || (perfil.modulos || []).includes(modulo);
}

export function esRol(...roles) {
  const u = SESSION.currentUser;
  return u && roles.includes(u.perfil);
}

export function esSuperadmin() {
  return Boolean(SESSION.currentUser?.esSuperadmin);
}

export function setCurrentUser(u) {
  SESSION.currentUser = u;
  return u;
}

export function login({ email, password }) {
  const client = getClient();
  return client.auth.signInWithPassword({ email, password }).then(({ data, error }) => {
    if (error) throw new Error(msjError(error, email));
    const user = data.user;
    return client.from('usuarios').select('*').eq('id', user.id).maybeSingle().then(({ data: fila, error: err2 }) => {
      if (err2) throw new Error('Error consultando el perfil del usuario: ' + err2.message);
      if (!fila) throw new Error('El usuario no tiene perfil asignado en la tabla usuarios.');
      return setCurrentUser(usuarioDesdeFila(user.id, fila));
    });
  });
}

function usuarioDesdeFila(id, fila) {
  return {
    id,
    email: fila.email,
    nombre: fila.nombre,
    perfil: fila.perfil,
    nroSocio: fila.nro_socio || null,
    empresaId: fila.empresa_id || null,
    esSuperadmin: Boolean(fila.es_superadmin),
  };
}

// Restaura currentUser a partir de una sesión activa de Supabase Auth (recarga).
export async function restaurarDesdeSesion() {
  const client = getClient();
  const { data } = await client.auth.getSession();
  if (!data?.session?.user) return null;
  const user = data.session.user;
  const { data: fila } = await client.from('usuarios').select('*').eq('id', user.id).maybeSingle();
  if (!fila) return null;
  return setCurrentUser(usuarioDesdeFila(user.id, fila));
}

export async function logout() {
  const client = getClient();
  await client.auth.signOut().catch(() => {});
  SESSION.currentUser = null;
}

export function iniciarSesion(email, password) {
  return login({ email, password });
}

export function msjError(err, email) {
  const msg = err?.message || String(err || '');
  if (/Invalid login credentials/i.test(msg)) return 'Credenciales inválidas. Verificá email y contraseña.';
  if (/Email not confirmed/i.test(msg)) return `El email ${email} no está confirmado. Verificá tu casilla de correo.`;
  return msg;
}
