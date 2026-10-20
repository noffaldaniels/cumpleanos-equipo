// Pantalla de la página de cumpleaños. Las cuentas están en logica.js.
(function () {
  var L = window.Logica;
  var URL_SERVIDOR = (window.CONFIG || {}).url || '';
  var DEMO = /[?&]demo=1\b/.test(location.search);
  var LLAVE = 'cumple-clave';
  var e = L.escapar;

  var estado = {
    personas: [], retirados: [], editor: false, hoy: L.hoyColombia(new Date()), mes: null,
    abiertos: { hoy: true, proximos: true }, formulario: null, confirmar: null, aviso: '', copiar: null, ocupado: false,
    minis: {}, pidiendo: {}, grandes: {}, verFoto: null, fotoPara: null, demoFotos: {}, busqueda: '',
  };
  var JPG = 'data:image/jpeg;base64,';

  function leerClave() { try { return localStorage.getItem(LLAVE) || ''; } catch (x) { return ''; } }
  function guardarClave(c) { try { localStorage.setItem(LLAVE, c); } catch (x) { /* sin memoria: se pedirá otra vez */ } }
  function olvidarClave() { try { localStorage.removeItem(LLAVE); } catch (x) { /* nada */ } }
  var clave = leerClave();

  var $ = function (id) { return document.getElementById(id); };
  var main = $('contenido');

  // ---------- Servidor ----------

  function pedirLista() {
    if (DEMO) return fetch('demo.json').then(function (r) { return r.json(); });
    return fetch(URL_SERVIDOR + '?accion=lista&clave=' + encodeURIComponent(clave)).then(function (r) { return r.json(); });
  }

  function enviar(accion, persona, forzar, extra) {
    if (DEMO) return Promise.resolve(simular(accion, persona, forzar, extra));
    var cuerpo = { clave: clave, accion: accion, persona: persona, forzar: !!forzar };
    for (var k in extra || {}) cuerpo[k] = extra[k];
    return fetch(URL_SERVIDOR, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // sin "preflight" de CORS
      body: JSON.stringify(cuerpo),
    }).then(function (r) { return r.json(); });
  }

  function pedirFotos(accion, parametros) {
    if (DEMO) {
      var f = estado.demoFotos;
      if (accion === 'ver-foto') return Promise.resolve(f[parametros.id] ? { ok: true, foto: f[parametros.id].foto } : { ok: false });
      var minis = {};
      parametros.ids.split(',').forEach(function (id) { if (f[id]) minis[id] = f[id].mini; });
      return Promise.resolve({ ok: true, minis: minis });
    }
    var url = URL_SERVIDOR + '?accion=' + accion + '&clave=' + encodeURIComponent(clave);
    for (var k in parametros) url += '&' + k + '=' + encodeURIComponent(parametros[k]);
    return fetch(url).then(function (r) { return r.json(); });
  }

  // En ?demo=1 los cambios quedan solo en esta pantalla.
  function simular(accion, persona, forzar, extra) {
    var todos = estado.personas.concat(estado.retirados);
    var buscar = function (lista) { return lista.findIndex(function (p) { return p.id === persona.id; }); };
    if (accion === 'agregar') {
      var parecidos = estado.personas.filter(function (p) { return p.nombre.toLowerCase() === persona.nombre.trim().toLowerCase(); });
      if (parecidos.length && !forzar) return { ok: false, error: 'parecido', parecidos: parecidos };
      estado.personas.push({ id: 'd' + (todos.length + 1), nombre: persona.nombre.trim(), detalle: persona.detalle, dia: persona.dia, mes: persona.mes });
    } else if (accion === 'editar') {
      estado.personas[buscar(estado.personas)] = persona;
    } else if (accion === 'quitar') {
      estado.retirados.push(estado.personas.splice(buscar(estado.personas), 1)[0]);
    } else if (accion === 'restaurar') {
      estado.personas.push(estado.retirados.splice(buscar(estado.retirados), 1)[0]);
    } else if (accion === 'subir-foto') {
      estado.demoFotos[persona.id] = { foto: extra.foto, mini: extra.mini };
    } else if (accion === 'quitar-foto') {
      delete estado.demoFotos[persona.id];
    }
    return { ok: true, demo: true };
  }

  function cargar() {
    main.innerHTML = '<p class="vacio">Cargando…</p>';
    pedirLista().then(function (r) {
      if (!r.ok) {
        if (r.error === 'clave') {
          olvidarClave();
          clave = '';
          return pantallaClave('Esa clave no sirve. Pídele la clave nueva a Noffal.');
        }
        return pantallaError();
      }
      estado.personas = r.personas || [];
      estado.retirados = r.retirados || [];
      estado.editor = !!r.editor;
      pintar();
    }).catch(pantallaError);
  }

  // ---------- Pantallas ----------

  function pantallaClave(mensaje) {
    $('buscador').classList.add('oculto');
    $('meses').classList.add('oculto');
    $('pie').classList.add('oculto');
    main.innerHTML =
      '<form class="panel" id="form-clave"><h2>Escribe la clave del equipo</h2>' +
      (mensaje ? '<p class="error">' + e(mensaje) + '</p>' : '') +
      '<label for="clave">Clave</label><input id="clave" type="password" autocomplete="current-password" required>' +
      '<p class="vacio">Solo la primera vez: este celular la recuerda.</p>' +
      '<button class="accion principal" type="submit">Entrar</button></form>';
    $('form-clave').addEventListener('submit', function (ev) {
      ev.preventDefault();
      clave = $('clave').value.trim();
      if (!clave) return;
      guardarClave(clave);
      cargar();
    });
    $('clave').focus();
  }

  function pantallaError() {
    main.innerHTML = '<div class="panel"><p class="error">No se pudo conectar. Intenta de nuevo.</p>' +
      '<button class="accion principal" type="button" data-accion="reintentar">Intentar de nuevo</button></div>';
  }

  function contarMes(mes) {
    return estado.personas.filter(function (p) { return p.mes === mes; }).length;
  }

  function pintar() {
    var hoy = estado.hoy;
    if (!estado.mes) estado.mes = hoy.mes;
    $('subtitulo').textContent = 'Oficina del Diputado Felipe Ferro · Hoy: ' + hoy.dia + ' de ' + L.nombreMes(hoy.mes) +
      (DEMO ? ' · DEMOSTRACIÓN (nombres inventados)' : '');
    var nav = $('meses');
    nav.innerHTML = L.ordenPestanas(hoy.mes).map(function (m) {
      var nombre = L.nombreMes(m);
      return '<button type="button" data-accion="mes" data-mes="' + m + '"' + (m === estado.mes ? ' class="activo"' : '') + '>' +
        nombre.charAt(0).toUpperCase() + nombre.slice(1) + ' · ' + contarMes(m) + '</button>';
    }).join('');
    nav.classList.remove('oculto');
    $('buscador').classList.remove('oculto');
    $('borrar-busqueda').classList.toggle('oculto', !estado.busqueda);
    $('pie').classList.toggle('oculto', DEMO);

    if (estado.busqueda.trim()) return pintarBusqueda();
    var mes = estado.mes;
    var titulo = L.nombreMes(mes).charAt(0).toUpperCase() + L.nombreMes(mes).slice(1);
    var html = '<div class="barra"><div><h2>' + titulo + '</h2><span class="total">' + contarMes(mes) + ' cumpleaños</span></div><div>' +
      '<button class="accion" type="button" data-accion="copiar">📋 Copiar lista</button> ' +
      (estado.editor ? '<button class="accion principal" type="button" data-accion="nuevo">+ Agregar</button>' : '') +
      '</div></div>';
    if (estado.aviso) html += '<p class="aviso">' + e(estado.aviso) + '</p>';
    if (estado.copiar !== null) {
      html += '<div class="panel"><p class="vacio">No se pudo copiar solo. Mantén presionado el texto, cópialo y pégalo en WhatsApp:</p>' +
        '<textarea id="texto-copiar" readonly>' + e(estado.copiar) + '</textarea></div>';
    }
    if (estado.formulario) html += formulario();
    if (estado.verFoto) html += visor();

    if (mes === hoy.mes) {
      var s = L.seccionesDelMes(estado.personas, hoy);
      html += seccion('hoy', 'Hoy · ' + hoy.dia + ' de ' + L.nombreMes(hoy.mes), s.hoy, 'Hoy nadie cumple años.') +
        seccion('proximos', 'Próximos 7 días', s.proximos, 'Nadie en los próximos 7 días.') +
        seccion('resto', 'Resto del mes', s.resto, 'Nadie más este mes.') +
        seccion('pasaron', 'Ya pasaron', s.pasaron, 'Todavía no ha pasado ninguno.');
    } else {
      html += seccion('mes-' + mes, 'Todo el mes', L.listaDelMes(estado.personas, mes), 'Nadie cumple este mes.', true);
    }
    if (estado.editor) {
      html += seccion('retirados', 'Retirados', estado.retirados.slice().sort(function (a, b) { return a.mes - b.mes || a.dia - b.dia; }),
        'No hay retirados.', false, true);
    }
    main.innerHTML = html;
    var area = $('texto-copiar');
    if (area) area.select();
    cargarMinis();
  }

  // Con algo escrito en el buscador se ve la gente de todos los meses que coincide.
  function pintarBusqueda() {
    var lista = L.buscar(estado.personas, estado.busqueda);
    var html = '<div class="barra"><div><h2>Resultados</h2><span class="total">' + lista.length +
      (lista.length === 1 ? ' persona' : ' personas') + '</span></div></div>';
    if (estado.aviso) html += '<p class="aviso">' + e(estado.aviso) + '</p>';
    if (estado.formulario) html += formulario();
    if (estado.verFoto) html += visor();
    html += lista.length ? '<div class="panel">' + lista.map(function (p) { return tarjeta(p); }).join('') + '</div>'
      : '<p class="vacio">Nadie con «' + e(estado.busqueda.trim()) + '». Revisa cómo está escrito.</p>';
    main.innerHTML = html;
    cargarMinis(lista);
  }

  function seccion(llave, titulo, lista, vacio, abierta, retirados) {
    var abierto = llave in estado.abiertos ? estado.abiertos[llave] : !!abierta;
    return '<details data-llave="' + llave + '"' + (llave === 'hoy' ? ' class="hoy"' : '') + (abierto ? ' open' : '') + '>' +
      '<summary><h2>' + e(titulo) + ' (' + lista.length + ')</h2></summary>' +
      (lista.length ? lista.map(function (p) { return tarjeta(p, retirados); }).join('') : '<p class="vacio">' + e(vacio) + '</p>') +
      '</details>';
  }

  function tarjeta(p, retirado) {
    var id = e(p.id);
    var botones = '';
    if (estado.editor) {
      if (retirado) {
        botones = '<div class="botones"><button class="accion" type="button" data-accion="restaurar" data-id="' + id + '">Devolver</button></div>';
      } else if (estado.confirmar === p.id) {
        botones = '<div class="botones"><span>¿Quitar a ' + e(p.nombre) + '?</span>' +
          '<button class="accion peligro" type="button" data-accion="quitar" data-id="' + id + '">Sí, quitar</button>' +
          '<button class="accion" type="button" data-accion="no-quitar">No</button></div>';
      } else {
        botones = '<div class="botones"><button class="accion" type="button" data-accion="editar" data-id="' + id + '">Editar</button>' +
          '<button class="accion peligro" type="button" data-accion="pedir-quitar" data-id="' + id + '">Quitar</button></div>';
      }
    }
    return '<div class="persona"><div class="fecha">' + String(p.dia).padStart(2, '0') +
      '<small>' + L.nombreMes(p.mes).slice(0, 3) + '</small></div>' + (retirado ? '' : avatar(p)) +
      '<div class="quien"><b>' + e(p.nombre) + '</b>' +
      (p.detalle ? '<div class="detalle">' + e(p.detalle) + '</div>' : '') + botones + '</div></div>';
  }

  // ---------- Fotos ----------

  function avatar(p) {
    var id = e(p.id);
    if (estado.fotoPara === p.id && estado.ocupado) return '<span class="av cargando">Subiendo…</span>';
    if (!p.foto) return '<button class="av sin" type="button" data-accion="subir-foto" data-id="' + id + '">Subir<br>foto</button>';
    var mini = estado.minis[p.id];
    return '<button class="av" type="button" data-accion="ver-foto" data-id="' + id + '" aria-label="Ver foto de ' + e(p.nombre) + '">' +
      (mini ? '<img src="' + mini + '" alt="">' : '') + '</button>';
  }

  // Las miniaturas se piden solo para el mes (o la búsqueda) que se está mirando.
  function cargarMinis(visibles) {
    var ids = (visibles || estado.personas.filter(function (p) { return p.mes === estado.mes; })).filter(function (p) {
      return p.foto && !estado.minis[p.id] && !estado.pidiendo[p.id];
    }).map(function (p) { return p.id; });
    if (!ids.length) return;
    ids.forEach(function (id) { estado.pidiendo[id] = true; });
    pedirFotos('minis', { ids: ids.join(',') }).then(function (r) {
      for (var id in (r.ok && r.minis) || {}) estado.minis[id] = JPG + r.minis[id];
      if (r.ok) pintar();
    }).catch(function () {
      ids.forEach(function (id) { delete estado.pidiendo[id]; });
    });
  }

  function visor() {
    var v = estado.verFoto;
    var p = estado.personas.find(function (x) { return x.id === v.id; });
    if (!p) return '';
    var id = e(p.id);
    var grande = estado.grandes[p.id];
    return '<div class="visor" role="dialog" aria-label="Foto de ' + e(p.nombre) + '"><div class="panel">' +
      '<h2>' + e(p.nombre) + '</h2>' +
      (grande ? '<img class="grande" src="' + grande + '" alt="Foto de ' + e(p.nombre) + '">'
        : '<p class="vacio">' + (v.error ? e(v.error) : 'Cargando la foto…') + '</p>') +
      '<div class="botones">' +
      (grande ? '<a class="accion principal" download="Cumple ' + e(p.nombre) + '.jpg" href="' + grande + '">⬇ Descargar</a>' : '') +
      '<button class="accion" type="button" data-accion="subir-foto" data-id="' + id + '">📷 Cambiar foto</button>' +
      (estado.editor ? '<button class="accion peligro" type="button" data-accion="quitar-foto" data-id="' + id + '">Quitar foto</button>' : '') +
      '<button class="accion" type="button" data-accion="cerrar-foto">✕ Cerrar</button></div></div></div>';
  }

  function verFoto(id) {
    estado.verFoto = { id: id };
    pintar();
    if (estado.grandes[id]) return;
    pedirFotos('ver-foto', { id: id }).then(function (r) {
      if (r.ok) estado.grandes[id] = JPG + r.foto;
      else if (estado.verFoto) estado.verFoto.error = r.mensaje || 'No se pudo abrir la foto.';
      pintar();
    }).catch(function () {
      if (estado.verFoto) estado.verFoto.error = 'No se pudo conectar. Intenta de nuevo.';
      pintar();
    });
  }

  // El celular achica la foto antes de subirla: grande (máx. 1600 px) y miniatura cuadrada de 160 px.
  function achicar(img, lado, cuadrada) {
    var w = img.naturalWidth, h = img.naturalHeight, sx = 0, sy = 0, sw = w, sh = h, cw, ch;
    if (cuadrada) {
      var m = Math.min(w, h);
      sx = (w - m) / 2; sy = (h - m) / 2; sw = sh = m;
      cw = ch = lado;
    } else {
      var escala = Math.min(1, lado / Math.max(w, h));
      cw = Math.round(w * escala); ch = Math.round(h * escala);
    }
    var lienzo = document.createElement('canvas');
    lienzo.width = cw; lienzo.height = ch;
    var ctx = lienzo.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, cw, ch);
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, cw, ch);
    return lienzo.toDataURL('image/jpeg', cuadrada ? 0.8 : 0.88).slice(JPG.length);
  }

  function subirFoto(archivo) {
    var id = estado.fotoPara;
    var p = estado.personas.find(function (x) { return x.id === id; });
    if (!p || !archivo) return;
    var url = URL.createObjectURL(archivo);
    var img = new Image();
    img.onerror = function () {
      URL.revokeObjectURL(url);
      avisar('Ese archivo no es una foto que se pueda abrir.');
      pintar();
    };
    img.onload = function () {
      URL.revokeObjectURL(url);
      var foto = achicar(img, 1600, false), mini = achicar(img, 160, true);
      estado.verFoto = null;
      estado.ocupado = true;
      avisar('Subiendo la foto de ' + p.nombre + '…');
      pintar();
      enviar('subir-foto', { id: id }, false, { foto: foto, mini: mini }).then(function (r) {
        estado.ocupado = false;
        if (r.error === 'clave') { olvidarClave(); clave = ''; return pantallaClave('Tu clave ya no sirve.'); }
        if (!r.ok) { avisar('No se pudo subir la foto: ' + (r.mensaje || r.error)); return pintar(); }
        p.foto = true;
        estado.minis[id] = JPG + mini;
        estado.grandes[id] = JPG + foto;
        avisar('Foto guardada: ' + p.nombre);
        pintar();
      }).catch(function () {
        estado.ocupado = false;
        avisar('No se pudo conectar. La foto no se subió; intenta de nuevo.');
        pintar();
      });
    };
    img.src = url;
  }

  function quitarFoto(id) {
    var p = estado.personas.find(function (x) { return x.id === id; });
    enviar('quitar-foto', { id: id }).then(function (r) {
      if (!r.ok) { avisar('No se pudo: ' + (r.mensaje || r.error)); return pintar(); }
      p.foto = false;
      delete estado.minis[id];
      delete estado.grandes[id];
      estado.verFoto = null;
      avisar('Foto quitada: ' + p.nombre);
      pintar();
    }).catch(function () { avisar('No se pudo conectar. Intenta de nuevo.'); pintar(); });
  }

  function formulario() {
    var f = estado.formulario;
    var dias = '', meses = '';
    for (var d = 1; d <= 31; d++) dias += '<option' + (d === Number(f.dia) ? ' selected' : '') + '>' + d + '</option>';
    for (var m = 1; m <= 12; m++) {
      meses += '<option value="' + m + '"' + (m === Number(f.mes) ? ' selected' : '') + '>' + L.nombreMes(m) + '</option>';
    }
    var parecidos = '';
    if (f.parecidos) {
      parecidos = '<div class="aviso">Ya hay alguien con un nombre parecido:<ul>' +
        f.parecidos.map(function (p) { return '<li>' + e(L.lineaPersona(p)) + '</li>'; }).join('') +
        '</ul><button class="accion principal" type="button" data-accion="forzar">Sí, es otra persona: agregar</button></div>';
    }
    return '<form class="panel" id="form-persona"><h2>' + (f.id ? 'Editar' : 'Agregar persona') + '</h2>' +
      '<label for="f-nombre">Nombre</label><input id="f-nombre" maxlength="120" required value="' + e(f.nombre) + '">' +
      '<label for="f-detalle">Cargo o de dónde es (opcional)</label><input id="f-detalle" maxlength="120" placeholder="Ej: Edil Comuna 1" value="' + e(f.detalle) + '">' +
      '<div class="fila"><div><label for="f-dia">Día</label><select id="f-dia">' + dias + '</select></div>' +
      '<div><label for="f-mes">Mes</label><select id="f-mes">' + meses + '</select></div></div>' +
      (f.error ? '<p class="error">' + e(f.error) + '</p>' : '') + parecidos +
      '<div class="botones"><button class="accion principal" type="submit"' + (estado.ocupado ? ' disabled' : '') + '>' +
      (estado.ocupado ? 'Guardando…' : 'Guardar') + '</button>' +
      '<button class="accion" type="button" data-accion="cancelar">Cancelar</button></div></form>';
  }

  // ---------- Acciones ----------

  function leerFormulario() {
    var f = estado.formulario;
    f.nombre = $('f-nombre').value;
    f.detalle = $('f-detalle').value;
    f.dia = Number($('f-dia').value);
    f.mes = Number($('f-mes').value);
    return { id: f.id, nombre: f.nombre.trim(), detalle: f.detalle.trim(), dia: f.dia, mes: f.mes };
  }

  function guardarPersona(forzar) {
    var p = leerFormulario();
    var f = estado.formulario;
    var maximo = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][p.mes - 1];
    if (!p.nombre) { f.error = 'Falta el nombre.'; return pintar(); }
    if (p.dia > maximo) { f.error = 'En ' + L.nombreMes(p.mes) + ' no hay día ' + p.dia + '.'; return pintar(); }
    estado.ocupado = true;
    pintar();
    enviar(p.id ? 'editar' : 'agregar', p, forzar).then(function (r) {
      estado.ocupado = false;
      if (r.ok) {
        estado.formulario = null;
        estado.mes = p.mes;
        avisar((p.id ? 'Cambios guardados: ' : 'Agregado: ') + L.lineaPersona(p));
        return r.demo ? pintar() : cargar();
      }
      if (r.error === 'clave') { olvidarClave(); clave = ''; return pantallaClave('Tu clave ya no sirve.'); }
      f.parecidos = r.error === 'parecido' ? r.parecidos : null;
      f.error = r.error === 'parecido' ? '' : (r.mensaje || 'No se pudo guardar.');
      pintar();
    }).catch(function () {
      estado.ocupado = false;
      f.error = 'No se pudo conectar. Intenta de nuevo.';
      pintar();
    });
  }

  function cambiarEstado(accion, id) {
    var p = estado.personas.concat(estado.retirados).find(function (x) { return x.id === id; });
    if (!p) return;
    enviar(accion, { id: id }).then(function (r) {
      estado.confirmar = null;
      if (!r.ok) { avisar('No se pudo: ' + (r.mensaje || r.error)); return pintar(); }
      avisar((accion === 'quitar' ? 'Quitado (está en Retirados): ' : 'Devuelto: ') + p.nombre);
      return r.demo ? pintar() : cargar();
    }).catch(function () { avisar('No se pudo conectar. Intenta de nuevo.'); pintar(); });
  }

  function avisar(texto) {
    estado.aviso = texto;
    estado.copiar = null;
  }

  function copiar() {
    var texto = L.textoCopiar(estado.mes, estado.personas);
    var listo = function () { avisar('Lista de ' + L.nombreMes(estado.mes) + ' copiada. Pégala en WhatsApp.'); pintar(); };
    var aMano = function () { estado.aviso = ''; estado.copiar = texto; pintar(); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(texto).then(listo, aMano);
    else aMano();
  }

  document.addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-accion]');
    if (!b) return;
    var accion = b.getAttribute('data-accion');
    var id = b.getAttribute('data-id');
    if (accion === 'mes') {
      estado.mes = Number(b.getAttribute('data-mes'));
      estado.busqueda = '';
      $('buscar').value = '';
      estado.aviso = '';
      estado.copiar = null;
      return pintar();
    }
    if (accion === 'reintentar') return cargar();
    if (accion === 'copiar') return copiar();
    if (accion === 'nuevo') {
      estado.formulario = { nombre: '', detalle: '', dia: estado.hoy.dia, mes: estado.mes };
      return pintar();
    }
    if (accion === 'editar') {
      var p = estado.personas.find(function (x) { return x.id === id; });
      estado.formulario = { id: p.id, nombre: p.nombre, detalle: p.detalle, dia: p.dia, mes: p.mes };
      window.scrollTo(0, 0);
      return pintar();
    }
    if (accion === 'cancelar') { estado.formulario = null; return pintar(); }
    if (accion === 'forzar') return guardarPersona(true);
    if (accion === 'pedir-quitar') { estado.confirmar = id; return pintar(); }
    if (accion === 'no-quitar') { estado.confirmar = null; return pintar(); }
    if (accion === 'quitar' || accion === 'restaurar') return cambiarEstado(accion, id);
    if (accion === 'ver-foto') return verFoto(id);
    if (accion === 'cerrar-foto') { estado.verFoto = null; return pintar(); }
    if (accion === 'quitar-foto') return quitarFoto(id);
    if (accion === 'subir-foto') {
      if (estado.ocupado) return;
      estado.fotoPara = id;
      var elegir = $('archivo-foto');
      elegir.value = '';
      return elegir.click();
    }
  });

  $('archivo-foto').addEventListener('change', function (ev) { subirFoto(ev.target.files[0]); });

  // El buscador está fuera de <main>: al repintar no se pierde lo que se está escribiendo.
  $('buscar').addEventListener('input', function (ev) {
    estado.busqueda = ev.target.value;
    estado.aviso = '';
    estado.copiar = null;
    pintar();
  });

  $('borrar-busqueda').addEventListener('click', function () {
    estado.busqueda = '';
    $('buscar').value = '';
    pintar();
    $('buscar').focus();
  });

  document.addEventListener('submit', function (ev) {
    if (ev.target.id !== 'form-persona') return;
    ev.preventDefault();
    if (!estado.ocupado) guardarPersona(false);
  });

  // Recordar qué secciones están abiertas al volver a pintar.
  document.addEventListener('toggle', function (ev) {
    var llave = ev.target.getAttribute && ev.target.getAttribute('data-llave');
    if (llave) estado.abiertos[llave] = ev.target.open;
  }, true);

  $('salir').addEventListener('click', function () {
    olvidarClave();
    clave = '';
    estado.editor = false;
    pantallaClave('');
  });

  if (DEMO || clave) cargar();
  else pantallaClave('');
})();
