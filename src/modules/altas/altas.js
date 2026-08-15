// Altas de asociados — modal de 8 tabs, precarga desde psico→docum, crea legajo + nro de socio.
// Fuente de verdad: 01_Flujo_Ingreso.md §1.6.

import { DB } from '../../state.js';
import { supaSync } from '../../shared/supabase.js';
import { ensureModal, cerrarModal, showToast } from '../../shared/modal.js';
import { esc, hoyISO, esCbuValido, formatMoney, maxP1 } from '../../shared/helpers.js';
import { calcularFechaAltaObraSocialISO } from '../../shared/obraSocial.js';
import { getCurrentUser } from '../../shared/auth.js';

export const ALTA_TABS = 8;

const FUNCIONES = ['Operario', 'Operario especializado', 'Supervisor', 'Administrativo', 'Mantenimiento'];
const ZONAS = ['Oeste', 'Norte', 'Sur', 'Este', 'Centro'];
const PARTIDOS = ['Tres de Febrero', 'San Martín', 'Morón', 'La Matanza', 'Capital Federal', 'Otro'];
const LOCALIDADES = ['Caseros', 'San Martín', 'Morón', 'Ramos Mejía', 'Villa Urquiza', 'Otra'];
const SERVICIOS = ['Edificio Centro', 'Torre Norte', 'Parque Industrial', 'Oficinas Sur', 'Hospital Oeste'];
const TALLES_PRENDA = [
  ['chomba', 'Chomba'],
  ['grafa', 'Grafa'],
  ['buzo', 'Buzo'],
  ['campera', 'Campera'],
  ['gorra', 'Gorra'],
];
const BANCOS = ['Banco Provincia', 'Banco Nación', 'Santander', 'BBVA', 'Mercado Pago', 'Naranja X'];

export function getAltById(id) {
  return (DB.catAltPendientes || []).find((a) => String(a.id) === String(id));
}

function smvmVigente() {
  const list = (DB.smvm || []).slice().sort((a, b) => String(b.vigenciaDesde || '').localeCompare(String(a.vigenciaDesde || '')));
  return list[0] || null;
}

export function integracionSugerida() {
  const s = smvmVigente();
  return s ? Math.round((Number(s.valor || 0) * 0.05) * 100) / 100 : 0;
}

export function renderAltas() {
  const cont = document.getElementById('screen-altas');
  const lista = (DB.catAltPendientes || []).filter((c) => c.estado === 'Pendiente de alta');

  cont.innerHTML = `
    <div class="stats">
      <div class="stat"><div class="num">${lista.length}</div><div class="lbl">Pendientes de alta</div></div>
      <div class="stat"><div class="num">${(DB.legajos || []).filter((l) => l.estado === 'Activo').length}</div><div class="lbl">Asociados activos</div></div>
    </div>
    <div class="toolbar">
      <input type="text" id="altas-buscar" placeholder="Buscar por DNI / nombre…" oninput="filtrarAltas()" />
      <div class="spacer"></div>
      <button class="btn" onclick="abrirAltaVacia()">+ Alta manual</button>
    </div>
    <div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>DNI</th><th>Nombre</th><th>Origen</th><th>Psicotécnico</th><th>Acciones</th></tr></thead>
      <tbody>
        ${lista.length ? lista.map(filaAlta).join('') : '<tr><td colspan="5" class="empty">Sin altas pendientes. Aprobá un psicotécnico o la documentación para que aparezca el alta.</td></tr>'}
      </tbody>
    </table></div>`;
}

export function filtrarAltas() {
  const term = document.getElementById('altas-buscar')?.value || '';
  const cont = document.getElementById('screen-altas');
  const filas = [...cont.querySelectorAll('tbody tr')];
  filas.forEach((tr) => {
    tr.classList.toggle('hidden', !tr.textContent.toLowerCase().includes(term.toLowerCase()));
  });
}

export function poblarFiltrosColumnasAltas() { /* hook */ }

export function poblarSelectsAltas() { /* hook */ }

function filaAlta(a) {
  const psico = (DB.psicos || []).find((p) => String(p.id) === String(a.psicoId));
  return `<tr>
    <td>${esc(a.dni || '')}</td>
    <td>${esc(a.nombre || '')}</td>
    <td><span class="chip chip-azul">${esc(a.creadoDesde || '—')}</span></td>
    <td>${psico ? `<span class="chip chip-verde">Apto</span>` : '<span class="muted">—</span>'}</td>
    <td class="acciones">
      <button class="btn" onclick="abrirModalAlta('${esc(String(a.id))}')">Completar alta</button>
      <button class="btn btn-secondary btn-sm" onclick="rechazarAlta('${esc(String(a.id))}')">Baja</button>
    </td>
  </tr>`;
}

export function rechazarAlta(id) {
  const a = getAltById(id);
  if (!a) return;
  a.estado = 'Alta rechazada';
  supaSync('catAltPendientes', a)
    .then(() => { showToast('Alta rechazada', 'warn'); renderAltas(); })
    .catch((e) => showToast(e.message, 'err'));
}

export function abrirAltaVacia() {
  const a = {
    id: Date.now().toString(),
    dni: '',
    nombre: '',
    candidatoId: null,
    psicoId: null,
    estado: 'Pendiente de alta',
    creadoDesde: 'manual',
  };
  DB.catAltPendientes.push(a);
  supaSync('catAltPendientes', a).then(() => abrirModalAlta(a.id));
}

export function abrirModalAlta(id) {
  const a = getAltById(id);
  if (!a) return;
  const psico = a.psicoId ? (DB.psicos || []).find((p) => String(p.id) === String(a.psicoId)) : null;
  const integracion = integracionSugerida();

  ensureModal('modal-alta', `
    <div class="modal-head">
      <h2>Alta de asociado — ${esc(a.nombre || a.dni || 'nuevo')}</h2>
      <button class="modal-close" onclick="cerrarModal('modal-alta')">×</button>
    </div>
    <form id="form-alta">
      <div class="modal-body">
        <div class="tabs" id="alta-tabs"></div>
        <div id="alta-panel"></div>
        <div id="alta-polizas-wrap"></div>
      </div>
      <div class="modal-foot">
        <button type="button" class="btn btn-secondary" onclick="tabAltaAnterior()">← Anterior</button>
        <button type="button" class="btn" onclick="tabAltaSiguiente()">Siguiente →</button>
        <button type="submit" class="btn btn-success" id="alta-confirmar-btn">Confirmar alta</button>
      </div>
    </form>`, { size: 'modal-xl' });

  _altaActual = a;
  _tabAltaIdx = 0;
  a._polizas = a._polizas || (Array.isArray(a.polizas) ? a.polizas.slice() : [{ numero: '', compania: '', tipo: '' }]);
  document.getElementById('form-alta').addEventListener('submit', (ev) => {
    ev.preventDefault();
    confirmarAlta(a.id);
  });
  tabAlta(0);
}

let _altaActual = null;
let _tabAltaIdx = 0;

function leerTab(id) {
  const a = _altaActual;
  if (!a) return;
  if (id === 0) {
    a.identificacion = {
      nombre: vl('alta-nombre'), dni: vl('alta-dni'), cuit: vl('alta-cuit'), tel: vl('alta-tel'),
      mail: vl('alta-mail'), estadoCivil: vl('alta-estado-civil'), nac: vl('alta-nac'), genero: vl('alta-genero'),
      fecNac: vl('alta-fec-nac'), fechaIngreso: vl('alta-fec-ingreso'),
    };
  }
  if (id === 1) {
    a.domicilio = { direccion: vl('alta-direccion'), zona: vl('alta-zona'), localidad: vl('alta-localidad'), partido: vl('alta-partido'), codigoPostal: vl('alta-cp') };
  }
  if (id === 2) {
    a.operativo = {
      funcion: vl('alta-funcion'), servicio: vl('alta-servicio'), supervisor: vl('alta-supervisor'),
      periodoPrueba: vl('alta-periodo-prueba') || 6, categoria: vl('alta-categoria'),
    };
  }
  if (id === 3) {
    const talles = {};
    for (const [key] of TALLES_PRENDA) talles[key] = vl('alta-talle-' + key);
    a.uniforme = { ambo: vl('alta-ambo'), calzado: vl('alta-calzado'), tallesUniforme: talles };
  }
  if (id === 4) {
    a.capital = { integracion: vl('alta-integracion'), formaPago: vl('alta-forma-pago') };
  }
  if (id === 5) {
    a.seguros = {
      seguro: vl('alta-seguro'), obraSocial: vl('alta-obra-social'), obraSocialInicioTramite: vl('alta-obra-social-inicio'),
      polizas: a._polizas,
    };
  }
  if (id === 6) {
    a.cuentaBancaria = { banco: vl('alta-banco'), cbu: vl('alta-cbu') };
  }
}

function vl(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : '';
}

export function tabAlta(idx) {
  _tabAltaIdx = idx;
  const a = _altaActual;
  if (!a) return;
  const tabsHtml = [];
  const nombres = ['Identificación', 'Domicilio', 'Operativo', 'Uniforme', 'Capital', 'Seguros', 'Cuentas bancarias', 'Resumen'];
  for (let i = 0; i < ALTA_TABS; i++) {
    tabsHtml.push(`<button type="button" class="tab-btn ${i === idx ? 'active' : ''}" onclick="tabAlta(${i})">${nombres[i]}</button>`);
  }
  document.getElementById('alta-tabs').innerHTML = tabsHtml.join('');
  const panel = document.getElementById('alta-panel');

  const ident = a.identificacion || {};
  const dom = a.domicilio || {};
  const op = a.operativo || {};
  const uni = a.uniforme || {};
  const cap = a.capital || {};
  const seg = a.seguros || {};
  const cue = a.cuentaBancaria || {};
  const s = smvmVigente();

  if (idx === 0) {
    panel.innerHTML = `
      <div class="form-grid">
        <div class="field"><label>Apellido y nombre *</label><input id="alta-nombre" value="${esc(ident.nombre || a.nombre || '')}" required /></div>
        <div class="field"><label>DNI *</label><input id="alta-dni" value="${esc(ident.dni || a.dni || '')}" required inputmode="numeric" /></div>
        <div class="field"><label>CUIT</label><input id="alta-cuit" value="${esc(ident.cuit || '')}" /></div>
        <div class="field"><label>Teléfono</label><input id="alta-tel" value="${esc(ident.tel || '')}" /></div>
        <div class="field"><label>Email</label><input id="alta-mail" value="${esc(ident.mail || '')}" /></div>
        <div class="field"><label>Estado civil</label>
          <select id="alta-estado-civil"><option></option><option>Soltero/a</option><option>Casado/a</option><option>Divorciado/a</option><option>Viudo/a</option></select></div>
        <div class="field"><label>Nacionalidad</label><input id="alta-nac" value="${esc(ident.nac || '')}" /></div>
        <div class="field"><label>Género</label>
          <select id="alta-genero"><option></option><option>Femenino</option><option>Masculino</option><option>Otro</option></select></div>
        <div class="field"><label>Fecha de nacimiento</label><input type="date" id="alta-fec-nac" value="${esc(ident.fecNac || '')}" /></div>
        <div class="field"><label>Fecha de ingreso</label><input type="date" id="alta-fec-ingreso" value="${esc(ident.fechaIngreso || hoyISO())}" onchange="recalcularInicioObraSocial()" /></div>
      </div>
      <div class="grupo"><legend>Reingresante</legend>
        <label class="field checkbox"><input type="checkbox" id="alta-reingresante" onchange="toggleReingresante()" /> Es reingresante</label>
        <div id="alta-reingresante-wrap" class="hidden" style="margin-top:8px">
          <div class="form-grid">
            <div class="field"><label>N° de legajo anterior</label><input id="alta-legajo-anterior" inputmode="numeric" /></div>
            <div class="field"><label>Fecha de reincorporación</label><input type="date" id="alta-fec-reincorp" /></div>
          </div>
        </div>
      </div>`;
    if (ident.estadoCivil) document.getElementById('alta-estado-civil').value = ident.estadoCivil;
    if (ident.genero) document.getElementById('alta-genero').value = ident.genero;
  } else if (idx === 1) {
    panel.innerHTML = `
      <div class="form-grid">
        <div class="field full"><label>Dirección</label><input id="alta-direccion" value="${esc(dom.direccion || '')}" /></div>
        <div class="field"><label>Zona</label>
          <select id="alta-zona" onchange="onChangeZonaAlta()"><option value="">Seleccionar…</option>${ZONAS.map((z) => `<option ${dom.zona === z ? 'selected' : ''}>${z}</option>`).join('')}</select></div>
        <div class="field"><label>Partido</label>
          <select id="alta-partido" onchange="onChangePartidoAlta()"><option value="">Seleccionar…</option>${PARTIDOS.map((p) => `<option ${dom.partido === p ? 'selected' : ''}>${p}</option>`).join('')}</select></div>
        <div class="field"><label>Localidad</label>
          <select id="alta-localidad" onchange="onChangeLocalidadAlta()"><option value="">Seleccionar…</option>${LOCALIDADES.map((l) => `<option ${dom.localidad === l ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        <div class="field"><label>Código postal</label><input id="alta-cp" value="${esc(dom.codigoPostal || '')}" /></div>
      </div>`;
  } else if (idx === 2) {
    const reingresante = a.legajoAnteriorNro ? true : false;
    panel.innerHTML = `
      <div class="form-grid">
        <div class="field"><label>Función *</label>
          <select id="alta-funcion" required><option value="">Seleccionar…</option>${FUNCIONES.map((f) => `<option ${op.funcion === f ? 'selected' : ''}>${f}</option>`).join('')}</select></div>
        <div class="field"><label>Servicio *</label>
          <select id="alta-servicio" onchange="onChangeServicioAlta()"><option value="">Seleccionar…</option>${SERVICIOS.map((s2) => `<option ${op.servicio === s2 ? 'selected' : ''}>${s2}</option>`).join('')}</select></div>
        <div class="field"><label>Supervisor</label><input id="alta-supervisor" value="${esc(op.supervisor || '')}" /></div>
        <div class="field"><label>Período de prueba (meses)</label><input id="alta-periodo-prueba" type="number" min="0" value="${op.periodoPrueba || 6}" /></div>
        <div class="field"><label>Categoría</label><input id="alta-categoria" value="${esc(op.categoria || '')}" placeholder="Ej: Operario Limpieza C2" /></div>
      </div>`;
  } else if (idx === 3) {
    panel.innerHTML = `
      <div class="form-grid">
        <div class="field"><label>Ambo (talle)</label><input id="alta-ambo" value="${esc(uni.ambo || '')}" /></div>
        <div class="field"><label>Calzado (n°)</label><input id="alta-calzado" value="${esc(uni.calzado || '')}" /></div>
      </div>
      <div class="grupo"><legend>Talles de uniforme</legend>
        <div class="grid3">${TALLES_PRENDA.map(([key, label]) => `<div class="field"><label>${label}</label><input id="alta-talle-${key}" value="${esc((uni.tallesUniforme || {})[key] || '')}" placeholder="S/M/L/XL…" /></div>`).join('')}</div>
      </div>`;
  } else if (idx === 4) {
    panel.innerHTML = `
      <div class="alert alert-warn">Integración sugerida: 5% del SMVM vigente (${s ? formatMoney(s.valor) : 'sin SMVM cargado'}).</div>
      <div class="form-grid">
        <div class="field"><label>Integración *</label><input id="alta-integracion" type="number" step="0.01" value="${(cap.integracion ?? integracion) || ''}" required /></div>
        <div class="field"><label>Forma de pago</label>
          <select id="alta-forma-pago"><option></option><option>Contado</option><option>3 cuotas</option><option>6 cuotas</option><option>Descuento de haberes</option></select></div>
      </div>`;
    if (cap.formaPago) document.getElementById('alta-forma-pago').value = cap.formaPago;
  } else if (idx === 5) {
    panel.innerHTML = `
      <div class="form-grid">
        <div class="field"><label>Seguro</label><input id="alta-seguro" value="${esc(seg.seguro || '')}" placeholder="Ej: Sancor Seguros" /></div>
        <div class="field"><label>Obra social</label><input id="alta-obra-social" value="${esc(seg.obraSocial || '')}" placeholder="Ej: OSECAC" /></div>
        <div class="field"><label>Inicio trámite obra social</label><input type="date" id="alta-obra-social-inicio" value="${esc(seg.obraSocialInicioTramite || '')}" /></div>
        <div class="field"><label>Pólizas (duplicadas bloquean)</label></div>
      </div>
      <div id="polizas-lista"></div>
      <button type="button" class="btn btn-secondary btn-sm" onclick="agregarFilaPoliza()">+ Agregar póliza</button>`;
    renderPolizas();
  } else if (idx === 6) {
    panel.innerHTML = `
      <div class="form-grid">
        <div class="field"><label>Banco</label>
          <select id="alta-banco"><option value="">Seleccionar…</option>${BANCOS.map((b) => `<option ${cue.banco === b ? 'selected' : ''}>${b}</option>`).join('')}</select></div>
        <div class="field"><label>CBU (22 dígitos)</label><input id="alta-cbu" value="${esc(cue.cbu || '')}" inputmode="numeric" placeholder="0000000000000000000000" /></div>
      </div>
      <div class="alert alert-warn">El CBU debe tener exactamente 22 dígitos. Si no está cargado, NO bloquea el alta (solo avisa).</div>`;
  } else if (idx === 7) {
    const ident2 = a.identificacion || {};
    const op2 = a.operativo || {};
    const cap2 = a.capital || {};
    panel.innerHTML = `
      <h3>Resumen del alta</h3>
      <div class="grupo"><legend>Identificación</legend><p>${esc(ident2.nombre || a.nombre || '')} · DNI ${esc(ident2.dni || a.dni || '')} · CUIT ${esc(ident2.cuit || '—')} · ${esc(ident2.tel || '—')}</p></div>
      <div class="grupo"><legend>Operativo</legend><p>${esc(op2.funcion || '')} · ${esc(op2.servicio || '')} · Sup: ${esc(op2.supervisor || '—')} · Prueba: ${esc(String(op2.periodoPrueba || 6))} meses</p></div>
      <div class="grupo"><legend>Capital y seguros</legend>
        <p>Integración: ${esc(String(cap2.integracion ?? ''))} · ${esc((a.seguros?.obraSocial) || '—')} · Inicio OS: ${esc((a.seguros?.obraSocialInicioTramite) || '—')}</p>
        <p>Pólizas: ${(a._polizas || []).filter((p) => p.numero).map((p) => `${esc(p.numero)} ${esc(p.compania)}`).join(' · ') || '—'}</p>
      </div>
      <div class="grupo"><legend>Cuenta bancaria</legend><p>${esc((a.cuentaBancaria?.banco) || '—')} · CBU ${esc((a.cuentaBancaria?.cbu) || '—')}</p></div>
      <div class="alert alert-ok">Al confirmar se creará el legajo con el próximo n° de socio (máximo actual + 1) y se generará el borrador del kit de uniforme.</div>`;
  }
}

export function tabAltaSiguiente() {
  leerTab(_tabAltaIdx);
  if (_tabAltaIdx < ALTA_TABS - 1) tabAlta(_tabAltaIdx + 1);
  else confirmarAlta(_altaActual?.id);
}

export function tabAltaAnterior() {
  leerTab(_tabAltaIdx);
  if (_tabAltaIdx > 0) tabAlta(_tabAltaIdx - 1);
}

export function onChangeZonaAlta() { /* cascada de selects: no-op básico */ }
export function onChangePartidoAlta() { /* idem */ }
export function onChangeLocalidadAlta() { /* idem */ }
export function onChangeServicioAlta() {
  const serv = document.getElementById('alta-servicio')?.value;
  if (serv) {
    const sup = (DB.legajos || []).find((l) => l.estado === 'Activo' && l.servicio === serv && l.funcion === 'Supervisor');
    if (sup) {
      const el = document.getElementById('alta-supervisor');
      if (el && !el.value) el.value = sup.nombre || '';
    }
  }
}

export function toggleReingresante() {
  const check = document.getElementById('alta-reingresante');
  const wrap = document.getElementById('alta-reingresante-wrap');
  wrap.classList.toggle('hidden', !check.checked);
}

export function buscarLegajoReingresante() {
  const nro = document.getElementById('alta-legajo-anterior')?.value;
  const leg = (DB.legajos || []).find((l) => l.estado === 'Baja' && String(l.nro) === String(nro));
  if (leg) {
    _altaActual._legajoAnteriorEncontrado = leg;
    showToast(`Legajo anterior encontrado: ${leg.nombre}`, 'ok');
  } else {
    _altaActual._legajoAnteriorEncontrado = null;
    showToast('No se encontró un legajo de baja con ese n°', 'warn');
  }
}

export function renderPolizas() {
  const wrap = document.getElementById('polizas-lista');
  if (!wrap || !_altaActual) return;
  const polizas = _altaActual._polizas || [];
  wrap.innerHTML = polizas
    .map(
      (p, i) => `
    <div class="form-grid" style="margin-bottom:8px;align-items:end">
      <div class="field"><label>N° de póliza</label><input id="poliza-num-${i}" value="${esc(p.numero || '')}" /></div>
      <div class="field"><label>Compañía</label><input id="poliza-cia-${i}" value="${esc(p.compania || '')}" /></div>
      <div class="field"><label>Tipo</label><input id="poliza-tipo-${i}" value="${esc(p.tipo || '')}" placeholder="ART / Vida / RC" /></div>
      <button type="button" class="btn btn-danger btn-sm" onclick="eliminarFilaPoliza(${i})">Quitar</button>
    </div>`
    )
    .join('');
}

export function agregarFilaPoliza() {
  leerPolizas();
  _altaActual._polizas.push({ numero: '', compania: '', tipo: '' });
  renderPolizas();
}

export function eliminarFilaPoliza(i) {
  leerPolizas();
  _altaActual._polizas.splice(i, 1);
  renderPolizas();
}

export function leerPolizas() {
  if (!_altaActual) return;
  const polizas = _altaActual._polizas || [];
  for (let i = 0; i < polizas.length; i++) {
    polizas[i].numero = document.getElementById('poliza-num-' + i)?.value || '';
    polizas[i].compania = document.getElementById('poliza-cia-' + i)?.value || '';
    polizas[i].tipo = document.getElementById('poliza-tipo-' + i)?.value || '';
  }
}

export function recalcularInicioObraSocial() {
  const fec = document.getElementById('alta-fec-ingreso')?.value;
  if (!fec) return;
  const inicio = calcularFechaAltaObraSocialISO(fec, 3);
  const el = document.getElementById('alta-obra-social-inicio');
  if (el && !el.value) el.value = inicio;
  return inicio;
}

function validarTabs(a) {
  const ident = a.identificacion || {};
  const op = a.operativo || {};
  const cap = a.capital || {};
  if (!ident.nombre || !ident.dni) return { ok: false, tab: 0, msg: 'Completá Identificación (nombre y DNI obligatorios).' };
  if (!op.funcion) return { ok: false, tab: 2, msg: 'Completá la Función en Operativo.' };
  if (cap.integracion === undefined || cap.integracion === null || cap.integracion === '') return { ok: false, tab: 4, msg: 'Completá la Integración en Capital.' };
  return { ok: true };
}

export function confirmarAlta(id) {
  const a = getAltById(id);
  if (!a) return;

  // Asegurar lectura de todos los tabs
  for (let i = 0; i < ALTA_TABS; i++) {
    if (i !== _tabAltaIdx) { _tabAltaIdx = i; leerTab(i); }
  }
  _tabAltaIdx = 0;
  leerTab(0);
  leerPolizas();
  a.polizas = a._polizas;

  const valid = validarTabs(a);
  if (!valid.ok) { showToast(valid.msg, 'err'); tabAlta(valid.tab); return; }

  const ident = a.identificacion || {};
  const op = a.operativo || {};
  const uni = a.uniforme || {};
  const cap = a.capital || {};
  const seg = a.seguros || {};
  const cue = a.cuentaBancaria || {};

  // Pólizas duplicadas → bloquean en tab 5
  const nums = (a.polizas || []).map((p) => (p.numero || '').trim()).filter(Boolean);
  if (new Set(nums).size !== nums.length) {
    showToast('Hay pólizas duplicadas (mismo N°). Corregilas en Seguros.', 'err');
    tabAlta(5);
    return;
  }

  // CBU: 22 dígitos si está cargado; faltante NO bloquea (avisa)
  let cbuMsg = '';
  if (cue.cbu) {
    if (!esCbuValido(cue.cbu)) {
      showToast('El CBU debe tener exactamente 22 dígitos numéricos.', 'err');
      tabAlta(6);
      return;
    }
  } else {
    cbuMsg = ' (sin CBU — recordá cargarlo)';
  }

  // Guard de DNI duplicado
  const dni = ident.dni;
  const legActivo = (DB.legajos || []).find((l) => l.estado === 'Activo' && String(l.dni) === String(dni));
  if (legActivo) { showToast(`Ya existe un asociado Activo con DNI ${dni} (legajo N° ${legActivo.nro}).`, 'err'); return; }
  const legBaja = (DB.legajos || []).find((l) => l.estado === 'Baja' && String(l.dni) === String(dni));
  const reingreso = a._legajoAnteriorEncontrado || (document.getElementById('alta-reingresante')?.checked && document.getElementById('alta-legajo-anterior')?.value);
  if (legBaja && !reingreso) { showToast(`Existe un legajo de BAJA con DNI ${dni}. Usá el flujo de reingresante para reincorporarlo.`, 'err'); return; }

  // Nro de socio: max + 1
  const nro = maxP1(DB.legajos, 'nro');
  const fechaIngresoISO = ident.fechaIngreso || hoyISO();
  const legajo = {
    id: String(nro),
    nro,
    nombre: ident.nombre,
    dni,
    cuit: ident.cuit,
    funcion: op.funcion,
    servicio: op.servicio,
    supervisor: op.supervisor,
    sector: op.funcion === 'Administrativo' ? 'Administrativo' : 'Operativo',
    ingreso: fechaIngresoISO,
    estado: 'Activo',
    estadoLegal: '',
    estadoMedico: '',
    fechaBaja: '',
    fechaReincorp: reingreso ? (document.getElementById('alta-fec-reincorp')?.value || '') : '',
    legajoAnteriorNro: reingreso ? (document.getElementById('alta-legajo-anterior')?.value || '') : '',
    seguro: seg.seguro || '',
    localidad: a.domicilio?.localidad || '',
    partido: a.domicilio?.partido || '',
    codigoPostal: a.domicilio?.codigoPostal || '',
    tel: ident.tel || '',
    mail: ident.mail || '',
    direccion: a.domicilio?.direccion || '',
    zona: a.domicilio?.zona || '',
    fecNac: ident.fecNac || '',
    estadoCivil: ident.estadoCivil || '',
    nac: ident.nac || '',
    genero: ident.genero || '',
    banco: cue.banco || '',
    cbu: cue.cbu || '',
    calzado: uni.calzado || '',
    ambo: uni.ambo || '',
    tallesUniforme: uni.tallesUniforme || {},
    periodoPrueba: Number(op.periodoPrueba) || 6,
    fechaIngresoPrueba: fechaIngresoISO,
    categoria: op.categoria || '',
    obraSocial: seg.obraSocial || '',
    obraSocialInicioTramite: seg.obraSocialInicioTramite || calcularFechaAltaObraSocialISO(fechaIngresoISO, 3),
    formaPago: cap.formaPago || '',
    integracion: Number(cap.integracion) || 0,
    polizas: a.polizas || [],
    cuit: ident.cuit,
  };
  DB.legajos.push(legajo);

  const tareas = [supaSync('legajos', legajo)];

  // Psico → estado 'Ingreso'
  if (a.psicoId) {
    const psico = (DB.psicos || []).find((p) => String(p.id) === String(a.psicoId));
    if (psico) {
      psico.estado = 'Ingreso';
      tareas.push(supaSync('psicos', psico));
    }
  }

  // catAltPendientes → 'Alta completada' + copia histórica por tab
  a.estado = 'Alta completada';
  a.copia = {
    identificacion: ident,
    domicilio: a.domicilio || {},
    operativo: op,
    uniforme: uni,
    capital: cap,
    seguros: seg,
    cuentaBancaria: cue,
  };
  tareas.push(supaSync('catAltPendientes', a));

  // Uniforme: kit inicial (borrador)
  if (window.crearEntregaUniformeDesdeAlta) {
    try { window.crearEntregaUniformeDesdeAlta(legajo); } catch { /* no bloquea */ }
  }

  Promise.all(tareas)
    .then(() => {
      showToast(`Alta completada — asociado N° ${nro}${cbuMsg}`, 'ok');
      cerrarModal('modal-alta');
      renderAltas();
    })
    .catch((e) => {
      showToast('Error al confirmar el alta: ' + e.message, 'err');
      const idx = DB.legajos.indexOf(legajo);
      if (idx >= 0) DB.legajos.splice(idx, 1);
    });
}
