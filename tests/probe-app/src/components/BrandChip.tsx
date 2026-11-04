/**
 * Chip da marca no cabecalho do trilho — "NETFLIX | streamings".
 *
 * Reproduz o mockup sem usar logotipo de terceiro: palavra da marca na cor
 * dela, barra vertical e a palavra "streamings" em peso leve. Usar o
 * logotipo real exigiria licenca de marca que o projeto nao tem; o
 * tratamento tipografico entrega a mesma leitura a 3 m.
 *
 * Nao ha caixa atras da marca. Alem de ser o que o projeto pede, a caixa
 * tinha um efeito colateral: o padding dela empurrava a palavra para dentro
 * e a marca nao comecava na coluna da MAIN, entao o cabecalho do trilho e o
 * primeiro cartao nao se alinhavam. Sem caixa, alinham.
 */
import React, {memo} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {C, px} from '../theme';

type Props = {
  brand: string;
  color: string;
  /**
   * Texto a direita da barra. Com varios trilhos da MESMA marca, e ele que
   * diz qual e qual ("em alta", "ação"); por isso nao e fixo em
   * "streamings" como era quando havia um trilho por provedor.
   */
  suffix?: string;
  /** Marca do trilho em foco fica cheia; as outras recuam. */
  dimmed?: boolean;
};

export const BrandChip = memo(({brand, color, suffix = 'streamings', dimmed = false}: Props) => (
  <View style={styles.row}>
    <Text
      numberOfLines={1}
      style={[styles.brand, {color}, dimmed ? styles.dim : null]}
      accessibilityRole="header">
      {brand}
    </Text>
    <View style={styles.bar} />
    <Text numberOfLines={1} style={[styles.suffix, dimmed ? styles.dim : null]}>
      {suffix}
    </Text>
  </View>
));
BrandChip.displayName = 'BrandChip';

const styles = StyleSheet.create({
  row: {flexDirection: 'row', alignItems: 'center'},
  brand: {fontSize: px(40), fontWeight: '900', letterSpacing: px(2)},
  bar: {
    width: px(3),
    height: px(44),
    backgroundColor: C.textSecondary,
    marginHorizontal: px(20),
  },
  suffix: {color: C.textPrimary, fontSize: px(38), fontWeight: '400'},
  /* Trilho fora de foco recua, mas continua acima do piso de contraste. */
  dim: {opacity: 0.55},
});
