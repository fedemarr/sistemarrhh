// Obra social: fecha de inicio de trámite = fecha de ingreso + 3 meses (editable).

import { addMonthsISO } from './helpers.js';

export function calcularFechaAltaObraSocialISO(fechaIngresoISO, meses = 3) {
  return addMonthsISO(fechaIngresoISO, meses);
}

export function recalcObraSocial(fechaIngresoISO, inputId = 'alta-obra-social-inicio') {
  if (!fechaIngresoISO) return '';
  const valor = calcularFechaAltaObraSocialISO(fechaIngresoISO);
  const el = document.getElementById(inputId);
  if (el && !el.value) el.value = valor;
  return valor;
}
