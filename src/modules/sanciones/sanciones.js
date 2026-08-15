// Sanciones — leves/graves con descuentos derivados; 2ª grave → baja del asociado.
// Fuente de verdad: 02_Gestion_Personal.md §2.5.

import { DB } from '../../state.js';
import { supaSync } from '../../shared/supabase.js';
import { ensureModal, cerrarModal, showToast, capturar } from '../../shared/modal.js';
import { esc, hoyISO, fechaISOToDisplay } from '../../shared/helpers.js';
import { getCurrentUser } from '../../shared/auth.js';

export function getSancionById(id) {
  return (DB.sanciones || []).find((s) => String(s.id) === String(id));
}

export function sancionesVigentesDe(nro) {
  return (DB.sanciones || []).filter((s) => s.estado === 'Vigente' && String(s.nroSocio) === String(nro) && s.tipo !== 'Proveedor');
}

export function cantSanciones(nro) {
  return sancionesVigentesDe(nro).length;
}

export function leyendaSanciones(nro) {
  const n = cantSanciones(nro);
  if (n <= 0) return '';
  return n === 1 ? '1 sancionado' : `${n} sanciones`;
}

export function renderSancionesInicial(tab = 'asociados') {
  const cont = document.getElementById('screen-sanciones');
  cont.innerHTML = `
    <div class="stats">
      <div class="stat"><div class="num">${(DB.sanciones || []).filter((s) => s.estado === 'Vigente' && s.tipo !== 'Proveedor').length}</div><div class="lbl">Sanciones a asociados</div></div>
      <div class="stat"><div class="num">${(DB.sanciones || []).filter((s) => s.estado === 'Vigente' && s.tipo === 'Proveedor').length}</div><div class="lbl">Sanciones a proveedores</div></div>
    </div>
    <div class="tabs">
      ${[['asociados', 'Asociados'], ['proveedores', 'Proveedores'], ['historial', 'Historial']]
        .map(([k, l]) => `<button class="tab-btn ${tab === k ? 'active' : ''}" onclick="renderSancionesInicial('${k}')">${l}</button>`).join('')}
    </div>
    <div class="toolbar">
      <input type="text" id="buscar-sancion" placeholder="Buscar…" oninput="filtrarSanciones()" />
      <div class="spacer"></div>
      <button class="btn" onclick="abrirNuevaSancion()">+ Nueva sanción</button>
    </div>
    <div id="sancion-contenido"></div>`;
  const panel = document.getElementById('sancion-contenido');
  const esProveedor = tab === 'proveedores';
  const lista = (DB.sanciones || []).filter((s) => (s.tipo === 'Proveedor') === esProveedor && (tab === 'historial' ? true : s.estado === 'Vigente'));
  panel.innerHTML = tablaSanciones(lista, esProveedor);
}

export function renderSancionesInterno(tab) {
  renderSancionesInicial(tab);
}

export function tabSanciones(tab) {
  renderSancionesInicial(tab);
}

export function filtrarSanciones() {
  const term = document.getElementById('buscar-sancion')?.value.toLowerCase() || '';
  document.querySelectorAll('#sancion-contenido tbody tr').forEach((tr) => tr.classList.toggle('hidden', !tr.textContent.toLowerCase().includes(term)));
}

function chipSancion(s) {
  const cls = s.estado === 'Cumplida' ? 'chip-verde' : s.estado === 'Anulada' ? 'chip-gris' : s.gravedad === 'Grave' ? 'chip-rojo' : 'chip-naranja';
  return `<span class="chip ${cls}">${esc(s.estado === 'Vigente' ? s.gravedad || 'Leve' : s.estado)}</span>`;
}

function tablaSanciones(lista, esProveedor) {
  if (!lista.length) return '<div class="empty">Sin sanciones.</div>';
  return `<div class="tbl-wrap"><table class="tbl">
    <thead><tr><th>N°</th><th>${esProveedor ? 'Proveedor' : 'Asociado'}</th><th>Fecha</th><th>Motivo</th><th>Gravedad</th><th>Descuento</th><th>Acciones</th></tr></thead>
    <tbody>${lista.map((s) => {
      const desc = (DB.descuentos || []).find((d) => String(d.id) === String(s.descuentoId));
      let acciones = `<button class="btn btn-secondary btn-sm" onclick="verSancion('${esc(String(s.id))}')">Ver</button>`;
      if (s.estado === 'Vigente') {
        acciones += `<button class="btn btn-secondary btn-sm" onclick="abrirEditarSancionPorId('${esc(String(s.id))}')">Editar</button>`;
        acciones += `<button class="btn btn-success btn-sm" onclick="marcarCumplidaSancion('${esc(String(s.id))}')">Cumplida</button>`;
        acciones += `<button class="btn btn-danger btn-sm" onclick="anularSancionPorId('${esc(String(s.id))}')">Anular</button>`;
      }
      return `<tr>
        <td>${esc(String(s.nroSocio || ''))}</td>
        <td>${esc(s.nombreAsociado || '')}</td>
        <td>${esc(fechaISOToDisplay(s.fecha))}</td>
        <td>${esc(s.motivo || '')}</td>
        <td>${chipSancion(s)}</td>
        <td>${desc ? `${esc(desc.nombre || '')} $${desc.monto || 0}` : '—'}</td>
        <td class="acciones">${acciones}</td>
      </tr>`;
    }).join('')}
    </tbody></table></div>`;
}

export function verSancion(id) {
  const s = getSancionById(id);
  if (!s) return;
  const desc = (DB.descuentos || []).find((d) => String(d.id) === String(s.descuentoId));
  ensureModal('modal-sancion-ver', `
    <div class="modal-head"><h2>Sanción — ${esc(s.nombreAsociado || '')}</h2><button class="modal-close" onclick="cerrarModal('modal-sancion-ver')">×</button></div>
    <div class="modal-body">
      <div class="grid3">
        ${[['N°', s.nroSocio], ['Tipo', s.tipo], ['Fecha', s.fecha ? fechaISOToDisplay(s.fecha) : ''], ['Motivo', s.motivo], ['Detalle', s.detalleMotivo], ['Gravedad', s.gravedad], ['Estado', s.estado], ['Sancionado por', s.sancionadoPor], ['Descuento', desc ? `${desc.nombre} $${desc.monto}` : '—'], ['Leyenda legajo', s.tipo !== 'Proveedor' ? leyendaSanciones(s.nroSocio) : '—']]
          .map(([k, val]) => `<div><strong>${k}:</strong><br/>${esc(val === null || val === undefined || val === '' ? '—' : String(val))}</div>`).join('')}
      </div>
    </div>
    <div class="modal-foot"><button class="btn btn-secondary" onclick="cerrarModal('modal-sancion-ver')">Cerrar</button></div>
  `, {});
}

export function abrirNuevaSancion() {
  ensureModal('modal-sancion', `
    <div class="modal-head"><h2>Nueva sanción</h2><button class="modal-close" onclick="cerrarModal('modal-sancion')">×</button></div>
    <form id="form-sancion">
      <div class="modal-body">
        <div class="form-grid">
          <div class="field"><label>Tipo *</label>
            <select name="tipo" onchange="toggleTipoSancion()"><option value="Asociado">Asociado</option><option value="Proveedor">Proveedor</option></select></div>
          <div class="field"><label>N° de socio *</label><input name="nroSocio" onchange="autocompletarSancion()" required /></div>
          <div class="field"><label>Asociado / Proveedor</label><input name="nombreAsociado" id="sancion-nombre" /></div>
          <div class="field"><label>Fecha *</label><input type="date" name="fecha" value="${hoyISO()}" required /></div>
          <div class="field"><label>Motivo *</label><input name="motivo" required /></div>
          <div class="field"><label>Detalle</label><input name="detalleMotivo" /></div>
          <div class="field"><label>Gravedad *</label>
            <select name="gravedad"><option>Leve</option><option>Grave</option></select></div>
          <div class="field"><label>Servicio</label><input name="servicio" id="sancion-servicio" /></div>
          <div class="field full" id="sancion-descuento-field"><label>Descuento asociado</label>
            <select name="descuentoId"><option value="">Sin descuento</option>${(DB.descuentos || []).map((d) => `<option value="${esc(String(d.id))}">${esc(d.nombre || d.motivo || '')} $${d.monto || 0}</option>`).join('')}</select></div>
        </div>
        <p id="sancion-aviso" class="muted"></p>
      </div>
      <div class="modal-foot"><button type="button" class="btn btn-secondary" onclick="cerrarModal('modal-sancion')">Cancelar</button><button type="submit" class="btn">Guardar</button></div>
    </form>`, { size: 'modal-lg' });
  document.getElementById('form-sancion').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const datos = capturar(ev);
    guardarSancion(datos, null);
  });
}

export function toggleTipoSancion() {
  const tipo = document.getElementById('form-sancion')?.elements?.tipo?.value;
  const field = document.getElementById('sancion-descuento-field');
  if (field) field.style.display = tipo === 'Proveedor' ? 'none' : '';
}

export function autocompletarSancion() {
  const form = document.getElementById('form-sancion');
  if (!form) return;
  const nro = form.elements.nroSocio.value;
  const leg = (DB.legajos || []).find((l) => String(l.nro) === String(nro));
  if (leg) {
    document.getElementById('sancion-nombre').value = leg.nombre || '';
    document.getElementById('sancion-servicio').value = leg.servicio || '';
  }
  const aviso = document.getElementById('sancion-aviso');
  if (aviso) {
    const n = cantSanciones(nro);
    aviso.innerHTML = n ? `<span class="alert alert-warn">${leyendaSanciones(nro)} en el legajo.</span>` : '';
  }
}

export function abrirEditarSancionPorId(id) {
  const s = getSancionById(id);
  if (!s) return;
  ensureModal('modal-sancion', `
    <div class="modal-head"><h2>Editar sanción</h2><button class="modal-close" onclick="cerrarModal('modal-sancion')">×</button></div>
    <form id="form-sancion">
      <div class="modal-body">
        <div class="form-grid">
          <div class="field"><label>Tipo</label>
            <select name="tipo"><option value="Asociado" ${s.tipo !== 'Proveedor' ? 'selected' : ''}>Asociado</option><option value="Proveedor" ${s.tipo === 'Proveedor' ? 'selected' : ''}>Proveedor</option></select></div>
          <div class="field"><label>N° de socio</label><input name="nroSocio" value="${esc(s.nroSocio)}" /></div>
          <div class="field"><label>Asociado / Proveedor</label><input name="nombreAsociado" value="${esc(s.nombreAsociado || '')}" /></div>
          <div class="field"><label>Fecha</label><input type="date" name="fecha" value="${esc(s.fecha)}" /></div>
          <div class="field"><label>Motivo</label><input name="motivo" value="${esc(s.motivo || '')}" /></div>
          <div class="field"><label>Gravedad</label>
            <select name="gravedad"><option ${s.gravedad !== 'Grave' ? 'selected' : ''}>Leve</option><option ${s.gravedad === 'Grave' ? 'selected' : ''}>Grave</option></select></div>
        </div>
      </div>
      <div class="modal-foot"><button type="button" class="btn btn-secondary" onclick="cerrarModal('modal-sancion')">Cancelar</button><button type="submit" class="btn">Guardar</button></div>
    </form>`, {});
  document.getElementById('form-sancion').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const datos = capturar(ev);
    Object.assign(s, datos, { nroSocio: Number(datos.nroSocio), editadoEn: new Date().toISOString() });
    supaSync('sanciones', s)
      .then(() => { cerrarModal('modal-sancion'); showToast('Sanción actualizada', 'ok'); renderSancionesInicial('asociados'); })
      .catch((e) => showToast(e.message, 'err'));
  });
}

export function guardarSancion(datos, _editar) {
  if (!datos.nroSocio || !datos.motivo) { showToast('N° y motivo son obligatorios.', 'err'); return; }
  const nro = Number(datos.nroSocio);
  const esGrave = datos.gravedad === 'Grave';
  if (datos.tipo !== 'Proveedor') {
    const vigentes = sancionesVigentesDe(nro);
    const graves = vigentes.filter((s) => s.gravedad === 'Grave').length;
    if (esGrave && graves >= 2) {
      showToast('No se puede cargar una 3ª sanción grave: se debe dar de baja al asociado.', 'err');
      return;
    }
    if (esGrave && graves === 1) {
      showToast('Alta de 2ª sanción grave: el asociado será dado de baja.', 'warn');
      setTimeout(() => {
        const leg = (DB.legajos || []).find((l) => String(l.nro) === nro);
        if (leg && leg.estado === 'Activo') {
          leg.estado = 'Baja';
          leg.fechaBaja = hoyISO();
          leg.motivoBaja = '2ª sanción grave';
          supaSync('legajos', leg).catch((e) => showToast(e.message, 'err'));
        }
      }, 100);
    }
  }
  const s = {
    id: Date.now().toString(),
    nroSocio: nro,
    nombreAsociado: datos.nombreAsociado || '',
    servicio: datos.servicio || '',
    tipo: datos.tipo || 'Asociado',
    motivo: datos.motivo,
    detalleMotivo: datos.detalleMotivo || '',
    fecha: datos.fecha || hoyISO(),
    gravedad: datos.gravedad || 'Leve',
    estado: 'Vigente',
    sancionadoPor: getCurrentUser()?.nombre || '',
    descuentoId: datos.descuentoId || null,
    historial: [],
    editadoEn: new Date().toISOString(),
  };
  DB.sanciones.push(s);
  supaSync('sanciones', s)
    .then(() => { cerrarModal('modal-sancion'); showToast('Sanción cargada', 'ok'); renderSancionesInicial('asociados'); })
    .catch((e) => showToast(e.message, 'err'));
}

export function marcarCumplidaSancion(id) {
  const s = getSancionById(id);
  if (!s) return;
  s.estado = 'Cumplida';
  supaSync('sanciones', s)
    .then(() => { showToast('Sanción cumplida', 'ok'); renderSancionesInicial('asociados'); })
    .catch((e) => showToast(e.message, 'err'));
}

export function anularSancionPorId(id) {
  const s = getSancionById(id);
  if (!s) return;
  s.estado = 'Anulada';
  supaSync('sanciones', s)
    .then(() => { showToast('Sanción anulada', 'warn'); renderSancionesInicial('asociados'); })
    .catch((e) => showToast(e.message, 'err'));
}
