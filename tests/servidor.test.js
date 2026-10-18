const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../apps-script/Codigo.gs');

const PROPS = { CLAVE_EQUIPO: 'equipo123', CLAVE_EDITOR: 'editor456' };
const HOY = '2026-10-18';

function almacen(filas) {
  return {
    filas: filas.map((f) => f.slice()),
    leer() { return this.filas.map((f) => f.slice()); },
    agregarFila(f) { this.filas.push(f.slice()); },
    cambiarFila(i, f) { this.filas[i] = f.slice(); },
  };
}
const base = () => almacen([
  ['p0001', 'Ana Prueba', 'Edil', 5, 11, 'activo', 'x', '2026-10-01'],
  ['p0002', 'Luis Ejemplo', '', 1, 12, 'retirado', 'x', '2026-10-01'],
]);

test('revisarClave', () => {
  assert.equal(S.revisarClave('editor456', PROPS), 'editor');
  assert.equal(S.revisarClave('equipo123', PROPS), 'equipo');
  assert.equal(S.revisarClave('mala', PROPS), null);
  assert.equal(S.revisarClave('', { CLAVE_EQUIPO: '', CLAVE_EDITOR: 'x' }), null);
  assert.equal(S.revisarClave(undefined, PROPS), null);
});

test('validarPersona', () => {
  assert.equal(S.validarPersona({ nombre: 'Ana', detalle: '', dia: 29, mes: 2 }), null);
  assert.ok(S.validarPersona({ nombre: '  ', dia: 1, mes: 1 }));
  assert.ok(S.validarPersona({ nombre: 'Ana', dia: 31, mes: 4 }));
  assert.ok(S.validarPersona({ nombre: 'Ana', dia: 0, mes: 4 }));
  assert.ok(S.validarPersona({ nombre: 'Ana', dia: 1, mes: 13 }));
  assert.ok(S.validarPersona({ nombre: 'Ana', dia: '1x', mes: 1 }));
  assert.ok(S.validarPersona({ nombre: 'A'.repeat(121), dia: 1, mes: 1 }));
});

test('sonParecidos (misma regla que la limpieza)', () => {
  assert.ok(S.sonParecidos('Rosa Ejemplo', 'ROSA MARIA EJEMPLO SOL'));
  assert.ok(S.sonParecidos('Ana Prueba', 'ana prueba'));
  assert.ok(S.sonParecidos('Jhon Fredy Prueba', 'John Fredy Prueba'));
  assert.ok(!S.sonParecidos('Ana Prueba', 'Luis Prueba'));
  assert.ok(!S.sonParecidos('Ana', 'Ana María Prueba'));
});

test('fila y persona ida y vuelta', () => {
  const fila = ['p0001', 'Ana Prueba', 'Edil', 5, 11, 'activo', 'x', '2026-10-01'];
  const p = S.filaAPersona(fila);
  assert.deepEqual(p, { id: 'p0001', nombre: 'Ana Prueba', detalle: 'Edil', dia: 5, mes: 11, estado: 'activo', fuente: 'x', agregado: '2026-10-01' });
  assert.deepEqual(S.personaAFila(p), fila);
  assert.equal(S.filaAPersona(['p9', 'X', '', '5', '11', 'activo', '', '']).dia, 5);
});

test('lista con la clave del equipo: solo activos, sin retirados ni campos internos', () => {
  const r = S.procesar({ accion: 'lista', clave: 'equipo123' }, PROPS, base(), HOY);
  assert.equal(r.ok, true);
  assert.equal(r.editor, false);
  assert.deepEqual(r.personas, [{ id: 'p0001', nombre: 'Ana Prueba', detalle: 'Edil', dia: 5, mes: 11 }]);
  assert.equal(r.retirados, undefined);
});

test('lista con la clave del editor trae los retirados', () => {
  const r = S.procesar({ accion: 'lista', clave: 'editor456' }, PROPS, base(), HOY);
  assert.equal(r.editor, true);
  assert.deepEqual(r.retirados.map((p) => p.id), ['p0002']);
});

test('clave mala o vacía: error clave y ningún nombre', () => {
  for (const clave of ['mala', '', undefined]) {
    const r = S.procesar({ accion: 'lista', clave }, PROPS, base(), HOY);
    assert.deepEqual(r, { ok: false, error: 'clave' });
  }
});

test('el equipo no puede editar', () => {
  const a = base();
  const r = S.procesar({ accion: 'agregar', clave: 'equipo123', persona: { nombre: 'Eva', dia: 1, mes: 1 } }, PROPS, a, HOY);
  assert.deepEqual(r, { ok: false, error: 'clave' });
  assert.equal(a.filas.length, 2);
});

test('agregar: id nuevo, fecha de hoy, activo', () => {
  const a = base();
  const r = S.procesar({ accion: 'agregar', clave: 'editor456', persona: { nombre: ' Eva Nueva ', detalle: 'Líder', dia: 3, mes: 1 } }, PROPS, a, HOY);
  assert.equal(r.ok, true);
  assert.deepEqual(r.persona, { id: 'p0003', nombre: 'Eva Nueva', detalle: 'Líder', dia: 3, mes: 1 });
  assert.deepEqual(a.filas[2], ['p0003', 'Eva Nueva', 'Líder', 3, 1, 'activo', 'página', HOY]);
});

test('agregar parecido a un activo avisa, y con forzar entra', () => {
  const a = base();
  const p = { nombre: 'ANA PRUEBA', dia: 6, mes: 11 };
  const r = S.procesar({ accion: 'agregar', clave: 'editor456', persona: p }, PROPS, a, HOY);
  assert.equal(r.ok, false);
  assert.equal(r.error, 'parecido');
  assert.deepEqual(r.parecidos.map((x) => x.id), ['p0001']);
  assert.equal(a.filas.length, 2);
  const r2 = S.procesar({ accion: 'agregar', clave: 'editor456', persona: p, forzar: true }, PROPS, a, HOY);
  assert.equal(r2.ok, true);
});

test('agregar con datos malos', () => {
  const r = S.procesar({ accion: 'agregar', clave: 'editor456', persona: { nombre: 'Eva', dia: 31, mes: 2 } }, PROPS, base(), HOY);
  assert.equal(r.ok, false);
  assert.equal(r.error, 'datos');
});

test('editar cambia nombre, detalle y fecha sin tocar id, estado ni fuente', () => {
  const a = base();
  const r = S.procesar({ accion: 'editar', clave: 'editor456', persona: { id: 'p0001', nombre: 'Ana María Prueba', detalle: 'Edil Comuna 4', dia: 6, mes: 11 } }, PROPS, a, HOY);
  assert.equal(r.ok, true);
  assert.deepEqual(a.filas[0], ['p0001', 'Ana María Prueba', 'Edil Comuna 4', 6, 11, 'activo', 'x', '2026-10-01']);
});

test('quitar y restaurar', () => {
  const a = base();
  assert.equal(S.procesar({ accion: 'quitar', clave: 'editor456', persona: { id: 'p0001' } }, PROPS, a, HOY).ok, true);
  assert.equal(a.filas[0][5], 'retirado');
  assert.equal(S.procesar({ accion: 'restaurar', clave: 'editor456', persona: { id: 'p0002' } }, PROPS, a, HOY).ok, true);
  assert.equal(a.filas[1][5], 'activo');
});

test('id que no existe o acción desconocida: error datos', () => {
  assert.equal(S.procesar({ accion: 'quitar', clave: 'editor456', persona: { id: 'p9999' } }, PROPS, base(), HOY).error, 'datos');
  assert.equal(S.procesar({ accion: 'borrarTodo', clave: 'editor456' }, PROPS, base(), HOY).error, 'datos');
});

test('la hoja con encabezado: se ignora la primera fila', () => {
  const a = almacen([S.COLUMNAS, ['p0001', 'Ana Prueba', '', 5, 11, 'activo', 'x', '']]);
  const r = S.procesar({ accion: 'lista', clave: 'equipo123' }, PROPS, a, HOY);
  assert.deepEqual(r.personas.map((p) => p.id), ['p0001']);
  const r2 = S.procesar({ accion: 'quitar', clave: 'editor456', persona: { id: 'p0001' } }, PROPS, a, HOY);
  assert.equal(r2.ok, true);
  assert.deepEqual(a.filas[0], S.COLUMNAS);
  assert.equal(a.filas[1][5], 'retirado');
});

test('un nombre que empieza con = no se vuelve fórmula en la hoja', () => {
  const a = base();
  S.procesar({ accion: 'agregar', clave: 'editor456', persona: { nombre: '=IMPORTXML("x")', dia: 1, mes: 1 } }, PROPS, a, HOY);
  assert.equal(a.filas[2][1], "'=IMPORTXML(\"x\")");
});

test('quitar no convierte en fórmula un nombre que la hoja devolvió sin apóstrofo', () => {
  const a = almacen([['p0001', '=HACK()', '', 5, 11, 'activo', 'x', '']]);
  S.procesar({ accion: 'quitar', clave: 'editor456', persona: { id: 'p0001' } }, PROPS, a, HOY);
  assert.equal(a.filas[0][1], "'=HACK()");
});

test('una fila dañada en la hoja no rompe la lista', () => {
  const a = almacen([
    ['﻿id', 'nombre', 'detalle', 'dia', 'mes', 'estado', 'fuente', 'agregado'],
    ['p0001', 'Ana Prueba', '', 5, 11, 'activo', 'x', ''],
    ['p0002', 'Sin Mes', '', 5, '', 'activo', 'x', ''],
    ['p0003', 'Mes Fecha', '', 5, new Date(), 'activo', 'x', ''],
  ]);
  const r = S.procesar({ accion: 'lista', clave: 'equipo123' }, PROPS, a, HOY);
  assert.deepEqual(r.personas.map((p) => p.id), ['p0001']);
});
