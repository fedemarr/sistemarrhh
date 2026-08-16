// Seed de usuarios demo vía Admin API (service_role) + filas en public.usuarios.
// Uso: node scripts/seed-demo-users.mjs
// Requiere: VITE_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const env = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
const URL = (env.match(/VITE_SUPABASE_URL=(.+)/) || [])[1]?.trim();
const SVC = (env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/) || [])[1]?.trim();

if (!URL || !SVC) {
  console.error('Falta SUPABASE_SERVICE_ROLE_KEY en .env (o VITE_SUPABASE_URL).');
  process.exit(1);
}

const USERS = [
  { email: 'admin@rrhh.cliente.com', password: 'Admin123!', nombre: 'Administrador del sistema', perfil: 'Administrador total', nro_socio: null, es_superadmin: true },
  { email: 'rrhh@rrhh.cliente.com', password: 'Rrhh123!', nombre: 'Área de RRHH', perfil: 'RRHH', nro_socio: null, es_superadmin: false },
  { email: 'operaciones@rrhh.cliente.com', password: 'Oper123!', nombre: 'Gerente de Operaciones', perfil: 'Operaciones', nro_socio: null, es_superadmin: false },
  { email: 'finanzas@rrhh.cliente.com', password: 'Fin123!', nombre: 'Finanzas', perfil: 'Finanzas', nro_socio: null, es_superadmin: false },
  { email: 'supervisor@rrhh.cliente.com', password: 'Sup123!', nombre: 'Supervisor', perfil: 'Supervisor', nro_socio: '100', es_superadmin: false },
  { email: 'asociado@rrhh.cliente.com', password: 'Asoc123!', nombre: 'Asociado de prueba', perfil: 'Asociado', nro_socio: '101', es_superadmin: false },
];

async function createAuthUser(u) {
  const r = await fetch(`${URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SVC, Authorization: `Bearer ${SVC}` },
    body: JSON.stringify({ email: u.email, password: u.password, email_confirm: true }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`auth ${u.email}: ${r.status} ${JSON.stringify(j)}`);
  return j;
}

for (const u of USERS) {
  let id;
  const existing = await fetch(`${URL}/auth/v1/admin/users?email=${encodeURIComponent(u.email)}`, {
    headers: { apikey: SVC, Authorization: `Bearer ${SVC}` },
  }).then((r) => r.json());
  const found = (existing.users || []).find((x) => x.email === u.email);
  if (found) {
    id = found.id;
    console.log(`existe: ${u.email} -> ${id}`);
  } else {
    const created = await createAuthUser(u);
    id = created.id;
    console.log(`creado: ${u.email} -> ${id}`);
  }

  const body = {
    id,
    email: u.email,
    nombre: u.nombre,
    perfil: u.perfil,
    nro_socio: u.nro_socio,
    empresa_id: 'emp-1',
    es_superadmin: u.es_superadmin,
  };
  const rr = await fetch(`${URL}/rest/v1/usuarios?select=id`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SVC, Authorization: `Bearer ${SVC}`, Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify(body),
  });
  console.log(`usuarios ${u.email}: ${rr.status}`);
}

console.log('Seed demo users OK.');
