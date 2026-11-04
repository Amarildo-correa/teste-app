/**
 * Botao de reler — roda o G3 de novo, sem reinstalar o app.
 *
 * Existe porque a medicao mudava so na montagem: para testar "instalei o
 * Disney+ agora, o selo vira INSTALADO?" era preciso matar e abrir o app
 * outra vez. Com o botao, a leitura e repetivel na mesma sessao.
 *
 * O desenho e o do <Button> do projeto — este arquivo guarda so a regra de
 * negocio: o rotulo muda enquanto mede, e o OK e ignorado nesse intervalo
 * sem que o botao saia da arvore de foco.
 */
import React, {memo} from 'react';
import {px} from '../theme';
import {Button} from './Button';

type Props = {
  measuring: boolean;
  onPress: () => void;
  /** Avisa a tela que o foco saiu do rail — veja `railActive` no cartao. */
  onFocusChange: (focused: boolean) => void;
};

export const RefreshButton = memo(({measuring, onPress, onFocusChange}: Props) => (
  <Button
    label={measuring ? 'Lendo...' : 'Reler agora'}
    busy={measuring}
    minWidth={px(320)}
    onPress={onPress}
    onFocusChange={onFocusChange}
    accessibilityLabel={measuring ? 'Lendo os apps instalados' : 'Reler os apps instalados'}
    accessibilityHint="Mede de novo quais apps de streaming estao instalados"
    testID="refresh-probe"
  />
));
RefreshButton.displayName = 'RefreshButton';
