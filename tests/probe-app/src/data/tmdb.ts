/**
 * Cliente do TMDB — so o pedaco que o portal usa.
 *
 * Papel do TMDB aqui: **arte e texto**, nada mais. Ele nao sabe o que esta
 * instalado no aparelho (isso e o `useProviderProbe`) e nao sabe abrir app
 * nenhum (isso e o `deeplink/netflixTitle`). Se a chave faltar ou a rede
 * cair, a tela tem de continuar de pe, so que com esqueleto no lugar das
 * capas — por isso todo erro aqui vira lista vazia, nunca excecao solta.
 *
 * Uso nao comercial: chave pessoal, sem receita, sem anuncio, sem compra.
 *
 * `watch_provider=8` e a Netflix no TMDB, e `watch_region=BR` restringe ao
 * catalogo brasileiro — sem a regiao o /discover devolve titulo que nao esta
 * na Netflix daqui, e o deep link cairia num titulo que o usuario nao tem.
 */
import {TMDB_API_KEY} from '../config/tmdbKey';

const API = 'https://api.themoviedb.org/3';
const IMG = 'https://image.tmdb.org/t/p';

/** Provedor Netflix no TMDB. Nao e o nosso id de pacote; e do TMDB. */
export const TMDB_PROVIDER_NETFLIX = 8;
export const TMDB_REGION = 'BR';
export const TMDB_LANG = 'pt-BR';

/** Um titulo ja normalizado — filme e serie chegam com campos diferentes. */
export type TmdbTitle = {
  id: number;
  /** 'movie' | 'tv' — muda o endpoint de detalhe e o rotulo na tela. */
  kind: 'movie' | 'tv';
  /** Nome exibido E texto que resolve o deep link do Netflix. */
  title: string;
  overview: string;
  posterUrl: string | null;
  posterLargeUrl: string | null;
  year: string;
};

type RawItem = {
  id?: number;
  title?: string;
  name?: string;
  overview?: string;
  poster_path?: string | null;
  release_date?: string;
  first_air_date?: string;
};

const imageUrl = (path: string | null | undefined, size: string): string | null =>
  path ? `${IMG}/${size}${path}` : null;

const normalize = (raw: RawItem, kind: 'movie' | 'tv'): TmdbTitle | null => {
  const title = raw.title ?? raw.name;
  if (raw.id === undefined || !title) {
    return null;
  }
  const date = raw.release_date ?? raw.first_air_date ?? '';
  return {
    id: raw.id,
    kind,
    title,
    overview: raw.overview ?? '',
    /* w500 para o trilho: o poster ocupa 300px de projeto, entao w500 ja
     * sobra. Puxar `original` so gastaria banda e memoria no armv7. */
    posterUrl: imageUrl(raw.poster_path, 'w500'),
    /* w780 para a coluna da tela de titulo, que ocupa 900x1080 de projeto:
     * w500 ficaria visivelmente esticado ali. */
    posterLargeUrl: imageUrl(raw.poster_path, 'w780'),
    year: date.slice(0, 4),
  };
};

/** `null` quando a chave nao foi configurada — a tela mostra esqueleto. */
export const hasApiKey = (): boolean => TMDB_API_KEY.length > 0;

const get = async (path: string, params: Record<string, string>): Promise<unknown> => {
  const query = new URLSearchParams({
    api_key: TMDB_API_KEY,
    language: TMDB_LANG,
    ...params,
  }).toString();
  const response = await fetch(`${API}${path}?${query}`);
  if (!response.ok) {
    throw new Error(`TMDB ${path} respondeu ${response.status}`);
  }
  return response.json();
};

/**
 * Catalogo da Netflix BR, por tipo.
 *
 * Erro vira lista vazia de proposito: a tela ja sabe desenhar esqueleto, e um
 * throw aqui derrubaria a renderizacao inteira — a mesma licao que o
 * `canOpenURL` deu em G3.
 */
export const discoverNetflix = async (
  kind: 'movie' | 'tv',
  genreId?: number,
): Promise<TmdbTitle[]> => {
  if (!hasApiKey()) {
    return [];
  }
  try {
    const params: Record<string, string> = {
      with_watch_providers: String(TMDB_PROVIDER_NETFLIX),
      watch_region: TMDB_REGION,
      sort_by: 'popularity.desc',
      /* Sem isso o /discover devolve titulo sem poster, e o trilho fica com
       * buraco. Melhor pedir menos e pedir completo. */
      include_adult: 'false',
      page: '1',
    };
    if (genreId !== undefined) {
      params.with_genres = String(genreId);
    }
    const data = (await get(`/discover/${kind}`, params)) as {results?: RawItem[]};
    return (data.results ?? [])
      .map(raw => normalize(raw, kind))
      .filter((t): t is TmdbTitle => t !== null && t.posterUrl !== null);
  } catch {
    return [];
  }
};

/**
 * Generos do TMDB — a resposta da duvida "o TMDB traz categoria?".
 *
 * Traz: `/genre/<kind>/list` devolve o par id/nome, e o id entra no
 * `with_genres` do /discover. Um trilho por genero custa uma linha em
 * `data/rails.ts`; nao esta ligado agora para a tela nao ficar com nove
 * trilhos de Netflix e nenhum dos outros provedores.
 */
export const listGenres = async (kind: 'movie' | 'tv'): Promise<{id: number; name: string}[]> => {
  if (!hasApiKey()) {
    return [];
  }
  try {
    const data = (await get(`/genre/${kind}/list`, {})) as {
      genres?: {id: number; name: string}[];
    };
    return data.genres ?? [];
  } catch {
    return [];
  }
};
