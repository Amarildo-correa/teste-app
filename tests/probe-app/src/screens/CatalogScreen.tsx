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
 * parado no primeiro bloco visivel e a pilha desliza por baixo. Nada de
 * ScrollView — no controle remoto o que o usuario precisa e que o item
 * focado esteja SEMPRE no mesmo lugar da tela.
 *
 * A ultima faixa nao sobe ate o topo de proposito (o clamp em `maxOffset`):
 * subir deixaria a tela com a metade de baixo vazia.
 */
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Animated, StyleSheet, Text, View} from 'react-native';
import {C, RAIL_BLOCK_H, RAIL_MAIN_X, SAFE_Y, px} from '../theme';
import {TopBar} from '../components/TopBar';
import {PosterRail} from '../components/PosterRail';
import {LIVE_RAILS, RAILS} from '../data/rails';
import {discoverNetflix, hasApiKey, type TmdbTitle} from '../data/tmdb';
import type {ScreenProps} from '../navigation/routes';

const SLIDE_MS = 240;
/** Quantos blocos de trilho cabem abaixo da barra de topo. */
const VISIBLE_RAILS = 2;

/**
 * Teto de cartoes por trilho.
 *
 * O TMDB devolve 20 por pagina. Com seis trilhos live isso daria 120
 * imagens remotas carregando de uma vez num armv7 — e nenhuma lista aqui e
 * virtualizada, entao todas montam juntas. Doze por trilho ja da 72, que e
 * mais do que cabe na tela varias vezes.
 *
 * Numero de conforto, nao de medicao: ninguem mediu onde o aparelho comeca
 * a sofrer. Se precisar de mais catalogo, suba aqui e OLHE a TV.
 */
const MAX_PER_RAIL = 12;

export type RailTitles = Record<string, TmdbTitle[]>;

/** Deslocamento vertical da pilha com este trilho no topo, com o clamp. */
const stackOffset = (railIndex: number): number =>
  Math.min(railIndex, Math.max(0, RAILS.length - VISIBLE_RAILS)) * RAIL_BLOCK_H;

export const CatalogScreen = ({navigation}: ScreenProps<'catalog'>): React.JSX.Element => {
  /** Titulos por chave de trilho. Trilho ausente do mapa = ainda carregando. */
  const [byRail, setByRail] = useState<RailTitles>({});
  const [settled, setSettled] = useState<boolean>(false);
  const [focusedRail, setFocusedRail] = useState<string>(RAILS[0].key);
  const [focusedTitle, setFocusedTitle] = useState<Record<string, number>>({});
  /* Foco na barra de topo nao pode pintar um trilho de amarelo ao mesmo
   * tempo — mesma regra de dois focos que o app-sonda ja seguia. */
  const [barFocused, setBarFocused] = useState<boolean>(false);

  const y = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let cancelled = false;
    const run = async (): Promise<void> => {
      /* `discoverNetflix` ja engole o proprio erro e devolve lista vazia,
       * entao nao ha promise rejeitada para derrubar o Promise.all. Trilho
       * que falhou simplesmente fica em esqueleto. */
      const lists = await Promise.all(
        LIVE_RAILS.map(async rail => {
          const query = rail.query;
          if (query === undefined) {
            return [rail.key, []] as const;
          }
          const titles = await discoverNetflix(query.kind, query.genreId);
          return [rail.key, titles.slice(0, MAX_PER_RAIL)] as const;
        }),
      );

      if (!cancelled) {
        const rails: RailTitles = Object.fromEntries(lists);
        setByRail(rails);
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
  }, []);

  /** Nenhum trilho live trouxe nada, mesmo com chave: rede ou TMDB. */
  const allEmpty = useMemo(
    () => LIVE_RAILS.every(rail => (byRail[rail.key] ?? []).length === 0),
    [byRail],
  );

  /* Uma transicao so: 'loading' -> 'ready'. `ready` ja e verdadeiro de
   * saida quando nao ha chave, porque nesse caso nenhuma busca acontece e
   * a tela nasce no estado final. */
  const stackKey = settled || !hasApiKey() ? 'ready' : 'loading';

  const railIndex = useMemo(
    () => Math.max(0, RAILS.findIndex(r => r.key === focusedRail)),
    [focusedRail],
  );

  useEffect(() => {
    Animated.timing(y, {
      toValue: -stackOffset(railIndex),
      duration: SLIDE_MS,
      useNativeDriver: true,
    }).start();
  }, [railIndex, y]);

  const handleRailFocus = useCallback((key: string): void => {
    setFocusedRail(key);
    setBarFocused(false);
  }, []);

  const handleTitleFocus = useCallback((key: string, id: number): void => {
    setFocusedTitle(prev => (prev[key] === id ? prev : {...prev, [key]: id}));
  }, []);

  const handleTitlePress = useCallback(
    (title: TmdbTitle): void => navigation.navigate('title', {title}),
    [navigation],
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
        <Animated.View key={stackKey} style={{transform: [{translateY: y}]}}>
          {RAILS.map((spec, index) => (
            <PosterRail
              key={spec.key}
              spec={spec}
              titles={byRail[spec.key] ?? []}
              active={focusedRail === spec.key && !barFocused}
              focusedTitleId={focusedTitle[spec.key] ?? null}
              takesInitialFocus={index === 0}
              onRailFocus={handleRailFocus}
              onTitleFocus={handleTitleFocus}
              onTitlePress={handleTitlePress}
            />
          ))}
        </Animated.View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: C.bg, paddingTop: SAFE_Y},
  /* Recorta a pilha: o trilho que desliza para fora nao pode pintar por
   * cima da barra de topo. */
  stackViewport: {flex: 1, overflow: 'hidden'},
  notice: {
    color: C.danger,
    fontSize: px(32),
    fontWeight: '600',
    marginHorizontal: RAIL_MAIN_X,
    marginBottom: px(16),
  },
});
