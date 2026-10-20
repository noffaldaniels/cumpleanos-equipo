const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../docs/logica.js');

const P = (nombre, dia, mes, detalle = '') => ({ id: nombre, nombre, detalle, dia, mes });
const nombres = (lista) => lista.map((p) => p.nombre);

test('hoy en Colombia aunque el reloj esté en UTC', () => {
  assert.deepEqual(L.hoyColombia(new Date('2026-11-01T03:00:00Z')), { dia: 31, mes: 10, anio: 2026 });
  assert.deepEqual(L.hoyColombia(new Date('2026-11-01T05:00:00Z')), { dia: 1, mes: 11, anio: 2026 });
});

test('secciones del mes: hoy, próximos 7 días, resto y ya pasaron', () => {
  const gente = [P('Ana', 17, 11), P('Beto', 18, 11), P('Caro', 24, 11), P('Dani', 25, 11),
    P('Eva', 2, 11), P('Fito', 17, 11), P('Gina', 5, 12)];
  const s = L.seccionesDelMes(gente, { dia: 17, mes: 11, anio: 2026 });
  assert.deepEqual(nombres(s.hoy), ['Ana', 'Fito']);
  assert.deepEqual(nombres(s.proximos), ['Beto', 'Caro']);
  assert.deepEqual(nombres(s.resto), ['Dani']);
  assert.deepEqual(nombres(s.pasaron), ['Eva']);
});

test('próximos 7 días pasa al mes siguiente', () => {
  const s = L.seccionesDelMes([P('Ana', 2, 11), P('Beto', 30, 10), P('Caro', 5, 11)], { dia: 28, mes: 10, anio: 2026 });
  assert.deepEqual(nombres(s.proximos), ['Beto', 'Ana']);
  assert.deepEqual(nombres(s.resto), []);
});

test('próximos 7 días cruza el año', () => {
  const s = L.seccionesDelMes([P('Ana', 2, 1)], { dia: 29, mes: 12, anio: 2026 });
  assert.deepEqual(nombres(s.proximos), ['Ana']);
});

test('29 de febrero: en año no bisiesto sale el 28', () => {
  const gente = [P('Bisi', 29, 2), P('Otro', 28, 2)];
  assert.deepEqual(nombres(L.seccionesDelMes(gente, { dia: 28, mes: 2, anio: 2027 }).hoy), ['Bisi', 'Otro']);
  const bisiesto = L.seccionesDelMes(gente, { dia: 28, mes: 2, anio: 2028 });
  assert.deepEqual(nombres(bisiesto.hoy), ['Otro']);
  assert.deepEqual(nombres(bisiesto.proximos), ['Bisi']);
  assert.deepEqual(nombres(L.seccionesDelMes(gente, { dia: 29, mes: 2, anio: 2028 }).hoy), ['Bisi']);
});

test('lista de otro mes, por día y nombre', () => {
  const gente = [P('Zoe', 3, 12), P('Ana', 3, 12), P('Beto', 1, 12), P('Caro', 1, 11)];
  assert.deepEqual(nombres(L.listaDelMes(gente, 12)), ['Beto', 'Ana', 'Zoe']);
});

test('pestañas: 12 meses empezando por el actual', () => {
  assert.deepEqual(L.ordenPestanas(11), [11, 12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.deepEqual(L.ordenPestanas(1), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
});

test('línea y texto para copiar como en los Word', () => {
  assert.equal(L.lineaPersona(P('Ana Pérez', 5, 11, 'Edil Comuna 4')), 'Ana Pérez (Edil Comuna 4) – 05 de noviembre');
  assert.equal(L.lineaPersona(P('Ana Pérez', 5, 11)), 'Ana Pérez – 05 de noviembre');
  assert.equal(L.textoCopiar(11, [P('Beto', 9, 11), P('Ana Pérez', 5, 11, 'Edil')]),
    'Noviembre\nAna Pérez (Edil) – 05 de noviembre\nBeto – 09 de noviembre');
});

test('escapar', () => {
  assert.equal(L.escapar('<b>"Ana" & \'Beto\'</b>'), '&lt;b&gt;&quot;Ana&quot; &amp; &#39;Beto&#39;&lt;/b&gt;');
  assert.equal(L.escapar(undefined), '');
});

test('buscar por nombre o cargo, sin tildes ni mayúsculas', () => {
  const gente = [P('Noffal Daniels', 3, 5), P('Ángela Huertas', 1, 12, 'Edil Comuna 1'), P('Ana María', 9, 2), P('Mario López', 4, 4)];
  assert.deepEqual(nombres(L.buscar(gente, 'noffal')), ['Noffal Daniels']);
  assert.deepEqual(nombres(L.buscar(gente, 'ANGELA')), ['Ángela Huertas']);
  assert.deepEqual(nombres(L.buscar(gente, 'edil')), ['Ángela Huertas']);
  assert.deepEqual(nombres(L.buscar(gente, 'ma lo')), ['Mario López']);
  assert.deepEqual(nombres(L.buscar(gente, 'ma')), ['Ana María', 'Mario López']);
  assert.deepEqual(L.buscar(gente, '   '), []);
});
