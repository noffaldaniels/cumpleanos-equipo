// Cuentas de la página de cumpleaños (sin pantalla: se prueban con node).
(function (raiz) {
  var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
    'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

  function hoyColombia(ahora) {
    var partes = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Bogota', year: 'numeric', month: 'numeric', day: 'numeric',
    }).formatToParts(ahora);
    var valor = function (tipo) { return Number(partes.find(function (p) { return p.type === tipo; }).value); };
    return { dia: valor('day'), mes: valor('month'), anio: valor('year') };
  }

  function bisiesto(anio) {
    return (anio % 4 === 0 && anio % 100 !== 0) || anio % 400 === 0;
  }

  // ¿Esta persona cumple en esta fecha? (el 29/2 se celebra el 28/2 en años no bisiestos)
  function cumpleEl(p, f) {
    if (p.dia === f.dia && p.mes === f.mes) return true;
    return p.dia === 29 && p.mes === 2 && f.dia === 28 && f.mes === 2 && !bisiesto(f.anio);
  }

  function sumarDias(f, k) {
    var d = new Date(Date.UTC(f.anio, f.mes - 1, f.dia + k));
    return { dia: d.getUTCDate(), mes: d.getUTCMonth() + 1, anio: d.getUTCFullYear() };
  }

  function porDiaYNombre(a, b) {
    return a.dia - b.dia || a.nombre.localeCompare(b.nombre, 'es');
  }

  function porNombre(a, b) {
    return a.nombre.localeCompare(b.nombre, 'es');
  }

  function seccionesDelMes(personas, hoy) {
    var usados = new Set();
    var deHoy = personas.filter(function (p) { return cumpleEl(p, hoy); }).sort(porNombre);
    deHoy.forEach(function (p) { usados.add(p); });
    var proximos = [];
    for (var k = 1; k <= 7; k++) {
      var f = sumarDias(hoy, k);
      personas.filter(function (p) { return !usados.has(p) && cumpleEl(p, f); }).sort(porNombre)
        .forEach(function (p) { usados.add(p); proximos.push(p); });
    }
    var delMes = personas.filter(function (p) { return p.mes === hoy.mes && !usados.has(p); }).sort(porDiaYNombre);
    return {
      hoy: deHoy,
      proximos: proximos,
      resto: delMes.filter(function (p) { return p.dia > hoy.dia; }),
      pasaron: delMes.filter(function (p) { return p.dia < hoy.dia; }),
    };
  }

  function listaDelMes(personas, mes) {
    return personas.filter(function (p) { return p.mes === mes; }).sort(porDiaYNombre);
  }

  function ordenPestanas(mesActual) {
    var meses = [];
    for (var i = 0; i < 12; i++) meses.push((mesActual - 1 + i) % 12 + 1);
    return meses;
  }

  function nombreMes(mes) {
    return MESES[mes - 1];
  }

  function lineaPersona(p) {
    return p.nombre + (p.detalle ? ' (' + p.detalle + ')' : '') + ' – ' +
      String(p.dia).padStart(2, '0') + ' de ' + nombreMes(p.mes);
  }

  function textoCopiar(mes, personas) {
    var titulo = nombreMes(mes).charAt(0).toUpperCase() + nombreMes(mes).slice(1);
    return [titulo].concat(listaDelMes(personas, mes).map(lineaPersona)).join('\n');
  }

  function escapar(texto) {
    return String(texto == null ? '' : texto).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  var Logica = {
    MESES: MESES, hoyColombia: hoyColombia, seccionesDelMes: seccionesDelMes, listaDelMes: listaDelMes,
    ordenPestanas: ordenPestanas, nombreMes: nombreMes, lineaPersona: lineaPersona, textoCopiar: textoCopiar,
    escapar: escapar,
  };
  if (typeof module !== 'undefined') module.exports = Logica;
  else raiz.Logica = Logica;
})(this);
