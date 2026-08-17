// Helpers compartidos — formato de fechas argentino, validaciones y utilidades.
// Fuente de verdad: EXTRACCION_RRHH/05 (formato DD/MM/AAAA display, ISO en inputs).

export const HS_MINIMO = 200;
export const MAX_SIZE_ADJUNTO = 10 * 1024 * 1024;

export function hoyISO() {
  return new Date().toISOString().slice(0, 10);
}

export function fechaISOToDisplay(iso) {
  if (!iso) return '';
  const [y, m, d] = String(iso).slice(0, 10).split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

export function displayToISO(display) {
  if (!display) return '';
  const m = String(display).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return '';
  return `${m[3]}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`;
}

export function fechaCsvAISO(csv) {
  const m = String(csv).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!m) return null;
  let anio = m[3];
  if (anio.length === 2) anio = (Number(anio) > 50 ? '19' : '20') + anio;
  return `${anio}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`;
}

export function addMonthsISO(iso, meses) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  d.setMonth(d.getMonth() + meses);
  return d.toISOString().slice(0, 10);
}

export function calcularEdad(fecNacISO) {
  if (!fecNacISO) return null;
  const nac = new Date(fecNacISO + 'T00:00:00');
  const hoy = new Date();
  let edad = hoy.getFullYear() - nac.getFullYear();
  if (hoy.getMonth() < nac.getMonth() || (hoy.getMonth() === nac.getMonth() && hoy.getDate() < nac.getDate())) edad--;
  return edad;
}

export function diasEntre(desdeISO, hastaISO) {
  return Math.floor((new Date(hastaISO) - new Date(desdeISO)) / 86400000);
}

export function esDniValido(dni) {
  return /^\d{6,8}$/.test(String(dni).trim());
}

export function esCuitValido(cuit) {
  return /^\d{11}$/.test(String(cuit).trim());
}

export function esCbuValido(cbu) {
  return /^\d{22}$/.test(String(cbu).trim());
}

export function soloNumeros(s) {
  return String(s || '').replace(/\D/g, '');
}

export function formatMoney(n) {
  const v = Number(n || 0);
  return '$' + v.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export function formatNumber(n) {
  return Number(n || 0).toLocaleString('es-AR');
}

export function calcEstadoVencimiento(vencimientoISO) {
  if (!vencimientoISO) return { estado: 'Sin dato', cls: 'chip-gris' };
  const dias = diasEntre(hoyISO(), vencimientoISO);
  if (dias < 0) return { estado: 'Caducado', cls: 'chip-rojo' };
  if (dias <= 30) return { estado: `Vence en ${dias} d`, cls: 'chip-naranja' };
  return { estado: `Vence en ${dias} d`, cls: 'chip-verde' };
}

export function calcularEstadoVencimiento(vencimientoISO) {
  return calcEstadoVencimiento(vencimientoISO);
}

export function uuid() {
  return crypto.randomUUID();
}

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function hoyDisplay() {
  return fechaISOToDisplay(hoyISO());
}

export function mesActual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function mesDisplay(mes) {
  if (!mes) return '';
  const [y, m] = String(mes).split('-');
  const nombres = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  return `${nombres[Number(m) - 1]} ${y}`;
}

export function rangoMeses(desde, hasta) {
  const out = [];
  let [y, m] = String(desde).split('-').map(Number);
  const [hy, hm] = String(hasta).split('-').map(Number);
  while (y < hy || (y === hy && m <= hm)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return out;
}

export function nombreMesDeISO(iso) {
  if (!iso) return '';
  const m = new Date(iso + 'T00:00:00').getMonth();
  return ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'][m];
}

export function esFeriado(feriados, iso) {
  return (feriados || []).some((f) => f.fecha === iso || displayToISO(f.fecha) === iso);
}

export function maxP1(arreglo, campo = 'nro') {
  const max = (arreglo || []).reduce((a, x) => Math.max(a, Number(x[campo]) || 0), 0);
  return max + 1;
}

export function invertirMapa(obj) {
  const out = {};
  for (const k of Object.keys(obj || {})) out[obj[k]] = k;
  return out;
}
