/**
 * Tela do titulo — o "single content" do mockup `novo.png`.
 *
 * Duas colunas: dados a esquerda, poster em retrato a direita, ate a borda.
 *
 * O rotulo do botao e fixo por decisao de produto; quem decide o destino
 * continua sendo o probe (G3). Com o app instalado ele abre o titulo dentro do
 * Netflix (kcp-launch, §2 de research/02-deeplink-netflix.md); sem o app, vai
 * para a pagina da loja. Como o texto visivel nao diz mais qual dos dois vai
 * acontecer, o `accessibilityHint` e o unico lugar que ainda diz.
 */
import React, {useCallback, useEffect, useState} from 'react';
import {BackHandler, Image, Linking, StyleSheet, Text, View} from 'react-native';
import {BRAND, C, RAIL_MAIN_X, SAFE_Y, px} from '../theme';
import {Button} from '../components/Button';
import {buildNetflixTitleUri, NETFLIX_APP_URI} from '../deeplink/netflixTitle';
import type {TmdbTitle} from '../data/tmdb';

/** Rotulo fixo: nao muda com o app instalado ou ausente. */
const ACTION = 'Abrir app Netflix e assistir';

type Props = {
  title: TmdbTitle;
  /** Netflix esta instalado neste aparelho? Vem do probe (G3). */
  installed: boolean;
  /** Pagina do Netflix na Appstore, para quem nao tem o app. */
  storeId: string | null;
  onBack: () => void;
};

export const TitleScreen = ({title, installed, storeId, onBack}: Props): React.JSX.Element => {
  const [status, setStatus] = useState<string>('');

  /* Voltar pelo botao do controle. Sem isso o usuario fica preso na tela do
   * titulo, porque nao ha barra de navegacao na TV. */
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack]);

  const handleOpen = useCallback((): void => {
    if (installed) {
      const uri = buildNetflixTitleUri(title.title);
      Linking.openURL(uri)
        .then(() => setStatus(`abrindo "${title.title}" no Netflix`))
        /* Nenhum modo de falha conhecido rejeita a promise, mas se um dia
         * rejeitar, o plano B e abrir o app na home — melhor que nada
         * acontecer na tela. */
        .catch(() => {
          setStatus('deep link recusado; abrindo o app');
          void Linking.openURL(NETFLIX_APP_URI).catch(() => undefined);
        });
      return;
    }

    if (storeId === null) {
      setStatus('sem storeId do Netflix; loja não chamada');
      return;
    }
    Linking.openURL(`amzn://apps/android?p=${storeId}`)
      .then(() => setStatus('abrindo a página do Netflix na loja'))
      .catch(() => setStatus('loja recusou (sem crash)'));
  }, [installed, storeId, title.title]);

  const year = title.year ? ` (${title.year})` : '';

  return (
    <View style={styles.screen}>
      <View style={styles.dataColumn}>
        <Text numberOfLines={1} style={styles.brand}>
          NETFLIX
        </Text>

        <Text numberOfLines={2} style={styles.title} accessibilityRole="header">
          {title.title}
        </Text>

        <Text style={styles.sectionTitle} accessibilityRole="header">
          Sinopse &amp; Info
        </Text>
        <Text numberOfLines={7} style={styles.overview}>
          {title.overview || 'Sem sinopse no TMDB para este título.'}
        </Text>

        <View style={styles.ctaRow}>
          <Button
            label={ACTION}
            icon="external"
            preferred
            onPress={handleOpen}
            accessibilityLabel={`${ACTION}. ${title.title}${year}`}
            accessibilityHint={
              installed
                ? 'Abre o Netflix na tela deste título'
                : 'Abre a página do Netflix na loja'
            }
            testID="btn-open-title"
          />
        </View>

        {status ? (
          <Text style={styles.status} testID="title-status">
            {status}
          </Text>
        ) : null}
      </View>

      <View style={styles.posterColumn}>
        {title.posterLargeUrl ? (
          <Image
            source={{uri: title.posterLargeUrl}}
            style={styles.poster}
            resizeMode="cover"
            accessible={false}
          />
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {flex: 1, flexDirection: 'row', backgroundColor: C.bg},

  /* 1020 de 1920: a proporcao das colunas em novo.png (637 de 1200). */
  dataColumn: {
    width: px(1020),
    paddingLeft: RAIL_MAIN_X,
    paddingRight: px(96),
    paddingVertical: SAFE_Y,
    justifyContent: 'center',
  },
  /* A superficie aparece so enquanto o poster carrega ou se ele faltar. */
  posterColumn: {flex: 1, backgroundColor: C.surface},
  poster: {width: '100%', height: '100%'},

  brand: {color: BRAND.netflix, fontSize: px(44), fontWeight: '900', letterSpacing: px(2)},
  title: {
    color: C.textPrimary,
    fontSize: px(80),
    lineHeight: px(96),
    fontWeight: '800',
    marginTop: px(8),
  },

  sectionTitle: {
    color: C.textPrimary,
    fontSize: px(48),
    fontWeight: '800',
    marginTop: px(48),
    marginBottom: px(16),
  },
  overview: {color: C.textPrimary, fontSize: px(40), lineHeight: px(60)},

  /* O botao em si vem do <Button>; aqui so o respiro acima dele. */
  ctaRow: {marginTop: px(40)},

  status: {color: C.textSecondary, fontSize: px(32), marginTop: px(24)},
});
