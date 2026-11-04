/**
 * Tipos para `@amazon-devices/react-native-vector-icons`.
 *
 * O pacote portado pela Amazon (2.1.2, sobre o react-native-vector-icons
 * 9.2.0) **nao traz `.d.ts`** — `package.json` so declara `main`. Sem este
 * shim o `tsc` para em "Could not find a declaration file for module".
 *
 * Declaro so a superficie que o projeto usa: o componente de icone por
 * fonte. Nada de `any` solto — se amanha alguem precisar de
 * `getImageSource`, acrescenta aqui e o tipo continua honesto.
 */
declare module '@amazon-devices/react-native-vector-icons/MaterialIcons' {
  import type {ComponentType} from 'react';
  import type {TextStyle, StyleProp} from 'react-native';

  export type MaterialIconProps = {
    /** Nome do glifo no glyphmap do Material Icons, ex.: 'open-in-new'. */
    name: string;
    size?: number;
    color?: string;
    style?: StyleProp<TextStyle>;
    allowFontScaling?: boolean;
  };

  const Icon: ComponentType<MaterialIconProps>;
  export default Icon;
}
