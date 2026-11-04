/**
 * Deep link para a TELA DO TITULO dentro do Netflix.
 *
 * Isto nao e deep link de URL. E uma chamada do **Content Launcher do
 * Matter** (cluster 1290 = 0x050A, comando 0 = LaunchContent) serializada em
 * JSON e pendurada na query de uma URI `pkg://` comum:
 *
 *   pkg://com.netflix.kepler.main?kcp-launch={...}
 *
 * Procedencia: a URI foi CAPTURADA do card da busca da Fire TV, com
 * `vlcm list` (a ultima coluna mostra a URI que o app recebeu), e depois
 * reenviada por `vmsgr send` fora da Alexa — abriu o mesmo titulo. Medicao
 * de 2026-11-03, em research/02-deeplink-netflix.md.
 *
 * O que o experimento 2x2 daquele documento fixou, e que manda neste arquivo:
 *
 *   - **Quem resolve o titulo e o TEXTO**, nao o id. Trocar o `amzn_id` nao
 *     muda a tela; trocar o texto muda. Por isso `title` e o parametro de
 *     verdade desta funcao.
 *   - **Mas o par `amzn_id` precisa existir.** Sem ele (so o texto), o
 *     Netflix para na LISTA DE RESULTADOS em vez de abrir o titulo. O valor
 *     e indiferente; a presenca nao.
 *
 * Consequencia de produto, registrada aqui porque e facil esquecer: como a
 * resolucao e por texto, um nome ambiguo abre o titulo errado e **nada
 * rejeita a promise**. Mesmo modo de falha do `storeId`. Todo titulo que for
 * para um catalogo fixo precisa de leitura em aparelho.
 */

/** Componente do Netflix no Vega. Id lido do aparelho, nao adivinhado. */
export const NETFLIX_COMPONENT = 'com.netflix.kepler.main';

/** Cluster Content Launcher do Matter. */
const CLUSTER_CONTENT_LAUNCHER = 1290;
/** LaunchContent. */
const COMMAND_LAUNCH_CONTENT = 0;
/** Endpoint do Content App do Netflix, como veio na captura. */
const ENDPOINT_CONTENT_APP = 15;

/** Tipo de parametro que carrega o id externo. Valor observado na captura. */
const PARAM_WITH_EXTERNAL_ID = 13;
/** Tipo de parametro que carrega so o texto. Valor observado na captura. */
const PARAM_TEXT = 16;

/* Tags TLV do Matter, como o kcp-launch as escreve. */
const TLV_LIST = '0x48';
const TLV_STRUCT = '0x4c';
const TLV_STRING = '0x42';
const TLV_UINT = '0x30';
const TLV_BOOL = '0x10';

/**
 * Texto -> array de bytes UTF-8, que e como o payload transporta string.
 *
 * `encodeURIComponent` e usado so para obter os bytes: ele devolve `%XX` por
 * byte fora do ASCII, o que serve de tabela pronta. Importa para titulo com
 * acento ("Jogos Vorazes: A Cantiga dos Passaros e das Serpentes").
 */
const utf8Bytes = (text: string): number[] => {
  const escaped = encodeURIComponent(text);
  const bytes: number[] = [];
  for (let i = 0; i < escaped.length; i += 1) {
    if (escaped[i] === '%') {
      bytes.push(parseInt(escaped.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      bytes.push(escaped.charCodeAt(i));
    }
  }
  return bytes;
};

const str = (text: string) => ({type: TLV_STRING, value: utf8Bytes(text)});
const uint = (value: number) => ({type: TLV_UINT, value});

/**
 * Monta a URI que abre `title` na tela de detalhe do Netflix.
 *
 * @param title  nome exibido do titulo — e o que resolve, entao precisa ser o
 *               nome como o Netflix o conhece (o do TMDB em pt-BR serve).
 * @param externalId  valor do par `amzn_id`. Medido como irrelevante; so a
 *               presenca importa. O default mantem o payload honesto quando
 *               nao ha id nenhum para informar.
 */
export const buildNetflixTitleUri = (title: string, externalId = '0'): string => {
  const payload = {
    revision: 1,
    action: 8,
    /* So precisa ser diferente a cada envio; o Netflix nao correlaciona. */
    transaction_id: Date.now() % 100000,
    fabric_index: 1,
    source_node: 1,
    destination: {Node: 1},
    suppress_response: false,
    timed_request: false,
    invoke_requests: [
      {
        command_path: {
          cluster_path: {
            target: {Endpoint: {node: 1, endpoint_id: ENDPOINT_CONTENT_APP}},
            cluster: CLUSTER_CONTENT_LAUNCHER,
          },
          command: COMMAND_LAUNCH_CONTENT,
        },
        command_fields: {
          '0': {
            type: TLV_LIST,
            value: [
              {
                type: TLV_STRUCT,
                value: {
                  /* ExternalIDList. Sem ela o Netflix para na lista de busca. */
                  '2': {
                    type: TLV_LIST,
                    value: [
                      {
                        type: TLV_STRUCT,
                        value: {'0': str('amzn_id'), '1': str(externalId)},
                      },
                    ],
                  },
                  '0': uint(PARAM_WITH_EXTERNAL_ID),
                  '1': str(title),
                },
              },
              {
                type: TLV_STRUCT,
                value: {'1': str(title), '0': uint(PARAM_TEXT)},
              },
            ],
          },
          /* AutoPlay do Matter. **O Netflix ignora este campo**: medido em
           * 2026-11-04 com o mesmo titulo nos dois valores, e a tela foi a
           * mesma — reproduzindo. O `LaunchContent` do Netflix sempre toca.
           *
           * Fica em `false` porque e o que a intencao do app diz, e porque e
           * o valor que a propria Alexa manda; mudar para `true` nao muda
           * nada e so esconderia o fato.
           *
           * Consequencia: este deep link entrega REPRODUCAO, nao a tela de
           * detalhe. Nao ha caminho conhecido para a tela de detalhe — o
           * `pkg://` simples cai na home. Por isso o botao diz "Abrir app e
           * assistir": e exatamente o que acontece. */
          '1': {type: TLV_BOOL, value: false},
        },
      },
    ],
  };

  return `pkg://${NETFLIX_COMPONENT}?kcp-launch=${JSON.stringify(payload)}`;
};

/** Abertura simples do app, sem titulo — o plano B de sempre. */
export const NETFLIX_APP_URI = `pkg://${NETFLIX_COMPONENT}`;
