/**
 * Paginacao dos trilhos: e o que deixa o catalogo crescer sem carregar tudo.
 *
 * Roda sem instalar nada:   node --test tests/unit/*.test.mjs
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

/* Por data: URL porque tests/probe-app nao tem package.json com type module, e
 * o Node leria o .js como CommonJS. O comando de teste segue sem flag. */
const source = readFileSync(new URL('../probe-app/src/data/railPager.js', import.meta.url), 'utf8');
const {createPager} = await import(`data:text/javascript,${encodeURIComponent(source)}`);

const byId = item => item.id;
const page = (ids, totalPages = 9) => ({items: ids.map(id => ({id})), totalPages});
const ids = pager => pager.items.map(byId);

test('pede as paginas em ordem e acumula', async () => {
  const asked = [];
  const pager = createPager(async n => {
    asked.push(n);
    return page([n * 10, n * 10 + 1]);
  }, byId);
  assert.equal(await pager.loadNext(), 2);
  assert.equal(await pager.loadNext(), 2);
  assert.deepEqual(asked, [1, 2]);
  assert.deepEqual(ids(pager), [10, 11, 20, 21]);
});

test('nao descarta a lista: quem desenha le sempre o mesmo array', async () => {
  const pager = createPager(async n => page([n]), byId);
  const items = pager.items;
  await pager.loadNext();
  await pager.loadNext();
  assert.equal(pager.items, items);
  assert.equal(items.length, 2);
});

test('pedido em voo nao dispara outro', async () => {
  let calls = 0;
  let release;
  const pager = createPager(() => {
    calls += 1;
    return new Promise(resolve => {
      release = () => resolve(page([1]));
    });
  }, byId);
  const first = pager.loadNext();
  assert.equal(pager.status, 'loading');
  /* Conta antes de esperar: com a guarda quebrada, o segundo pedido nunca volta. */
  const second = pager.loadNext();
  assert.equal(calls, 1);
  assert.equal(await second, 0);
  release();
  assert.equal(await first, 1);
});

test('titulo repetido entre paginas entra uma vez so', async () => {
  const pages = {1: page([1, 2]), 2: page([2, 3])};
  const pager = createPager(async n => pages[n], byId);
  await pager.loadNext();
  assert.equal(await pager.loadNext(), 1);
  assert.deepEqual(ids(pager), [1, 2, 3]);
});

test('ultima pagina encerra e nao vai mais a rede', async () => {
  let calls = 0;
  const pager = createPager(async () => {
    calls += 1;
    return page([1], 1);
  }, byId);
  await pager.loadNext();
  assert.equal(pager.status, 'done');
  assert.equal(await pager.loadNext(), 0);
  assert.equal(calls, 1);
});

test('erro nao rejeita, nao perde o que ja chegou e repete a mesma pagina', async () => {
  const asked = [];
  let fail = false;
  const pager = createPager(async n => {
    asked.push(n);
    if (fail) {
      throw new Error('rede');
    }
    return page([n]);
  }, byId);
  await pager.loadNext();
  fail = true;
  assert.equal(await pager.loadNext(), 0);
  assert.equal(pager.status, 'error');
  assert.deepEqual(ids(pager), [1]);
  fail = false;
  assert.equal(await pager.loadNext(), 1);
  assert.deepEqual(asked, [1, 2, 2]);
  assert.deepEqual(ids(pager), [1, 2]);
});

test('pagina vazia no meio nao encerra: o filtro de poster pode esvaziar uma', async () => {
  const pages = {1: page([]), 2: page([7])};
  const pager = createPager(async n => pages[n], byId);
  assert.equal(await pager.loadNext(), 0);
  assert.equal(pager.status, 'idle');
  assert.equal(await pager.loadNext(), 1);
});

test('5000 titulos: cada pagina custa so os itens dela', async () => {
  const size = 20;
  const pager = createPager(
    async n => page(Array.from({length: size}, (_, i) => (n - 1) * size + i), 250),
    byId,
  );
  /* Com teto: se `done` nunca chegar, o teste falha em vez de travar. */
  for (let i = 0; i < 250; i += 1) {
    await pager.loadNext();
  }
  assert.equal(pager.status, 'done');
  assert.equal(pager.items.length, 5000);
  assert.equal(new Set(ids(pager)).size, 5000);
});
