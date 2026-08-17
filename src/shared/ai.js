// AI service — Google Gemini integration for document analysis.

const GEMINI_KEY_STORAGE = 'sistema-rrhh-gemini-key';

export function getGeminiKey() {
  return localStorage.getItem(GEMINI_KEY_STORAGE) || '';
}

export function setGeminiKey(key) {
  localStorage.setItem(GEMINI_KEY_STORAGE, key);
}

export async function analizarConGemini(prompt) {
  const key = getGeminiKey();
  if (!key) throw new Error('Configure la API key de Gemini en Configuración.');
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
  });
  if (!res.ok) throw new Error('Error de Gemini: ' + res.status);
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || 'Sin respuesta de la IA.';
}
