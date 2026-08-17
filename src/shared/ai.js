// AI service — Google Gemini integration for document analysis.

const GEMINI_KEY_STORAGE = 'sistema-rrhh-gemini-key';

export function getGeminiKey() {
  return localStorage.getItem(GEMINI_KEY_STORAGE) || '';
}

export function setGeminiKey(key) {
  localStorage.setItem(GEMINI_KEY_STORAGE, key);
}

// gemini-2.0-flash fue dado de baja por Google (devolvía 404 siempre,
// con cualquier API key válida). Modelo vigente: gemini-3.6-flash.
const GEMINI_MODEL = 'gemini-3.6-flash';

export async function analizarConGemini(prompt) {
  const key = getGeminiKey();
  if (!key) throw new Error('Configure la API key de Gemini en Configuración.');
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.error?.message || `Error de Gemini: ${res.status}`);
  }
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || 'Sin respuesta de la IA.';
}
