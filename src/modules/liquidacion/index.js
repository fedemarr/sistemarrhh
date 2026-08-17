// Liquidación — index.

export * from './liqUtils.js';
export * from './liquidacion_horas.js';
export * from './liq_admin.js';
export * from './categorias.js';
export * from './smvm.js';
export * from './retenes.js';
export * from './monotributos.js';
export * from './retenciones.js';
export * from './descuentos.js';
export * from './paritarias.js';
export * from './feriados.js';
export * from './liquidaciones.js';
export * from './mantenimiento.js';

import { renderCategorias, agregarCategoria, editarCategoria, anularCategoria, guardarCategoria, vistaPreviaCategorias, verParametrosValoresYObservaciones } from './categorias.js';
import { renderSmvm, agregarValorParametro, editarValorParametro, anularValorParametro, guardarValorParametro, verParametrosVerHistorial } from './smvm.js';
import { renderLiquidacionHorasInicial, filtrarLiquidacionesHoras, verLiquidacionHoras, abrirNuevaLiquidacionHoras, abrirEditarLiquidacionHorasPorId, autocompletarLiquidacion, pintarValorHora, liquidarHorasPorId, anularLiquidacionHorasPorId, importarHorasCSV } from './liquidacion_horas.js';
import { renderLiqAdminInicial, filtrarLiqAdmin, verLiqAdmin, abrirNuevaLiqAdmin, autocompletarLiqAdmin, liquidarAdminPorId, anularLiqAdminPorId } from './liq_admin.js';
import { renderMantenimiento, renderMantenimientoTab, exportarBackupJSON, limpiarRegistrosAnulados, verLogs } from './mantenimiento.js';
import { renderRetenes, agregarReten, editarReten, anularReten, guardarReten } from './retenes.js';
import { renderLiquidaciones, abrirNuevoRecibo, verRecibo, imprimirRecibo, emitirRecibo, anularRecibo } from './liquidaciones.js';
import { renderMonotributos, abrirNuevaRetMonotributo, autocompletarMono, guardarRetMonotributo, anularMono } from './monotributos.js';
import { renderRetenciones, filtrarRetenciones, abrirNuevaRetencion, editarRetencion, anularRetencion, guardarRetencion, autocompletarRetencion } from './retenciones.js';
import { renderDescuentos, filtrarDescuentos, verDescuento, abrirNuevoDescuento, abrirEditarDescuento, autocompletarDescuento, guardarDescuento, anularDescuento } from './descuentos.js';
import { renderParitarias, abrirModalParitaria, editarParitaria, guardarParitaria, anularParitaria, verActasParitarias } from './paritarias.js';
import { renderFeriados, abrirNuevoFeriado, guardarFeriado, anularFeriado } from './feriados.js';

export const liquidacionScreenConfig = {
  categorias: {
    title: 'Categorías salariales',
    btn: '+ Nueva categoría',
    fn: agregarCategoria,
    render: renderCategorias,
  },
  smvm: {
    title: 'SMVM y valores',
    btn: '+ Nuevo valor',
    fn: agregarValorParametro,
    render: renderSmvm,
  },
  liquidacion_horas: {
    title: 'Liquidación por horas',
    btn: '+ Nueva liquidación',
    fn: abrirNuevaLiquidacionHoras,
    render: () => renderLiquidacionHorasInicial('borradores'),
  },
  liq_admin: {
    title: 'Liquidación administrativos',
    btn: '+ Nueva liquidación',
    fn: abrirNuevaLiqAdmin,
    render: renderLiqAdminInicial,
  },
  mantenimiento: {
    title: 'Mantenimiento',
    btn: '',
    fn: null,
    render: renderMantenimiento,
  },
  retenes: {
    title: 'Retenes',
    btn: '+ Nuevo retén',
    fn: agregarReten,
    render: renderRetenes,
  },
  liquidaciones: {
    title: 'Recibos de sueldo',
    btn: '+ Nuevo recibo',
    fn: abrirNuevoRecibo,
    render: () => renderLiquidaciones('emitidos'),
  },
  monotributos: {
    title: 'Monotributo',
    btn: '+ Nueva retención',
    fn: abrirNuevaRetMonotributo,
    render: renderMonotributos,
  },
  retenciones: {
    title: 'Retenciones',
    btn: '+ Nueva retención',
    fn: abrirNuevaRetencion,
    render: renderRetenciones,
  },
  descuentos: {
    title: 'Descuentos',
    btn: '+ Nuevo descuento',
    fn: abrirNuevoDescuento,
    render: renderDescuentos,
  },
  paritarias: {
    title: 'Paritarias',
    btn: '+ Nueva acta',
    fn: abrirModalParitaria,
    render: renderParitarias,
  },
  feriados: {
    title: 'Feriados',
    btn: '+ Nuevo feriado',
    fn: abrirNuevoFeriado,
    render: renderFeriados,
  },
};

window.renderCategorias = renderCategorias;
window.agregarCategoria = agregarCategoria;
window.editarCategoria = editarCategoria;
window.anularCategoria = anularCategoria;
window.guardarCategoria = guardarCategoria;
window.vistaPreviaCategorias = vistaPreviaCategorias;
window.verParametrosValoresYObservaciones = verParametrosValoresYObservaciones;
window.renderSmvm = renderSmvm;
window.agregarValorParametro = agregarValorParametro;
window.editarValorParametro = editarValorParametro;
window.anularValorParametro = anularValorParametro;
window.guardarValorParametro = guardarValorParametro;
window.verParametrosVerHistorial = verParametrosVerHistorial;
window.renderLiquidacionHorasInicial = renderLiquidacionHorasInicial;
window.filtrarLiquidacionesHoras = filtrarLiquidacionesHoras;
window.verLiquidacionHoras = verLiquidacionHoras;
window.abrirNuevaLiquidacionHoras = abrirNuevaLiquidacionHoras;
window.abrirEditarLiquidacionHorasPorId = abrirEditarLiquidacionHorasPorId;
window.autocompletarLiquidacion = autocompletarLiquidacion;
window.pintarValorHora = pintarValorHora;
window.liquidarHorasPorId = liquidarHorasPorId;
window.anularLiquidacionHorasPorId = anularLiquidacionHorasPorId;
window.importarHorasCSV = importarHorasCSV;
window.renderLiqAdminInicial = renderLiqAdminInicial;
window.filtrarLiqAdmin = filtrarLiqAdmin;
window.verLiqAdmin = verLiqAdmin;
window.abrirNuevaLiqAdmin = abrirNuevaLiqAdmin;
window.autocompletarLiqAdmin = autocompletarLiqAdmin;
window.liquidarAdminPorId = liquidarAdminPorId;
window.anularLiqAdminPorId = anularLiqAdminPorId;
window.renderMantenimiento = renderMantenimiento;
window.renderMantenimientoTab = renderMantenimientoTab;
window.exportarBackupJSON = exportarBackupJSON;
window.limpiarRegistrosAnulados = limpiarRegistrosAnulados;
window.verLogs = verLogs;
window.renderRetenes = renderRetenes;
window.agregarReten = agregarReten;
window.editarReten = editarReten;
window.anularReten = anularReten;
window.guardarReten = guardarReten;
window.renderLiquidaciones = renderLiquidaciones;
window.abrirNuevoRecibo = abrirNuevoRecibo;
window.verRecibo = verRecibo;
window.imprimirRecibo = imprimirRecibo;
window.emitirRecibo = emitirRecibo;
window.anularRecibo = anularRecibo;
window.renderMonotributos = renderMonotributos;
window.abrirNuevaRetMonotributo = abrirNuevaRetMonotributo;
window.autocompletarMono = autocompletarMono;
window.guardarRetMonotributo = guardarRetMonotributo;
window.anularMono = anularMono;
window.renderRetenciones = renderRetenciones;
window.filtrarRetenciones = filtrarRetenciones;
window.abrirNuevaRetencion = abrirNuevaRetencion;
window.editarRetencion = editarRetencion;
window.anularRetencion = anularRetencion;
window.guardarRetencion = guardarRetencion;
window.autocompletarRetencion = autocompletarRetencion;
window.renderDescuentos = renderDescuentos;
window.filtrarDescuentos = filtrarDescuentos;
window.verDescuento = verDescuento;
window.abrirNuevoDescuento = abrirNuevoDescuento;
window.abrirEditarDescuento = abrirEditarDescuento;
window.autocompletarDescuento = autocompletarDescuento;
window.guardarDescuento = guardarDescuento;
window.anularDescuento = anularDescuento;
window.renderParitarias = renderParitarias;
window.abrirModalParitaria = abrirModalParitaria;
window.editarParitaria = editarParitaria;
window.guardarParitaria = guardarParitaria;
window.anularParitaria = anularParitaria;
window.verActasParitarias = verActasParitarias;
window.renderFeriados = renderFeriados;
window.abrirNuevoFeriado = abrirNuevoFeriado;
window.guardarFeriado = guardarFeriado;
window.anularFeriado = anularFeriado;
