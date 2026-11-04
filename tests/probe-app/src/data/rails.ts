/**
 * Os trilhos da tela de catalogo.
 *
 * Um trilho esta `live` ou nao. Live = tem uma consulta ao TMDB e cartao que
 * abre o titulo no app do provedor. Os outros existem para mostrar a forma
 * da tela com os nove provedores, e desenham **esqueleto no tamanho real do
 * cartao** — nao imagem de mentira.
 *
 * Isso e disciplina, nao preguica: cartao com capa falsa mentiria sobre o
 * que ja foi medido. So a Netflix tem deep link comprovado em aparelho
 * (research/02-deeplink-netflix.md); os demais ainda nao, entao nao fingem
 * que tem.
 *
 * ## Por que varios trilhos da Netflix, e nenhum deles testado titulo a
 * ## titulo
 *
 * O que foi medido no aparelho e o **padrao do endereco**, nao cada filme:
 * a URI e `pkg://com.netflix.kepler.main?kcp-launch={...}` e a unica coisa
 * que varia entre um titulo e outro e o texto do nome. Dai sai uma funcao
 * pura (`deeplink/netflixTitle`) que gera a URI para qualquer titulo do
 * catalogo, sem aparelho e sem LLM no caminho.
 *
 * Por isso acrescentar genero aqui e barato: e uma linha, e o deep link
 * continua valendo pelo mesmo motivo que valia para os 20 primeiros.
 *
 * Os ids de genero foram LIDOS de `/genre/movie/list` e `/genre/tv/list` em
 * 2026-11-04, nao chutados, e cada consulta foi conferida: todas devolvem 20
 * resultados com poster no catalogo Netflix BR.
 */
import {BRAND} from '../theme';

/** O que pedir ao TMDB para encher o trilho. */
export type RailQuery = {
  kind: 'movie' | 'tv';
  /** Id de genero do TMDB. Ausente = o catalogo todo, por popularidade. */
  genreId?: number;
};

export type RailSpec = {
  key: string;
  /** Nome da marca no chip do cabecalho. */
  brand: string;
  /** Texto a direita da barra: "em alta", "ação", "streamings"... */
  suffix: string;
  /** Cor da marca no chip. */
  color: string;
  /** Tem dado real e navegacao? Falso = esqueleto pulsando. */
  live: boolean;
  /** Quantos esqueletos desenhar quando nao e live. */
  skeletonCount: number;
  /** So nos trilhos live. */
  query?: RailQuery;
};

const netflix = (key: string, suffix: string, query: RailQuery): RailSpec => ({
  key,
  brand: 'NETFLIX',
  suffix,
  color: BRAND.netflix,
  live: true,
  skeletonCount: 8,
  query,
});

const soon = (key: string, brand: string, color: string): RailSpec => ({
  key,
  brand,
  suffix: 'streamings',
  color,
  live: false,
  skeletonCount: 8,
});

export const RAILS: RailSpec[] = [
  netflix('netflix-alta', 'em alta', {kind: 'movie'}),
  netflix('netflix-series', 'séries', {kind: 'tv'}),
  netflix('netflix-acao', 'ação', {kind: 'movie', genreId: 28}),
  netflix('netflix-comedia', 'comédia', {kind: 'movie', genreId: 35}),
  netflix('netflix-terror', 'terror', {kind: 'movie', genreId: 27}),
  netflix('netflix-animacao', 'animação', {kind: 'movie', genreId: 16}),

  soon('prime', 'PRIME VIDEO', BRAND.prime),
  soon('disney', 'DISNEY+', BRAND.disney),
  soon('max', 'HBO MAX', BRAND.max),
  soon('appletv', 'APPLE TV', BRAND.appletv),
  soon('paramount', 'PARAMOUNT+', BRAND.paramount),
  soon('globoplay', 'GLOBOPLAY', BRAND.globoplay),
  soon('crunchyroll', 'CRUNCHYROLL', BRAND.crunchyroll),
  soon('mubi', 'MUBI', BRAND.mubi),
];

/** Os trilhos que fazem chamada de rede. */
export const LIVE_RAILS: RailSpec[] = RAILS.filter(r => r.live);
