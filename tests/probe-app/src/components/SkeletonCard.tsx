/**
 * Esqueleto no lugar do poster.
 *
 * Tamanho REAL do cartao — POSTER_W x POSTER_H, o mesmo do PosterCard. Isso
 * e o ponto: a tela nao muda de forma quando o dado chega, entao nada pula
 * no lugar e o layout pode ser julgado antes de existir conteudo.
 *
 * E **focavel, um a um**, igual ao cartao de verdade. Antes o trilho inteiro
 * era um unico Pressable: dava para descer ate ele, mas nao para andar
 * dentro dele, e o trilho nao deslizava. Os trilhos sem dado se comportavam
 * como outra coisa, e quem usa o controle nao tem como adivinhar que aquele
 * trilho e diferente.
 *
 * O que ele NAO faz e `onPress`: nao ha tela de titulo para um esqueleto, e
 * prometer acao que nao existe e pior do que nao oferecer nenhuma.
 *
 * O pulso e opacidade, nao cor nem posicao: `useNativeDriver` so aceita
 * opacity e transform, e opacidade e a unica das duas que nao mexe no
 * layout. No armv7 isso importa — a animacao roda fora da thread de JS.
 *
 * Todos os esqueletos de um trilho pulsam juntos, de proposito: um `delay`
 * por cartao criaria onda, que parece carregamento progressivo e mente,
 * porque nao ha nada carregando nestes trilhos.
 */
import React, {memo, useEffect, useRef} from 'react';
import {Animated, Easing, Pressable, StyleSheet} from 'react-native';
import {C, POSTER_H, POSTER_W, px} from '../theme';

const PULSE_MS = 900;
const MIN_OPACITY = 0.35;
const MAX_OPACITY = 0.75;

type Props = {
  index: number;
  /** Para o leitor de tela: "<marca>, catalogo em breve". */
  accessibilityLabel: string;
};

export const SkeletonCard = memo(
  ({index, accessibilityLabel}: Props) => {
    const pulse = useRef(new Animated.Value(MIN_OPACITY)).current;

    useEffect(() => {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, {
            toValue: MAX_OPACITY,
            duration: PULSE_MS,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulse, {
            toValue: MIN_OPACITY,
            duration: PULSE_MS,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      );
      loop.start();
      /* Parar no unmount: trilho fora da tela nao pode continuar animando e
       * queimando frame no armv7. */
      return () => loop.stop();
    }, [pulse]);

    return (
      <Pressable
        /* Sem `onPress`, o Pressable nao e focavel por padrao, e o trilho
         * inteiro ficava fora do alcance do DOWN (VVD, 2026-11-08). */
        focusable
        accessible
        accessibilityRole="none"
        accessibilityLabel={accessibilityLabel}
        style={styles.frame}
        testID={`skeleton-${index}`}>
        <Animated.View style={[styles.fill, {opacity: pulse}]} />
      </Pressable>
    );
  },
);
SkeletonCard.displayName = 'SkeletonCard';

const frameBase = {
  width: POSTER_W,
  height: POSTER_H,
  /* A borda existe sempre, mesmo transparente: sem ela o cartao mudaria de
   * tamanho ao ganhar foco e o trilho inteiro se deslocaria um pixel. Mesma
   * regra do PosterCard. */
  borderWidth: px(6),
} as const;

const styles = StyleSheet.create({
  frame: {...frameBase, borderColor: 'transparent'},
  fill: {flex: 1, backgroundColor: C.surfaceFocus},
});
