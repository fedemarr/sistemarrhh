// Modales dinámicos (ensureModal) + toast + helpers de formulario.

export function ensureModal(id, innerHtml, opts = {}) {
  let ov = document.getElementById(id + '-overlay');
  if (ov) ov.remove();
  ov = document.createElement('div');
  ov.className = 'modal-overlay';
  ov.id = id + '-overlay';
  ov.innerHTML = `<div class="modal ${opts.size || ''}">${innerHtml}</div>`;
  document.getElementById('modal-root').appendChild(ov);
  ov.addEventListener('click', (e) => {
    if (e.target === ov && !opts.fixed) cerrarModal(id);
  });
  return ov;
}

export function cerrarModal(id) {
  const ov = document.getElementById(id + '-overlay');
  if (ov) ov.remove();
}

export function showToast(msg, tipo = 'ok') {
  const root = document.getElementById('toast-root');
  if (!root) return;
  const t = document.createElement('div');
  t.className = 'toast ' + tipo;
  t.textContent = msg;
  root.appendChild(t);
  setTimeout(() => t.remove(), 3600);
}

export function capturar(e) {
  const fd = new FormData(e.target);
  const o = {};
  fd.forEach((v, k) => { o[k] = v; });
  return o;
}

export function valCampo(nombre, msg) {
  const el = document.getElementById(nombre);
  const v = el ? el.value : '';
  if (!v && msg) {
    showToast(msg, 'err');
    el?.focus();
    throw new Error(msg);
  }
  return v;
}

export function num(n) {
  const v = Number(String(n ?? '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(v) ? v : 0;
}
