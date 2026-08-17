// Helper de envío de emails — invoca la Edge Function enviar-mail.
// Usa las credenciales Gmail configuradas en la empresa (gmailUser / gmailPass).

import { getClient } from './supabase.js';
import { DB, SESSION } from '../state.js';

export async function enviarMail({ to, subject, html }) {
  const empresaId = SESSION.currentUser?.empresaId;
  if (!empresaId) throw new Error('No hay empresa activa');

  const empresa = (DB.empresas || []).find(e => String(e.id) === String(empresaId));
  if (!empresa?.gmailUser) throw new Error('Gmail no configurado para esta empresa. Administración > Empresas > Editar.');

  const client = getClient();
  const { data, error } = await client.functions.invoke('enviar-mail', {
    body: { empresaId, to, subject, html }
  });

  if (error) throw new Error(error.message);
  return data;
}
