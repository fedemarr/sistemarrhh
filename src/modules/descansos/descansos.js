// Descansos — semanales/mensuales con configuración por servicio y emisión de reposos.
// Fuente de verdad: 02_Gestion_Personal.md §2.4.

import { DB } from '../../state.js';
import { supaSync } from '../../shared/supabase.js';
import { ensureModal, cerrarModal, showToast, capturar } from '../../shared/modal.js';
import { esc, hoyISO, fechaISOToDisplay } from '../../shared/helpers.js';
import { getCurrentUser } from '../../shared/auth.js';

export function getDescansoById(id) {
  return (DB.descansos || []).find((d) => String(d.id) === String(id));
}

export function renderDescansosInicial(tab = 'descansos') {
  const cont = document.getElementById('screen-descansos');
  cont.innerHTML = `
    <div class="tabs">
      ${[['descansos', `Descansos (${(DB.descansos || []).filter((d) => d.estado === 'Vigente').length})`], ['config', 'Configuración por servicio']]
        .map(([k, l]) => `<button class="tab-btn ${tab === k ? 'active' : ''}" onclick="renderDescansosInicial('${k}')">${l}</button>`).join('')}
    </div>
    <div id="desc-contenido"></div>`;
  const panel = document.getElementById('desc-contenido');
  if (tab === 'config') {
    renderConfigDescansos(panel);
    return;
  }
  panel.innerHTML = `
    <div class="toolbar">
      <div class="spacer"></div>
      <button class="btn" onclick="abrirNuevoDescanso()">+ Nuevo descanso</button>
      <button class="btn btn-secondary" onclick="emitirReposoMensual()">Emitir reposo mensual</button>
    </div>
    <div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>N°</th><th>Asociado</th><th>Servicio</th><th>Tipo</th><th>Fecha</th><th>Motivo</th><th>Estado</th><th>Acciones</th></tr></thead>
      <tbody>
        ${(DB.descansos || []).filter((d) => d.estado !== 'Anulado').map((d) => {
          let acciones = `<button class="btn btn-secondary btn-sm" onclick="editarDescansoPorId('${esc(String(d.id))}')">Editar</button>`;
          if (d.estado === 'Vigente') acciones += `<button class="btn btn-success btn-sm" onclick="marcarDescansoTomado('${esc(String(d.id))}')">Tomado</button>`;
          acciones += `<button class="btn btn-danger btn-sm" onclick="anularDescansoPorId('${esc(String(d.id))}')">Anular</button>`;
          return `<tr>
            <td>${esc(String(d.nroSocio || ''))}</td>
            <td>${esc(d.nombreAsociado || '')}</td>
            <td>${esc(d.servicio || '')}</td>
            <td>${esc(d.tipo || '')}</td>
            <td>${esc(fechaISOToDisplay(d.fecha))}</td>
            <td>${esc(d.motivo || '')}</td>
            <td>${esc(d.estado || '')}</td>
            <td class="acciones">${acciones}</td>
          </tr>`;
        }).join('') || '<tr><td colspan="8" class="empty">Sin descansos cargados.</td></tr>'}
      </tbody>
    </table></div>`;
}

export function renderConfigDescansos(panel) {
  panel.innerHTML = `
    <div class="toolbar"><div class="spacer"></div><button class="btn" onclick="abrirModalConfigDescanso()">+ Configurar servicio</button></div>
    <div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>Servicio</th><th>Descanso semanal (día)</th><th>Descanso mensual (días)</th><th>Acciones</th></tr></thead>
      <tbody>
        ${(DB.descansosConfig || []).map((c) => `<tr>
          <td>${esc(String(c.servicio || ''))}</td>
          <td>${esc(c.diaSemanal || '')}</td>
          <td>${esc(String(c.diaMensual ?? ''))}</td>
          <td class="acciones"><button class="btn btn-secondary btn-sm" onclick="editarConfigDescanso('${esc(String(c.id))}')">Editar</button><button class="btn btn-danger btn-sm" onclick="anularConfigDescanso('${esc(String(c.id))}')">Anular</button></td>
        </tr>`).join('') || '<tr><td colspan="4" class="empty">Sin configuración por servicio.</td></tr>'}
      </tbody>
    </table></div>`;
}

const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

export function abrirModalConfigDescanso() {
  ensureModal('modal-desc-config', `
    <div class="modal-head"><h2>Configuración de descanso por servicio</h2><button class="modal-close" onclick="cerrarModal('modal-desc-config')">×</button></div>
    <form id="form-desc-config">
      <div class="modal-body">
        <div class="form-grid">
          <div class="field"><label>Servicio *</label><input name="servicio" required /></div>
          <div class="field"><label>Descanso semanal (día)</label>
            <select name="diaSemanal">${DIAS_SEMANA.map((d) => `<option>${d}</option>`).join('')}</select></div>
          <div class="field"><label>Descanso mensual (días)</label><input type="number" name="diaMensual" value="1.5" step="0.5" /></div>
        </div>
      </div>
      <div class="modal-foot"><button type="button" class="btn btn-secondary" onclick="cerrarModal('modal-desc-config')">Cancelar</button><button type="submit" class="btn">Guardar</button></div>
    </form>`, {});
  document.getElementById('form-desc-config').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const datos = capturar(ev);
    if ((DB.descansosConfig || []).some((c) => String(c.servicio) === String(datos.servicio) && !c.anulado)) { showToast('Ese servicio ya está configurado.', 'err'); return; }
    const cfg = { id: Date.now().toString(), servicio: datos.servicio, diaSemanal: datos.diaSemanal, diaMensual: Number(datos.diaMensual) || 0, anulado: false };
    (DB.descansosConfig ||= []).push(cfg);
    supaSync('descansosConfig', cfg)
      .then(() => { cerrarModal('modal-desc-config'); showToast('Configuración guardada', 'ok'); renderDescansosInicial('config'); })
      .catch((e) => showToast(e.message, 'err'));
  });
}

export function editarConfigDescanso(id) {
  const c = (DB.descansosConfig || []).find((x) => String(x.id) === String(id));
  if (!c) return;
  ensureModal('modal-desc-config', `
    <div class="modal-head"><h2>Editar configuración</h2><button class="modal-close" onclick="cerrarModal('modal-desc-config')">×</button></div>
    <form id="form-desc-config">
      <div class="modal-body">
        <div class="form-grid">
          <div class="field"><label>Servicio</label><input name="servicio" value="${esc(c.servicio)}" required /></div>
          <div class="field"><label>Descanso semanal</label>
            <select name="diaSemanal">${DIAS_SEMANA.map((d) => `<option ${c.diaSemanal === d ? 'selected' : ''}>${d}</option>`).join('')}</select></div>
          <div class="field"><label>Descanso mensual (días)</label><input type="number" name="diaMensual" value="${c.diaMensual}" step="0.5" /></div>
        </div>
      </div>
      <div class="modal-foot"><button type="button" class="btn btn-secondary" onclick="cerrarModal('modal-desc-config')">Cancelar</button><button type="submit" class="btn">Guardar</button></div>
    </form>`, {});
  document.getElementById('form-desc-config').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const datos = capturar(ev);
    Object.assign(c, datos, { diaMensual: Number(datos.diaMensual) || 0 });
    supaSync('descansosConfig', c)
      .then(() => { cerrarModal('modal-desc-config'); showToast('Configuración actualizada', 'ok'); renderDescansosInicial('config'); })
      .catch((e) => showToast(e.message, 'err'));
  });
}

export function anularConfigDescanso(id) {
  const c = (DB.descansosConfig || []).find((x) => String(x.id) === String(id));
  if (!c) return;
  c.anulado = true;
  supaSync('descansosConfig', c)
    .then(() => { showToast('Configuración anulada', 'warn'); renderDescansosInicial('config'); })
    .catch((e) => showToast(e.message, 'err'));
}

function tiposDescanso() {
  const cfg = DB.motivosDescansoCfg || [];
  const list = cfg.filter((m) => !m.anulado).map((m) => m.nombre);
  return list.length ? list : ['Descanso semanal', 'Descanso mensual', 'Otro'];
}

export function abrirNuevoDescanso() {
  ensureModal('modal-desc', `
    <div class="modal-head"><h2>Nuevo descanso</h2><button class="modal-close" onclick="cerrarModal('modal-desc')">×</button></div>
    <form id="form-desc">
      <div class="modal-body">
        <div class="form-grid">
          <div class="field"><label>N° de socio *</label><input name="nroSocio" onchange="autocompletarDesc()" required /></div>
          <div class="field"><label>Asociado</label><input name="nombreAsociado" id="desc-nombre" /></div>
          <div class="field"><label>Tipo</label>
            <select name="tipo">${tiposDescanso().map((t) => `<option>${esc(t)}</option>`).join('')}</select></div>
          <div class="field"><label>Fecha *</label><input type="date" name="fecha" value="${hoyISO()}" required /></div>
          <div class="field"><label>Motivo</label><input name="motivo" /></div>
          <div class="field full"><label>Detalle</label><textarea name="detalleMotivo" rows="2"></textarea></div>
        </div>
      </div>
      <div class="modal-foot"><button type="button" class="btn btn-secondary" onclick="cerrarModal('modal-desc')">Cancelar</button><button type="submit" class="btn">Guardar</button></div>
    </form>`, { size: 'modal-lg' });
  document.getElementById('form-desc').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const datos = capturar(ev);
    if (!datos.nroSocio) { showToast('N° de socio obligatorio.', 'err'); return; }
    const leg = (DB.legajos || []).find((l) => String(l.nro) === String(datos.nroSocio));
    if (!leg) { showToast('Socio no encontrado.', 'err'); return; }
    const d = {
      id: Date.now().toString(),
      ...datos,
      nroSocio: Number(datos.nroSocio),
      servicio: leg.servicio || '',
      estado: 'Vigente',
      creadoPor: getCurrentUser()?.nombre || '',
      editadoEn: new Date().toISOString(),
    };
    DB.descansos.push(d);
    supaSync('descansos', d)
      .then(() => { cerrarModal('modal-desc'); showToast('Descanso cargado', 'ok'); renderDescansosInicial('descansos'); })
      .catch((e) => showToast(e.message, 'err'));
  });
}

export function autocompletarDesc() {
  const nro = document.getElementById('form-desc')?.elements?.nroSocio?.value;
  const leg = (DB.legajos || []).find((l) => String(l.nro) === String(nro));
  if (leg) { const el = document.getElementById('desc-nombre'); if (el) el.value = leg.nombre || ''; }
}

export function editarDescansoPorId(id) {
  const d = getDescansoById(id);
  if (!d) return;
  ensureModal('modal-desc', `
    <div class="modal-head"><h2>Editar descanso</h2><button class="modal-close" onclick="cerrarModal('modal-desc')">×</button></div>
    <form id="form-desc-edit">
      <div class="modal-body">
        <div class="form-grid">
          <div class="field"><label>N° de socio</label><input name="nroSocio" value="${esc(d.nroSocio)}" /></div>
          <div class="field"><label>Asociado</label><input name="nombreAsociado" value="${esc(d.nombreAsociado || '')}" /></div>
          <div class="field"><label>Tipo</label>
            <select name="tipo">${tiposDescanso().map((t) => `<option ${d.tipo === t ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></div>
          <div class="field"><label>Fecha</label><input type="date" name="fecha" value="${esc(d.fecha)}" /></div>
          <div class="field"><label>Motivo</label><input name="motivo" value="${esc(d.motivo || '')}" /></div>
        </div>
      </div>
      <div class="modal-foot"><button type="button" class="btn btn-secondary" onclick="cerrarModal('modal-desc')">Cancelar</button><button type="submit" class="btn">Guardar</button></div>
    </form>`, {});
  document.getElementById('form-desc-edit').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const datos = capturar(ev);
    Object.assign(d, datos, { nroSocio: Number(datos.nroSocio), editadoEn: new Date().toISOString() });
    supaSync('descansos', d)
      .then(() => { cerrarModal('modal-desc'); showToast('Descanso actualizado', 'ok'); renderDescansosInicial('descansos'); })
      .catch((e) => showToast(e.message, 'err'));
  });
}

export function marcarDescansoTomado(id) {
  const d = getDescansoById(id);
  if (!d) return;
  d.estado = 'Tomado';
  supaSync('descansos', d)
    .then(() => { showToast('Descanso marcado como tomado', 'ok'); renderDescansosInicial('descansos'); })
    .catch((e) => showToast(e.message, 'err'));
}

export function anularDescansoPorId(id) {
  const d = getDescansoById(id);
  if (!d) return;
  d.estado = 'Anulado';
  supaSync('descansos', d)
    .then(() => { showToast('Descanso anulado', 'warn'); renderDescansosInicial('descansos'); })
    .catch((e) => showToast(e.message, 'err'));
}

export function emitirReposoMensual() {
  const activos = (DB.legajos || []).filter((l) => l.estado === 'Activo' && l.servicio);
  if (!activos.length) { showToast('No hay asociados activos.', 'warn'); return; }
  const mes = new Date().toISOString().slice(0, 7);
  const yaExisten = (DB.descansos || []).filter((d) => d.tipo === 'Descanso mensual' && (d.fecha || '').startsWith(mes)).map((d) => String(d.nroSocio));
  const pendientes = activos.filter((l) => !yaExisten.includes(String(l.nro)));
  if (!pendientes.length) { showToast('Todos ya tienen el reposo mensual emitido este mes.', 'warn'); return; }
  ensureModal('modal-reposo', `
    <div class="modal-head"><h2>Emitir reposo mensual</h2><button class="modal-close" onclick="cerrarModal('modal-reposo')">×</button></div>
    <div class="modal-body">
      <p>Se crearán descansos de tipo "Descanso mensual" para <strong>${pendientes.length}</strong> asociados (${mes}).</p>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>N°</th><th>Nombre</th><th>Servicio</th></tr></thead>
        <tbody>${pendientes.slice(0, 10).map((l) => `<tr><td>${esc(String(l.nro))}</td><td>${esc(l.nombre)}</td><td>${esc(l.servicio)}</td></tr>`).join('')}
        ${pendientes.length > 10 ? `<tr><td colspan="3" class="muted">… y ${pendientes.length - 10} más</td></tr>` : ''}
      </tbody></table></div>
    </div>
    <div class="modal-foot"><button class="btn btn-secondary" onclick="cerrarModal('modal-reposo')">Cancelar</button><button class="btn" onclick="confirmarEmitirReposo(${pendientes.length})">Emitir</button></div>
  `, { size: 'modal-lg' });
}

export function confirmarEmitirReposo(cantidad) {
  const mes = new Date().toISOString().slice(0, 7);
  const yaExistentes = (DB.descansos || []).filter((d) => d.tipo === 'Descanso mensual' && (d.fecha || '').startsWith(mes)).map((d) => String(d.nroSocio));
  const activos = (DB.legajos || []).filter((l) => l.estado === 'Activo' && l.servicio && !yaExistentes.includes(String(l.nro)));
  const creados = activos.map((l) => {
    const d = {
      id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
      nroSocio: Number(l.nro),
      nombreAsociado: l.nombre || '',
      servicio: l.servicio || '',
      tipo: 'Descanso mensual',
      fecha: mes + '-15',
      motivo: 'Reposo mensual',
      detalleMotivo: '',
      estado: 'Vigente',
      creadoPor: getCurrentUser()?.nombre || '',
    };
    DB.descansos.push(d);
    return supaSync('descansos', d);
  });
  Promise.all(creados)
    .then(() => { cerrarModal('modal-reposo'); showToast(`${creados.length} reposos emitidos`, 'ok'); renderDescansosInicial('descansos'); })
    .catch((e) => showToast(e.message, 'err'));
}
