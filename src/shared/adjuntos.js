// Adjuntos PDF: bucket privado `adjuntos`, solo PDF, máx 10MB.
// Subir un nuevo adjunto del mismo tipo invalida (vigente=false) el anterior.

import { getClient, supaSync } from './supabase.js';
import { DB } from '../state.js';
import { getCurrentUser } from './auth.js';
import { MAX_SIZE_ADJUNTO } from './helpers.js';

export const BUCKET = 'adjuntos';

export async function subirAdjunto({ etapa, tipo, refIdLocal, file }) {
  if (!file) return null;
  // Guard: si refIdLocal viene undefined/null (registro sin id todavía,
  // ej. no se guardó bien antes de subir el archivo), NO subir en silencio
  // con una referencia rota (quedaría un adjunto imposible de encontrar
  // después). Mejor cortar acá con un error claro.
  if (refIdLocal === undefined || refIdLocal === null || String(refIdLocal) === 'undefined' || String(refIdLocal).trim() === '') {
    throw new Error('No se pudo identificar el registro para adjuntar el archivo (falta el ID). Guardá primero y volvé a intentar.');
  }
  const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
  if (file.type && !allowedTypes.includes(file.type)) {
    throw new Error('Solo se permiten adjuntos PDF o imágenes (JPG/PNG).');
  }
  if (file.size > MAX_SIZE_ADJUNTO) {
    throw new Error('El archivo supera el máximo de 10MB.');
  }
  const client = getClient();
  const path = `${etapa}/${refIdLocal}/${Date.now()}-${String(file.name).replace(/[^\w.\-]/g, '_')}`;
  const contentType = file.type || 'application/pdf';
  const { error } = await client.storage.from(BUCKET).upload(path, file, {
    contentType,
    upsert: false,
  });
  if (error) throw new Error('Error al subir el adjunto: ' + error.message);

  for (const a of DB.adjuntos || []) {
    if (a.etapa === etapa && a.tipo === tipo && String(a.refIdLocal) === String(refIdLocal) && a.vigente) {
      a.vigente = false;
      await supaSync('adjuntos', a).catch(() => {});
    }
  }

  const adj = {
    id: Date.now().toString(),
    etapa,
    tipo,
    refIdLocal: String(refIdLocal),
    archivo: path,
    nombreArchivo: file.name,
    vigente: true,
    subidoPor: getCurrentUser()?.nombre || '',
    subidoEn: new Date().toISOString(),
  };
  DB.adjuntos.push(adj);
  await supaSync('adjuntos', adj);
  return adj;
}

export async function verAdjunto(archivo) {
  if (!archivo) return;
  const client = getClient();
  const { data, error } = await client.storage.from(BUCKET).createSignedUrl(archivo, 3600);
  if (error || !data) throw new Error('No se pudo generar el enlace del adjunto.');
  window.open(data.signedUrl, '_blank');
}

export function adjuntosDe(etapa, tipo, refIdLocal) {
  return (DB.adjuntos || [])
    .filter((a) => a.etapa === etapa && a.tipo === tipo && String(a.refIdLocal) === String(refIdLocal))
    .sort((a, b) => String(b.id).localeCompare(String(a.id)));
}

export function adjuntoVigenteDe(etapa, tipo, refIdLocal) {
  return (DB.adjuntos || []).find(
    (a) => a.etapa === etapa && a.tipo === tipo && String(a.refIdLocal) === String(refIdLocal) && a.vigente
  );
}

export function htmlAdjuntos(etapa, tipo, refIdLocal) {
  const list = adjuntosDe(etapa, tipo, refIdLocal);
  if (!list.length) return '<span class="muted">Sin adjuntos</span>';
  return list
    .map(
      (a) =>
        `<button class="btn btn-secondary btn-sm" onclick="verAdjunto('${esc(a.archivo)}')" title="${esc(a.nombreArchivo)}">${a.vigente ? '📄' : '🗄️'} ${esc(a.nombreArchivo).slice(0, 26)}</button>`
    )
    .join(' ');
}

function esc(s) {
  return String(s ?? '').replace(/["']/g, '');
}
