/**
 * Main — a coluna de conteudo.
 *
 * Define onde o conteudo comeca e termina. Tudo que precisa ficar alinhado
 * (logo, titulo de secao, painel de diagnostico) entra aqui.
 *
 * Tem a largura de exatamente 3 cartoes e fica centrada na tela, entao o
 * painel de diagnostico termina no mesmo x que o terceiro cartao do rail.
 *
 * O <Rail> fica DE FORA, de proposito: e por estar fora da Main que os peeks
 * alcancam as bordas da tela. O rail se realinha a esta coluna sozinho,
 * usando o mesmo MAIN_X do tema para posicionar o slot de foco.
 */
import React, {memo} from 'react';
import {StyleSheet, View} from 'react-native';
import {MAIN_W} from '../theme';

type Props = {
  children: React.ReactNode;
};

export const Main = memo(({children}: Props) => (
  <View style={styles.main}>{children}</View>
));
Main.displayName = 'Main';

const styles = StyleSheet.create({
  /* Largura de exatamente 3 cartoes, centrada. E por isso que o painel de
   * diagnostico termina no mesmo x que o terceiro cartao do rail. */
  main: {width: MAIN_W, alignSelf: 'center'},
});
