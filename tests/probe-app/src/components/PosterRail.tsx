/**
 * Trilho de posters: cabecalho da marca + Carousel horizontal.
 *
 * Segue o exemplo da doc do `@amazon-devices/vega-carousel`: o Carousel cuida
 * do foco e da selecao, e o item e um Pressable simples. O foco inicial e o
 * `hasPreferredFocus` do Carousel do primeiro trilho.
 *
 * Remonta ao perder o foco. O Carousel nativo (1.0.5) guarda o primeiro cartao
 * que recebeu foco depois que o trilho voltou a ser focado e, a cada volta,
 * devolve o foco a ele, nao ao selecionado. Medido no VVD em 2026-11-08:
 * selecao em 4, DOWN e UP, voltava para 2; LEFT dali ia para 9 (view
 * reciclada). Trocar a `key` ao sair zera esse estado, e o trilho renasce em
 * `initialStartIndex` = ultima posicao.
 */
import React, {createContext, memo, useCallback, useContext, useEffect, useMemo, useRef, useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {
  Carousel,
  CarouselDataChangeType,
  type CarouselItemDataAdapter,
  type CarouselRef,
  type CarouselRenderInfo,
  type CarouselSelectionChangeEvent,
} from '@amazon-devices/vega-carousel';
import {C, POSTER_GAP, POSTER_H, RAIL_GAP, RAIL_HEADER_H, RAIL_MAIN_X, SCREEN_W, px} from '../theme';
import {BrandChip} from './BrandChip';
import {PosterCard} from './PosterCard';
import {SkeletonCard} from './SkeletonCard';
import type {Pager} from '../data/railPager';
import type {RailSpec} from '../data/rails';
import type {TmdbTitle} from '../data/tmdb';

const ITEM_STYLE = {itemPadding: POSTER_GAP, itemPaddingOnSelection: POSTER_GAP};

/** Anel de selecao desenhado pelo proprio Carousel; 'inset' nao muda o tamanho do item. */
const FOCUS_RING = {
  borderStrategy: 'inset' as const,
  borderWidth: px(6),
  borderColor: C.accent,
  borderRadius: 0,
  borderStrokeWidth: 0,
};

/**
 * Por contexto: o Carousel de fora nao redesenha um item ja montado quando o
 * `renderItem` muda. `selectedIndexes` e onde a posicao de cada trilho sobrevive
 * a remontagem e a reciclagem.
 */
export const RailFocusContext = createContext<{
  activeRail: string | null;
  selectedIndexes: Record<string, number>;
  /** Muda quando o catalogo volta a ser a tela ativa: o trilho ativo remonta e pede o foco. */
  refocusToken: number;
}>({activeRail: null, selectedIndexes: {}, refocusToken: 0});

/** Duracao do encolher do cartao ao apertar OK; a tela espera por ela. */
export const CARD_PRESS_MS = 150;
const ANIMATION = {itemPressedDuration: CARD_PRESS_MS / 1000};

/** Faltando estes cartoes para o fim do que ja chegou, pede a proxima pagina. */
const LOAD_AHEAD = 8;

type Props = {
  spec: RailSpec;
  /** null = trilho sem dado (provedor ainda em esqueleto). */
  pager: Pager<TmdbTitle> | null;
  /** Este trilho leva o foco inicial da tela? */
  takesInitialFocus: boolean;
  onRailFocus: (key: string) => void;
  onTitlePress: (title: TmdbTitle) => void;
};

export const PosterRail = memo(
  ({spec, pager, takesInitialFocus, onRailFocus, onTitlePress}: Props) => {
    const {activeRail, selectedIndexes, refocusToken} = useContext(RailFocusContext);
    const active = activeRail === spec.key;
    const showSkeleton = !spec.live || pager === null || pager.items.length === 0;

    /* Uma geracao nova a cada vez que o trilho perde o foco. */
    const [generation, setGeneration] = useState<number>(0);
    const [refocus, setRefocus] = useState<boolean>(false);
    const wasActive = useRef<boolean>(active);
    useEffect(() => {
      if (wasActive.current && !active) {
        setRefocus(false);
        setGeneration(previous => previous + 1);
      }
      wasActive.current = active;
    }, [active]);

    /* Volta ao catalogo: o trilho ativo remonta na mesma posicao e pede o foco,
     * o mesmo que descer e subir fazia a mao. So reage a token novo. */
    const activeRef = useRef<boolean>(active);
    activeRef.current = active;
    useEffect(() => {
      if (refocusToken > 0 && activeRef.current) {
        setRefocus(true);
        setGeneration(previous => previous + 1);
      }
    }, [refocusToken]);

    const titlesRef = useRef<CarouselRef<number>>(null);
    const pagerRef = useRef(pager);
    pagerRef.current = pager;

    const handleSelectionChanged = useCallback(
      ({selectedIndex}: CarouselSelectionChangeEvent) => {
        selectedIndexes[spec.key] = selectedIndex;
        onRailFocus(spec.key);

        /* Pagina nova entra por `notifyDataChange`: acrescenta cartoes sem
         * redesenhar o trilho nem mexer no foco. */
        if (pager !== null && selectedIndex >= pager.items.length - LOAD_AHEAD) {
          const position = pager.items.length;
          void pager.loadNext().then(count => {
            if (count > 0 && pagerRef.current === pager) {
              titlesRef.current?.notifyDataChange([
                {type: CarouselDataChangeType.ADD, position, count},
              ]);
            }
          });
        }
      },
      [onRailFocus, pager, selectedIndexes, spec.key],
    );

    const skeletonAdapter: CarouselItemDataAdapter<number, string> = useMemo(
      () => ({
        getItem: index => index,
        getItemCount: () => spec.skeletonCount,
        getItemKey: (info: CarouselRenderInfo<number>) => `${spec.key}-skeleton-${info.item}`,
        notifyDataError: () => false,
      }),
      [spec.key, spec.skeletonCount],
    );

    const titlesAdapter: CarouselItemDataAdapter<TmdbTitle, number> = useMemo(
      () => ({
        /* Le o paginador na hora: `items` cresce sem trocar de identidade. */
        getItem: index => pager?.items[index],
        getItemCount: () => pager?.items.length ?? 0,
        getItemKey: (info: CarouselRenderInfo<TmdbTitle>) => info.item.id,
        notifyDataError: () => false,
      }),
      [pager],
    );

    const renderSkeleton = useCallback(
      ({item: index}: CarouselRenderInfo<number>) => (
        <SkeletonCard index={index} accessibilityLabel={`${spec.brand}, catálogo em breve`} />
      ),
      [spec.brand],
    );

    const renderTitle = useCallback(
      ({item: title}: CarouselRenderInfo<TmdbTitle>) => (
        /* A key zera o estado do cartao (retry, falha) quando a celula e reciclada. */
        <PosterCard key={title.id} title={title} onPress={onTitlePress} />
      ),
      [onTitlePress],
    );

    /* Props comuns aos dois Carousels. `anchored`: o selecionado fica parado em
     * RAIL_MAIN_X e o trilho desliza por baixo. `trapSelectionOnOrientation`:
     * RIGHT no ultimo cartao nao salta para outro trilho. */
    const carouselKey = `${spec.key}-${generation}`;
    const common = {
      uniqueId: spec.key,
      containerStyle: styles.track,
      orientation: 'horizontal' as const,
      initialStartIndex: selectedIndexes[spec.key] ?? 0,
      hasPreferredFocus: (takesInitialFocus && generation === 0) || refocus,
      itemStyle: ITEM_STYLE,
      selectionStrategy: 'anchored' as const,
      navigableScrollAreaMargin: RAIL_MAIN_X,
      trapSelectionOnOrientation: true,
      onSelectionChanged: handleSelectionChanged,
      selectionBorder: FOCUS_RING,
    };

    return (
      <View style={styles.block}>
        <View style={styles.header}>
          <BrandChip brand={spec.brand} suffix={spec.suffix} color={spec.color} dimmed={!active} />
          {!spec.live ? (
            <Text style={styles.soon} numberOfLines={1}>
              EM BREVE
            </Text>
          ) : null}
        </View>

        <View style={styles.viewport}>
          {showSkeleton ? (
            <Carousel<number, string>
              key={carouselKey}
              {...common}
              dataAdapter={skeletonAdapter}
              renderItem={renderSkeleton}
            />
          ) : (
            <Carousel<TmdbTitle, number>
              key={carouselKey}
              {...common}
              ref={titlesRef}
              dataAdapter={titlesAdapter}
              renderItem={renderTitle}
              animationDuration={ANIMATION}
            />
          )}
        </View>
      </View>
    );
  },
);
PosterRail.displayName = 'PosterRail';

const styles = StyleSheet.create({
  block: {marginBottom: RAIL_GAP},
  header: {
    height: RAIL_HEADER_H,
    marginLeft: RAIL_MAIN_X,
    marginBottom: px(16),
    flexDirection: 'row',
    alignItems: 'center',
  },
  soon: {
    color: C.textMuted,
    fontSize: px(32),
    fontWeight: '700',
    letterSpacing: px(2),
    marginLeft: px(28),
  },
  /* Viewport com a largura da TELA: e dela que vem o peek nas duas pontas. */
  viewport: {width: SCREEN_W, overflow: 'hidden'},
  track: {width: SCREEN_W, height: POSTER_H},
});
