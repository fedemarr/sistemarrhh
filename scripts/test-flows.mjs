// Tests de flujos con cliente Supabase fake (setClient).
// Cubre: login (Auth), sync de tablas, cálculo salarial, adelantos y competencia anual.

import assert from 'node:assert/strict';
import { setClient, _SM, _toSnakeRow, supaSync } from '../src/shared/supabase.js';
import { login } from '../src/shared/auth.js';
import { initDB, DB } from '../src/state.js';
import { calcularSalario, smvmDe, redondear2, periodoLabel } from '../src/modules/liquidacion/liqUtils.js';
import { totalDeuda, cuotaMensual as cuotaAdelanto, puedeAprobarFin } from '../src/modules/adelantos/adelantosShared.js';
import { registrarEvento, totalesPorAsociado, resultadoAnual } from '../src/modules/competencia/movimientos.js';
import { esc, fechaISOToDisplay, hoyISO } from '../src/shared/helpers.js';

let passed = 0;
const failed = [];

function test(nombre, fn) {
  try {
    fn();
    passed++;
    console.log(`ok   ${nombre}`);
  } catch (e) {
    failed.push(nombre);
    console.error(`FAIL ${nombre}\n     ${e.message}`);
  }
}

async function testAsync(nombre, fn) {
  try {
    await fn();
    passed++;
    console.log(`ok   ${nombre}`);
  } catch (e) {
    failed.push(nombre);
    console.error(`FAIL ${nombre}\n     ${e.message}`);
  }
}

const PASSWORDS = {
  'admin@rrhh.cliente.com': 'Admin123!',
  'asociado@rrhh.cliente.com': 'Asoc123!',
};
const USUARIOS_FAKE = [
  { id: '00000000-0000-0000-0000-000000000001', email: 'admin@rrhh.cliente.com', nombre: 'Admin', perfil: 'Administrador total', nro_socio: null, empresa_id: 'emp-1', es_superadmin: true },
  { id: '00000000-0000-0000-0000-000000000006', email: 'asociado@rrhh.cliente.com', nombre: 'Asociado', perfil: 'Asociado', nro_socio: '101', empresa_id: 'emp-1', es_superadmin: false },
];

const dbFake = new Map();

function makeFakeClient() {
  return {
    auth: {
      async signInWithPassword({ email, password }) {
        const u = USUARIOS_FAKE.find((x) => x.email === email);
        if (!u || PASSWORDS[email] !== password) return { data: { user: null }, error: new Error('Invalid login credentials') };
        return { data: { user: { id: u.id } }, error: null };
      },
      async signOut() { return { error: null }; },
      async getSession() { return { data: { session: null } }; },
    },
    from(table) {
      if (!dbFake.has(table)) dbFake.set(table, []);
      const store = dbFake.get(table);
      return {
        select() {
          return {
            eq(col, val) {
              return {
                maybeSingle: async () => {
                  const fila = store.find((r) => String(r[col]) === String(val)) || null;
                  return { data: fila, error: null };
                },
              };
            },
          };
        },
        async upsert(row) {
          const idx = store.findIndex((r) => String(r.id_local) === String(row.id_local));
          if (idx >= 0) store[idx] = row;
          else store.push(row);
          return { data: [row], error: null };
        },
        async insert(rows) {
          store.push(...rows);
          return { data: rows, error: null };
        },
        delete() {
          return { eq: async () => ({ data: null, error: null }) };
        },
      };
    },
  };
}

const fake = makeFakeClient();
setClient(fake);
initDB();
dbFake.set('usuarios', USUARIOS_FAKE.map((u) => ({ ...u })));

// 1. Login exitoso (Administrador total + superadmin multitenant)
await testAsync('login administrador', async () => {
  const u = await login({ email: 'admin@rrhh.cliente.com', password: 'Admin123!' });
  assert.equal(u.perfil, 'Administrador total');
  assert.equal(u.nombre, 'Admin');
  assert.equal(u.empresaId, 'emp-1');
  assert.equal(u.esSuperadmin, true);
});

// 2. Login con credenciales inválidas
await testAsync('login inválido', async () => {
  await assert.rejects(() => login({ email: 'admin@rrhh.cliente.com', password: 'mal' }), /Credenciales inválidas/);
});

// 3. Login Asociado y permisos de aprobación de adelantos
await testAsync('login asociado y permisos', async () => {
  const u = await login({ email: 'asociado@rrhh.cliente.com', password: 'Asoc123!' });
  assert.equal(u.perfil, 'Asociado');
  assert.equal(puedeAprobarFin(), false);
});

// 4. supaSync: mapeo snake_case + reflejo en DB + inyección de tenant
await testAsync('supaSync legajos (multitenant)', async () => {
  await login({ email: 'admin@rrhh.cliente.com', password: 'Admin123!' });
  const obj = { id: 'leg-test', nro: '999', nombre: 'Test', nroSocio: 999, horasEFT: 40, activo: true };
  await supaSync('legajos', obj);
  const fila = dbFake.get('legajos').find((r) => r.id_local === 'leg-test');
  assert.ok(fila, 'fila guardada');
  assert.equal(fila.nro_socio, 999, 'camelCase → snake_case');
  assert.equal(fila.horas_eft, 40, 'override por acrónimo');
  assert.equal(fila.id_local, 'leg-test', 'id → id_local');
  assert.equal(fila.empresa_id, 'emp-1', 'tenant inyectado por sesión');
  assert.equal(DB.legajos.some((l) => l.id === 'leg-test'), true, 'reflejo en DB');
});

// 5. Mapeo _toSnakeRow genérico
test('_toSnakeRow genérico', () => {
  const r = _toSnakeRow({ id: 'x1', nombreAsociado: 'A', infoEFT: 's' });
  assert.deepEqual(Object.keys(r).sort(), ['id_local', 'info_eft', 'nombre_asociado']);
});

// 6. Cálculo salarial (SMVM default 234315.12, Categoría 2 factor 1.05)
test('calcularSalario categoría 2', () => {
  const smvm = smvmDe(2026, 7);
  assert.equal(smvm, 234315.12);
  const sal = calcularSalario('Categoría 2', 2026, 7);
  assert.equal(redondear2(sal), 246030.88);
});

// 7. Adelantos: cuota y deuda
test('cuota y deuda adelantos', () => {
  assert.equal(cuotaAdelanto(120000, 12), 10000);
  DB.adelantos = [
    { id: 'a1', nroSocio: 101, monto: 50000, estado: 'Entregado' },
    { id: 'a2', nroSocio: 101, monto: 20000, estado: 'Rechazado por supervisor' },
    { id: 'a3', nroSocio: 102, monto: 30000, estado: 'Entregado' },
  ];
  assert.equal(totalDeuda(101), 50000);
  assert.equal(cuotaAdelanto(50000, 4), 12500);
});

// 8. Competencia anual: registrarEvento + totales + resultado
await testAsync('competencia anual puntos', async () => {
  await registrarEvento({ reglaCodigo: 'capacitacion_servicio', fecha: '2026-03-10', protagonista: 100, origenModulo: 'capacitaciones' });
  await registrarEvento({ reglaCodigo: 'sancion_grave', fecha: '2026-06-01', protagonista: 100, origenModulo: 'sanciones' });
  await registrarEvento({ reglaCodigo: 'capacitacion_servicio', fecha: '2025-12-01', protagonista: 100, origenModulo: 'capacitaciones' });
  const totales = totalesPorAsociado(2026);
  const socio = totales.find((t) => t.protagonista === 100);
  assert.equal(socio.puntos, 1, '5 - 4 = 1');
  const res = resultadoAnual(100, 2026);
  assert.equal(res.puntos, 1);
  assert.equal(res.conclusion, 'Desempeño insuficiente');
  assert.equal(totalesPorAsociado(2025).find((t) => t.protagonista === 100)?.puntos, 5, 'filtro por año');
});

// 9. Helpers compartidos
test('helpers esc/fechas', () => {
  assert.equal(esc('<b>&'), '&lt;b&gt;&amp;');
  assert.equal(fechaISOToDisplay('2026-08-15'), '15/08/2026');
  assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(hoyISO()));
});

// 10. Mapa _SM completo y consistente
test('mapa _SM cubre todas las claves de state.js', async () => {
  const { _KEYS } = await import('../src/state.js');
  const faltantes = _KEYS.filter((k) => !(k in _SM));
  assert.deepEqual(faltantes, []);
});

console.log(`\n${passed}/${passed + failed.length} tests OK.`);
if (failed.length) {
  console.error('Fallaron: ' + failed.join(', '));
  process.exit(1);
}
