// AI service — análisis con Gemini vía la Edge Function analizar-ia.
// La API key vive como secreto del servidor (GEMINI_API_KEY en Supabase),
// nunca en el navegador: ningún usuario tiene que configurar nada acá.

import { getClient } from './supabase.js';

export async function analizarConGemini(prompt) {
  const client = getClient();
  const { data, error } = await client.functions.invoke('analizar-ia', { body: { prompt } });
  if (error) throw new Error(error.context?.message || error.message);
  if (data?.error) throw new Error(data.error);
  return data?.respuesta || 'Sin respuesta de la IA.';
}
