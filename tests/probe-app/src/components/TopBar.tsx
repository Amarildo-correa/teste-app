/**
 * Barra de topo — marca do portal e o atalho de diagnostico.
 *
 * A marca fica a direita, como nos mockups. O botao de Menu existe porque a
 * sonda (G3/G4) nao pode sumir so porque o app ganhou telas bonitas: ela e o
 * instrumento que prova que o selo INSTALADO funciona. Fica atras de um
 * clique, nao na frente do usuario.
 */
import React, {memo} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {C, RAIL_MAIN_X, px} from '../theme';
import {Button} from './Button';

type Props = {
  onOpenProbe: () => void;
  onFocusChange: (focused: boolean) => void;
};

export const TopBar = memo(({onOpenProbe, onFocusChange}: Props) => (
  <View style={styles.bar}>
    <Button
      label="Menu"
      icon="menu"
      onPress={onOpenProbe}
      onFocusChange={onFocusChange}
      accessibilityLabel="Menu de diagnóstico"
      accessibilityHint="Abre a tela de diagnóstico G3 e G4"
      testID="btn-menu"
    />

    <View style={styles.spacer} />

    {/*
      * Marca do portal: logo-icon.svg + palavra. O SVG sao tres quadrados e o
      * projeto nao tem react-native-svg, entao ele e reproduzido com Views:
      * mesma geometria (42x42, quadrados de 17, vao de 8) e mesmas cores.
      */}
    <View style={styles.brand} accessible accessibilityRole="header">
      <View style={styles.glyph}>
        <View style={[styles.glyphSquare, styles.glyphTopLeft]} />
        <View style={[styles.glyphSquare, styles.glyphTopRight]} />
        <View style={[styles.glyphSquare, styles.glyphBottomLeft]} />
      </View>
      <Text style={styles.brandText}>ORTAL</Text>
    </View>
  </View>
));
TopBar.displayName = 'TopBar';

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: RAIL_MAIN_X,
    marginBottom: px(28),
  },

  spacer: {flex: 1},

  brand: {flexDirection: 'row', alignItems: 'center'},
  glyph: {width: px(42), height: px(42), marginRight: px(14)},
  glyphSquare: {position: 'absolute', width: px(17), height: px(17)},
  glyphTopLeft: {top: 0, left: 0, backgroundColor: C.brandLight},
  glyphTopRight: {top: 0, right: 0, backgroundColor: C.brandDark},
  glyphBottomLeft: {bottom: 0, left: 0, backgroundColor: C.brandDark},
  brandText: {
    color: C.textPrimary,
    fontSize: px(44),
    fontWeight: '700',
    letterSpacing: px(6),
  },
});
