/**
 * Catalogo de provedores do app-sonda.
 *
 * Os ids vieram do proprio aparelho — ver tests/device/expected-catalog.json.
 * Nenhum deles se adivinha: Prime Video e `com.amazon.frenchpress`.
 *
 * Cada `module` precisa estar declarado em `[[wants.module]]` no
 * manifest.toml, senao o provedor e tratado como ausente mesmo para quem tem o
 * app: o botao vai para a loja. `tests/unit/catalog.test.mjs` trava esse
 * pareamento.
 */
import {C} from '../theme';

export type Provider = {
  key: string;
  name: string;
  mark: string;
  markColor: string;
  markBg: string;
  /** URI de lancamento. Sempre pkg:// — https:// vai para o navegador. */
  uri: string;
  /** o que esperamos neste aparelho; usado para o veredito do teste */
  expectAvailable: boolean;
  /** false quando o id e hipotese, nao leitura de aparelho */
  idVerified: boolean;
  /**
   * Package ANDROID do app na Appstore. Vai em
   * `amzn://apps/android?p=<storeId>` e abre a pagina de detalhes.
   *
   * Nos cinco que foram medidos num aparelho, bateu com o id Vega sem o
   * `.main`: `com.amazon.frenchpress.main` -> `com.amazon.frenchpress`,
   * `com.netflix.kepler.main` -> `com.netflix.kepler`, e assim por diante.
   * Trate isso como pista para o proximo palpite, NAO como regra: nada na
   * documentacao promete, e cada novo provedor continua precisando de uma
   * pagina aberta num aparelho antes de entrar aqui.
   *
   * Dois enganos que so a tela revela, porque nenhum rejeita a promise:
   *
   *   - package inexistente (`com.wbd.stream`) -> tela de "Erro / Go Back"
   *     em cima do portal;
   *   - package de OUTRA plataforma (`com.netflix.ninja`, a entrada Android
   *     TV) -> pagina certa do app, botao "Indisponivel". Pior que o erro,
   *     porque parece ter funcionado.
   *
   * Por isso o criterio de aceitacao e ver o botao: "Abrir" para quem tem o
   * app, "Baixar"/"Comprar" para quem nao tem.
   *
   * `null` = nao sabemos, e o portal NAO manda para a loja.
   */
  storeId: string | null;
};

export const PROVIDERS: Provider[] = [
  /* ---- instalados neste Fire Stick, ids lidos do aparelho ---- */
  {
    key: 'prime',
    name: 'Prime Video',
    mark: 'prime',
    markColor: '#4DC3F0',
    markBg: '#0E1D27',
    uri: 'pkg://com.amazon.frenchpress.main',
    expectAvailable: true,
    idVerified: true,
    storeId: 'com.amazon.frenchpress',
  },
  {
    key: 'netflix',
    name: 'Netflix',
    mark: 'N',
    markColor: '#FF5A5F',
    markBg: '#231012',
    uri: 'pkg://com.netflix.kepler.main',
    expectAvailable: true,
    idVerified: true,
    // `com.netflix.ninja` e a entrada Android TV: abre, mas diz Indisponivel.
    storeId: 'com.netflix.kepler',
  },
  {
    key: 'appletv',
    name: 'Apple TV',
    mark: 'tv',
    markColor: '#F5F6F7',
    markBg: '#1A1C21',
    uri: 'pkg://com.apple.atve.amazon.appletv.main',
    expectAvailable: true,
    idVerified: true,
    storeId: 'com.apple.atve.amazon.appletv',
  },
  {
    key: 'pluto',
    name: 'Pluto TV',
    mark: 'pluto',
    markColor: '#FFE94D',
    markBg: '#201E0C',
    uri: 'pkg://tv.pluto.android.main',
    expectAvailable: true,
    idVerified: true,
    storeId: 'tv.pluto.android',
  },

  /* ---- streamings reais AUSENTES deste aparelho ----
   *
   * Confirmado com `vpm list packages`. Os ids sao HIPOTESES: nao da para
   * ler o id de um app que nao esta instalado. Para o teste tanto faz (app
   * ausente da o mesmo resultado com id certo ou errado), mas antes de
   * producao cada um precisa ser lido de um aparelho que tenha o app.
   *
   * O que estes tres medem e outra coisa: se o build aceita declarar um
   * [[wants.module]] que NAO existe no sistema — a situacao de todo usuario
   * que nao tem Disney+. Mediu: aceita. */
  {
    key: 'disney',
    name: 'Disney+',
    mark: 'D+',
    markColor: '#7BA7FF',
    markBg: '#10172B',
    uri: 'pkg://com.disney.disneyplus.main',
    expectAvailable: false,
    idVerified: false,
    storeId: 'com.disney.disneyplus',
  },
  {
    key: 'max',
    name: 'Max',
    mark: 'max',
    markColor: '#9D8CFF',
    markBg: '#161228',
    uri: 'pkg://com.hbo.hbonow.main',
    expectAvailable: false,
    idVerified: false,
    storeId: 'com.hbo.hbonow',
  },
  {
    key: 'globoplay',
    name: 'Globoplay',
    mark: 'globo',
    markColor: '#FF8A5B',
    markBg: '#241410',
    uri: 'pkg://com.globo.globotv.main',
    expectAvailable: false,
    idVerified: false,
    storeId: 'com.globo.globotv',
  },

  /* ---- controle negativo ----
   *
   * App que ESTA instalado, mas cujo modulo NAO foi declarado no nosso
   * manifesto. Separa "o app existe" de "nos temos permissao de falar com
   * ele", e mostra o custo de esquecer um [[wants.module]]. */
  {
    key: 'ctrl-undeclared',
    name: 'Modulo nao declarado',
    mark: '!',
    markColor: C.textMuted,
    markBg: '#1A1C21',
    uri: 'pkg://com.amazon.tigris.main',
    expectAvailable: false,
    idVerified: true,
    storeId: null, // controle negativo: sem caminho de loja de proposito
  },
];
