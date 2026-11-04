# Navegação nativa: a pilha substitui a restauração manual? — medição de 2026-11-04

Aparelho: Fire TV Stick HD, Vega OS 2.0, build Release armv7. Escopo reduzido a pedido do responsável pelo projeto: migração com um teste rápido no aparelho, sem a bateria completa de 11 casos nem a comparação de tempos e memória.

## Veredito

**Sim, nos casos medidos.** O catálogo mantém foco, rolagem e dados na volta sem código de restauração. `restore`, `cachedRails`, `RailPosition`, `preferredIndex` e os `BackHandler` das telas saíram.

| Caso | Resultado | Evidência |
|---|---|---|
| Abrir no Release | sem crash | `vlcm crash-history` sem entrada nova, portal `VISIBLE` |
| 3º poster de "em alta" → Back | mesmo poster | screenshot antes e depois |
| 2º poster de "séries" → Back | mesmo poster, pilha rolada | screenshot depois |
| Último poster de "séries" → Back | mesmo poster | screenshot antes e depois |
| Direcional depois de voltar | navega | RIGHT andou até o fim do trilho |
| Menu → Diagnóstico → Back | volta ao catálogo na mesma posição | screenshot depois |
| Back na raiz | sai para o launcher com um Back | `vlcm list` |

Os PNGs de antes e depois têm md5 diferente mesmo com a tela igual à vista: a comparação foi feita olhando, não por pixel.

## Pacotes

Versões da Package Version Matrix para RN 0.83: `react-navigation__native` e `__native-stack` `~8.0.9000000001`, `react-native-screens` `~3.0.9000000001`, `react-native-safe-area-context` `~8.0.9000000001`.

O import é `@amazon-devices/react-navigation__native-stack`. Com ele o Release abriu sem declarar módulo novo no `manifest.toml`, ao contrário do relato de crash na comunidade, que usava `react-native-screens/native-stack` no SDK 0.21.

## O que não funcionou

As ferramentas de medida da documentação não rodam neste ambiente:

| Ferramenta | Resultado |
|---|---|
| `vega exec perf`, SDK 2.0.13986 | não inicia: `TypeError: readonly attribute` |
| `perf` do SDK 0.24.12112 + bibliotecas instaladas no container | `doctor` funciona; `kpi-visualizer` conclui 0 iterações |
| `memory-monitor` e `activity-monitor` do mesmo SDK | `list index out of range` |
| `/proc/<pid>` no shell do aparelho | invisível: não há memória por processo |
| `/proc/meminfo`, app fechado menos app carregado | -28 MB numa leitura: o ruído do sistema é maior que o app |

## Catálogo reciclado: milhares de cards

A pilha de navegação não resolve escala: ela mantém o catálogo vivo, e todos os trilhos montavam juntos. A pilha vertical animada à mão virou um `Carousel` vertical com os trilhos dentro, o padrão aninhado do `vega-carousel` (`uniqueId`). Só 4 trilhos ficam na árvore. O prompt indicava FlashList; o Carousel foi escolhido por já cuidar do D-pad, e a FlashList não foi testada.

Três defeitos apareceram na troca, todos medidos no aparelho e corrigidos:

| Defeito | Causa | Correção |
|---|---|---|
| Cabeçalho do trilho focado apagado | o Carousel não redesenha item montado quando o `renderItem` muda | `RailFocusContext` |
| Trilho reciclado voltava ao 1º poster | a posição morre com a reciclagem | `selectedIndexes` + `initialStartIndex` |
| Subir pulava para "em alta" | o 1º trilho remontava com `hasTVPreferredFocus` | só a primeira montagem pede foco |

`selectedIndexes` é uma memória de posição escrita à mão, a única que restou: cobre a reciclagem, não a navegação.

Teste de carga, em build só de teste: 2000 títulos sintéticos em cada um dos 6 trilhos da Netflix. 100 RIGHT, abrir e voltar, 13 DOWN e 13 UP: sem crash, portal `VISIBLE`, posição preservada.

**O que esse teste não prova:** os títulos repetem os mesmos 12 posters, então não mede memória com milhares de imagens diferentes; as teclas iam a cerca de uma por segundo, então não mede repetição rápida; e não houve medida de latência. O app real continua limitado a 12 títulos por trilho, porque a busca no TMDB não pagina.

## Em aberto

- **Memória e tempos antes e depois:** não comparados. Antes da migração, com marcas no log: abrir título 74 ms e voltar 433 ms (mediana, n=10). Não há o número equivalente depois.
- **Catálogo vivo em uso longo:** 30 ciclos de abrir e voltar não foram rodados.
- **Título → Netflix → voltar ao portal:** precisa de uma pessoa olhando a TV, por causa do DRM.
- **Foco sem rede depois de voltar:** não testado.
