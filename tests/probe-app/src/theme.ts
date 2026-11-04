/**
 * Sistema visual para TV (1080p).
 *
 * Tudo e desenhado em 1920x1080 e reduzido pela largura real da tela.
 *
 * Acessibilidade, verificada contra o fundo #0A0B0D:
 *   - piso de 32px em TODO texto (~3% da altura da tela), legivel a 3 m
 *   - contraste minimo 7:1, bem acima do AA (4,5:1)
 *   - foco nunca indicado so por cor: quatro sinais redundantes
 *   - espacamento numa grade de 4px
 */
import {Dimensions} from 'react-native';

const BASE_WIDTH = 1920;

export const SCREEN_W = Dimensions.get('window').width;
export const scale = SCREEN_W / BASE_WIDTH;

/** Converte medida de projeto (1920x1080) para pixel da tela. */
export const px = (n: number): number => Math.round(n * scale);

/** Menor corpo de texto permitido em qualquer lugar do app. */
export const MIN_FONT = 32;

export const C = {
  bg: '#0A0B0D',
  surface: '#15171C',
  surfaceFocus: '#232832',
  border: '#2B303A',
  borderFocus: '#4A5260',
  textPrimary: '#F5F6F7', // ~19:1
  textSecondary: '#B6BDC7', // ~10:1
  textMuted: '#9AA2AE', // ~7:1
  accent: '#F5C518', // ~11:1
  danger: '#F2857D', // ~7:1
  onAccent: '#14161A',
  brandLight: '#A444FD', // logo-icon.svg, quadrado superior esquerdo
  brandDark: '#8F2FF1', // logo-icon.svg, os outros dois quadrados
} as const;

/* -------------------------------------------------------------------------
 * Layout — tudo derivado de duas regras
 *
 *   1. A Main tem a largura de exatamente 3 cartoes + 2 vaos, e e centrada.
 *      Assim o painel de diagnostico termina no mesmo x que o 3o cartao.
 *   2. O peek visivel, nas duas pontas, e METADE de um cartao.
 *
 * As duas juntas fixam a largura do cartao; nao sobra escolha. Com G de vao
 * e W de cartao, numa tela de largura S:
 *
 *      MAIN_W  = 3W + 2G
 *      goteira = (S - MAIN_W) / 2
 *      peek    = goteira - G          (o vao fica fora da parte visivel)
 *
 *   peek = W/2   =>   (S - 3W - 2G)/2 - G = W/2   =>   W = S/4 - G
 *
 * Com S = 1920 e G = 24: W = 456. Dai MAIN_W = 1416, goteira = 252 e o peek
 * sai em 228, que e exatamente W/2.
 *
 * Mexer em CARD_GAP_BASE reajusta o resto sozinho — nenhum numero magico.
 * ---------------------------------------------------------------------- */
const BASE_GAP = 24;
/** W = S/4 - G. E a unica largura que satisfaz "3 cartoes na Main" e
 *  "peek de meio cartao" ao mesmo tempo. */
const BASE_CARD_W = BASE_WIDTH / 4 - BASE_GAP;
const BASE_MAIN_W = 3 * BASE_CARD_W + 2 * BASE_GAP;
const BASE_MAIN_X = (BASE_WIDTH - BASE_MAIN_W) / 2;

export const CARD_GAP = px(BASE_GAP);
export const CARD_W = px(BASE_CARD_W);
export const CARD_STEP = CARD_W + CARD_GAP;

/** Coluna de conteudo: largura de 3 cartoes, centrada na tela. */
export const MAIN_W = px(BASE_MAIN_W);
/** x onde a Main comeca — e tambem onde o <Rail> ancora o slot de foco. */
export const MAIN_X = px(BASE_MAIN_X);

export const SAFE_Y = px(54);

/* -------------------------------------------------------------------------
 * Trilhos de poster (telas de catalogo e de titulo)
 *
 * O cartao de provedor (CARD_W = 456) e largo porque carrega texto. Poster e
 * outra coisa: a proporcao manda. 2:3 e o formato que o TMDB entrega e o que
 * o mockup mostra, entao a largura sai da ALTURA que cabe na tela, nao o
 * contrario.
 *
 * Com 1080 de altura: barra de topo 132 + titulo do trilho 64 + poster 450 +
 * respiro 44 = 690 para o primeiro trilho, e sobra 390 — mais da metade do
 * segundo poster. O peek vertical e de proposito: diz que ha mais trilhos
 * abaixo sem precisar de seta nem de scrollbar.
 * ---------------------------------------------------------------------- */
const BASE_POSTER_W = 300;
const BASE_POSTER_GAP = 24;
/** 2:3 — a proporcao que o TMDB entrega e a que o mockup mostra. */
const BASE_POSTER_H = (BASE_POSTER_W * 3) / 2;

export const POSTER_W = px(BASE_POSTER_W);
export const POSTER_H = px(BASE_POSTER_H);
export const POSTER_GAP = px(BASE_POSTER_GAP);
export const POSTER_STEP = POSTER_W + POSTER_GAP;

/* -------------------------------------------------------------------------
 * A coluna MAIN das telas de poster
 *
 * MAIN_W/MAIN_X (acima) vem da conta dos cartoes de PROVEDOR: 3 cartoes de
 * 456. Poster e outro modulo — 300 de largura — entao a mesma coluna nao
 * serve para os dois. Usar a antiga deixava 252 de margem a esquerda e 72 a
 * direita: a coluna nao ficava centrada, e era o que o mockup
 * `home-correto.png` apontava.
 *
 * Aqui a regra e so uma: **a MAIN tem exatamente 5 posteres + 4 vaos, e e
 * centrada**. Dela sai tudo o mais, sem numero magico:
 *
 *      RAIL_MAIN_W = 5W + 4G = 5*300 + 4*24 = 1596
 *      RAIL_MAIN_X = (1920 - 1596) / 2      = 162
 *      peek        = RAIL_MAIN_X - G        = 138   (nas duas pontas)
 *
 * Mudar VISIBLE_POSTERS ou POSTER_W reajusta o resto sozinho.
 * ---------------------------------------------------------------------- */
export const VISIBLE_POSTERS = 5;

const BASE_RAIL_MAIN_W =
  VISIBLE_POSTERS * BASE_POSTER_W + (VISIBLE_POSTERS - 1) * BASE_POSTER_GAP;

/** Largura da coluna de conteudo das telas de poster. */
export const RAIL_MAIN_W = px(BASE_RAIL_MAIN_W);
/** x onde a coluna comeca — barra de topo, cabecalho do trilho e o slot de
 *  foco do trilho usam este mesmo valor, e e isso que alinha os tres. */
export const RAIL_MAIN_X = px((BASE_WIDTH - BASE_RAIL_MAIN_W) / 2);

/** Altura de um bloco de trilho: cabecalho + poster + respiro. */
export const RAIL_HEADER_H = px(64);
export const RAIL_GAP = px(44);
export const RAIL_BLOCK_H = RAIL_HEADER_H + px(16) + POSTER_H + RAIL_GAP;

/** Cor da marca de cada provedor, usada no chip do cabecalho do trilho. */
export const BRAND = {
  netflix: '#E50914',
  prime: '#4DC3F0',
  disney: '#A1B4FF',
  max: '#B18CFF',
  appletv: '#F5F6F7',
  paramount: '#6FA8FF',
  globoplay: '#FF5A4D',
  crunchyroll: '#F5A623',
  mubi: '#8FE1C8',
} as const;
