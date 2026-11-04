/** As rotas do app e o que cada uma recebe. */
import type {NativeStackScreenProps} from '@amazon-devices/react-navigation__native-stack';
import type {TmdbTitle} from '../data/tmdb';

export type RootStackParamList = {
  catalog: undefined;
  title: {title: TmdbTitle};
  probe: undefined;
};

export type ScreenProps<Name extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  Name
>;
