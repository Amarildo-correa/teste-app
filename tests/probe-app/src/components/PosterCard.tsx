/**
 * Cartao de poster.
 *
 * O anel de foco e do Carousel (`selectionBorder` no PosterRail). O cartao
 * reserva a borda de 6px transparente para o anel 'inset' nao cobrir a arte.
 *
 * O cartao focado NAO escreve o titulo por cima da capa: a arte do poster ja
 * traz o nome, e a faixa que havia ali so cobria a imagem com informacao
 * repetida. Quem nao enxerga a capa continua atendido — o nome, o tipo e o
 * ano estao no `accessibilityLabel`, e a tela do titulo mostra tudo em
 * texto. O nome so e desenhado quando NAO ha capa (ver `fallback`).
 */
import React, {memo, useCallback, useEffect, useMemo, useState} from 'react';
import {Image, Pressable, StyleSheet, Text, View} from 'react-native';
import {C, POSTER_H, POSTER_W, px} from '../theme';
import type {TmdbTitle} from '../data/tmdb';

/** Quanto esperar por `onLoad` antes de remontar o <Image>. */
const RETRY_MS = 2500;
/** Tentativas no total; depois delas o cartao mostra o nome do titulo. */
const MAX_ATTEMPTS = 3;

type Props = {
  title: TmdbTitle;
  onPress: (title: TmdbTitle) => void;
};

export const PosterCard = memo(
  ({title, onPress}: Props) => {
    const handlePress = useCallback(() => onPress(title), [onPress, title]);

    /* `source={{uri}}` inline cria um objeto novo a cada render. O cartao
     * re-renderiza ao ganhar e perder foco, e no aparelho isso refez o
     * pedido da imagem no meio do carregamento: o primeiro cartao, que
     * recebe foco na montagem, ficava preto para sempre enquanto todos os
     * outros carregavam. Medido no Fire TV Stick em 2026-11-04.
     *
     * Com a identidade estavel o RN nao reinicia o download. */
    const source = useMemo(
      () => (title.posterUrl ? {uri: title.posterUrl} : null),
      [title.posterUrl],
    );

    /* Falha de rede num poster nao pode deixar buraco preto: cai para o
     * nome do titulo, que e a informacao que o cartao precisa dar. */
    const [failed, setFailed] = useState<boolean>(false);
    const handleError = useCallback(() => setFailed(true), []);

    /* Medido no Fire TV Stick em 2026-11-04: o primeiro cartao do trilho
     * ficava preto para sempre. Nao e o arquivo (o mesmo JPEG abre fora do
     * aparelho) e nao e falha — `onError` NUNCA dispara. O pedido fica
     * pendurado, sem sucesso e sem erro, e o RN nao tem timeout proprio
     * para imagem.
     *
     * Entao o timeout e nosso: sem `onLoad` em RETRY_MS, remonta o <Image>
     * trocando a key. Tres tentativas; depois disso cai para o nome do
     * titulo, que e melhor que um retangulo vazio. */
    const [attempt, setAttempt] = useState<number>(0);
    const [loaded, setLoaded] = useState<boolean>(false);
    const handleLoad = useCallback(() => setLoaded(true), []);

    useEffect(() => {
      if (loaded || failed || source === null) {
        return undefined;
      }
      const timer = setTimeout(() => {
        setAttempt(previous => {
          if (previous >= MAX_ATTEMPTS - 1) {
            setFailed(true);
            return previous;
          }
          return previous + 1;
        });
      }, RETRY_MS);
      return () => clearTimeout(timer);
    }, [attempt, loaded, failed, source]);

    const kind = title.kind === 'tv' ? 'série' : 'filme';

    return (
      <Pressable
        onPress={handlePress}
        accessible
        accessibilityRole="button"
        accessibilityLabel={`${title.title}, ${kind}${
          title.year ? `, ${title.year}` : ''
        }. Abrir no Netflix`}
        style={styles.frame}
        testID={`poster-${title.id}`}>
        {source !== null && !failed ? (
          <Image
            key={`poster-${title.id}-${attempt}`}
            source={source}
            style={styles.imageDim}
            resizeMode="cover"
            onLoad={handleLoad}
            onError={handleError}
            accessible={false}
          />
        ) : (
          <View style={styles.fallback}>
            <Text numberOfLines={4} style={styles.fallbackText}>
              {title.title}
            </Text>
          </View>
        )}
      </Pressable>
    );
  },
);
PosterCard.displayName = 'PosterCard';

const frameBase = {
  width: POSTER_W,
  height: POSTER_H,
  borderWidth: px(6),
  overflow: 'hidden',
  backgroundColor: C.surface,
} as const;

const styles = StyleSheet.create({
  /* Cartao sem foco nao tem borda nenhuma — nem a cinza que antes marcava
   * "o trilho parou aqui". Com nove trilhos na tela, nove marcas cinzas
   * competiam com o unico foco amarelo que importa. A borda transparente
   * fica para reservar o espaco, nao para aparecer. */
  frame: {...frameBase, borderColor: 'transparent'},

  imageDim: {width: '100%', height: '100%', opacity: 0.62},

  fallback: {flex: 1, alignItems: 'center', justifyContent: 'center', padding: px(18)},
  fallbackText: {color: C.textSecondary, fontSize: px(32), textAlign: 'center'},
});
