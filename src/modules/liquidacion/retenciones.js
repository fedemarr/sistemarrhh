// Retenciones — Ganancias/IIBB/Decreto 814 con DNI de asociado.
// Fuente de verdad: 03_Liquidacion.md §3.7.

import { DB } from '../../state.js';
import { supaSync } from '../../shared/supabase.js';
import { ensureModal, cerrarModal, showToast, capturar } from '../../shared/modal.js';
import { esc } from '../../shared/helpers.js';

export const TIPOS_RETENCION = ['Ganancias', 'IIBB', 'Decreto 814'];

export function getRetencionById(id) {
  return (DB.retenciones || []).find((r) => String(r.id) === String(id));
}

export function renderRetenciones() {
  const cont = document.getElementById('screen-retenciones');
  cont.innerHTML = `
    <div class="toolbar">
      <input type="text" id="buscar-retencion" placeholder="Buscar por DNI / entidad…" oninput="filtrarRetenciones()" />
      <div class="spacer"></div>
      <button class="btn" onclick="abrirNuevaRetencion()">+ Nueva retención</button>
    </div>
    <div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>Asociado</th><th>DNI</th><th>Tipo</th><th>Entidad</th><th>N°</th><th>Monto</th><th>Periodo</th><th>Acciones</th></tr></thead>
      <tbody>
        ${(DB.retenciones || []).map((r) => `<tr>
          <td>${esc(r.nombreAsociado || '')}</td>
          <td>${esc(String(r.dni || ''))}</td>
          <td><span class="chip chip-azul">${esc(r.tipo || '')}</span></td>
          <td>${esc(r.entidad || '')}</td>
          <td>${esc(r.nro || '')}</td>
          <td>$${r.monto || 0}</td>
          <td>${esc(String(r.mes).padStart(2, '0') + '/' + r.anio)}</td>
          <td class="acciones">
            <button class="btn btn-secondary btn-sm" onclick="editarRetencion('${esc(String(r.id))}')">Editar</button>
            <button class="btn btn-danger btn-sm" onclick="anularRetencion('${esc(String(r.id))}')">Anular</button>
          </td>
        </tr>`).join('') || '<tr><td colspan="8" class="empty">Sin retenciones.</td></tr>'}
      </tbody>
    </table></div>`;
}

export function filtrarRetenciones() {
  const term = document.getElementById('buscar-retencion')?.value.toLowerCase() || '';
  document.querySelectorAll('#screen-retenciones tbody tr').forEach((tr) => tr.classList.toggle('hidden', !tr.textContent.toLowerCase().includes(term)));
}

export function abrirModalRetencion(r) {
  ensureModal('modal-retencion', `
    <div class="modal-head"><h2>${r ? 'Editar retención' : 'Nueva retención'}</h2><button class="modal-close" onclick="cerrarModal('modal-retencion')">×</button></div>
    <form id="form-retencion">
      <div class="modal-body">
        <div class="form-grid">
          <div class="field"><label>DNI del asociado *</label><input name="dni" value="${esc(r?.dni || '')}" onchange="autocompletarRetencion()" required /></div>
          <div class="field"><label>Asociado</label><input name="nombreAsociado" id="retencion-nombre" value="${esc(r?.nombreAsociado || '')}" /></div>
          <div class="field"><label>Tipo *</label>
            <select name="tipo">${TIPOS_RETENCION.map((t) => `<option ${r?.tipo === t ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
          <div class="field"><label>Entidad *</label><input name="entidad" value="${esc(r?.entidad || '')}" required /></div>
          <div class="field"><label>N° de retención</label><input name="nro" value="${esc(r?.nro || '')}" /></div>
          <div class="field"><label>Monto ($)</label><input type="number" name="monto" value="${r?.monto ?? 0}" step="0.01" /></div>
          <div class="field"><label>Año</label><input type="number" name="anio" value="${r?.anio ?? new Date().getFullYear()}" /></div>
          <div class="field"><label>Mes</label><input type="number" name="mes" value="${r?.mes ?? new Date().getMonth() + 1}" min="1" max="12" /></div>
        </div>
      </div>
      <div class="modal-foot"><button type="button" class="btn btn-secondary" onclick="cerrarModal('modal-retencion')">Cancelar</button><button type="submit" class="btn">Guardar</button></div>
    </form>`, { size: 'modal-lg' });
  document.getElementById('form-retencion').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const datos = capturar(ev);
    if (!datos.dni || !datos.entidad) { showToast('DNI y entidad son obligatorios.', 'err'); return; }
    const obj = { id: r?.id || Date.now().toString(), dni: String(datos.dni), nombreAsociado: datos.nombreAsociado, tipo: datos.tipo, entidad: datos.entidad, nro: datos.nro || '', monto: Number(datos.monto) || 0, anio: Number(datos.anio), mes: Number(datos.mes), estado: 'Activo' };
    if (r) {
      const idx = (DB.retenciones || []).findIndex((x) => String(x.id) === String(r.id));
      if (idx >= 0) DB.retenciones[idx] = obj; else DB.retenciones.push(obj);
    } else {
      (DB.retenciones ||= []).push(obj);
    }
    supaSync('retenciones', obj)
      .then(() => { cerrarModal('modal-retencion'); showToast('Retención guardada', 'ok'); renderRetenciones(); })
      .catch((e) => showToast(e.message, 'err'));
  });
}

export function autocompletarRetencion() {
  const form = document.getElementById('form-retencion');
  if (!form) return;
  const dni = form.elements.dni.value;
  const leg = (DB.legajos || []).find((l) => String(l.dni) === String(dni));
  if (leg) { const n = document.getElementById('retencion-nombre'); if (n) n.value = leg.nombre || ''; }
}

export function abrirNuevaRetencion() { abrirModalRetencion(null); }
export function guardarRetencion() { abrirModalRetencion(null); }
export function editarRetencion(id) { abrirModalRetencion(getRetencionById(id)); }

export function anularRetencion(id) {
  const r = getRetencionById(id);
  if (!r) return;
  r.estado = 'Anulado';
  supaSync('retenciones', r)
    .then(() => { showToast('Retención anulada', 'warn'); renderRetenciones(); })
    .catch((e) => showToast(e.message, 'err'));
}
