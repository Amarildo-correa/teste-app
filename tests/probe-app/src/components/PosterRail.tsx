/**
 * Trilho de posters — cabecalho da marca + faixa horizontal.
 *
 * Herda do <Rail> do app-sonda a regra que faz o layout funcionar na TV: o
 * foco NAO se move, o trilho desliza por baixo dele. O slot focado fica
 * sempre em RAIL_MAIN_X, alinhado a coluna de conteudo, e os vizinhos sangram
 * pelas goteiras. Numa TV isso vale mais que scroll livre, porque o olho nao
 * precisa procurar onde o foco foi parar.
 *
 * O deslize em si e o `selectionStrategy="anchored"` do Carousel nativo
 * (binding @amazon-devices/vega-carousel) — substitui o Animated.View +
 * TVFocusGuideView que fazia essa conta a mao. NAO e "pinned": a doc do
 * pacote avisa que o pinned cai para o comportamento "natural" perto do
 * inicio/fim da lista, entao o item 0 (sempre o caso no primeiro load)
 * colava na borda esquerda em vez de ficar em RAIL_MAIN_X — medido no
 * aparelho em 2026-11-04. O anchored nao tem essa transicao de borda.
 *
 * Trilho sem dado (todos menos a Netflix) desenha esqueleto e se comporta
 * EXATAMENTE igual: cartao a cartao, com foco amarelo e o mesmo deslize. A
 * unica diferenca e que nao ha `onPress` — nao existe tela de titulo para
 * um esqueleto. Fazer o trilho vazio navegar de outro jeito ensinaria ao
 * usuario uma regra que deixa de valer assim que o dado chega.
 */
import React, {createContext, memo, useCallback, useContext, useMemo, useRef} from 'react';
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

/** Vao entre cartoes no itemPadding nativo: margem no cartao entrava na medida do item e o anel vazava ate o vizinho. */
const ITEM_GAP = {itemPadding: POSTER_GAP, itemPaddingOnSelection: POSTER_GAP};

/* O anel de foco por `focused`/`onFocus` do cartao ficou preso no item 0:
 * o Carousel nao move foco real de View para o Pressable interno, so avisa
 * por `onSelectionChanged` — e mesmo assim nao e confiavel no primeiro
 * render. O `selectionBorder` do proprio Carousel desenha o anel em cima
 * de quem ESTA de fato selecionado, sem depender dessa sincronizacao —
 * medido no aparelho em 2026-11-04. `borderStrokeWidth: 0` tira o traco
 * preto que o Carousel desenha por padrao em volta da borda. */
const FOCUS_RING = {
  /* 'inset': o cartao reserva px(6) de borda sempre (ver PosterCard), entao
   * o anel nao pode CRESCER o item ao focar — mudaria o tamanho do cartao
   * e deslocaria o trilho inteiro um pixel. */
  borderStrategy: 'inset' as const,
  borderWidth: px(6),
  borderColor: C.accent,
  borderRadius: 0,
  borderStrokeWidth: 0,
};

/**
 * Vem por contexto, nao por prop: o Carousel de fora nao redesenha um item ja
 * montado quando o `renderItem` muda, entao uma prop `active` ficava velha e o
 * cabecalho do trilho focado continuava apagado. Medido em 2026-11-04.
 */
export const RailFocusContext = createContext<{
  activeRail: string | null;
  selectedIndexes: Record<string, number>;
}>({activeRail: null, selectedIndexes: {}});

/** Duracao do encolher do cartao ao apertar OK; a tela espera por ela. */
export const CARD_PRESS_MS = 150;
const CARD_ANIMATION = {itemPressedDuration: CARD_PRESS_MS / 1000};

/** Faltando estes cartoes para o fim do que ja chegou, pede a proxima pagina. */
const LOAD_AHEAD = 8;

type Props = {
  spec: RailSpec;
  /** null = trilho sem dado (provedor ainda em esqueleto). */
  pager: Pager<TmdbTitle> | null;
  /** O primeiro cartao deste trilho recebe o foco na montagem? */
  takesInitialFocus: boolean;
  onRailFocus: (key: string) => void;
  onTitlePress: (title: TmdbTitle) => void;
};

export const PosterRail = memo(
  ({
    spec,
    pager,
    takesInitialFocus,
    onRailFocus,
    onTitlePress,
  }: Props) => {
    const {activeRail, selectedIndexes} = useContext(RailFocusContext);
    const active = activeRail === spec.key;

    /* Trilho live sem titulo ainda (rede em voo, ou sem chave do TMDB) cai
     * no mesmo esqueleto dos outros — nao ha estado de "vazio" na tela. */
    const showSkeleton = !spec.live || pager === null || pager.items.length === 0;

    const titlesRef = useRef<CarouselRef<number>>(null);
    const pagerRef = useRef(pager);
    pagerRef.current = pager;

    const handleCardFocus = useCallback(() => onRailFocus(spec.key), [onRailFocus, spec.key]);

    /* O Carousel nao move o foco real de View para dentro do Pressable de
     * cada cartao — ele gerencia a selecao por conta propria e so avisa por
     * `onSelectionChanged`. Confiar no `onFocus` do Pressable (como no
     * exemplo da doc) deixa o anel de foco congelado no primeiro item para
     * sempre, porque o evento nunca dispara — medido no aparelho em
     * 2026-11-04: o RIGHT deslizava o trilho mas nenhum cartao acendia. */
    const handleSelectionChanged = useCallback(
      ({selectedIndex}: CarouselSelectionChangeEvent) => {
        selectedIndexes[spec.key] = selectedIndex;
        onRailFocus(spec.key);

        /* A pagina nova entra por `notifyDataChange`, nao por prop: e o que
         * acrescenta cartoes sem redesenhar o trilho nem mexer no foco. O item
         * do Carousel de fora nao redesenha quando o `renderItem` muda, entao
         * uma prop nova nem chegaria a um trilho ja montado. */
        if (pager !== null && selectedIndex >= pager.items.length - LOAD_AHEAD) {
          const position = pager.items.length;
          void pager.loadNext().then(count => {
            /* O trilho pode ter sido reciclado para outro provedor na espera. */
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

    /* `focused` sempre false aqui: quem desenha o anel agora e o
     * `selectionBorder` nativo do Carousel (sobre o item realmente
     * selecionado), nao o par focused/onFocus do cartao — ver comentario
     * acima do FOCUS_RING. Passar um `focused` calculado em cima do mesmo
     * estado que so o onSelectionChanged atualiza arriscava desenhar DOIS
     * aneis em cartoes diferentes se algum dia dessincronizar. */
    const renderSkeleton = useCallback(
      ({item: index}: CarouselRenderInfo<number>) => (
        <SkeletonCard
          index={index}
          focused={false}
          railActive={active}
          preferred={takesInitialFocus && index === 0}
          onFocus={handleCardFocus}
          accessibilityLabel={`${spec.brand}, catálogo em breve`}
        />
      ),
      [active, handleCardFocus, spec.brand, takesInitialFocus],
    );

    const renderTitle = useCallback(
      ({item: title, index}: CarouselRenderInfo<TmdbTitle>) => (
        /* A key zera o estado do cartao (retry, falha) quando a celula e
         * reciclada: sem ela, um titulo herdaria a falha de imagem do anterior. */
        <PosterCard
          key={title.id}
          title={title}
          focused={false}
          railActive={active}
          preferred={takesInitialFocus && index === 0}
          onFocus={handleCardFocus}
          onPress={onTitlePress}
        />
      ),
      [active, handleCardFocus, onTitlePress, takesInitialFocus],
    );

    return (
      <View style={styles.block}>
        <View style={styles.header}>
          <BrandChip
            brand={spec.brand}
            suffix={spec.suffix}
            color={spec.color}
            dimmed={!active}
          />
          {!spec.live ? (
            <Text style={styles.soon} numberOfLines={1}>
              EM BREVE
            </Text>
          ) : null}
        </View>

        {/* Mesma trilha para os dois casos: e dela que vem o foco parado na
          * mesma posicao da viewport, com o trilho deslizando por baixo —
          * agora e o `selectionStrategy="anchored"` + `navigableScrollAreaMargin`
          * do Carousel nativo que faz essa conta (o item 0 nasce ancorado em
          * RAIL_MAIN_X, exatamente onde o translateX manual o colocava antes).
          * `trapSelectionOnOrientation` substitui o par trapFocusLeft/
          * trapFocusRight: sem ele, o RIGHT no ULTIMO cartao saltava para o
          * trilho vizinho (medido no aparelho em 2026-11-04). So a horizontal
          * e presa; cima e baixo seguem livres, que e como se troca de
          * trilho.
          *
          * SEM `hasPreferredFocus`, de proposito: e proativo (tenta ganhar
          * foco NA MONTAGEM), ao contrario do `autoFocus` do TVFocusGuideView
          * antigo, que so reagia quando o foco chegava no trilho. Com todo
          * trilho pedindo foco ao montar, nenhum card recebia foco real e o
          * anel amarelo nunca aparecia — medido no aparelho em 2026-11-04.
          * Quem leva o foco inicial e o `hasTVPreferredFocus` do primeiro
          * cartao do primeiro trilho. */}
        <View style={styles.viewport}>
          {showSkeleton ? (
            <Carousel<number, string>
              uniqueId={spec.key}
              containerStyle={styles.track}
              orientation="horizontal"
              dataAdapter={skeletonAdapter}
              renderItem={renderSkeleton}
              initialStartIndex={selectedIndexes[spec.key] ?? 0}
              itemStyle={ITEM_GAP}
              selectionStrategy="anchored"
              navigableScrollAreaMargin={RAIL_MAIN_X}
              trapSelectionOnOrientation
              onSelectionChanged={handleSelectionChanged}
              selectionBorder={FOCUS_RING}
            />
          ) : (
            <Carousel<TmdbTitle, number>
              ref={titlesRef}
              uniqueId={spec.key}
              containerStyle={styles.track}
              orientation="horizontal"
              dataAdapter={titlesAdapter}
              renderItem={renderTitle}
              animationDuration={CARD_ANIMATION}
              initialStartIndex={selectedIndexes[spec.key] ?? 0}
              itemStyle={ITEM_GAP}
              selectionStrategy="anchored"
              navigableScrollAreaMargin={RAIL_MAIN_X}
              trapSelectionOnOrientation
              onSelectionChanged={handleSelectionChanged}
              selectionBorder={FOCUS_RING}
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
