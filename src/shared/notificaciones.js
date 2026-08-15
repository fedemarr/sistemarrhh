// Notificaciones internas entre roles (bandeja). Tipos usados:
// vacacion_solicitada, vacacion_preaviso_corto_autorizado, descanso_solicitado,
// legajo_monotributo_pendiente, reasignacion_*, uniforme_*.

import { DB } from '../state.js';
import { supaSync } from './supabase.js';

export function crearNotificacion({ tipo, mensaje, destinatarios = [], refId = null }) {
  const n = {
    id: Date.now().toString(),
    tipo,
    mensaje,
    destinatarios,
    refId,
    leida: false,
    fecha: new Date().toISOString(),
  };
  DB.notificaciones.push(n);
  supaSync('notificaciones', n).catch(() => {});
  return n;
}

export function notificacionesPara(nombreUsuario) {
  return (DB.notificaciones || [])
    .filter((n) => (n.destinatarios || []).includes(nombreUsuario) || (n.destinatarios || []).includes('*'))
    .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
}
