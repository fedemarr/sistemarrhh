// Psicotécnico — registro y gestión de evaluaciones psicotécnicas.
// Fuente de verdad: 01_Flujo_Ingreso.md §1.3.

import { DB } from '../../state.js';
import { supaSync } from '../../shared/supabase.js';
import { ensureModal, cerrarModal, showToast, capturar } from '../../shared/modal.js';
import { esc, fechaISOToDisplay } from '../../shared/helpers.js';
import { getCurrentUser } from '../../shared/auth.js';
import { analizarConGemini } from '../../shared/ai.js';
import { subirAdjunto, htmlAdjuntos, verAdjunto } from '../../shared/adjuntos.js';

export const RESULTADOS_PSICO = ['Pendiente', 'Apto+', 'Apto', 'Apto-', 'Apto condicional', 'No Apto'];
export const ETAPAS_PSICO = [
  { key: 'psicotecnico', label: 'Psicotécnico', obligatoria: true },
  { key: 'prelaboral', label: 'Prelaboral', obligatoria: true },
  { key: 'antecedentes', label: 'Antecedentes', obligatoria: false },
  { key: 'libreta', label: 'Libreta sanitaria', obligatoria: false },
];

export function yaIngresadoPsico(dni) {
  return (DB.catAltPendientes || []).some((c) => c.dni === dni && c.estado === 'Alta completada');
}

export function getPsicoById(id) {
  return (DB.psicos || []).find((p) => String(p.id) === String(id));
}

let _verPsico = 'activos';

export function renderPsico() {
  const cont = document.getElementById('screen-psicotecnico');
  const ver = _verPsico;
  const buscar = document.getElementById('psico-buscar')?.value || '';

  const lista = (DB.psicos || [])
    .filter((p) => {
      const historico = ver === 'historico' ? true : ver === 'ingresados' ? yaIngresadoPsico(p.dni) : false;
      if (ver === 'ingresados') return yaIngresadoPsico(p.dni);
      if (ver === 'activos') return !yaIngresadoPsico(p.dni) && p.estado !== 'Ingreso';
      if (ver === 'historico') return yaIngresadoPsico(p.dni) || p.estado === 'Ingreso';
      return historico;
    })
    .filter((p) => !buscar || String(p.nombre || '').toLowerCase().includes(buscar.toLowerCase()) || String(p.dni).includes(buscar));

  const sinFecha = lista.filter((p) => !p.fechaRealizacion);
  const conFecha = lista.filter((p) => p.fechaRealizacion).sort((a, b) => a.fechaRealizacion.localeCompare(b.fechaRealizacion));
  const ordenado = conFecha.concat(sinFecha);

  const stats = {
    total: (DB.psicos || []).length,
    enProceso: (DB.psicos || []).filter((p) => p.estado === 'En proceso').length,
    aprobados: (DB.psicos || []).filter((p) => p.estado === 'Aprobado').length,
    ingresados: (DB.psicos || []).filter((p) => yaIngresadoPsico(p.dni)).length,
  };

  cont.innerHTML = `
    <div class="stats">
      <div class="stat"><div class="num">${stats.total}</div><div class="lbl">Evaluaciones</div></div>
      <div class="stat"><div class="num">${stats.enProceso}</div><div class="lbl">En proceso</div></div>
      <div class="stat"><div class="num">${stats.aprobados}</div><div class="lbl">Aprobados</div></div>
      <div class="stat"><div class="num">${stats.ingresados}</div><div class="lbl">Con alta completada</div></div>
    </div>
    <div class="toolbar">
      <button class="btn ${ver === 'activos' ? '' : 'btn-secondary'}" onclick="tabPsico('activos')">Activos</button>
      <button class="btn ${ver === 'ingresados' ? '' : 'btn-secondary'}" onclick="tabPsico('ingresados')">Ya ingresados</button>
      <button class="btn ${ver === 'historico' ? '' : 'btn-secondary'}" onclick="tabPsico('historico')">Histórico</button>
      <input type="text" id="psico-buscar" placeholder="Buscar por DNI / nombre…" value="${esc(buscar)}" oninput="renderPsico()" />
      <div class="spacer"></div>
      <button class="btn" onclick="abrirNuevoPsico()">+ Nueva evaluación</button>
    </div>
    <div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>Nombre</th><th>DNI</th><th>Fecha</th><th>Resultado</th><th>Etapas</th><th>Estado</th><th>Acciones</th></tr></thead>
      <tbody>
        ${ordenado.length ? ordenado.map(filaPsico).join('') : '<tr><td colspan="7" class="empty">Sin evaluaciones.</td></tr>'}
      </tbody>
    </table></div>`;
}

export function tabPsico(ver) {
  _verPsico = ver;
  renderPsico();
}

function chipEtapas(etapas) {
  const e = etapas || {};
  return ETAPAS_PSICO.map(({ key, label }) => {
    const ok = !!e[key];
    return `<span class="chip ${ok ? 'chip-verde' : 'chip-gris'}" title="${label}">${label.slice(0, 8)}${ok ? '✓' : ''}</span>`;
  }).join(' ');
}

function chipEstadoPsico(e) {
  const cls = e === 'Aprobado' || e === 'Ingreso' ? 'chip-verde' : e === 'Rechazado' ? 'chip-rojo' : 'chip-naranja';
  return `<span class="chip ${cls}">${esc(e)}</span>`;
}

function filaPsico(p) {
  const acciones = [];
  if (p.estado === 'En proceso') {
    acciones.push(`<button class="btn btn-sm" onclick="abrirGestionPsico('${esc(String(p.id))}')">Gestionar</button>`);
  } else {
    acciones.push(`<button class="btn btn-secondary btn-sm" onclick="abrirGestionPsico('${esc(String(p.id))}')">Ver</button>`);
    if (p.estado !== 'Ingreso' && !yaIngresadoPsico(p.dni)) {
      acciones.push(`<button class="btn btn-secondary btn-sm" onclick="revertirPsico('${esc(String(p.id))}')">Revertir</button>`);
    }
  }
  return `<tr>
    <td>${esc(p.nombre || '')}</td>
    <td>${esc(p.dni || '')}</td>
    <td>${p.fechaRealizacion ? esc(fechaISOToDisplay(p.fechaRealizacion)) : '<span class="muted">Sin fecha</span>'}</td>
    <td><span class="chip ${p.resultado === 'No Apto' ? 'chip-rojo' : p.resultado === 'Apto' || p.resultado === 'Apto+' ? 'chip-verde' : p.resultado === 'Pendiente' ? 'chip-gris' : 'chip-naranja'}">${esc(p.resultado || 'Pendiente')}</span></td>
    <td>${chipEtapas(p.etapas)}</td>
    <td>${chipEstadoPsico(p.estado)}</td>
    <td class="acciones">${acciones.join('')}</td>
  </tr>`;
}

export function abrirNuevoPsico() {
  ensureModal('modal-psico', `
    <div class="modal-head"><h2>Nueva evaluación psicotécnica</h2><button class="modal-close" onclick="cerrarModal('modal-psico')">×</button></div>
    <form id="form-psico">
      <div class="modal-body">
        <div class="form-grid">
          <div class="field"><label>DNI *</label><input name="dni" required inputmode="numeric" placeholder="6-8 dígitos" /></div>
          <div class="field"><label>Candidato (id)</label><input name="candidatoId" placeholder="id_local del candidato" /></div>
          <div class="field full"><label>Nombre *</label><input name="nombre" required placeholder="Apellido, Nombre" /></div>
          <div class="field"><label>Fecha de realización</label><input type="date" name="fechaRealizacion" /></div>
          <div class="field"><label>Resultado</label>
            <select name="resultado">${RESULTADOS_PSICO.map((r) => `<option>${r}</option>`).join('')}</select>
          </div>
          <div class="field full"><label>Observaciones</label><textarea name="observaciones" rows="3"></textarea></div>
          <div class="field"><label>Informe psicotécnico (PDF/IMG)</label><input type="file" id="psico-informe" accept=".pdf,.jpg,.png" /></div>
          <div class="field"><label>Evaluación prelaboral (PDF/IMG)</label><input type="file" id="psico-prelaboral" accept=".pdf,.jpg,.png" /></div>
        </div>
      </div>
      <div class="modal-foot"><button type="button" class="btn btn-secondary" onclick="cerrarModal('modal-psico')">Cancelar</button><button type="submit" class="btn">Guardar</button></div>
    </form>`, {});
  document.getElementById('form-psico').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const datos = capturar(ev);
    if (datos.candidatoId) {
      const c = (DB.candidatos || []).find((x) => String(x.id) === String(datos.candidatoId));
      if (c) datos.nombre = datos.nombre || `${c.apellido}, ${c.nombre}`;
    }
    const p = {
      id: Date.now().toString(),
      dni: datos.dni,
      candidatoId: datos.candidatoId || null,
      nombre: datos.nombre,
      fechaRealizacion: datos.fechaRealizacion || '',
      resultado: datos.resultado || 'Pendiente',
      etapas: { psicotecnico: false, prelaboral: false, antecedentes: false, libreta: false },
      estado: 'En proceso',
      observaciones: datos.observaciones,
    };
    DB.psicos.push(p);
    supaSync('psicos', p)
      .then(async () => {
        const fInf = document.getElementById('psico-informe')?.files?.[0];
        if (fInf) await subirAdjunto({ etapa: 'psicotecnico', tipo: 'informe', refIdLocal: p.id, file: fInf }).catch(e => showToast(e.message, 'err'));
        const fPre = document.getElementById('psico-prelaboral')?.files?.[0];
        if (fPre) await subirAdjunto({ etapa: 'psicotecnico', tipo: 'prelaboral', refIdLocal: p.id, file: fPre }).catch(e => showToast(e.message, 'err'));
        cerrarModal('modal-psico'); showToast('Evaluación guardada', 'ok'); renderPsico();
      })
      .catch((e) => showToast(e.message, 'err'));
  });
}

export function abrirGestionPsico(id) {
  const p = getPsicoById(id);
  if (!p) return;
  const etapas = p.etapas || {};
  ensureModal('modal-psico-gestion', `
    <div class="modal-head accent psico"><h2>🧠 Psicotécnico — ${esc(p.nombre || '')}</h2><button class="modal-close" onclick="cerrarModal('modal-psico-gestion')">×</button></div>
    <form id="form-psico-etapas">
      <div class="modal-body">
        <div class="form-grid">
          <div class="field"><label>DNI</label><input value="${esc(p.dni)}" readonly /></div>
          <div class="field"><label>Fecha de realización</label><input type="date" name="fechaRealizacion" value="${esc(p.fechaRealizacion || '')}" /></div>
          <div class="field"><label>Resultado</label>
            <select name="resultado">${RESULTADOS_PSICO.map((r) => `<option ${p.resultado === r ? 'selected' : ''}>${r}</option>`).join('')}</select>
          </div>
          <div class="field"><label>Estado</label><input value="${esc(p.estado)}" readonly /></div>
          <div class="field full"><label>Observaciones</label><textarea name="observaciones" rows="2">${esc(p.observaciones || '')}</textarea></div>
        </div>
        <div class="adjunto-box psico">
          <h4>🎙️ Informe psicotécnico</h4>
          <div class="form-grid">
            <div class="field"><label>Informe psicotécnico</label>${htmlAdjuntos('psicotecnico', 'informe', p.id)}<input type="file" id="psico-gest-informe" accept=".pdf,.jpg,.png" /></div>
            <div class="field"><label>Evaluación prelaboral</label>${htmlAdjuntos('psicotecnico', 'prelaboral', p.id)}<input type="file" id="psico-gest-prelaboral" accept=".pdf,.jpg,.png" /></div>
          </div>
          <button type="button" class="btn btn-secondary" onclick="analizarInformePsicoIA('${esc(String(p.id))}')">🤖 Analizar con IA</button>
        </div>
        <div class="grupo"><legend>Etapas (${ETAPAS_PSICO.filter((e) => e.obligatoria).map((e) => e.label).join(' y ')} obligatorias)</legend>
          <div class="grid4">
            ${ETAPAS_PSICO.map(({ key, label }) => `<label class="field checkbox"><input type="checkbox" name="etapas_${key}" ${etapas[key] ? 'checked' : ''} /> ${label}</label>`).join('')}
          </div>
        </div>
        <div class="toolbar">
          <button type="button" class="btn btn-success" onclick="aprobarPsico('${esc(String(p.id))}')">✅ Aprobar</button>
          <button type="button" class="btn btn-danger" onclick="rechazarPsico('${esc(String(p.id))}')">❌ Rechazar</button>
        </div>
      </div>
      <div class="modal-foot"><button type="button" class="btn btn-secondary" onclick="cerrarModal('modal-psico-gestion')">Cerrar panel</button><button type="submit" class="btn">💾 Guardar etapas</button></div>
    </form>`, { size: 'modal-lg' });
  document.getElementById('form-psico-etapas').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const datos = capturar(ev);
    const etapasNuevas = {};
    for (const { key } of ETAPAS_PSICO) etapasNuevas[key] = Boolean(datos[`etapas_${key}`]);
    p.etapas = etapasNuevas;
    p.fechaRealizacion = datos.fechaRealizacion || p.fechaRealizacion;
    p.resultado = datos.resultado;
    p.observaciones = datos.observaciones;
    supaSync('psicos', p)
      .then(async () => {
        const fInf = document.getElementById('psico-gest-informe')?.files?.[0];
        if (fInf) await subirAdjunto({ etapa: 'psicotecnico', tipo: 'informe', refIdLocal: p.id, file: fInf }).catch(e => showToast(e.message, 'err'));
        const fPre = document.getElementById('psico-gest-prelaboral')?.files?.[0];
        if (fPre) await subirAdjunto({ etapa: 'psicotecnico', tipo: 'prelaboral', refIdLocal: p.id, file: fPre }).catch(e => showToast(e.message, 'err'));
        showToast('Etapas guardadas', 'ok'); abrirGestionPsico(p.id);
      })
      .catch((e) => showToast(e.message, 'err'));
  });
}

export function guardarEtapasPsico(id, etapas) {
  const p = getPsicoById(id);
  if (!p) return Promise.reject(new Error('Evaluación no encontrada'));
  p.etapas = etapas;
  return supaSync('psicos', p);
}

export function guardarPsico(datos) {
  const p = getPsicoById(datos.id);
  if (p) Object.assign(p, datos);
  else DB.psicos.push(datos);
  return supaSync('psicos', datos);
}

function etapasObligatoriasOk(p) {
  const e = p.etapas || {};
  return ETAPAS_PSICO.filter((x) => x.obligatoria).every((x) => e[x.key]);
}

export function aprobarPsico(id) {
  const p = getPsicoById(id);
  if (!p) return;
  if (p.estado !== 'En proceso') { showToast('Solo se aprueban evaluaciones En proceso.', 'warn'); return; }
  if (!etapasObligatoriasOk(p)) { showToast('Las etapas obligatorias (psicotécnico y prelaboral) deben estar completas.', 'err'); return; }
  // Guard de idempotencia por DNI: si ya está en altas con alta completada, no duplicar.
  if (yaIngresadoPsico(p.dni)) { showToast(`El DNI ${p.dni} ya ingresó (alta completada).`, 'warn'); return; }
  const yaEnAltas = (DB.catAltPendientes || []).some((c) => c.dni === p.dni && c.estado === 'Pendiente de alta');
  if (!yaEnAltas) {
    const alt = {
      id: Date.now().toString(),
      dni: p.dni,
      nombre: p.nombre,
      candidatoId: p.candidatoId,
      psicoId: p.id,
      estado: 'Pendiente de alta',
      creadoDesde: 'psico',
    };
    DB.catAltPendientes.push(alt);
    supaSync('catAltPendientes', alt).catch((e) => showToast(e.message, 'err'));
  }
  p.estado = 'Aprobado';
  p.resultado = p.resultado === 'Pendiente' ? 'Apto' : p.resultado;
  supaSync('psicos', p)
    .then(() => {
      showToast('Psicotécnico aprobado — pasa a Altas', 'ok');
      cerrarModal('modal-psico-gestion');
      renderPsico();
    })
    .catch((e) => showToast(e.message, 'err'));
}

export function rechazarPsico(id, motivo) {
  const p = getPsicoById(id);
  if (!p) return Promise.reject(new Error('Evaluación no encontrada'));
  if (!motivo) {
    motivo = window.prompt('Motivo del rechazo (obligatorio):', '')?.trim();
    if (!motivo) return Promise.reject(new Error('El motivo del rechazo es obligatorio'));
  }
  p.estado = 'Rechazado';
  p.resultado = p.resultado === 'Pendiente' ? 'No Apto' : p.resultado;
  if (motivo) p.observaciones = (p.observaciones ? p.observaciones + ' ' : '') + `[Rechazo: ${motivo}]`;
  // Actualiza el candidato original con el motivo
  if (p.candidatoId) {
    const c = (DB.candidatos || []).find((x) => String(x.id) === String(p.candidatoId));
    if (c && c.estado === 'En Psicotécnico') {
      c.estado = 'Rechazado';
      c.motivoRechazo = motivo || 'No apto en psicotécnico';
      supaSync('candidatos', c).catch(() => {});
    }
  }
  return supaSync('psicos', p).then(() => { showToast('Psicotécnico rechazado', 'warn'); cerrarModal('modal-psico-gestion'); renderPsico(); });
}

export function revertirPsico(id) {
  const p = getPsicoById(id);
  if (!p) return;
  const enAltas = (DB.catAltPendientes || []).some((c) => c.dni === p.dni && c.estado === 'Pendiente de alta');
  if (enAltas) { showToast('No se puede revertir: ya existe un alta pendiente para este DNI.', 'err'); return; }
  p.estado = 'En proceso';
  p.resultado = 'Pendiente';
  supaSync('psicos', p)
    .then(() => { showToast('Evaluación revertida a En proceso', 'ok'); renderPsico(); })
    .catch((e) => showToast(e.message, 'err'));
}

export async function analizarInformePsicoIA(id) {
  const p = getPsicoById(id);
  if (!p) return;
  showToast('Analizando informe psicotécnico con IA…', 'warn');
  try {
    const etapas = p.etapas || {};
    const prompt = `Analiza este informe psicotécnico y determina si el candidato es apto. Evaluá las capacidades cognitivas, personales y sociales.\n\nDatos:\n- Nombre: ${p.nombre}\n- DNI: ${p.dni}\n- Fecha realización: ${p.fechaRealizacion}\n- Resultado actual: ${p.resultado}\n- Etapas completadas: Psicotécnico=${etapas.psicotecnico ? 'Sí' : 'No'}, Prelaboral=${etapas.prelaboral ? 'Sí' : 'No'}, Antecedentes=${etapas.antecedentes ? 'Sí' : 'No'}, Libreta=${etapas.libreta ? 'Sí' : 'No'}\n- Observaciones: ${p.observaciones || 'Sin observaciones'}`;
    const respuesta = await analizarConGemini(prompt);
    ensureModal('modal-ia-resultado', `
      <div class="modal-head"><h2>Resultado IA — Informe Psicotécnico</h2><button class="modal-close" onclick="cerrarModal('modal-ia-resultado')">×</button></div>
      <div class="modal-body"><pre style="white-space:pre-wrap;font-size:0.9em">${esc(respuesta)}</pre></div>
      <div class="modal-foot"><button class="btn btn-secondary" onclick="cerrarModal('modal-ia-resultado')">Cerrar</button></div>
    `, { size: 'modal-lg' });
  } catch (e) { showToast(e.message, 'err'); }
}

export function usarDatosIAInformePsico(id, datos) {
  const p = getPsicoById(id);
  if (!p) return;
  if (datos?.resultado) p.resultado = datos.resultado;
  if (datos?.etapas) p.etapas = datos.etapas;
  supaSync('psicos', p);
}
