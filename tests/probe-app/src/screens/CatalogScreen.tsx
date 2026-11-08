/**
 * Tela de catalogo — a home do portal.
 *
 * Seis trilhos da Netflix com dado de verdade (TMDB) e cartao que abre o
 * titulo no app; os oito provedores restantes desenham esqueleto no tamanho
 * real do cartao, para mostrar a forma da tela sem fingir conteudo.
 *
 * Os trilhos live sao buscados **em paralelo**, nao em fila: seis idas ao
 * TMDB em serie somariam a latencia de todas, e a tela so sairia do
 * esqueleto no fim. Em paralelo, a espera e a da consulta mais lenta.
 *
 * Rolagem vertical pelo mesmo principio do trilho horizontal: o foco fica
 * parado no primeiro bloco visivel e a pilha desliza por baixo. Quem faz isso
 * e um Carousel vertical com os trilhos dentro, o padrao aninhado do pacote
 * (`uniqueId`). Ele recicla: so `RENDERED_RAILS` trilhos existem na arvore, e
 * cada trilho so desenha alguns cartoes, seja qual for o tamanho do catalogo.
 */
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {
  Carousel,
  type CarouselItemDataAdapter,
  type CarouselRenderInfo,
  type CarouselSelectionChangeEvent,
} from '@amazon-devices/vega-carousel';
import {C, RAIL_MAIN_X, SAFE_Y, SCREEN_W, px} from '../theme';
import {TopBar} from '../components/TopBar';
import {CARD_PRESS_MS, PosterRail, RailFocusContext} from '../components/PosterRail';
import {LIVE_RAILS, RAILS, type RailSpec} from '../data/rails';
import {createPager, type Pager} from '../data/railPager';
import {fetchNetflixPage, hasApiKey, type TmdbTitle} from '../data/tmdb';
import type {ScreenProps} from '../navigation/routes';

/** Dois visiveis, um acima e um abaixo, para o foco ter para onde ir. */
const RENDERED_RAILS = 4;

type RailPagers = Record<string, Pager<TmdbTitle>>;

/** Um paginador por trilho live. Vive com a tela, que fica montada na pilha. */
const createRailPagers = (): RailPagers =>
  Object.fromEntries(
    LIVE_RAILS.flatMap(({key, query}) =>
      query === undefined
        ? []
        : [
            [
              key,
              createPager<TmdbTitle>(
                page => fetchNetflixPage(query.kind, query.genreId, page),
                title => title.id,
              ),
            ],
          ],
    ),
  );

/**
 * Espera antes de abrir o titulo, para o encolher do cartao aparecer inteiro.
 * O pacote nao avisa o fim da animacao, entao e a duracao dela. Era 200 ms, com
 * folga; reduzido a pedido na TV em 2026-11-04.
 */
const OPEN_TITLE_DELAY_MS = CARD_PRESS_MS;

/* Sem o vao padrao do Carousel: o espaco entre trilhos ja vem do RAIL_GAP.
 * Sem escala ao apertar: para o Carousel de fora, o item pressionado e o trilho
 * inteiro, e o padrao de 0.8 encolhia o trilho todo a cada OK (visto na TV em
 * 2026-11-04). A animacao fica so no cartao, pelo Carousel de dentro. */
const RAIL_ITEM_STYLE = {itemPadding: 0, itemPaddingOnSelection: 0, pressedItemScaleFactor: 1};

const railsAdapter: CarouselItemDataAdapter<RailSpec, string> = {
  getItem: index => RAILS[index],
  getItemCount: () => RAILS.length,
  getItemKey: (info: CarouselRenderInfo<RailSpec>) => info.item.key,
  notifyDataError: () => false,
};

export const CatalogScreen = ({navigation}: ScreenProps<'catalog'>): React.JSX.Element => {
  const [pagers] = useState<RailPagers>(createRailPagers);
  const [settled, setSettled] = useState<boolean>(false);
  /* So a primeira montagem pede foco. Medido em 2026-11-04: o primeiro trilho,
   * ao ser reciclado de volta, remontava com `hasTVPreferredFocus` e roubava o
   * foco do trilho de baixo. */
  const initialFocusTaken = useRef<boolean>(false);
  const [focusedRail, setFocusedRail] = useState<string>(RAILS[0].key);
  /* Foco na barra de topo nao pode pintar um trilho de amarelo ao mesmo
   * tempo — mesma regra de dois focos que o app-sonda ja seguia. */
  const [barFocused, setBarFocused] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    const run = async (): Promise<void> => {
      /* `loadNext` nao rejeita, entao uma falha nao derruba o Promise.all.
       * Trilho que falhou fica em esqueleto. */
      await Promise.all(Object.values(pagers).map(pager => pager.loadNext()));

      if (!cancelled) {
        initialFocusTaken.current = false;
        setSettled(true);
        /* A pilha remonta (ver `stackKey`) e o foco volta para o primeiro
         * poster; o indice de rolagem tem de acompanhar, senao a tela fica
         * mostrando outro trilho com o foco no primeiro. */
        setFocusedRail(RAILS[0].key);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [pagers]);

  /** Nenhum trilho live trouxe nada, mesmo com chave: rede ou TMDB. */
  const allEmpty = Object.values(pagers).every(pager => pager.items.length === 0);

  /* Uma transicao so: 'loading' -> 'ready'. `ready` ja e verdadeiro de
   * saida quando nao ha chave, porque nesse caso nenhuma busca acontece e
   * a tela nasce no estado final. */
  const stackKey = settled || !hasApiKey() ? 'ready' : 'loading';

  const handleRailFocus = useCallback((key: string): void => {
    initialFocusTaken.current = true;
    setFocusedRail(key);
    setBarFocused(false);
  }, []);

  const openTitleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleTitlePress = useCallback(
    (title: TmdbTitle): void => {
      /* Segundo OK durante a espera nao abre outra tela. */
      if (openTitleTimer.current !== null) {
        return;
      }
      openTitleTimer.current = setTimeout(() => {
        openTitleTimer.current = null;
        /* O Menu pode ter aberto o Diagnostico durante a espera. */
        if (navigation.isFocused()) {
          navigation.navigate('title', {title});
        }
      }, OPEN_TITLE_DELAY_MS);
    },
    [navigation],
  );

  useEffect(
    () => () => {
      if (openTitleTimer.current !== null) {
        clearTimeout(openTitleTimer.current);
      }
    },
    [],
  );

  const handleRailSelected = useCallback(
    ({selectedIndex}: CarouselSelectionChangeEvent): void => {
      const rail = RAILS[selectedIndex];
      if (rail) {
        handleRailFocus(rail.key);
      }
    },
    [handleRailFocus],
  );

  const renderRail = useCallback(
    ({item: spec, index}: CarouselRenderInfo<RailSpec>) => (
      <PosterRail
        spec={spec}
        pager={pagers[spec.key] ?? null}
        takesInitialFocus={index === 0 && !initialFocusTaken.current}
        onRailFocus={handleRailFocus}
        onTitlePress={handleTitlePress}
      />
    ),
    [pagers, handleRailFocus, handleTitlePress],
  );

  /* Ao voltar para o catalogo (Back do titulo ou da sonda), o trilho ativo
   * remonta e pede o foco de novo. Sem isso, as setas laterais travavam depois
   * de alguns segundos parado; descer e subir destravava (VVD, 2026-11-08). */
  const [refocusToken, setRefocusToken] = useState<number>(0);
  useEffect(() => {
    let first = true;
    return navigation.addListener('focus', () => {
      if (first) {
        first = false;
        return;
      }
      setRefocusToken(previous => previous + 1);
    });
  }, [navigation]);

  /* Trilho reciclado perde a posicao: e aqui que ela sobrevive. */
  const selectedIndexes = useRef<Record<string, number>>({}).current;
  const railFocus = useMemo(
    () => ({activeRail: barFocused ? null : focusedRail, selectedIndexes, refocusToken}),
    [barFocused, focusedRail, selectedIndexes, refocusToken],
  );

  const handleOpenProbe = useCallback((): void => navigation.navigate('probe'), [navigation]);

  return (
    <View style={styles.screen}>
      <TopBar onOpenProbe={handleOpenProbe} onFocusChange={setBarFocused} />

      {!hasApiKey() ? (
        <Text style={styles.notice} testID="notice-nokey">
          Sem chave do TMDB — todos os trilhos em esqueleto. Preencha
          src/config/tmdbKey.ts.
        </Text>
      ) : settled && allEmpty ? (
        <Text style={styles.notice} testID="notice-offline">
          TMDB não respondeu — trilhos da Netflix em esqueleto.
        </Text>
      ) : null}

      <View style={styles.stackViewport}>
        {/* Medido no aparelho em 2026-11-04: quando os titulos chegam, o
          * esqueleto focavel da Netflix e desmontado e trocado pelos
          * posters. O foco morre junto e o sistema o entrega ao proximo
          * focavel — o trilho do Prime Video — e a tela rolava sozinha
          * para o segundo trilho.
          *
          * `hasTVPreferredFocus` nao resolve: ele so vale na montagem do
          * elemento, e ate la o foco ja mudou de dono. Remontar a pilha
          * inteira com uma key nova monta tudo de novo ao mesmo tempo, e
          * ai o preferido ganha. Acontece uma vez, na carga inicial; a volta
          * de um titulo nao passa por aqui, porque a tela segue montada. */}
        <RailFocusContext.Provider value={railFocus}>
          <Carousel<RailSpec, string>
          key={stackKey}
          containerStyle={styles.stack}
          orientation="vertical"
          dataAdapter={railsAdapter}
          renderItem={renderRail}
          itemStyle={RAIL_ITEM_STYLE}
          renderedItemsCount={RENDERED_RAILS}
          numOffsetItems={1}
          selectionStrategy="anchored"
          onSelectionChanged={handleRailSelected}
        />
        </RailFocusContext.Provider>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: C.bg, paddingTop: SAFE_Y},
  /* Recorta a pilha: o trilho que desliza para fora nao pode pintar por
   * cima da barra de topo. */
  stackViewport: {flex: 1, overflow: 'hidden'},
  stack: {width: SCREEN_W, height: '100%'},
  notice: {
    color: C.danger,
    fontSize: px(32),
    fontWeight: '600',
    marginHorizontal: RAIL_MAIN_X,
    marginBottom: px(16),
  },
});
