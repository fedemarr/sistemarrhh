// Competencia Anual — resultados, detalle y aprobación de conclusiones.
// Fuente de verdad: 02_Gestion_Personal.md §2.2.

import { DB } from '../../state.js';
import { supaSync } from '../../shared/supabase.js';
import { ensureModal, cerrarModal, showToast } from '../../shared/modal.js';
import { esc, fechaISOToDisplay } from '../../shared/helpers.js';
import { getCurrentUser } from '../../shared/auth.js';
import { totalesPorAsociado, resultadoAnual, promediarPuntosAnio, puntosPorRegla } from './movimientos.js';

export const RANGOS = ['Todos', 'Sobresaliente', 'Conforme', 'Mejoras', 'Insuficiente'];

export function renderResultados(tab = 'puntuaciones') {
  const cont = document.getElementById('screen-resultados');
  const anio = Number(document.getElementById('comp-anio')?.value) || new Date().getFullYear();
  const totales = totalesPorAsociado(anio);
  const filtrosModulo = [...new Set((DB.eventosCompetencia || []).filter((e) => !e.anulado && (e.fecha || '').startsWith(String(anio))).map((e) => e.origenModulo))];
  const promedio = promediarPuntosAnio(anio);

  cont.innerHTML = `
    <div class="stats">
      <div class="stat"><div class="num">${totales.length}</div><div class="lbl">Evaluados</div></div>
      <div class="stat"><div class="num">${promedio}</div><div class="lbl">Puntaje promedio</div></div>
      <div class="stat"><div class="num">${totales.filter((t) => t.puntos >= 8).length}</div><div class="lbl">Sobresalientes</div></div>
      <div class="stat"><div class="num">${totales.filter((t) => t.puntos < 2).length}</div><div class="lbl">Insuficientes</div></div>
    </div>
    <div class="toolbar">
      <label>Año <input type="number" id="comp-anio" value="${anio}" min="2020" max="2100" style="width:80px" onchange="renderResultados('${tab}')" /></label>
      <div class="spacer"></div>
      <button class="btn" onclick="exportarResultadosCSV()">Exportar CSV</button>
    </div>
    <div class="tabs">
      ${[['puntuaciones', 'Puntuaciones'], ['detalle', 'Detalle anual'], ['grafico', 'Gráfico por rango']]
        .map(([k, l]) => `<button class="tab-btn ${tab === k ? 'active' : ''}" onclick="renderResultados('${k}')">${l}</button>`).join('')}
    </div>
    <div id="resultados-contenido"></div>`;
  const panel = document.getElementById('resultados-contenido');

  if (tab === 'detalle') {
    panel.innerHTML = `
      <div class="toolbar">
        <select id="filtro-rango" onchange="filtrarResultados()">${RANGOS.map((r) => `<option>${r}</option>`).join('')}</select>
        <select id="filtro-modulo" onchange="filtrarResultados()"><option value="">Todos los módulos</option>${filtrosModulo.map((m) => `<option value="${esc(m)}">${esc(m)}</option>`).join('')}</select>
        <input type="text" id="buscar-resultado" placeholder="Buscar por N° o nombre…" oninput="filtrarResultados()" />
      </div>
      <div class="tbl-wrap"><table class="tbl">
        <thead><tr><th>N°</th><th>Nombre</th><th>Eventos</th><th>Puntos</th><th>Conclusión</th><th>Acciones</th></tr></thead>
        <tbody>
          ${totales.map((t) => {
            const leg = (DB.legajos || []).find((l) => String(l.nro) === String(t.protagonista));
            const res = resultadoAnual(t.protagonista, anio);
            return `<tr data-puntos="${t.puntos}" data-modulos="${(DB.eventosCompetencia || []).filter((e) => e.protagonista === t.protagonista && !e.anulado && (e.fecha || '').startsWith(String(anio))).map((e) => e.origenModulo).join(' ')}">
              <td>${esc(String(t.protagonista))}</td>
              <td>${esc(leg?.nombre || '')}</td>
              <td>${t.eventos.length}</td>
              <td><strong>${t.puntos}</strong></td>
              <td>${chipConclusion(res.conclusion)}</td>
              <td class="acciones"><button class="btn btn-secondary btn-sm" onclick="verDetalleResultado('${t.protagonista}', ${anio})">Ver detalle</button></td>
            </tr>`;
          }).join('') || '<tr><td colspan="6" class="empty">Sin eventos cargados para este año.</td></tr>'}
        </tbody>
      </table></div>`;
    return;
  }
  if (tab === 'grafico') {
    const categorias = [
      ['Sobresaliente (≥8)', totales.filter((t) => t.puntos >= 8).length, 'chip-verde'],
      ['Conforme (5-7)', totales.filter((t) => t.puntos >= 5 && t.puntos < 8).length, 'chip-azul'],
      ['Mejoras (2-4)', totales.filter((t) => t.puntos >= 2 && t.puntos < 5).length, 'chip-naranja'],
      ['Insuficiente (<2)', totales.filter((t) => t.puntos < 2).length, 'chip-rojo'],
    ];
    const max = Math.max(...categorias.map(([, c]) => c), 1);
    panel.innerHTML = `<div class="card"><h3>Distribución anual ${anio}</h3>
      ${categorias.map(([lbl, c, cls]) => `
        <div class="barra-row"><div class="barra-lbl">${lbl}</div>
        <div class="barra-track"><div class="barra-fill ${cls}" style="width:${(c / max) * 100}%"></div></div>
        <div class="barra-val">${c}</div></div>`).join('')}
      <p class="muted">Puntaje promedio: ${promedio}</p></div>`;
    return;
  }
  panel.innerHTML = `<div class="tbl-wrap"><table class="tbl">
    <thead><tr><th>N°</th><th>Nombre</th><th>Puntos</th></tr></thead>
    <tbody>${totales.map((t) => {
      const leg = (DB.legajos || []).find((l) => String(l.nro) === String(t.protagonista));
      return `<tr><td>${esc(String(t.protagonista))}</td><td>${esc(leg?.nombre || '')}</td><td><strong>${t.puntos}</strong></td></tr>`;
    }).join('') || '<tr><td colspan="3" class="empty">Sin datos.</td></tr>'}
    </tbody></table></div>`;
}

export function filtrarResultados() {
  const rango = document.getElementById('filtro-rango')?.value || 'Todos';
  const modulo = document.getElementById('filtro-modulo')?.value || '';
  const term = (document.getElementById('buscar-resultado')?.value || '').toLowerCase();
  const filas = document.querySelectorAll('#resultados-contenido tbody tr');
  filas.forEach((tr) => {
    const puntos = Number(tr.dataset.puntos ?? 0);
    let okRango = rango === 'Todos';
    if (rango === 'Sobresaliente') okRango = puntos >= 8;
    if (rango === 'Conforme') okRango = puntos >= 5 && puntos < 8;
    if (rango === 'Mejoras') okRango = puntos >= 2 && puntos < 5;
    if (rango === 'Insuficiente') okRango = puntos < 2;
    const okModulo = !modulo || (tr.dataset.modulos || '').includes(modulo);
    const okTerm = !term || tr.textContent.toLowerCase().includes(term);
    tr.classList.toggle('hidden', !(okRango && okModulo && okTerm));
  });
}

export function seleccionarResultadoAnio(anio) {
  renderResultados('detalle');
}

export function verDetalleResultado(protagonista, anio) {
  const leg = (DB.legajos || []).find((l) => String(l.nro) === String(protagonista));
  const eventos = (DB.eventosCompetencia || []).filter((e) => e.protagonista === Number(protagonista) && (e.fecha || '').startsWith(String(anio)) && !e.anulado);
  const res = resultadoAnual(protagonista, anio);
  ensureModal('modal-detalle-resultado', `
    <div class="modal-head"><h2>Resultado ${anio} — ${esc(leg?.nombre || 'Socio ' + protagonista)}</h2><button class="modal-close" onclick="cerrarModal('modal-detalle-resultado')">×</button></div>
    <div class="modal-body">
      <div class="stats">
        <div class="stat"><div class="num">${res.puntos}</div><div class="lbl">Puntos</div></div>
        <div class="stat"><div class="num">${esc(res.conclusion)}</div><div class="lbl">Conclusión</div></div>
        <div class="stat"><div class="num">${eventos.length}</div><div class="lbl">Eventos</div></div>
      </div>
      <div class="tbl-wrap"><table class="tbl">
        <thead><tr><th>Fecha</th><th>Regla</th><th>Puntos</th><th>Módulo</th><th>Observaciones</th></tr></thead>
        <tbody>
          ${eventos.map((e) => `<tr>
            <td>${esc(fechaISOToDisplay(e.fecha))}</td>
            <td>${esc(e.reglaCodigo)}</td>
            <td>${puntosPorRegla(e.reglaCodigo)}</td>
            <td>${esc(e.origenModulo)}</td>
            <td>${esc(e.observaciones || '')}</td>
          </tr>`).join('') || '<tr><td colspan="5" class="empty">Sin eventos.</td></tr>'}
        </tbody>
      </table></div>
      <button class="btn" onclick="aprobarResultadoConclusion(${protagonista}, ${anio})">${res.conclusion === 'Desempeño insuficiente' ? 'Confirmar plan de mejora' : 'Aprobar conclusión'}</button>
    </div>
    <div class="modal-foot"><button class="btn btn-secondary" onclick="cerrarModal('modal-detalle-resultado')">Cerrar</button></div>
  `, { size: 'modal-lg' });
}

export function aprobarResultadoConclusion(protagonista, anio) {
  const res = resultadoAnual(protagonista, anio);
  const entrada = (DB.resultadosCompetencia || []).find((r) => r.protagonista === Number(protagonista) && r.anio === Number(anio));
  const nuevo = entrada || { id: `${protagonista}-${anio}`, protagonista: Number(protagonista), anio: Number(anio), puntos: res.puntos, conclusion: res.conclusion, aprobadoPor: getCurrentUser()?.nombre || '', aprobadoEn: new Date().toISOString(), planMejora: '' };
  if (!entrada) Object.assign(nuevo, { puntos: res.puntos, conclusion: res.conclusion, aprobadoPor: getCurrentUser()?.nombre || '', aprobadoEn: new Date().toISOString() });
  else Object.assign(nuevo, { puntos: res.puntos, conclusion: res.conclusion });
  (DB.resultadosCompetencia ||= []).filter((r) => !(r.protagonista === Number(protagonista) && r.anio === Number(anio)));
  DB.resultadosCompetencia.push(nuevo);
  supaSync('resultadosCompetencia', nuevo)
    .then(() => { showToast('Conclusión aprobada', 'ok'); cerrarModal('modal-detalle-resultado'); renderResultados('detalle'); })
    .catch((e) => showToast(e.message, 'err'));
}

export function exportarResultadosCSV() {
  const anio = Number(document.getElementById('comp-anio')?.value) || new Date().getFullYear();
  const totales = totalesPorAsociado(anio);
  const filas = [['Nro', 'Nombre', 'Puntos', 'Conclusion']];
  for (const t of totales) {
    const leg = (DB.legajos || []).find((l) => String(l.nro) === String(t.protagonista));
    filas.push([t.protagonista, leg?.nombre || '', t.puntos, resultadoAnual(t.protagonista, anio).conclusion]);
  }
  const blob = new Blob(['\ufeff' + filas.map((f) => f.join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `competencia_${anio}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function renderPuntuacionesAnio(anio) {
  renderResultados('puntuaciones');
}

export function resumenAnalista() {
  renderResultados('grafico');
}
