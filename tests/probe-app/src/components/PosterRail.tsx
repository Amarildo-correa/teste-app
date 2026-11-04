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
import React, {memo, useCallback, useMemo} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {
  Carousel,
  type CarouselItemDataAdapter,
  type CarouselRenderInfo,
  type CarouselSelectionChangeEvent,
} from '@amazon-devices/vega-carousel';
import {C, POSTER_GAP, POSTER_H, RAIL_GAP, RAIL_HEADER_H, RAIL_MAIN_X, SCREEN_W, px} from '../theme';
import {BrandChip} from './BrandChip';
import {PosterCard} from './PosterCard';
import {SkeletonCard} from './SkeletonCard';
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

type Props = {
  spec: RailSpec;
  titles: TmdbTitle[];
  /** Este trilho e o que tem o foco? */
  active: boolean;
  focusedTitleId: number | null;
  /** O primeiro cartao deste trilho recebe o foco na montagem? */
  takesInitialFocus: boolean;
  onRailFocus: (key: string) => void;
  onTitleFocus: (key: string, id: number) => void;
  onTitlePress: (title: TmdbTitle) => void;
};

export const PosterRail = memo(
  ({
    spec,
    titles,
    active,
    /* Nao usado mais aqui: quem desenha o anel e o `selectionBorder` do
     * Carousel. Prop mantida para nao mexer no contrato com CatalogScreen. */
    focusedTitleId: _focusedTitleId,
    takesInitialFocus,
    onRailFocus,
    onTitleFocus,
    onTitlePress,
  }: Props) => {
    /* Trilho live sem titulo ainda (rede em voo, ou sem chave do TMDB) cai
     * no mesmo esqueleto dos outros — nao ha estado de "vazio" na tela. */
    const showSkeleton = !spec.live || titles.length === 0;

    const handleTitleFocus = useCallback(
      (id: number) => {
        onRailFocus(spec.key);
        onTitleFocus(spec.key, id);
      },
      [onRailFocus, onTitleFocus, spec.key],
    );

    /* O Carousel nao move o foco real de View para dentro do Pressable de
     * cada cartao — ele gerencia a selecao por conta propria e so avisa por
     * `onSelectionChanged`. Confiar no `onFocus` do Pressable (como no
     * exemplo da doc) deixa o anel de foco congelado no primeiro item para
     * sempre, porque o evento nunca dispara — medido no aparelho em
     * 2026-11-04: o RIGHT deslizava o trilho mas nenhum cartao acendia. */
    const handleSkeletonSelectionChanged = useCallback(
      ({selectedIndex}: CarouselSelectionChangeEvent) => {
        onRailFocus(spec.key);
        onTitleFocus(spec.key, selectedIndex);
      },
      [onRailFocus, onTitleFocus, spec.key],
    );

    const handleTitleSelectionChanged = useCallback(
      ({selectedIndex}: CarouselSelectionChangeEvent) => {
        const title = titles[selectedIndex];
        if (title) {
          onRailFocus(spec.key);
          onTitleFocus(spec.key, title.id);
        }
      },
      [onRailFocus, onTitleFocus, spec.key, titles],
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
        getItem: index => titles[index],
        getItemCount: () => titles.length,
        getItemKey: (info: CarouselRenderInfo<TmdbTitle>) => info.item.id,
        notifyDataError: () => false,
      }),
      [titles],
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
          onFocus={handleTitleFocus}
          accessibilityLabel={`${spec.brand}, catálogo em breve`}
        />
      ),
      [active, handleTitleFocus, spec.brand, takesInitialFocus],
    );

    const renderTitle = useCallback(
      ({item: title, index}: CarouselRenderInfo<TmdbTitle>) => (
        <PosterCard
          title={title}
          focused={false}
          railActive={active}
          preferred={takesInitialFocus && index === 0}
          onFocus={handleTitleFocus}
          onPress={onTitlePress}
        />
      ),
      [active, handleTitleFocus, onTitlePress, takesInitialFocus],
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
              containerStyle={styles.track}
              orientation="horizontal"
              dataAdapter={skeletonAdapter}
              renderItem={renderSkeleton}
              itemStyle={ITEM_GAP}
              selectionStrategy="anchored"
              navigableScrollAreaMargin={RAIL_MAIN_X}
              trapSelectionOnOrientation
              onSelectionChanged={handleSkeletonSelectionChanged}
              selectionBorder={FOCUS_RING}
            />
          ) : (
            <Carousel<TmdbTitle, number>
              containerStyle={styles.track}
              orientation="horizontal"
              dataAdapter={titlesAdapter}
              renderItem={renderTitle}
              itemStyle={ITEM_GAP}
              selectionStrategy="anchored"
              navigableScrollAreaMargin={RAIL_MAIN_X}
              trapSelectionOnOrientation
              onSelectionChanged={handleTitleSelectionChanged}
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
