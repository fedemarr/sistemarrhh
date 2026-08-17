// Liquidación por horas — nómina, cálculo y cierre de liquidación.
// Fuente de verdad: 03_Liquidacion.md §3.1.

import { DB } from '../../state.js';
import { supaSync } from '../../shared/supabase.js';
import { ensureModal, cerrarModal, showToast, capturar } from '../../shared/modal.js';
import { esc } from '../../shared/helpers.js';
import { getCurrentUser } from '../../shared/auth.js';
import { obtenerCategorias, calcularSalario, valorCategoria1, resumenPeriodo, obtenerHorasLiquidacion, redondear2 } from './liqUtils.js';

export const HS_MINIMO = 200;

export function obtenerValorHoraDe(categoria, anio, mes) {
  const salario = calcularSalario(categoria, anio, mes);
  return redondear2(salario / HS_MINIMO);
}

export function getLiquidacionHorasById(id) {
  return (DB.liquidacionesHoras || []).find((l) => String(l.id) === String(id));
}

export function renderLiquidacionHorasInicial(tab = 'borradores') {
  const cont = document.getElementById('screen-liquidacion_horas');
  if (!cont) return;
  const lista = DB.liquidacionesHoras || [];
  const borradores = lista.filter((l) => l.estado === 'Borrador');
  cont.innerHTML = `
    <div class="tabs">
      ${[['borradores', `Borradores (${borradores.length})`], ['liquidados', `Liquidados (${lista.filter((l) => l.estado === 'Liquidado').length})`], ['anulados', `Anulados (${lista.filter((l) => l.estado === 'Anulado').length})`]]
        .map(([k, l]) => `<button class="tab-btn ${tab === k ? 'active' : ''}" onclick="renderLiquidacionHorasInicial('${k}')">${l}</button>`).join('')}
    </div>
    <div class="toolbar">
      <input type="text" id="buscar-liq-horas" placeholder="Buscar…" oninput="filtrarLiquidacionesHoras()" />
      <div class="spacer"></div>
      <button class="btn" onclick="abrirNuevaLiquidacionHoras()">+ Nueva liquidación</button>
    </div>
    <div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>N°</th><th>Asociado</th><th>Periodo</th><th>Horas</th><th>Bruto</th><th>Descuentos</th><th>Neto</th><th>Estado</th><th>Acciones</th></tr></thead>
      <tbody>
        ${lista.filter((l) => (tab === 'borradores' ? l.estado === 'Borrador' : tab === 'liquidados' ? l.estado === 'Liquidado' : l.estado === 'Anulado')).map((l) => {
          let acciones = `<button class="btn btn-secondary btn-sm" onclick="verLiquidacionHoras('${esc(String(l.id))}')">Ver</button>`;
          if (l.estado === 'Borrador') {
            acciones += `<button class="btn btn-secondary btn-sm" onclick="abrirEditarLiquidacionHorasPorId('${esc(String(l.id))}')">Editar</button>`;
            acciones += `<button class="btn btn-success btn-sm" onclick="liquidarHorasPorId('${esc(String(l.id))}')">Liquidar</button>`;
            acciones += `<button class="btn btn-danger btn-sm" onclick="anularLiquidacionHorasPorId('${esc(String(l.id))}')">Anular</button>`;
          }
          return `<tr>
            <td>${esc(String(l.nroSocio || ''))}</td>
            <td>${esc(l.nombreAsociado || '')}</td>
            <td>${esc(String(l.mes || '').padStart(2, '0') + '/' + l.anio)}</td>
            <td>${esc(String(l.horasTrabajadas ?? ''))}</td>
            <td>$${redondear2(l.sueldoBruto)}</td>
            <td>$${redondear2(l.descuentosTotal)}</td>
            <td><strong>$${redondear2(l.sueldoNeto)}</strong></td>
            <td><span class="chip ${l.estado === 'Liquidado' ? 'chip-verde' : l.estado === 'Anulado' ? 'chip-gris' : 'chip-naranja'}">${esc(l.estado)}</span></td>
            <td class="acciones">${acciones}</td>
          </tr>`;
        }).join('') || '<tr><td colspan="9" class="empty">Sin liquidaciones.</td></tr>'}
      </tbody>
    </table></div>`;
}

export function filtrarLiquidacionesHoras() {
  const term = document.getElementById('buscar-liq-horas')?.value.toLowerCase() || '';
  document.querySelectorAll('#screen-liquidacion-horas tbody tr').forEach((tr) => tr.classList.toggle('hidden', !tr.textContent.toLowerCase().includes(term)));
}

export function verLiquidacionHoras(id) {
  const l = getLiquidacionHorasById(id);
  if (!l) return;
  ensureModal('modal-liq-horas-ver', `
    <div class="modal-head"><h2>Liquidación de horas — ${esc(l.nombreAsociado || '')}</h2><button class="modal-close" onclick="cerrarModal('modal-liq-horas-ver')">×</button></div>
    <div class="modal-body">
      <div class="grid3">
        ${[['N°', l.nroSocio], ['Periodo', `${String(l.mes).padStart(2, '0')}/${l.anio}`], ['Servicio', l.servicio], ['Categoría', l.categoria], ['Horas trabajadas', l.horasTrabajadas], ['Valor hora', `$${l.valorHora}`], ['Bruto', `$${redondear2(l.sueldoBruto)}`], ['Descuentos', `$${redondear2(l.descuentosTotal)}`], ['Neto', `$${redondear2(l.sueldoNeto)}`], ['Estado', l.estado], ['Observaciones', l.observaciones]]
          .map(([k, val]) => `<div><strong>${k}:</strong><br/>${esc(val === null || val === undefined || val === '' ? '—' : String(val))}</div>`).join('')}
      </div>
    </div>
    <div class="modal-foot"><button class="btn btn-secondary" onclick="cerrarModal('modal-liq-horas-ver')">Cerrar</button></div>
  `, {});
}

export function abrirNuevaLiquidacionHoras() {
  ensureModal('modal-liq-horas', `
    <div class="modal-head"><h2>Nueva liquidación de horas</h2><button class="modal-close" onclick="cerrarModal('modal-liq-horas')">×</button></div>
    <form id="form-liq-horas">
      <div class="modal-body">
        <div class="form-grid">
          <div class="field"><label>N° de socio *</label><input name="nroSocio" onchange="autocompletarLiquidacion()" required /></div>
          <div class="field"><label>Asociado</label><input name="nombreAsociado" id="liq-nombre" /></div>
          <div class="field"><label>Servicio</label><input name="servicio" id="liq-servicio" /></div>
          <div class="field"><label>Categoría</label>
            <select name="categoria" id="liq-categoria" onchange="pintarValorHora()">${obtenerCategorias().map((c) => `<option>${esc(c.nombre)}</option>`).join('')}</select></div>
          <div class="field"><label>Año *</label><input type="number" name="anio" id="liq-anio" value="${new Date().getFullYear()}" required /></div>
          <div class="field"><label>Mes *</label><input type="number" name="mes" id="liq-mes" value="${new Date().getMonth() + 1}" min="1" max="12" required /></div>
          <div class="field"><label>Horas trabajadas *</label><input type="number" name="horasTrabajadas" id="liq-horas" min="0" oninput="pintarValorHora()" required /></div>
          <div class="field"><label>Valor hora</label><input name="valorHora" id="liq-valor-hora" readonly /></div>
          <div class="field full"><label>Observaciones</label><textarea name="observaciones" rows="2"></textarea></div>
        </div>
        <p id="liq-preview" class="muted"></p>
      </div>
      <div class="modal-foot"><button type="button" class="btn btn-secondary" onclick="cerrarModal('modal-liq-horas')">Cancelar</button><button type="submit" class="btn">Guardar borrador</button></div>
    </form>`, { size: 'modal-lg' });
  pintarValorHora();
  document.getElementById('form-liq-horas').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const datos = capturar(ev);
    guardarLiquidacionHoras(datos, null);
  });
}

export function autocompletarLiquidacion() {
  const form = document.getElementById('form-liq-horas');
  if (!form) return;
  const nro = form.elements.nroSocio.value;
  const leg = (DB.legajos || []).find((l) => String(l.nro) === String(nro));
  if (leg) {
    const n = document.getElementById('liq-nombre'); if (n) n.value = leg.nombre || '';
    const s = document.getElementById('liq-servicio'); if (s) s.value = leg.servicio || '';
    const c = document.getElementById('liq-categoria');
    if (c && leg.categoria && [...c.options].some((o) => o.value === leg.categoria)) c.value = leg.categoria;
  }
  pintarValorHora();
}

export function pintarValorHora() {
  const categoria = document.getElementById('liq-categoria')?.value;
  const anio = Number(document.getElementById('liq-anio')?.value) || new Date().getFullYear();
  const mes = Number(document.getElementById('liq-mes')?.value) || new Date().getMonth() + 1;
  const horas = Number(document.getElementById('liq-horas')?.value) || 0;
  const vh = obtenerValorHoraDe(categoria, anio, mes);
  const vhEl = document.getElementById('liq-valor-hora');
  if (vhEl) vhEl.value = vh;
  const preview = document.getElementById('liq-preview');
  if (preview) preview.textContent = `Bruto estimado: $${redondear2(horas * vh)} (valor hora $${vh}).`;
}

export function abrirEditarLiquidacionHorasPorId(id) {
  const l = getLiquidacionHorasById(id);
  if (!l) return;
  if (l.estado !== 'Borrador') { showToast('Solo se editan borradores.', 'warn'); return; }
  ensureModal('modal-liq-horas', `
    <div class="modal-head"><h2>Editar liquidación</h2><button class="modal-close" onclick="cerrarModal('modal-liq-horas')">×</button></div>
    <form id="form-liq-horas">
      <div class="modal-body">
        <div class="form-grid">
          <div class="field"><label>N° de socio</label><input name="nroSocio" value="${esc(l.nroSocio)}" /></div>
          <div class="field"><label>Asociado</label><input name="nombreAsociado" value="${esc(l.nombreAsociado || '')}" /></div>
          <div class="field"><label>Servicio</label><input name="servicio" value="${esc(l.servicio || '')}" /></div>
          <div class="field"><label>Categoría</label>
            <select name="categoria">${obtenerCategorias().map((c) => `<option ${l.categoria === c.nombre ? 'selected' : ''}>${esc(c.nombre)}</option>`).join('')}</select></div>
          <div class="field"><label>Año</label><input type="number" name="anio" value="${l.anio}" /></div>
          <div class="field"><label>Mes</label><input type="number" name="mes" value="${l.mes}" min="1" max="12" /></div>
          <div class="field"><label>Horas trabajadas</label><input type="number" name="horasTrabajadas" value="${l.horasTrabajadas}" min="0" /></div>
          <div class="field"><label>Observaciones</label><textarea name="observaciones" rows="2">${esc(l.observaciones || '')}</textarea></div>
        </div>
      </div>
      <div class="modal-foot"><button type="button" class="btn btn-secondary" onclick="cerrarModal('modal-liq-horas')">Cancelar</button><button type="submit" class="btn">Guardar</button></div>
    </form>`, { size: 'modal-lg' });
  document.getElementById('form-liq-horas').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const datos = capturar(ev);
    guardarLiquidacionHoras(datos, l);
  });
}

export function validarLiquidacionHoras(datos) {
  if (!datos.nroSocio) return 'N° de socio obligatorio.';
  if (!(DB.legajos || []).some((l) => String(l.nro) === String(datos.nroSocio))) return 'Socio inexistente.';
  if (!datos.anio || !datos.mes) return 'Periodo obligatorio.';
  if (Number(datos.horasTrabajadas) < 0) return 'Horas no pueden ser negativas.';
  const existente = obtenerHorasLiquidacion(datos.nroSocio, datos.anio, datos.mes);
  return null;
}

export function guardarLiquidacionHoras(datos, l) {
  const error = validarLiquidacionHoras(datos);
  if (error) { showToast(error, 'err'); return; }
  const categoria = datos.categoria || 'Categoría 1';
  const valorHora = obtenerValorHoraDe(categoria, datos.anio, datos.mes);
  const sueldoBruto = redondear2((Number(datos.horasTrabajadas) || 0) * valorHora);
  const descuentosTotal = 0;
  const datos2 = {
    nroSocio: Number(datos.nroSocio),
    nombreAsociado: datos.nombreAsociado || '',
    servicio: datos.servicio || '',
    categoria,
    anio: Number(datos.anio),
    mes: Number(datos.mes),
    horasTrabajadas: Number(datos.horasTrabajadas) || 0,
    valorHora,
    sueldoBruto,
    descuentosTotal,
    sueldoNeto: redondear2(sueldoBruto - descuentosTotal),
    observaciones: datos.observaciones || '',
  };
  if (!l) {
    const nueva = { id: Date.now().toString(), ...datos2, estado: 'Borrador', editadoPor: getCurrentUser()?.nombre || '', editadoEn: new Date().toISOString() };
    DB.liquidacionesHoras.push(nueva);
    supaSync('liquidacionesHoras', nueva)
      .then(() => { cerrarModal('modal-liq-horas'); showToast('Liquidación guardada', 'ok'); renderLiquidacionHorasInicial('borradores'); })
      .catch((e) => showToast(e.message, 'err'));
  } else {
    Object.assign(l, datos2, { editadoEn: new Date().toISOString() });
    supaSync('liquidacionesHoras', l)
      .then(() => { cerrarModal('modal-liq-horas'); showToast('Liquidación actualizada', 'ok'); renderLiquidacionHorasInicial('borradores'); })
      .catch((e) => showToast(e.message, 'err'));
  }
}

export function liquidarHorasPorId(id) {
  const l = getLiquidacionHorasById(id);
  if (!l) return;
  l.estado = 'Liquidado';
  l.fechaLiquidacion = new Date().toISOString();
  supaSync('liquidacionesHoras', l)
    .then(() => { showToast('Liquidación cerrada', 'ok'); renderLiquidacionHorasInicial('liquidados'); })
    .catch((e) => showToast(e.message, 'err'));
}

export function anularLiquidacionHorasPorId(id) {
  const l = getLiquidacionHorasById(id);
  if (!l) return;
  l.estado = 'Anulado';
  supaSync('liquidacionesHoras', l)
    .then(() => { showToast('Liquidación anulada', 'warn'); renderLiquidacionHorasInicial('anulados'); })
    .catch((e) => showToast(e.message, 'err'));
}
