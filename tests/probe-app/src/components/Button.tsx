/**
 * O botao do projeto. Um so, para todos.
 *
 * Antes havia tres implementacoes de botao — o CTA da tela de titulo, o Menu
 * da barra de topo e o Reler do diagnostico — cada uma com seu tamanho, sua
 * borda e seu jeito de pintar o foco. Tres lugares para errar o mesmo
 * detalhe. Aqui e um lugar so: mudou aqui, mudou no app inteiro.
 *
 * Estado de foco, conforme `buttons-padrao.png`: fundo amarelo cheio, texto
 * e icone pretos. Fora de foco o botao recua para superficie escura com
 * borda — e a diferenca e dada por QUATRO sinais redundantes, nunca so cor:
 * fundo, cor do texto, peso do texto e cor da borda. Numa TV a 3 m isso
 * importa; so a cor nao basta.
 *
 * Cantos retos em tudo: o projeto nao usa raio de canto em lugar nenhum.
 */
import React, {memo, useCallback, useState} from 'react';
import {Pressable, StyleSheet, Text} from 'react-native';
import MaterialIcon from '@amazon-devices/react-native-vector-icons/MaterialIcons';
import {C, MIN_FONT, px} from '../theme';

/**
 * Nome do glifo no Material Icons — o mesmo conjunto que a interface da
 * propria Fire TV usa, portado pela Amazon em
 * `@amazon-devices/react-native-vector-icons`.
 *
 * Antes estes dois glifos eram desenhados com <View> para nao carregar
 * dependencia. Com o pacote oficial disponivel no registro da Amazon, o
 * desenho a mao deixou de se justificar: `open-in-new` e exatamente o icone
 * que o sistema mostra quando a acao sai do app atual, e usar o mesmo
 * simbolo do sistema e o que torna a acao reconhecivel sem ler.
 *
 * A fonte vive em `assets/raw/fonts/MaterialIcons.ttf`, que e onde o
 * empacotador do Vega procura (README do pacote, secao Kepler).
 */
const GLYPH = {
  external: 'open-in-new',
  menu: 'menu',
} as const;

export type ButtonIcon = 'none' | keyof typeof GLYPH;

type Props = {
  label: string;
  icon?: ButtonIcon;
  onPress: () => void;
  /** Avisa a tela que o foco entrou ou saiu — quem desenha trilho precisa. */
  onFocusChange?: (focused: boolean) => void;
  preferred?: boolean;
  /** Ocupado: o botao continua focavel e so ignora o OK (ver RefreshButton). */
  busy?: boolean;
  minWidth?: number;
  accessibilityLabel: string;
  accessibilityHint?: string;
  testID?: string;
};

const ICON_SIZE = px(40);

export const Button = memo(
  ({
    label,
    icon = 'none',
    onPress,
    onFocusChange,
    preferred = false,
    busy = false,
    minWidth,
    accessibilityLabel,
    accessibilityHint,
    testID,
  }: Props) => {
    /* `PressableStateCallbackType` do RN 0.83 so expoe `pressed`. Numa TV
     * nao ha "pressed" que dure: o estado que pinta a tela e o foco, e ele
     * chega pelos eventos. */
    const [focused, setFocused] = useState<boolean>(false);

    const handleFocus = useCallback((): void => {
      setFocused(true);
      onFocusChange?.(true);
    }, [onFocusChange]);

    const handleBlur = useCallback((): void => {
      setFocused(false);
      onFocusChange?.(false);
    }, [onFocusChange]);

    const handlePress = useCallback((): void => {
      /* Ocupado nao vira `disabled`: isso tiraria o botao da arvore de foco
       * no meio da interacao e o foco cairia num vizinho sozinho. Pior que
       * um OK sem efeito. */
      if (!busy) {
        onPress();
      }
    }, [busy, onPress]);

    const fg = focused ? C.onAccent : C.textSecondary;

    return (
      <Pressable
        focusable
        hasTVPreferredFocus={preferred}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onPress={handlePress}
        accessible
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        accessibilityState={{busy}}
        style={[
          focused ? styles.buttonFocused : styles.button,
          minWidth === undefined ? null : {minWidth},
        ]}
        testID={testID}>
        <Text numberOfLines={1} style={[styles.label, {color: fg}, focused ? styles.labelFocused : null]}>
          {label}
        </Text>
        {icon === 'none' ? null : (
          <MaterialIcon
            name={GLYPH[icon]}
            size={ICON_SIZE}
            color={fg}
            style={styles.icon}
            /* O icone acompanha o corpo do texto, nao o tamanho de fonte do
             * sistema: na TV quem define a escala e o nosso px(). */
            allowFontScaling={false}
          />
        )}
      </Pressable>
    );
  },
);
Button.displayName = 'Button';

const base = {
  flexDirection: 'row',
  alignItems: 'center',
  alignSelf: 'flex-start',
  borderWidth: px(4),
  paddingHorizontal: px(32),
  paddingVertical: px(16),
} as const;

const styles = StyleSheet.create({
  button: {...base, backgroundColor: C.surface, borderColor: C.border},
  buttonFocused: {...base, backgroundColor: C.accent, borderColor: C.accent},

  label: {fontSize: px(MIN_FONT + 4), fontWeight: '700', letterSpacing: px(1)},
  labelFocused: {fontWeight: '900'},

  icon: {marginLeft: px(20)},
});
