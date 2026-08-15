// Uniformes — prendas por función, talles, entregas y reposición; kit inicial desde alta.
// Fuente de verdad: 02_Gestion_Personal.md §2.8.

import { DB } from '../../state.js';
import { supaSync } from '../../shared/supabase.js';
import { ensureModal, cerrarModal, showToast, capturar } from '../../shared/modal.js';
import { esc, hoyISO, fechaISOToDisplay } from '../../shared/helpers.js';
import { getCurrentUser } from '../../shared/auth.js';

export function getEntregaById(id) {
  return (DB.uniformes || []).find((u) => String(u.id) === String(id));
}

export function prendasPorFuncion(funcion) {
  const prendas = (DB.prendasUniformeCfg || []).filter((p) => !p.anulado && (!p.funcion || p.funcion === funcion || p.funcion === 'Todas'));
  if (prendas.length) return prendas;
  return [{ id: 'rematera', prenda: 'Rematera', funcion, talles: ['S', 'M', 'L', 'XL'] }];
}

export function renderUniformesInicial(tab = 'uniformes') {
  const cont = document.getElementById('screen-uniformes');
  cont.innerHTML = `
    <div class="stats">
      <div class="stat"><div class="num">${(DB.uniformes || []).filter((u) => u.estado === 'Entregado').length}</div><div class="lbl">Entregados</div></div>
      <div class="stat"><div class="num">${(DB.uniformes || []).filter((u) => u.estado === 'Pendiente').length}</div><div class="lbl">Pendientes</div></div>
    </div>
    <div class="tabs">
      ${[['uniformes', 'Entregas'], ['prendas', 'Prendas por función'], ['pruebas', 'Pruebas de uniforme']]
        .map(([k, l]) => `<button class="tab-btn ${tab === k ? 'active' : ''}" onclick="renderUniformesInicial('${k}')">${l}</button>`).join('')}
    </div>
    <div id="uniforme-contenido"></div>`;
  const panel = document.getElementById('uniforme-contenido');
  if (tab === 'prendas') {
    renderPrendas(panel);
    return;
  }
  if (tab === 'pruebas') {
    renderPruebas(panel);
    return;
  }
  panel.innerHTML = `
    <div class="toolbar">
      <input type="text" id="buscar-uniforme" placeholder="Buscar…" oninput="filtrarUniformes()" />
      <div class="spacer"></div>
      <button class="btn" onclick="abrirNuevaEntrega()">+ Nueva entrega</button>
    </div>
    <div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>N°</th><th>Asociado</th><th>Prenda</th><th>Talle</th><th>Fecha</th><th>Tipo</th><th>Estado</th><th>Acciones</th></tr></thead>
      <tbody>
        ${(DB.uniformes || []).map((u) => {
          const talle = u.talles ? Object.values(u.talles)[0] || u.talle : u.talle || '';
          let acciones = `<button class="btn btn-secondary btn-sm" onclick="verEntrega('${esc(String(u.id))}')">Ver</button>`;
          if (u.estado === 'Pendiente') {
            acciones += `<button class="btn btn-success btn-sm" onclick="marcarEntregado('${esc(String(u.id))}')">Entregado</button>`;
            acciones += `<button class="btn btn-danger btn-sm" onclick="anularEntregaPorId('${esc(String(u.id))}')">Anular</button>`;
          }
          return `<tr>
            <td>${esc(String(u.nroSocio || ''))}</td>
            <td>${esc(u.nombreAsociado || '')}</td>
            <td>${esc(u.prenda || '')}</td>
            <td>${esc(talle)}</td>
            <td>${esc(fechaISOToDisplay(u.fecha))}</td>
            <td>${esc(u.tipoEntrega || '')}</td>
            <td><span class="chip ${u.estado === 'Entregado' ? 'chip-verde' : u.estado === 'Anulado' ? 'chip-gris' : 'chip-naranja'}">${esc(u.estado)}</span></td>
            <td class="acciones">${acciones}</td>
          </tr>`;
        }).join('') || '<tr><td colspan="8" class="empty">Sin entregas.</td></tr>'}
      </tbody>
    </table></div>`;
}

export function filtrarUniformes() {
  const term = document.getElementById('buscar-uniforme')?.value.toLowerCase() || '';
  document.querySelectorAll('#uniforme-contenido tbody tr').forEach((tr) => tr.classList.toggle('hidden', !tr.textContent.toLowerCase().includes(term)));
}

export function verEntrega(id) {
  const u = getEntregaById(id);
  if (!u) return;
  ensureModal('modal-uniforme-ver', `
    <div class="modal-head"><h2>Entrega de uniforme — ${esc(u.nombreAsociado || '')}</h2><button class="modal-close" onclick="cerrarModal('modal-uniforme-ver')">×</button></div>
    <div class="modal-body">
      <div class="grid3">
        ${[['N°', u.nroSocio], ['Servicio', u.servicio], ['Función', u.funcion], ['Prenda', u.prenda], ['Talle', u.talles ? Object.values(u.talles).join(' · ') : u.talle], ['Fecha', u.fecha ? fechaISOToDisplay(u.fecha) : ''], ['Tipo', u.tipoEntrega], ['Estado', u.estado], ['Proveedor', u.proveedor], ['Notas', u.notas]]
          .map(([k, val]) => `<div><strong>${k}:</strong><br/>${esc(val === null || val === undefined || val === '' ? '—' : String(val))}</div>`).join('')}
      </div>
    </div>
    <div class="modal-foot"><button class="btn btn-secondary" onclick="cerrarModal('modal-uniforme-ver')">Cerrar</button></div>
  `, {});
}

export function abrirNuevaEntrega() {
  ensureModal('modal-uniforme', `
    <div class="modal-head"><h2>Nueva entrega de uniforme</h2><button class="modal-close" onclick="cerrarModal('modal-uniforme')">×</button></div>
    <form id="form-uniforme">
      <div class="modal-body">
        <div class="form-grid">
          <div class="field"><label>N° de socio *</label><input name="nroSocio" onchange="autocompletarUniforme()" required /></div>
          <div class="field"><label>Asociado</label><input name="nombreAsociado" id="uniforme-nombre" /></div>
          <div class="field"><label>Servicio</label><input name="servicio" id="uniforme-servicio" /></div>
          <div class="field"><label>Prenda *</label>
            <select name="prenda" id="uniforme-prenda" onchange="pintarTalles()">${prendasPorFuncion('').map((p) => `<option>${esc(p.prenda)}</option>`).join('')}</select></div>
          <div class="field"><label>Talle</label><input name="talle" id="uniforme-talle" placeholder="S / M / L / XL…" /></div>
          <div class="field"><label>Fecha *</label><input type="date" name="fecha" value="${hoyISO()}" required /></div>
          <div class="field"><label>Tipo</label>
            <select name="tipoEntrega"><option>Inicial</option><option>Reposición</option></select></div>
          <div class="field"><label>Proveedor</label><input name="proveedor" /></div>
          <div class="field full"><label>Notas</label><textarea name="notas" rows="2"></textarea></div>
        </div>
      </div>
      <div class="modal-foot"><button type="button" class="btn btn-secondary" onclick="cerrarModal('modal-uniforme')">Cancelar</button><button type="submit" class="btn">Guardar</button></div>
    </form>`, { size: 'modal-lg' });
  document.getElementById('form-uniforme').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const datos = capturar(ev);
    if (!datos.nroSocio || !datos.prenda) { showToast('N° y prenda son obligatorios.', 'err'); return; }
    const leg = (DB.legajos || []).find((l) => String(l.nro) === String(datos.nroSocio));
    const u = {
      id: Date.now().toString(),
      nroSocio: Number(datos.nroSocio),
      nombreAsociado: datos.nombreAsociado || leg?.nombre || '',
      servicio: datos.servicio || leg?.servicio || '',
      funcion: leg?.funcion || '',
      prenda: datos.prenda,
      talle: datos.talle || '',
      talles: leg?.tallesUniforme || {},
      fecha: datos.fecha,
      tipoEntrega: datos.tipoEntrega || 'Inicial',
      proveedor: datos.proveedor || '',
      notas: datos.notas || '',
      estado: 'Pendiente',
      creadoPor: getCurrentUser()?.nombre || '',
      editadoEn: new Date().toISOString(),
    };
    DB.uniformes.push(u);
    supaSync('uniformes', u)
      .then(() => { cerrarModal('modal-uniforme'); showToast('Entrega cargada', 'ok'); renderUniformesInicial('uniformes'); })
      .catch((e) => showToast(e.message, 'err'));
  });
}

export function pintarTalles() {
  const prenda = document.getElementById('uniforme-prenda')?.value;
  const talle = document.getElementById('uniforme-talle');
  if (!prenda || !talle) return;
  const p = (DB.prendasUniformeCfg || []).find((x) => x.prenda === prenda && !x.anulado);
  if (p?.talles?.length) {
    talle.placeholder = p.talles.join(' / ');
  }
}

export function autocompletarUniforme() {
  const form = document.getElementById('form-uniforme');
  if (!form) return;
  const nro = form.elements.nroSocio.value;
  const leg = (DB.legajos || []).find((l) => String(l.nro) === String(nro));
  if (leg) {
    const n = document.getElementById('uniforme-nombre'); if (n) n.value = leg.nombre || '';
    const s = document.getElementById('uniforme-servicio'); if (s) s.value = leg.servicio || '';
    const talles = leg.tallesUniforme || {};
    if (Object.keys(talles).length) {
      const t = document.getElementById('uniforme-talle'); if (t) t.value = Object.values(talles).join(' / ');
    }
  }
}

export function marcarEntregado(id) {
  const u = getEntregaById(id);
  if (!u) return;
  u.estado = 'Entregado';
  u.fechaEntrega = hoyISO();
  supaSync('uniformes', u)
    .then(() => { showToast('Entrega registrada', 'ok'); renderUniformesInicial('uniformes'); })
    .catch((e) => showToast(e.message, 'err'));
}

export function anularEntregaPorId(id) {
  const u = getEntregaById(id);
  if (!u) return;
  u.estado = 'Anulado';
  supaSync('uniformes', u)
    .then(() => { showToast('Entrega anulada', 'warn'); renderUniformesInicial('uniformes'); })
    .catch((e) => showToast(e.message, 'err'));
}

export function crearEntregaUniformeDesdeAlta(legajo) {
  if (!legajo || !legajo.nro) return;
  const prendas = prendasPorFuncion(legajo.funcion);
  const talles = legajo.tallesUniforme || {};
  prendas.forEach((p, i) => {
    const u = {
      id: Date.now().toString() + i,
      nroSocio: Number(legajo.nro),
      nombreAsociado: legajo.nombre || '',
      servicio: legajo.servicio || '',
      funcion: legajo.funcion || '',
      prenda: p.prenda,
      talle: talles[p.prenda] || talles[p.id] || p.talles?.[0] || '',
      talles,
      fecha: hoyISO(),
      tipoEntrega: 'Inicial',
      proveedor: '',
      notas: 'Kit inicial generado automáticamente en el alta.',
      estado: 'Pendiente',
      creadoPor: getCurrentUser()?.nombre || '',
      editadoEn: new Date().toISOString(),
    };
    DB.uniformes.push(u);
    supaSync('uniformes', u).catch(() => {});
  });
}

function renderPrendas(panel) {
  panel.innerHTML = `
    <div class="toolbar"><div class="spacer"></div><button class="btn" onclick="abrirModalPrenda()">+ Nueva prenda</button></div>
    <div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>Prenda</th><th>Función</th><th>Talles</th><th>Acciones</th></tr></thead>
      <tbody>
        ${(DB.prendasUniformeCfg || []).filter((p) => !p.anulado).map((p) => `<tr>
          <td>${esc(p.prenda)}</td>
          <td>${esc(p.funcion || 'Todas')}</td>
          <td>${esc((p.talles || []).join(' · ') || '—')}</td>
          <td class="acciones"><button class="btn btn-danger btn-sm" onclick="anularPrenda('${esc(String(p.id))}')">Anular</button></td>
        </tr>`).join('') || '<tr><td colspan="4" class="empty">Sin prendas configuradas.</td></tr>'}
      </tbody>
    </table></div>`;
}

export function abrirModalPrenda() {
  ensureModal('modal-prenda', `
    <div class="modal-head"><h2>Nueva prenda</h2><button class="modal-close" onclick="cerrarModal('modal-prenda')">×</button></div>
    <form id="form-prenda">
      <div class="modal-body">
        <div class="form-grid">
          <div class="field"><label>Prenda *</label><input name="prenda" required /></div>
          <div class="field"><label>Función</label>
            <select name="funcion"><option value="Todas">Todas</option>${[...new Set((DB.legajos || []).filter((l) => l.funcion).map((l) => l.funcion))].map((f) => `<option>${esc(f)}</option>`).join('')}</select></div>
          <div class="field full"><label>Talles (separados por coma)</label><input name="tallesInput" placeholder="S, M, L, XL" /></div>
        </div>
      </div>
      <div class="modal-foot"><button type="button" class="btn btn-secondary" onclick="cerrarModal('modal-prenda')">Cancelar</button><button type="submit" class="btn">Guardar</button></div>
    </form>`, {});
  document.getElementById('form-prenda').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const datos = capturar(ev);
    if (!datos.prenda) { showToast('Nombre de prenda obligatorio.', 'err'); return; }
    const p = { id: Date.now().toString(), prenda: datos.prenda, funcion: datos.funcion || 'Todas', talles: (datos.tallesInput || '').split(',').map((t) => t.trim()).filter(Boolean), anulado: false };
    (DB.prendasUniformeCfg ||= []).push(p);
    supaSync('prendasUniformeCfg', p)
      .then(() => { cerrarModal('modal-prenda'); showToast('Prenda configurada', 'ok'); renderUniformesInicial('prendas'); })
      .catch((e) => showToast(e.message, 'err'));
  });
}

export function guardarPrenda() { abrirModalPrenda(); }

export function anularPrenda(id) {
  const p = (DB.prendasUniformeCfg || []).find((x) => String(x.id) === String(id));
  if (!p) return;
  p.anulado = true;
  supaSync('prendasUniformeCfg', p)
    .then(() => { showToast('Prenda anulada', 'warn'); renderUniformesInicial('prendas'); })
    .catch((e) => showToast(e.message, 'err'));
}

function renderPruebas(panel) {
  panel.innerHTML = `
    <div class="toolbar"><div class="spacer"></div><button class="btn" onclick="abrirModalPrueba()">+ Registrar prueba</button></div>
    <div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>N°</th><th>Asociado</th><th>Fecha</th><th>Observaciones</th><th>Estado</th></tr></thead>
      <tbody>
        ${(DB.pruebasUniforme || []).map((p) => `<tr>
          <td>${esc(String(p.nroSocio || ''))}</td>
          <td>${esc(p.nombreAsociado || '')}</td>
          <td>${esc(fechaISOToDisplay(p.fecha))}</td>
          <td>${esc(p.observaciones || '')}</td>
          <td>${esc(p.estado || 'Pendiente')}</td>
        </tr>`).join('') || '<tr><td colspan="5" class="empty">Sin pruebas registradas.</td></tr>'}
      </tbody>
    </table></div>`;
}

export function abrirModalPrueba() {
  ensureModal('modal-prueba-uniforme', `
    <div class="modal-head"><h2>Prueba de uniforme</h2><button class="modal-close" onclick="cerrarModal('modal-prueba-uniforme')">×</button></div>
    <form id="form-prueba-uniforme">
      <div class="modal-body">
        <div class="form-grid">
          <div class="field"><label>N° de socio *</label><input name="nroSocio" required /></div>
          <div class="field"><label>Asociado</label><input name="nombreAsociado" /></div>
          <div class="field"><label>Fecha *</label><input type="date" name="fecha" value="${hoyISO()}" required /></div>
          <div class="field"><label>Estado</label><select name="estado"><option>Pendiente</option><option>Aprobada</option><option>Rechazada</option></select></div>
          <div class="field full"><label>Observaciones</label><textarea name="observaciones" rows="2"></textarea></div>
        </div>
      </div>
      <div class="modal-foot"><button type="button" class="btn btn-secondary" onclick="cerrarModal('modal-prueba-uniforme')">Cancelar</button><button type="submit" class="btn">Guardar</button></div>
    </form>`, {});
  document.getElementById('form-prueba-uniforme').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const datos = capturar(ev);
    if (!datos.nroSocio) { showToast('N° de socio obligatorio.', 'err'); return; }
    (DB.pruebasUniforme ||= []).push({ id: Date.now().toString(), nroSocio: Number(datos.nroSocio), nombreAsociado: datos.nombreAsociado, fecha: datos.fecha, observaciones: datos.observaciones || '', estado: datos.estado });
    supaSync('pruebasUniforme', DB.pruebasUniforme[DB.pruebasUniforme.length - 1])
      .then(() => { cerrarModal('modal-prueba-uniforme'); showToast('Prueba registrada', 'ok'); renderUniformesInicial('pruebas'); })
      .catch((e) => showToast(e.message, 'err'));
  });
}

export function guardarPrueba() { abrirModalPrueba(); }
