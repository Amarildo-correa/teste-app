/**
 * Painel de resultado — a saida do teste.
 *
 * Fica na tela, e nao so no log, porque num build de Release os console.log
 * do JS nao aparecem no `loggingctl`. O screenshot e o relatorio.
 */
import React, {memo} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {C, MIN_FONT, px} from '../theme';
import {RefreshButton} from './RefreshButton';

type Props = {
  verdict: string;
  detail: string;
  lastAction: string;
  measuring: boolean;
  reading: number;
  onRemeasure: () => void;
  onButtonFocusChange: (focused: boolean) => void;
};

export const Diagnostics = memo(
  ({
    verdict,
    detail,
    lastAction,
    measuring,
    reading,
    onRemeasure,
    onButtonFocusChange,
  }: Props) => (
    <View style={styles.panel}>
      <Text style={styles.title}>{verdict}</Text>
      <Text style={styles.line}>{detail}</Text>
      <Text style={styles.line}>G4  OK abre o app  ·  {lastAction}</Text>
      {/* O contador e a prova, no screenshot, de que a releitura rodou. */}
      <Text style={styles.line}>leitura #{reading}</Text>
      <RefreshButton
        measuring={measuring}
        onPress={onRemeasure}
        onFocusChange={onButtonFocusChange}
      />
    </View>
  ),
);
Diagnostics.displayName = 'Diagnostics';

const styles = StyleSheet.create({
  panel: {
    marginTop: px(40),
    backgroundColor: C.surface,
    borderWidth: px(2),
    borderColor: C.border,
    paddingHorizontal: px(28),
    paddingVertical: px(22),
  },
  title: {color: C.accent, fontSize: px(34), fontWeight: '700'},
  line: {
    color: C.textSecondary,
    fontSize: px(MIN_FONT),
    lineHeight: px(46),
    marginTop: px(10),
  },
});
