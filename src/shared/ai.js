// AI service — análisis con Gemini vía la Edge Function analizar-ia.
// La API key vive como secreto del servidor (GEMINI_API_KEY en Supabase),
// nunca en el navegador. La función también baja el PDF/imagen REAL que se
// subió como adjunto y se lo manda a Gemini junto con el prompt, así el
// análisis sale del contenido real del documento (fecha, resultado) y no
// solo de los campos de texto del formulario.

import { getClient, fnErrorMessage } from './supabase.js';

// { etapa, tipo, refIdLocal } identifican el adjunto vigente a analizar
// (mismos valores que se usaron al subirlo con subirAdjunto). `prompt` es
// la consigna específica del módulo.
export async function analizarConGemini({ etapa, tipo, refIdLocal, prompt }) {
  const client = getClient();
  const { data, error } = await client.functions.invoke('analizar-ia', { body: { etapa, tipo, refIdLocal, prompt } });
  if (error) throw new Error(await fnErrorMessage(error));
  if (data?.error) throw new Error(data.error);
  return data?.respuesta || 'Sin respuesta de la IA.';
}
