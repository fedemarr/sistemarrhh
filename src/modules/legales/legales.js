// Situaciones legales — embargos, inhibiciones y otros con control de vigencia.
// Fuente de verdad: 02_Gestion_Personal.md §2.7.

import { DB } from '../../state.js';
import { supaSync } from '../../shared/supabase.js';
import { ensureModal, cerrarModal, showToast, capturar } from '../../shared/modal.js';
import { esc, hoyISO, fechaISOToDisplay } from '../../shared/helpers.js';
import { getCurrentUser } from '../../shared/auth.js';

export function getSituacionById(id) {
  return (DB.situacionesLegales || []).find((s) => String(s.id) === String(id));
}

export function situacionesDeSocio(nro) {
  return (DB.situacionesLegales || []).filter((s) => String(s.nroSocio) === String(nro));
}

export function tiposSL() {
  const cfg = DB.tiposSituacionesLegalesCfg || [];
  const list = cfg.filter((t) => !t.anulado).map((t) => t.nombre);
  return list.length ? list : ['Embargo', 'Inhibición', 'Quiebra', 'Intervención', 'Otro'];
}

export function renderSituacionesLegalesInicial() {
  const cont = document.getElementById('screen-situaciones-legales');
  const vigentes = (DB.situacionesLegales || []).filter((s) => s.estado === 'Vigente');
  cont.innerHTML = `
    <div class="stats">
      <div class="stat"><div class="num">${vigentes.length}</div><div class="lbl">Vigentes</div></div>
      <div class="stat"><div class="num">${(DB.situacionesLegales || []).filter((s) => s.estado === 'Vencida').length}</div><div class="lbl">Vencidas</div></div>
      <div class="stat"><div class="num">${(DB.situacionesLegales || []).filter((s) => s.estado === 'Anulada').length}</div><div class="lbl">Anuladas</div></div>
    </div>
    <div class="toolbar">
      <input type="text" id="buscar-sl" placeholder="Buscar…" oninput="filtrarSituaciones()" />
      <div class="spacer"></div>
      <button class="btn" onclick="abrirNuevaSituacionLegal()">+ Nueva situación legal</button>
    </div>
    <div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>N°</th><th>Asociado</th><th>Tipo</th><th>Inicio</th><th>Fin</th><th>Motivo</th><th>Estado</th><th>Acciones</th></tr></thead>
      <tbody>
        ${(DB.situacionesLegales || []).map((s) => {
          let acciones = `<button class="btn btn-secondary btn-sm" onclick="verSituacionLegal('${esc(String(s.id))}')">Ver</button>`;
          if (s.estado === 'Vigente') {
            acciones += `<button class="btn btn-secondary btn-sm" onclick="abrirEditarSituacionPorId('${esc(String(s.id))}')">Editar</button>`;
            acciones += `<button class="btn btn-success btn-sm" onclick="marcarVencidaSituacion('${esc(String(s.id))}')">Marcar vencida</button>`;
          }
          acciones += `<button class="btn btn-danger btn-sm" onclick="anularSituacionLegalPorId('${esc(String(s.id))}')">Anular</button>`;
          return `<tr>
            <td>${esc(String(s.nroSocio || ''))}</td>
            <td>${esc(s.nombreAsociado || '')}</td>
            <td><span class="chip chip-rojo">${esc(s.tipo || '')}</span></td>
            <td>${esc(fechaISOToDisplay(s.fechaInicio))}</td>
            <td>${esc(fechaISOToDisplay(s.fechaFin))}</td>
            <td>${esc(s.motivo || '')}</td>
            <td><span class="chip ${s.estado === 'Vigente' ? 'chip-rojo' : s.estado === 'Vencida' ? 'chip-naranja' : 'chip-gris'}">${esc(s.estado)}</span></td>
            <td class="acciones">${acciones}</td>
          </tr>`;
        }).join('') || '<tr><td colspan="8" class="empty">Sin situaciones legales.</td></tr>'}
      </tbody>
    </table></div>`;
}

export function filtrarSituaciones() {
  const term = document.getElementById('buscar-sl')?.value.toLowerCase() || '';
  document.querySelectorAll('#screen-situaciones-legales tbody tr').forEach((tr) => tr.classList.toggle('hidden', !tr.textContent.toLowerCase().includes(term)));
}

export function verSituacionLegal(id) {
  const s = getSituacionById(id);
  if (!s) return;
  ensureModal('modal-sl-ver', `
    <div class="modal-head"><h2>Situación legal — ${esc(s.nombreAsociado || '')}</h2><button class="modal-close" onclick="cerrarModal('modal-sl-ver')">×</button></div>
    <div class="modal-body">
      <div class="grid3">
        ${[['N°', s.nroSocio], ['Tipo', s.tipo], ['Inicio', s.fechaInicio ? fechaISOToDisplay(s.fechaInicio) : ''], ['Fin', s.fechaFin ? fechaISOToDisplay(s.fechaFin) : ''], ['Motivo', s.motivo], ['Detalle', s.detalleMotivo], ['Estado', s.estado], ['Creado por', s.creadoPor]]
          .map(([k, val]) => `<div><strong>${k}:</strong><br/>${esc(val === null || val === undefined || val === '' ? '—' : String(val))}</div>`).join('')}
      </div>
    </div>
    <div class="modal-foot"><button class="btn btn-secondary" onclick="cerrarModal('modal-sl-ver')">Cerrar</button></div>
  `, {});
}

function camposSL(s) {
  return `
    <div class="form-grid">
      <div class="field"><label>N° de socio *</label><input name="nroSocio" value="${esc(s?.nroSocio || '')}" onchange="autocompletarSL()" required /></div>
      <div class="field"><label>Asociado</label><input name="nombreAsociado" id="sl-nombre" value="${esc(s?.nombreAsociado || '')}" /></div>
      <div class="field"><label>Tipo *</label>
        <select name="tipo">${tiposSL().map((t) => `<option ${s?.tipo === t ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></div>
      <div class="field"><label>Fecha de inicio *</label><input type="date" name="fechaInicio" value="${esc(s?.fechaInicio || hoyISO())}" required /></div>
      <div class="field"><label>Fecha de fin</label><input type="date" name="fechaFin" value="${esc(s?.fechaFin || '')}" /></div>
      <div class="field"><label>Motivo</label><input name="motivo" value="${esc(s?.motivo || '')}" /></div>
      <div class="field full"><label>Detalle</label><textarea name="detalleMotivo" rows="2">${esc(s?.detalleMotivo || '')}</textarea></div>
    </div>`;
}

export function abrirNuevaSituacionLegal() {
  ensureModal('modal-sl', `
    <div class="modal-head"><h2>Nueva situación legal</h2><button class="modal-close" onclick="cerrarModal('modal-sl')">×</button></div>
    <form id="form-sl">
      <div class="modal-body">${camposSL(null)}</div>
      <div class="modal-foot"><button type="button" class="btn btn-secondary" onclick="cerrarModal('modal-sl')">Cancelar</button><button type="submit" class="btn">Guardar</button></div>
    </form>`, { size: 'modal-lg' });
  document.getElementById('form-sl').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const datos = capturar(ev);
    guardarSituacionLegal(datos, null);
  });
}

export function autocompletarSL() {
  const form = document.getElementById('form-sl');
  if (!form) return;
  const nro = form.elements.nroSocio.value;
  const leg = (DB.legajos || []).find((l) => String(l.nro) === String(nro));
  if (leg) { const el = document.getElementById('sl-nombre'); if (el) el.value = leg.nombre || ''; }
}

export function abrirEditarSituacionPorId(id) {
  const s = getSituacionById(id);
  if (!s) return;
  ensureModal('modal-sl', `
    <div class="modal-head"><h2>Editar situación legal</h2><button class="modal-close" onclick="cerrarModal('modal-sl')">×</button></div>
    <form id="form-sl">
      <div class="modal-body">${camposSL(s)}</div>
      <div class="modal-foot"><button type="button" class="btn btn-secondary" onclick="cerrarModal('modal-sl')">Cancelar</button><button type="submit" class="btn">Guardar</button></div>
    </form>`, { size: 'modal-lg' });
  document.getElementById('form-sl').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const datos = capturar(ev);
    Object.assign(s, datos, { nroSocio: Number(datos.nroSocio), editadoEn: new Date().toISOString() });
    supaSync('situacionesLegales', s)
      .then(() => { cerrarModal('modal-sl'); showToast('Situación actualizada', 'ok'); renderSituacionesLegalesInicial(); })
      .catch((e) => showToast(e.message, 'err'));
  });
}

export function guardarSituacionLegal(datos, _s) {
  if (!datos.nroSocio) { showToast('N° de socio obligatorio.', 'err'); return; }
  if (datos.fechaFin && datos.fechaInicio > datos.fechaFin) { showToast('La fecha de fin no puede ser menor a la de inicio.', 'err'); return; }
  const leg = (DB.legajos || []).find((l) => String(l.nro) === String(datos.nroSocio));
  const s = {
    id: Date.now().toString(),
    nroSocio: Number(datos.nroSocio),
    nombreAsociado: datos.nombreAsociado || leg?.nombre || '',
    servicio: leg?.servicio || '',
    legajoIdLocal: String(datos.nroSocio),
    tipo: datos.tipo,
    fechaInicio: datos.fechaInicio,
    fechaFin: datos.fechaFin || '',
    motivo: datos.motivo || '',
    detalleMotivo: datos.detalleMotivo || '',
    estado: 'Vigente',
    creadoPor: getCurrentUser()?.nombre || '',
    editadoEn: new Date().toISOString(),
  };
  DB.situacionesLegales.push(s);
  supaSync('situacionesLegales', s)
    .then(() => { cerrarModal('modal-sl'); showToast('Situación legal cargada', 'ok'); renderSituacionesLegalesInicial(); })
    .catch((e) => showToast(e.message, 'err'));
}

export function marcarVencidaSituacion(id) {
  const s = getSituacionById(id);
  if (!s) return;
  s.estado = 'Vencida';
  supaSync('situacionesLegales', s)
    .then(() => { showToast('Situación marcada como vencida', 'ok'); renderSituacionesLegalesInicial(); })
    .catch((e) => showToast(e.message, 'err'));
}

export function anularSituacionLegalPorId(id) {
  const s = getSituacionById(id);
  if (!s) return;
  s.estado = 'Anulada';
  supaSync('situacionesLegales', s)
    .then(() => { showToast('Situación anulada', 'warn'); renderSituacionesLegalesInicial(); })
    .catch((e) => showToast(e.message, 'err'));
}

export function abrirModalConfigTipoSL() {
  ensureModal('modal-tipo-sl', `
    <div class="modal-head"><h2>Nuevo tipo de situación legal</h2><button class="modal-close" onclick="cerrarModal('modal-tipo-sl')">×</button></div>
    <form id="form-tipo-sl">
      <div class="modal-body"><div class="field"><label>Tipo</label><input name="nombre" required /></div></div>
      <div class="modal-foot"><button type="button" class="btn btn-secondary" onclick="cerrarModal('modal-tipo-sl')">Cancelar</button><button type="submit" class="btn">Guardar</button></div>
    </form>`, {});
  document.getElementById('form-tipo-sl').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const datos = capturar(ev);
    (DB.tiposSituacionesLegalesCfg ||= []).push({ id: Date.now().toString(), nombre: datos.nombre, anulado: false });
    supaSync('tiposSituacionesLegalesCfg', DB.tiposSituacionesLegalesCfg[DB.tiposSituacionesLegalesCfg.length - 1])
      .then(() => { cerrarModal('modal-tipo-sl'); showToast('Tipo agregado', 'ok'); });
  });
}

export function guardarTipoSL() { abrirModalConfigTipoSL(); }

export function eliminarTipoSL(nombre) {
  const t = (DB.tiposSituacionesLegalesCfg || []).find((x) => x.nombre === nombre);
  if (!t) return;
  t.anulado = true;
  supaSync('tiposSituacionesLegalesCfg', t)
    .then(() => showToast('Tipo anulado', 'warn'))
    .catch((e) => showToast(e.message, 'err'));
}
