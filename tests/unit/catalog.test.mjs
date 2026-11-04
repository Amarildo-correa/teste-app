/**
 * Invariantes do catálogo de provedores.
 *
 * Trava, por escrito, as regras que a pesquisa no aparelho descobriu — para
 * que ninguém reintroduza um deep link no formato do Fire OS meses depois.
 *
 * Roda sem instalar nada:   node --test tests/unit/*.test.mjs
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const catalog = JSON.parse(
  readFileSync(join(here, '..', 'device', 'expected-catalog.json'), 'utf8'),
);
const manifest = readFileSync(join(here, '..', 'probe-app', 'manifest.toml'), 'utf8');

test('todo provedor abre por pkg://, nunca por https:// nem esquema custom', () => {
  for (const p of catalog.providers) {
    const uri = `pkg://${p.componentId}`;
    assert.match(uri, /^pkg:\/\//, `${p.name} precisa usar pkg://`);
    assert.doesNotMatch(p.componentId, /^https?:/, `${p.name} não pode ser URL`);
    assert.doesNotMatch(p.componentId, /:\/\//, `${p.name} não pode ter esquema embutido`);
  }
});

test('componentId é sempre <packageId>.<algo> — pega id inventado', () => {
  for (const p of catalog.providers) {
    assert.ok(
      p.componentId.startsWith(`${p.packageId}.`),
      `${p.name}: componentId "${p.componentId}" não pertence a "${p.packageId}"`,
    );
  }
});

test('nenhum id de package é adivinhado a partir do nome comercial', () => {
  // Prime Video é com.amazon.frenchpress; Netflix é com.netflix.kepler, não
  // com.netflix.ninja. Chutar o id é o erro mais caro aqui, porque o app
  // compila e só falha na TV.
  const prime = catalog.providers.find(p => p.name === 'Prime Video');
  assert.equal(prime.packageId, 'com.amazon.frenchpress');
  const netflix = catalog.providers.find(p => p.name === 'Netflix');
  assert.equal(netflix.packageId, 'com.netflix.kepler');
});

test('todo provedor tem módulo e aceita sender "*"', () => {
  for (const p of catalog.providers) {
    assert.ok(p.module?.startsWith('/'), `${p.name} sem módulo declarável`);
    assert.equal(
      p.senderPrivilege,
      '*',
      `${p.name} não aceita remetente qualquer — exigiria acordo com o parceiro`,
    );
  }
});

test('o manifesto do app-sonda declara um [[wants.module]] por provedor', () => {
  for (const p of catalog.providers) {
    assert.ok(
      manifest.includes(p.module),
      `manifest.toml não declara ${p.module} (${p.name}) — openURL vai falhar`,
    );
  }
});

test('os módulos dos provedores são [wants], nunca [needs]', () => {
  // Com [[needs.module]] o app deixaria de instalar em aparelho sem Netflix.
  // Comentários são removidos antes: o manifesto explica por que NÃO usa
  // [[needs.module]], e essa menção não pode disparar o teste.
  const live = manifest
    .split('\n')
    .map(l => l.replace(/#.*$/, ''))
    .join('\n');

  assert.ok(/^\s*\[wants\]/m.test(live), 'manifesto precisa do bloco [wants]');

  // Pega cada [[needs.module]] real e o id que ele declara.
  const needed = [...live.matchAll(/\[\[needs\.module\]\]\s*\n\s*id\s*=\s*"([^"]+)"/g)].map(
    m => m[1],
  );
  for (const p of catalog.providers) {
    assert.ok(
      !needed.includes(p.module),
      `${p.module} está em [needs] — tornaria ${p.name} obrigatório para instalar o portal`,
    );
  }
});

test('existe fallback de loja que não depende de módulo nenhum', () => {
  const fb = catalog.fallback.appstoreHome;
  assert.equal(fb.module, null);
  assert.equal(fb.senderCheck, 'PASS');
});

test('casos negativos continuam negativos', () => {
  assert.match(catalog.negativeCases.customSchemes['netflix://'], /No module found/);
  assert.equal(catalog.negativeCases.httpsLinks.canonicalUri, 'https://');
  assert.match(
    catalog.negativeCases.httpsLinks.receiverPrivilege,
    /assume-default-browser-role/,
    'https:// deve continuar caindo no navegador',
  );
});

test('provedores ausentes tambem sao declarados no manifesto', () => {
  // O build aceita [[wants.module]] de modulo inexistente (medido: G5), e e
  // disso que depende o portal poder listar um provedor antes de o usuario
  // instalar. Se a declaracao sumir, o cartao vira "nao instalado" para quem
  // instalar o app depois.
  for (const p of catalog.absentProviders.providers) {
    assert.ok(
      manifest.includes(p.module),
      `manifest.toml nao declara ${p.module} (${p.name})`,
    );
  }
});

test('todo provedor ausente esta marcado como id nao verificado', () => {
  // Trava a honestidade do catalogo: nao da para ler o id de um app que nao
  // esta no aparelho, entao esses ids sao hipoteses ate alguem confirmar num
  // aparelho que tenha o app.
  for (const p of catalog.absentProviders.providers) {
    assert.equal(
      p.idVerified,
      false,
      `${p.name}: marcar idVerified=true so depois de ler o id de um aparelho real`,
    );
  }
});

test('provedor confirmado e provedor hipotetico nao se misturam', () => {
  const verified = new Set(catalog.providers.map(p => p.packageId));
  for (const p of catalog.absentProviders.providers) {
    assert.ok(
      !verified.has(p.packageId),
      `${p.name} esta nas duas listas — decida se o id foi confirmado`,
    );
  }
});

test('a descoberta de apps instalados segue indisponível', () => {
  // Se um dia isto virar true, o portal pode largar o catálogo estático.
  assert.equal(catalog.discoveryApi.available, false);
  assert.equal(catalog.discoveryApi.requirement, 'platform signature');
});

/* ---------------------------------------------------------------------------
 * Caminho da loja (G6) — medido no aparelho em 2026-11-03.
 *
 * `amzn://apps/android?p=<packageId>` abre a pagina do app na Appstore, de
 * dentro do portal, sem privilegio extra. Os testes abaixo travam o que a
 * medicao custou a descobrir.
 * ------------------------------------------------------------------------ */

const providersTs = readFileSync(
  join(here, '..', 'probe-app', 'src', 'data', 'providers.ts'),
  'utf8',
);

/** [{uri, storeId}] lidos do catalogo do app, na ordem em que aparecem. */
const appCatalog = [...providersTs.matchAll(/uri: '([^']+)',[\s\S]*?storeId: (?:'([^']+)'|null)/g)].map(
  m => ({uri: m[1], storeId: m[2] ?? null}),
);

test('o catalogo do app foi lido — senao os testes abaixo passam vazios', () => {
  assert.ok(appCatalog.length >= 8, `so ${appCatalog.length} provedores lidos de providers.ts`);
});

test('storeId e o packageId: pkg://<storeId>.main', () => {
  // Nos oito provedores medidos a Appstore usa o MESMO package id do Vega.
  // Quando os dois discordam, um dos dois e palpite — foi assim que
  // `com.wbd.stream` (uri) e `com.hbo.hbonow` (loja) se denunciaram.
  for (const {uri, storeId} of appCatalog) {
    if (storeId === null) continue;
    assert.equal(
      uri,
      `pkg://${storeId}.main`,
      `uri "${uri}" e storeId "${storeId}" discordam — um dos dois foi chutado`,
    );
  }
});

test('o deep link da loja usa ?p= e um esquema que o componente aceita', () => {
  const det = catalog.fallback.appstoreDetails;
  assert.equal(det.uriTemplate, 'amzn://apps/android?p=<packageId>');
  const scheme = det.uriTemplate.slice(0, det.uriTemplate.indexOf('/', 8));
  assert.ok(
    det.acceptedUris.some(u => u.startsWith(scheme)),
    `${scheme} nao esta entre os message targets de ${det.componentId}`,
  );
});

test('a busca na loja segue proibida como plano B', () => {
  // `?s=<termo>` entra na loja e fica num spinner que nao termina. Se alguem
  // reintroduzir isso como fallback, o usuario fica preso numa tela morta.
  assert.ok(
    catalog.fallback.appstoreDetails.failureModes.searchQuery.length > 0,
    'o modo de falha da busca precisa continuar documentado',
  );
  assert.doesNotMatch(
    catalog.fallback.appstoreDetails.uriTemplate,
    /\?s=/,
    'o template da loja nao pode virar busca',
  );
});

test('nenhum provedor usa o package de outra plataforma', () => {
  // `com.netflix.ninja` e a entrada Android TV: abre a pagina certa do
  // Netflix com o botao "Indisponivel". Parece sucesso, e nao e.
  const banned = ['com.netflix.ninja', 'com.amazon.avod', 'com.wbd.stream', 'com.globo.globoplay'];
  for (const {uri, storeId} of appCatalog) {
    for (const bad of banned) {
      assert.notEqual(storeId, bad, `storeId ${bad} foi medido e NAO serve neste aparelho`);
      assert.notEqual(uri, `pkg://${bad}.main`, `uri de ${bad} foi medido e NAO serve`);
    }
  }
});

test('todo provedor ausente teve a pagina da loja verificada', () => {
  // idVerified continua false (componentId e module sao palpite), mas o
  // packageId deixou de ser: cada um foi aberto na loja.
  for (const p of catalog.absentProviders.providers) {
    assert.ok(
      p.storePageVerified,
      `${p.name}: abra amzn://apps/android?p=${p.packageId} num aparelho e confira o titulo`,
    );
  }
});
