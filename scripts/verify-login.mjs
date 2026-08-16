import fs from 'node:fs';

const env = fs.readFileSync('.env', 'utf8');
const URL = env.match(/VITE_SUPABASE_URL=(.+)/)?.[1]?.trim();
const ANON = env.match(/VITE_SUPABASE_ANON_KEY=(.+)/)?.[1]?.trim();

const l = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', apikey: ANON },
  body: JSON.stringify({ email: 'admin@rrhh.cliente.com', password: 'Admin123!' }),
});
console.log('login admin:', l.status);
const j = await l.json();
if (l.status !== 200) { console.log(JSON.stringify(j).slice(0, 300)); process.exit(1); }
console.log('access_token OK (prefix):', j.access_token.slice(0, 30));

const q = await fetch(`${URL}/rest/v1/empresas?select=id,nombre,activa`, {
  headers: { apikey: ANON, Authorization: `Bearer ${j.access_token}` },
});
console.log('empresas (RLS):', q.status, await q.text());

const p = await fetch(`${URL}/rest/v1/usuarios?select=id,email,perfil,empresa_id,es_superadmin`, {
  headers: { apikey: ANON, Authorization: `Bearer ${j.access_token}` },
});
console.log('mi usuario (RLS):', p.status, await p.text());

const t = await fetch(`${URL}/auth/v1/user`, { headers: { apikey: ANON, Authorization: `Bearer ${j.access_token}` } });
console.log('getUser:', t.status, JSON.stringify((await t.json())).slice(0, 150));
