/**
 * Cumpleaños · Oficina del Diputado Felipe Ferro
 * Servidor: va pegado a la hoja "Cumpleaños Equipo Ferro" (pestaña "personas").
 * Las claves NO van aquí: Configuración del proyecto → Propiedades del script →
 * CLAVE_EQUIPO (mirar y subir fotos) y CLAVE_EDITOR (editar).
 * Las fotos van en la carpeta privada "Fotos cumpleaños (privado)" del Drive de Noffal;
 * la columna "foto" de la hoja guarda los códigos de los dos archivos (grande|mini).
 */

var COLUMNAS = ['id', 'nombre', 'detalle', 'dia', 'mes', 'estado', 'fuente', 'agregado', 'foto'];
var DIAS_POR_MES = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
var LARGO_MAXIMO = 120;
var FOTO_MAXIMA = 4000000; // caracteres en base64 (~3 MB): el celular la achica antes de subirla
var MINI_MAXIMA = 100000;
var MINIS_POR_PEDIDO = 60;

// ---------- Apps Script ----------

function doGet(e) {
  var p = (e && e.parameter) || {};
  return responder_(procesar({ accion: p.accion, clave: p.clave, id: p.id, ids: p.ids }, propiedades_(), almacenHoja_(), hoy_(), fotosDrive_()));
}

function doPost(e) {
  var peticion;
  try {
    peticion = JSON.parse(e.postData.contents);
  } catch (err) {
    return responder_({ ok: false, error: 'datos' });
  }
  var candado = LockService.getScriptLock();
  candado.waitLock(10000);
  try {
    return responder_(procesar(peticion, propiedades_(), almacenHoja_(), hoy_(), fotosDrive_()));
  } finally {
    candado.releaseLock();
  }
}

function responder_(r) {
  return ContentService.createTextOutput(JSON.stringify(r)).setMimeType(ContentService.MimeType.JSON);
}

function propiedades_() {
  return PropertiesService.getScriptProperties().getProperties();
}

function hoy_() {
  return Utilities.formatDate(new Date(), 'America/Bogota', 'yyyy-MM-dd');
}

function almacenHoja_() {
  var hoja = SpreadsheetApp.getActive().getSheetByName('personas');
  return {
    leer: function () { return hoja.getDataRange().getValues(); },
    agregarFila: function (f) { hoja.appendRow(f); },
    cambiarFila: function (i, f) { hoja.getRange(i + 1, 1, 1, f.length).setValues([f]); },
  };
}

// Ejecutar a mano una vez desde el editor si Google no pidió el permiso de Drive.
function autorizarDrive() {
  return DriveApp.getRootFolder().getName();
}

function fotosDrive_() {
  var props = PropertiesService.getScriptProperties();
  function carpeta() {
    var id = props.getProperty('CARPETA_FOTOS');
    if (id) {
      try { return DriveApp.getFolderById(id); } catch (err) { /* la borraron: se crea otra */ }
    }
    var nueva = DriveApp.createFolder('Fotos cumpleaños (privado)');
    props.setProperty('CARPETA_FOTOS', nueva.getId());
    return nueva;
  }
  return {
    guardar: function (base64, nombre) {
      var blob = Utilities.newBlob(Utilities.base64Decode(base64), 'image/jpeg', nombre);
      return carpeta().createFile(blob).getId();
    },
    leer: function (idArchivo) {
      try { return Utilities.base64Encode(DriveApp.getFileById(idArchivo).getBlob().getBytes()); } catch (err) { return null; }
    },
    borrar: function (idArchivo) {
      try { DriveApp.getFileById(idArchivo).setTrashed(true); } catch (err) { /* ya no estaba */ }
    },
  };
}

// ---------- Lógica (se prueba en el PC con node) ----------

function revisarClave(clave, props) {
  if (!clave) return null;
  if (props.CLAVE_EDITOR && clave === props.CLAVE_EDITOR) return 'editor';
  if (props.CLAVE_EQUIPO && clave === props.CLAVE_EQUIPO) return 'equipo';
  return null;
}

function validarPersona(p) {
  var nombre = String((p && p.nombre) || '').trim();
  if (!nombre) return 'Falta el nombre';
  if (nombre.length > LARGO_MAXIMO || String(p.detalle || '').length > LARGO_MAXIMO) return 'Texto muy largo';
  var dia = Number(p.dia), mes = Number(p.mes);
  if (!Number.isInteger(mes) || mes < 1 || mes > 12) return 'Mes no válido';
  if (!Number.isInteger(dia) || dia < 1 || dia > DIAS_POR_MES[mes - 1]) return 'Día no válido';
  return null;
}

function claveNombre(nombre) {
  return String(nombre).normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\./g, ' ').toLowerCase().split(/\s+/).filter(Boolean).join(' ');
}

// Igual que difflib.SequenceMatcher.ratio() de Python (Ratcliff/Obershelp).
function coincidencias_(a, b) {
  var mejor = 0, ia = 0, ib = 0;
  for (var i = 0; i < a.length; i++) {
    for (var j = 0; j < b.length; j++) {
      var k = 0;
      while (i + k < a.length && j + k < b.length && a[i + k] === b[j + k]) k++;
      if (k > mejor) { mejor = k; ia = i; ib = j; }
    }
  }
  if (!mejor) return 0;
  return mejor + coincidencias_(a.slice(0, ia), b.slice(0, ib)) +
    coincidencias_(a.slice(ia + mejor), b.slice(ib + mejor));
}

function sonParecidos(a, b) {
  var ka = claveNombre(a), kb = claveNombre(b);
  if (ka === kb) return true;
  var wa = ka.split(' '), wb = kb.split(' ');
  var comunes = wa.filter(function (w) { return wb.indexOf(w) >= 0; }).length;
  var contenida = wa.every(function (w) { return wb.indexOf(w) >= 0; }) ||
    wb.every(function (w) { return wa.indexOf(w) >= 0; });
  if (contenida && comunes >= 2) return true;
  return 2 * coincidencias_(ka, kb) / (ka.length + kb.length) >= 0.9;
}

function filaAPersona(f) {
  return {
    id: String(f[0]), nombre: String(f[1]), detalle: String(f[2] || ''),
    dia: Number(f[3]), mes: Number(f[4]), estado: String(f[5]), fuente: String(f[6] || ''), agregado: f[7],
    foto: String(f[8] || ''),
  };
}

function personaAFila(p) {
  return [p.id, texto_(p.nombre), texto_(p.detalle), p.dia, p.mes, p.estado, p.fuente, p.agregado, p.foto || ''];
}

function publica_(p) {
  var r = { id: p.id, nombre: p.nombre, detalle: p.detalle, dia: p.dia, mes: p.mes };
  if (p.foto) r.foto = true;
  return r;
}

// "grande|mini" → códigos de los archivos en Drive
function archivosFoto_(p) {
  var partes = String(p.foto || '').split('|');
  return { grande: partes[0] || '', mini: partes[1] || '' };
}

function esJpeg_(base64, maximo) {
  return typeof base64 === 'string' && base64.length <= maximo && base64.slice(0, 4) === '/9j/' &&
    /^[A-Za-z0-9+\/]+={0,2}$/.test(base64);
}

// Un texto que empieza con = + @ la hoja lo tomaría como fórmula.
function texto_(v) {
  var t = String(v || '').trim();
  return /^[=+@]/.test(t) ? "'" + t : t;
}

function procesar(peticion, props, almacen, hoy, fotos) {
  peticion = peticion || {};
  var rol = revisarClave(peticion.clave, props);
  if (!rol) return { ok: false, error: 'clave' };

  var filas = almacen.leer();
  var inicio = filas.length && String(filas[0][0]).replace(/^﻿/, '') === 'id' ? 1 : 0;
  var personas = [];
  for (var i = inicio; i < filas.length; i++) {
    if (filas[i][0] === '' || filas[i][0] == null) continue;
    var leida = filaAPersona(filas[i]);
    if (!validarPersona(leida)) personas.push({ fila: i, p: leida }); // una fila dañada a mano no rompe la página
  }
  var activos = personas.filter(function (x) { return x.p.estado !== 'retirado'; });

  if (peticion.accion === 'lista') {
    var r = { ok: true, editor: rol === 'editor', personas: activos.map(function (x) { return publica_(x.p); }) };
    if (rol === 'editor') {
      r.retirados = personas.filter(function (x) { return x.p.estado === 'retirado'; })
        .map(function (x) { return publica_(x.p); });
    }
    return r;
  }

  var buscar = function (id) { return activos.filter(function (x) { return x.p.id === id; })[0]; };

  // Fotos: las ven y las suben las dos claves (pedido de Noffal, 19-oct).
  if (peticion.accion === 'minis') {
    var minis = {};
    String(peticion.ids || '').split(',').slice(0, MINIS_POR_PEDIDO).forEach(function (id) {
      var x = buscar(id);
      var datos = x && archivosFoto_(x.p).mini ? fotos.leer(archivosFoto_(x.p).mini) : null;
      if (datos) minis[id] = datos;
    });
    return { ok: true, minis: minis };
  }
  if (peticion.accion === 'ver-foto') {
    var vista = buscar(peticion.id);
    var grande = vista && archivosFoto_(vista.p).grande ? fotos.leer(archivosFoto_(vista.p).grande) : null;
    return grande ? { ok: true, foto: grande } : { ok: false, error: 'datos', mensaje: 'Esa persona no tiene foto' };
  }
  if (peticion.accion === 'subir-foto') {
    var conFoto = buscar((peticion.persona || {}).id);
    if (!conFoto) return { ok: false, error: 'datos', mensaje: 'No encontré a esa persona' };
    if (!esJpeg_(peticion.foto, FOTO_MAXIMA) || !esJpeg_(peticion.mini, MINI_MAXIMA)) {
      return { ok: false, error: 'datos', mensaje: 'La foto no sirve o es muy pesada' };
    }
    var antes = archivosFoto_(conFoto.p);
    conFoto.p.foto = fotos.guardar(peticion.foto, conFoto.p.id + '.jpg') + '|' + fotos.guardar(peticion.mini, conFoto.p.id + '-mini.jpg');
    if (inicio && filas[0][8] !== 'foto') almacen.cambiarFila(0, COLUMNAS); // título de la columna nueva
    almacen.cambiarFila(conFoto.fila, personaAFila(conFoto.p));
    if (antes.grande) fotos.borrar(antes.grande);
    if (antes.mini) fotos.borrar(antes.mini);
    return { ok: true, persona: publica_(conFoto.p) };
  }

  if (rol !== 'editor') return { ok: false, error: 'clave' };
  var dato = peticion.persona || {};

  if (peticion.accion === 'quitar-foto') {
    var sinFoto = buscar(dato.id);
    if (!sinFoto) return { ok: false, error: 'datos', mensaje: 'No encontré a esa persona' };
    var viejos = archivosFoto_(sinFoto.p);
    sinFoto.p.foto = '';
    almacen.cambiarFila(sinFoto.fila, personaAFila(sinFoto.p));
    if (viejos.grande) fotos.borrar(viejos.grande);
    if (viejos.mini) fotos.borrar(viejos.mini);
    return { ok: true, persona: publica_(sinFoto.p) };
  }

  if (peticion.accion === 'agregar') {
    if (validarPersona(dato)) return { ok: false, error: 'datos', mensaje: validarPersona(dato) };
    var nombre = String(dato.nombre).trim();
    var parecidos = activos.filter(function (x) { return sonParecidos(x.p.nombre, nombre); });
    if (parecidos.length && !peticion.forzar) {
      return { ok: false, error: 'parecido', parecidos: parecidos.map(function (x) { return publica_(x.p); }) };
    }
    var ultimo = personas.reduce(function (m, x) { return Math.max(m, parseInt(x.p.id.slice(1), 10) || 0); }, 0);
    var nueva = {
      id: 'p' + ('000' + (ultimo + 1)).slice(-4), nombre: nombre, detalle: String(dato.detalle || '').trim(),
      dia: Number(dato.dia), mes: Number(dato.mes), estado: 'activo', fuente: 'página', agregado: hoy,
    };
    almacen.agregarFila(personaAFila(nueva));
    return { ok: true, persona: publica_(nueva) };
  }

  var objetivo = personas.filter(function (x) { return x.p.id === dato.id; })[0];
  if (!objetivo) return { ok: false, error: 'datos', mensaje: 'No encontré a esa persona' };
  var p = objetivo.p;

  if (peticion.accion === 'editar') {
    if (validarPersona(dato)) return { ok: false, error: 'datos', mensaje: validarPersona(dato) };
    p.nombre = String(dato.nombre).trim();
    p.detalle = String(dato.detalle || '').trim();
    p.dia = Number(dato.dia);
    p.mes = Number(dato.mes);
  } else if (peticion.accion === 'quitar') {
    p.estado = 'retirado';
  } else if (peticion.accion === 'restaurar') {
    p.estado = 'activo';
  } else {
    return { ok: false, error: 'datos', mensaje: 'Acción desconocida' };
  }
  almacen.cambiarFila(objetivo.fila, personaAFila(p));
  return { ok: true, persona: publica_(p) };
}

if (typeof module !== 'undefined') {
  module.exports = {
    COLUMNAS: COLUMNAS, revisarClave: revisarClave, validarPersona: validarPersona, sonParecidos: sonParecidos,
    filaAPersona: filaAPersona, personaAFila: personaAFila, procesar: procesar,
  };
}
