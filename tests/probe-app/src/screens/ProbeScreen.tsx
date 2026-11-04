/**
 * Tela de diagnostico — o app-sonda original, agora atras do Menu.
 *
 * Continua sendo o instrumento que fecha G3 e G4: o selo INSTALADO das
 * telas de catalogo e de titulo so vale porque esta medicao existe e pode
 * ser repetida no aparelho a qualquer momento.
 *
 * O layout e o mesmo de antes, com uma unica adicao: `BackHandler`, porque
 * agora ha para onde voltar.
 */
import React, {useCallback, useEffect, useState} from 'react';
import {BackHandler, StyleSheet, Text, View} from 'react-native';
import {C, SAFE_Y, px} from '../theme';
import {Main} from '../layout/Main';
import {Rail} from '../components/Rail';
import {SectionHeader} from '../components/SectionHeader';
import {Diagnostics} from '../components/Diagnostics';
import {PROVIDERS} from '../data/providers';
import type {ProbeResult} from '../probe/useProviderProbe';

type Props = {
  probe: ProbeResult;
  onBack: () => void;
};

export const ProbeScreen = ({probe, onBack}: Props): React.JSX.Element => {
  const {probes, verdict, detail, lastAction, measuring, reading, open, remeasure} = probe;
  const [focusedKey, setFocusedKey] = useState<string>(PROVIDERS[0].key);
  const [railActive, setRailActive] = useState<boolean>(true);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack]);

  const handleCardFocus = useCallback((key: string): void => {
    setFocusedKey(key);
    setRailActive(true);
  }, []);

  const handleButtonFocusChange = useCallback((focused: boolean): void => {
    setRailActive(!focused);
  }, []);

  const position = Math.max(0, PROVIDERS.findIndex(p => p.key === focusedKey)) + 1;

  return (
    <View style={styles.screen}>
      <Main>
        <Text style={styles.brand}>Diagnóstico</Text>
        <SectionHeader
          title="ASSISTIR AGORA NOS APPS"
          position={position}
          total={PROVIDERS.length}
        />
      </Main>

      {/* Fora da Main de proposito: e daqui que vem o peek nas duas pontas. */}
      <Rail
        providers={PROVIDERS}
        probes={probes}
        focusedKey={focusedKey}
        active={railActive}
        onFocus={handleCardFocus}
        onPress={open}
      />

      <Main>
        <Diagnostics
          verdict={verdict}
          detail={detail}
          lastAction={lastAction}
          measuring={measuring}
          reading={reading}
          onRemeasure={remeasure}
          onButtonFocusChange={handleButtonFocusChange}
        />
        <Text style={styles.hint}>Voltar ao catálogo: botão Back do controle</Text>
      </Main>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: C.bg, paddingVertical: SAFE_Y},
  brand: {
    color: C.textPrimary,
    fontSize: px(48),
    fontWeight: '300',
    letterSpacing: px(2),
    marginBottom: px(40),
  },
  hint: {color: C.textMuted, fontSize: px(32), marginTop: px(28)},
});
