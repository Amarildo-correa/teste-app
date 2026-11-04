/**
 * Cartao de provedor, usado so na tela de diagnostico.
 *
 * O selo mostra o resultado de G3 para quem esta medindo. A interface do produto
 * nao diz se o app esta instalado: o botao do titulo tem rotulo fixo.
 *
 * Foco com quatro sinais redundantes, nunca so cor: borda de 6px, superficie
 * mais clara, acao em destaque e selo invertido.
 */
import React, {memo, useCallback} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {C, CARD_W, MIN_FONT, px} from '../theme';
import type {Provider} from '../data/providers';
import type {Probe} from '../probe/useProviderProbe';

type Props = {
  provider: Provider;
  probe: Probe;
  focused: boolean;
  /** O rail e quem tem o foco agora? Falso quando ele esta no botao de reler. */
  railActive: boolean;
  onFocus: (key: string) => void;
  onPress: (provider: Provider) => void;
  preferred: boolean;
};

const SELECTED = {selected: true} as const;

export const ProviderCard = memo(
  ({provider, probe, focused, railActive, onFocus, onPress, preferred}: Props) => {
    const handleFocus = useCallback(() => onFocus(provider.key), [onFocus, provider.key]);
    const handlePress = useCallback(() => onPress(provider), [onPress, provider]);

    /* `focused` e so a posicao do rail; ela sobrevive ao foco sair dali.
     * Pintar de accent por `focused` punha dois focos amarelos na tela ao
     * mesmo tempo — o cartao e o botao. Accent so quando o rail esta ativo;
     * sem ele o cartao cai para "selecionado", visivel mas sem disputar. */
    const active = focused && railActive;

    const pending = probe.available === null;
    const available = probe.available === true;
    /* Sem `storeId` nao ha pagina para abrir, e prometer "Instalar na loja"
     * levaria a uma tela de erro da Appstore. O cartao diz a verdade. */
    const action = available
      ? 'Abrir no app'
      : provider.storeId !== null
        ? 'Instalar na loja'
        : 'Sem link na loja';
    const status = pending ? 'verificando' : available ? 'instalado' : 'nao instalado';

    return (
      <Pressable
        focusable
        hasTVPreferredFocus={preferred}
        onFocus={handleFocus}
        onPress={handlePress}
        accessible
        accessibilityRole="button"
        accessibilityLabel={`${provider.name}, ${status}. ${action}`}
        accessibilityState={SELECTED}
        style={active ? styles.cardFocused : focused ? styles.cardSelected : styles.card}
        testID={`card-${provider.key}`}>
        <View style={[styles.mark, {backgroundColor: provider.markBg}]}>
          <Text numberOfLines={1} style={[styles.markText, {color: provider.markColor}]}>
            {provider.mark}
          </Text>
        </View>

        {pending ? (
          <View style={styles.badgePending}>
            <Text numberOfLines={1} style={styles.badgePendingText}>
              VERIFICANDO
            </Text>
          </View>
        ) : available ? (
          <View style={active ? styles.badgeOkFocused : styles.badgeOk}>
            <Text
              numberOfLines={1}
              style={active ? styles.badgeOkTextFocused : styles.badgeOkText}>
              INSTALADO
            </Text>
          </View>
        ) : (
          <View style={styles.badgeAbsent}>
            <Text numberOfLines={1} style={styles.badgeAbsentText}>
              NAO INSTALADO
            </Text>
          </View>
        )}

        <Text numberOfLines={2} style={styles.name}>
          {provider.name}
        </Text>

        <View style={styles.spacer} />
        <View style={active ? styles.dividerFocused : styles.divider} />

        <Text numberOfLines={1} style={active ? styles.actionFocused : styles.action}>
          {action}
        </Text>
      </Pressable>
    );
  },
);
ProviderCard.displayName = 'ProviderCard';

const cardBase = {
  width: CARD_W,
  minHeight: px(392),
  borderWidth: px(6),
  paddingHorizontal: px(26),
  paddingVertical: px(26),
} as const;

const badgeBase = {
  alignSelf: 'flex-start',
  paddingHorizontal: px(14),
  paddingVertical: px(8),
  marginTop: px(20),
} as const;

const badgeTextBase = {
  fontSize: px(MIN_FONT),
  fontWeight: '800',
  letterSpacing: px(1),
} as const;

const styles = StyleSheet.create({
  card: {...cardBase, backgroundColor: C.surface, borderColor: 'transparent'},
  cardFocused: {...cardBase, backgroundColor: C.surfaceFocus, borderColor: C.accent},
  /* Posicao do rail com o foco em outro lugar: superficie clara mantem o
   * lugar marcado, borda cinza nao compete com o foco de verdade. */
  cardSelected: {...cardBase, backgroundColor: C.surfaceFocus, borderColor: C.borderFocus},

  mark: {
    alignSelf: 'flex-start',
    minWidth: px(120),
    height: px(72),
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: px(16),
  },
  markText: {fontSize: px(36), fontWeight: '800'},

  badgePending: {...badgeBase, backgroundColor: C.surface, borderWidth: px(2), borderColor: C.border},
  badgePendingText: {...badgeTextBase, color: C.textMuted},
  badgeOk: {...badgeBase, backgroundColor: '#2F3540'},
  badgeOkText: {...badgeTextBase, color: C.textPrimary},
  badgeOkFocused: {...badgeBase, backgroundColor: C.accent},
  badgeOkTextFocused: {...badgeTextBase, color: C.onAccent},
  badgeAbsent: {...badgeBase, backgroundColor: '#3A2220'},
  badgeAbsentText: {...badgeTextBase, color: C.danger},

  name: {
    color: C.textPrimary,
    fontSize: px(40),
    lineHeight: px(50),
    fontWeight: '700',
    marginTop: px(20),
  },
  spacer: {flex: 1, minHeight: px(20)},
  divider: {height: px(2), backgroundColor: C.border},
  dividerFocused: {height: px(2), backgroundColor: C.borderFocus},
  action: {color: C.textSecondary, fontSize: px(36), fontWeight: '600', marginTop: px(18)},
  actionFocused: {color: C.accent, fontSize: px(36), fontWeight: '700', marginTop: px(18)},
});
