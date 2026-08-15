// Liquidación — utilidades compartidas (categorías, SMVM, cálculo salarial, periodos).
// Fuente de verdad: 03_Liquidacion.md.

import { DB } from '../../state.js';

export function obtenerCategorias() {
  const cat = DB.categorias || [];
  if (cat.length) return cat.filter((c) => !c.anulado);
  return [
    { id: 'c1', nombre: 'Categoría 1', categoria: 1, factor: 1, adicional: 0, anulado: false },
    { id: 'c2', nombre: 'Categoría 2', categoria: 2, factor: 1.05, adicional: 0, anulado: false },
    { id: 'c3', nombre: 'Categoría 3', categoria: 3, factor: 1.1, adicional: 0, anulado: false },
    { id: 'c4', nombre: 'Categoría 4', categoria: 4, factor: 1.15, adicional: 0, anulado: false },
    { id: 'c5', nombre: 'Categoría 5', categoria: 5, factor: 1.2, adicional: 0, anulado: false },
    { id: 'c6', nombre: 'Categoría 6', categoria: 6, factor: 1.3, adicional: 0, anulado: false },
    { id: 'c7', nombre: 'Categoría 7', categoria: 7, factor: 1.4, adicional: 0, anulado: false },
  ];
}

export function categoriaDe(nombre) {
  return obtenerCategorias().find((c) => c.nombre === nombre);
}

export function obtenerParametroValor(nombre, anio, mes) {
  const vals = (DB.parametrosValores || []).filter((p) => p.nombreParametro === nombre && (!anio || p.anio === anio) && (!mes || p.mes === mes));
  if (vals.length) return vals[0].valor;
  const defs = { SMVM: 234315.12, valorCategoria1: 234315.12 };
  return defs[nombre] ?? 0;
}

export function smvmDe(anio, mes) {
  return Number(obtenerParametroValor('SMVM', anio, mes)) || 0;
}

export function valorCategoria1(anio, mes) {
  return Number(obtenerParametroValor('valorCategoria1', anio, mes)) || smvmDe(anio, mes);
}

export function calcularSalario(categoria, anio, mes) {
  const cat = categoriaDe(categoria);
  const base = valorCategoria1(anio, mes);
  if (!cat) return Math.round(base * 100) / 100;
  return Math.round((base * (cat.factor || 1) + (cat.adicional || 0)) * 100) / 100;
}

export function calcularSalarioLegajo(legajo, anio, mes) {
  const categoria = legajo?.categoria || 'Categoría 1';
  return calcularSalario(categoria, anio, mes);
}

export function periodoActual() {
  const now = new Date();
  return { anio: now.getFullYear(), mes: now.getMonth() + 1 };
}

export function periodoLabel(anio, mes) {
  return `${String(mes).padStart(2, '0')}/${anio}`;
}

export function resumenPeriodo(anio, mes) {
  const liqs = (DB.liquidacionesHoras || []).filter((l) => l.anio === Number(anio) && l.mes === Number(mes));
  const totalHoras = liqs.reduce((a, l) => a + (Number(l.horasTrabajadas) || 0), 0);
  const totalLiquido = liqs.reduce((a, l) => a + (Number(l.liquido) || 0), 0);
  return { cantidad: liqs.length, totalHoras, totalLiquido: Math.round(totalLiquido * 100) / 100 };
}

export function horaEnPeriodo(nroSocio, anio, mes) {
  return (DB.liquidacionesHoras || []).find((l) => String(l.nroSocio) === String(nroSocio) && l.anio === Number(anio) && l.mes === Number(mes));
}

export function obtenerHorasLiquidacion(nroSocio, anio, mes) {
  return horaEnPeriodo(nroSocio, anio, mes);
}

export function feriadosDe(anio, mes) {
  return (DB.feriados || []).filter((f) => String(f.fecha || '').startsWith(`${anio}-${String(mes).padStart(2, '0')}`));
}

export function redondear2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}
