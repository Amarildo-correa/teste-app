/**
 * Titulo da secao + contador de posicao no rail.
 *
 * O contador existe porque, com o foco parado no mesmo slot, o usuario perde
 * a referencia de onde esta na lista.
 */
import React, {memo} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {C, MIN_FONT, px} from '../theme';

type Props = {
  title: string;
  position: number;
  total: number;
};

export const SectionHeader = memo(({title, position, total}: Props) => (
  <View style={styles.row}>
    <Text style={styles.title}>{title}</Text>
    <View style={styles.chip}>
      <Text style={styles.chipText}>
        {position} de {total}
      </Text>
    </View>
  </View>
));
SectionHeader.displayName = 'SectionHeader';

const styles = StyleSheet.create({
  row: {flexDirection: 'row', alignItems: 'center', marginBottom: px(20)},
  title: {color: C.textPrimary, fontSize: px(34), fontWeight: '700', letterSpacing: px(2)},
  chip: {
    backgroundColor: C.surface,
    borderWidth: px(2),
    borderColor: C.border,
    paddingHorizontal: px(16),
    paddingVertical: px(6),
    marginLeft: px(24),
  },
  chipText: {color: C.textSecondary, fontSize: px(MIN_FONT), fontWeight: '700'},
});
