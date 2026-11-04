/**
 * MODELO — copie para `tmdbKey.ts` e ponha a sua chave.
 *
 * Este arquivo e versionado; `tmdbKey.ts` NAO e (ver .gitignore na raiz).
 * `scripts/prepare-config.mjs` cria o `tmdbKey.ts` a partir daqui quando ele
 * nao existe, entao um clone novo compila sem nenhum passo manual.
 *
 * A chave e do plano Developer do TMDB, gratuito e de uso estritamente nao
 * comercial: sem receita, sem anuncio, sem compra no app. Pegue a sua em
 * https://www.themoviedb.org/settings/api (campo "Chave da API", v3 auth).
 *
 * Com a string vazia o app nao faz chamada de rede nenhuma e todos os
 * trilhos desenham esqueleto — e proposital, build sem chave nao quebra.
 */
export const TMDB_API_KEY = '';
