/**
 * Portal de Streamings — raiz e navegacao.
 *
 *   catalogo  -> trilho por provedor (so a Netflix com dado real)
 *   titulo    -> single content, com o deep link kcp-launch
 *   sonda     -> diagnostico G3/G4, atras do Menu
 *
 * A pilha nativa mantem o catalogo montado por baixo do titulo: titulos,
 * rolagem e foco continuam onde estavam, sem nada guardado aqui para a volta.
 * O Back do controle e tratado pelo navegador.
 *
 * A medicao (`useProviderProbe`) vive AQUI, acima das telas, e nao dentro da
 * sonda: a tela do titulo precisa do resultado de G3 para decidir entre "abrir
 * o titulo" e "instalar na loja". Se a medicao morasse na sonda, essa decisao
 * dependeria de o usuario ter aberto o Menu antes.
 */
import React, {useMemo} from 'react';
import {useTVEventHandler, type HWEvent} from '@amazon-devices/react-native-kepler';
import {enableFreeze, enableScreens} from '@amazon-devices/react-native-screens';
import {
  DarkTheme,
  NavigationContainer,
  createNavigationContainerRef,
} from '@amazon-devices/react-navigation__native';
import {createNativeStackNavigator} from '@amazon-devices/react-navigation__native-stack';
import {CatalogScreen} from './screens/CatalogScreen';
import {TitleScreen} from './screens/TitleScreen';
import {ProbeScreen} from './screens/ProbeScreen';
import {C} from './theme';
import {PROVIDERS} from './data/providers';
import {useProviderProbe} from './probe/useProviderProbe';
import type {RootStackParamList} from './navigation/routes';

enableScreens();
enableFreeze();

const Stack = createNativeStackNavigator<RootStackParamList>();
const navigationRef = createNavigationContainerRef<RootStackParamList>();

/* Sem animacao: `fade` e `default` foram testados e rejeitados na TV em
 * 2026-11-04. No `default`, so a coluna de dados do titulo piscava. */
const SCREEN_OPTIONS = {
  headerShown: false,
  animation: 'none',
  contentStyle: {backgroundColor: C.bg},
} as const;

/* O fundo do tema aparece atras da tela enquanto ela anima: com o tema padrao era
 * branco, e a troca de tela piscava (visto na TV em 2026-11-04). */
const NAV_THEME = {...DarkTheme, colors: {...DarkTheme.colors, background: C.bg}};

export const App = (): React.JSX.Element => {
  const probe = useProviderProbe();
  const netflix = useMemo(() => PROVIDERS.find(p => p.key === 'netflix') ?? null, []);

  /* Botao Menu (≡) do controle abre a sonda de qualquer tela. So no soltar
   * (eventKeyAction 1): o aperto e o soltar chegam como dois eventos. */
  useTVEventHandler((event: HWEvent) => {
    if (event.eventType === 'menu' && event.eventKeyAction === 1 && navigationRef.isReady()) {
      navigationRef.navigate('probe');
    }
  });

  /* `available === true` e o unico valor que vale como "instalado": `null` quer
   * dizer que a medicao ainda nao terminou, e tratar null como instalado
   * prometeria assistir antes de saber. */
  const installed = netflix !== null && probe.probes[netflix.key]?.available === true;

  return (
    <NavigationContainer ref={navigationRef} theme={NAV_THEME}>
      <Stack.Navigator initialRouteName="catalog" screenOptions={SCREEN_OPTIONS}>
        <Stack.Screen name="catalog" component={CatalogScreen} />
        <Stack.Screen name="title">
          {({route}) => (
            <TitleScreen
              title={route.params.title}
              installed={installed}
              storeId={netflix?.storeId ?? null}
            />
          )}
        </Stack.Screen>
        <Stack.Screen name="probe">{() => <ProbeScreen probe={probe} />}</Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default App;
