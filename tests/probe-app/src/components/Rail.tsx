/**
 * Rail — a faixa horizontal de cartoes.
 *
 * Fica DE FORA do <Main>, e e isso que faz os peeks alcancarem as bordas da
 * tela: a viewport tem a largura inteira, entao o recorte acontece na borda
 * do painel, nao na margem do conteudo.
 *
 * Mesmo estando fora, ele se alinha a Main sozinho: o slot de foco e posto
 * exatamente em MAIN_X, o mesmo padding que o <Main> aplica. Resultado — o
 * cartao em foco fica na coluna do logo, do titulo e do painel, enquanto os
 * vizinhos sangram pelas goteiras dos dois lados.
 *
 * O foco nao se move: o rail desliza por baixo dele, via `selectionStrategy
 * ="anchored"` do Carousel nativo (@amazon-devices/vega-carousel) — mesmo
 * padrao do <PosterRail>, pelo mesmo motivo: nao desenhar carousel na mao.
 * No indice 0 a goteira da esquerda fica vazia, que e o preco de manter o
 * foco sempre no mesmo lugar.
 *
 * O anel de foco vem do `selectionBorder` do proprio Carousel, nao do
 * `focused`/`onFocus` do ProviderCard: o Carousel nao move foco real de
 * View para o Pressable interno, so avisa por `onSelectionChanged` — e
 * `focused` no ProviderCard fica sempre false aqui por isso (ver mesma nota
 * no PosterRail). Efeito colateral aceito: o ProviderCard tem um terceiro
 * estado visual (`cardSelected`, borda cinza — "foco saiu para o botao de
 * reler mas lembra a posicao") que dependia desse `focused`; sem ele o
 * cartao cai direto para "sem foco" quando o usuario desce para o botao.
 */
import React, {memo, useCallback, useMemo} from 'react';
import {StyleSheet, View} from 'react-native';
import {
  Carousel,
  type CarouselItemDataAdapter,
  type CarouselRenderInfo,
  type CarouselSelectionChangeEvent,
} from '@amazon-devices/vega-carousel';
import {C, CARD_GAP, MAIN_X, SCREEN_W, px} from '../theme';
import {ProviderCard} from './ProviderCard';
import type {Provider} from '../data/providers';
import type {Probes} from '../probe/useProviderProbe';

const ITEM_GAP = {itemPadding: CARD_GAP, itemPaddingOnSelection: CARD_GAP};
const FOCUS_RING = {
  borderStrategy: 'inset' as const,
  borderWidth: px(6),
  borderColor: C.accent,
  borderRadius: 0,
  borderStrokeWidth: 0,
};
/** Altura fixa do cartao — o Carousel precisa de uma dimensao numerica para
 *  virtualizar; `minHeight` do ProviderCard vira o piso real. */
const TRACK_HEIGHT = px(392);

type Props = {
  providers: Provider[];
  probes: Probes;
  focusedKey: string;
  /** O foco esta no rail? Falso quando foi para o botao de reler. */
  active: boolean;
  onFocus: (key: string) => void;
  onPress: (provider: Provider) => void;
};

export const Rail = memo(
  ({
    providers,
    probes,
    /* Nao usado mais aqui: quem desenha o anel e o `selectionBorder` do
     * Carousel. Prop mantida para nao mexer no contrato com ProbeScreen. */
    focusedKey: _focusedKey,
    active,
    onFocus,
    onPress,
  }: Props) => {
  const dataAdapter: CarouselItemDataAdapter<Provider, string> = useMemo(
    () => ({
      getItem: index => providers[index],
      getItemCount: () => providers.length,
      getItemKey: (info: CarouselRenderInfo<Provider>) => info.item.key,
      notifyDataError: () => false,
    }),
    [providers],
  );

  const handleSelectionChanged = useCallback(
    ({selectedIndex}: CarouselSelectionChangeEvent) => {
      const provider = providers[selectedIndex];
      if (provider) {
        onFocus(provider.key);
      }
    },
    [onFocus, providers],
  );

  const renderItem = useCallback(
    ({item: provider, index}: CarouselRenderInfo<Provider>) => (
      <ProviderCard
        provider={provider}
        probe={probes[provider.key]}
        focused={false}
        railActive={active}
        onFocus={onFocus}
        onPress={onPress}
        preferred={index === 0}
      />
    ),
    [active, onFocus, onPress, probes],
  );

  return (
    <View style={styles.viewport}>
      <Carousel<Provider, string>
        containerStyle={styles.track}
        orientation="horizontal"
        dataAdapter={dataAdapter}
        renderItem={renderItem}
        itemStyle={ITEM_GAP}
        selectionStrategy="anchored"
        navigableScrollAreaMargin={MAIN_X}
        trapSelectionOnOrientation
        onSelectionChanged={handleSelectionChanged}
        selectionBorder={FOCUS_RING}
      />
    </View>
  );
});
Rail.displayName = 'Rail';

const styles = StyleSheet.create({
  /* Viewport recorta e tem a largura da TELA, nao da coluna de conteudo:
   * e isso que deixa o peek chegar ate as bordas do painel. */
  viewport: {width: SCREEN_W, overflow: 'hidden'},
  track: {width: SCREEN_W, height: TRACK_HEIGHT},
});
