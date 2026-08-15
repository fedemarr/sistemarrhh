// Adelantos — lógica compartida entre pedidos, gestión y mis adelantos.
// Fuente de verdad: 04_Adelantos.md.

import { DB } from '../../state.js';
import { getCurrentUser, esRol } from '../../shared/auth.js';
import { redondear2 } from '../liquidacion/liqUtils.js';

export const ESTADOS_ADELANTO = ['Borrador', 'Enviado', 'En proceso', 'Aprobado', 'Entregado', 'Rechazado por supervisor', 'Rechazado por finanzas', 'Cancelado'];

export const MOTIVOS_ADELANTO_DEFAULT = [
  'Gastos de emergencia', 'Salud', 'Educación', 'Vivienda', 'Anticipo de sueldo', 'Otro',
];

export function getAdelantoById(id) {
  return (DB.adelantos || []).find((a) => String(a.id) === String(id));
}

export function motivosAdelanto() {
  const cfg = DB.motivosAdelantosCfg || [];
  const list = cfg.filter((m) => !m.anulado).map((m) => m.nombre);
  return list.length ? list : MOTIVOS_ADELANTO_DEFAULT;
}

export function cuotaMensual(monto, cuotas) {
  return redondear2((Number(monto) || 0) / (Number(cuotas) || 1));
}

export function puedePedir() {
  return esRol('Administrador total', 'RRHH', 'Operaciones', 'Supervisor', 'Asociado');
}

export function puedeAprobarSup(adelanto) {
  const u = getCurrentUser();
  if (!u) return false;
  if (esRol('Administrador total', 'RRHH', 'Finanzas')) return true;
  if (esRol('Supervisor') && (adelanto?.servicio === u.servicio || !u.servicio)) return true;
  return false;
}

export function puedeAprobarFin() {
  return esRol('Administrador total', 'RRHH', 'Finanzas');
}

export function adelantosDeSocio(nro) {
  return (DB.adelantos || []).filter((a) => String(a.nroSocio) === String(nro));
}

export function totalDeuda(nro) {
  return (DB.adelantos || [])
    .filter((a) => String(a.nroSocio) === String(nro) && ['Aprobado', 'Entregado'].includes(a.estado))
    .reduce((acc, a) => acc + (Number(a.monto) || 0), 0);
}

export function chipEstadoAdelanto(estado) {
  const cls = estado === 'Entregado' ? 'chip-verde' : ['Rechazado por supervisor', 'Rechazado por finanzas', 'Cancelado'].includes(estado) ? 'chip-rojo' : estado === 'Borrador' ? 'chip-gris' : 'chip-naranja';
  return `<span class="chip ${cls}">${estado}</span>`;
}

export function agregarLogAdelanto(a, tipo, comentario) {
  a.historial = a.historial || [];
  a.historial.push({ fecha: new Date().toISOString(), tipo, comentario: comentario || '', usuario: getCurrentUser()?.nombre || '' });
  return a.historial;
}
