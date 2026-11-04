/**
 * Portal de Streamings — raiz e navegacao.
 *
 * Tres telas, sem biblioteca de navegacao: a arvore e rasa demais para
 * justificar uma, e cada dependencia nativa a mais e risco de build no
 * armv7.
 *
 *   catalogo  -> trilho por provedor (so a Netflix com dado real)
 *   titulo    -> single content, com o deep link kcp-launch
 *   sonda     -> diagnostico G3/G4, atras do Menu
 *
 * A medicao (`useProviderProbe`) vive AQUI, na raiz, e nao dentro da sonda:
 * a tela do titulo precisa do resultado de G3 para decidir entre "abrir o
 * titulo" e "instalar na loja". Se a medicao morasse na sonda, essa decisao
 * dependeria de o usuario ter aberto o Menu antes.
 *
 * Tambem vivem aqui os titulos e a posicao do catalogo. Sem biblioteca de
 * navegacao a tela e desmontada ao abrir um titulo, entao e daqui que ela
 * renasce no ponto certo: a Amazon recomenda guardar o ultimo item focado e
 * restaura-lo na volta (react_native_for_vega_tv_app_focus_management).
 */
import React, {useCallback, useMemo, useState} from 'react';
import {useTVEventHandler, type HWEvent} from '@amazon-devices/react-native-kepler';
import {CatalogScreen, type RailTitles} from './screens/CatalogScreen';
import {TitleScreen} from './screens/TitleScreen';
import {ProbeScreen} from './screens/ProbeScreen';
import {PROVIDERS} from './data/providers';
import {useProviderProbe} from './probe/useProviderProbe';
import type {RailPosition} from './components/PosterRail';
import type {TmdbTitle} from './data/tmdb';

type Route =
  | {name: 'catalog'}
  | {name: 'title'; title: TmdbTitle}
  | {name: 'probe'};

export const App = (): React.JSX.Element => {
  const probe = useProviderProbe();
  const [route, setRoute] = useState<Route>({name: 'catalog'});

  const netflix = useMemo(() => PROVIDERS.find(p => p.key === 'netflix') ?? null, []);

  const [cachedRails, setCachedRails] = useState<RailTitles | null>(null);
  const [restore, setRestore] = useState<RailPosition | null>(null);

  const goCatalog = useCallback(() => setRoute({name: 'catalog'}), []);
  const openTitle = useCallback(
    (title: TmdbTitle, position: RailPosition) => {
      setRestore(position);
      setRoute({name: 'title', title});
    },
    [],
  );
  const openProbe = useCallback(() => {
    setRestore(null);
    setRoute({name: 'probe'});
  }, []);

  /* Botao Menu (≡) do controle abre a sonda de qualquer tela. So no soltar
   * (eventKeyAction 1): o aperto e o soltar chegam como dois eventos. */
  useTVEventHandler((event: HWEvent) => {
    if (event.eventType === 'menu' && event.eventKeyAction === 1) {
      openProbe();
    }
  });

  if (route.name === 'title') {
    return (
      <TitleScreen
        title={route.title}
        /* `available === true` e o unico valor que vale como "instalado":
         * `null` quer dizer que a medicao ainda nao terminou, e tratar null
         * como instalado prometeria assistir antes de saber. */
        installed={netflix !== null && probe.probes[netflix.key]?.available === true}
        storeId={netflix?.storeId ?? null}
        onBack={goCatalog}
      />
    );
  }

  if (route.name === 'probe') {
    return <ProbeScreen probe={probe} onBack={goCatalog} />;
  }

  return (
    <CatalogScreen
      cachedRails={cachedRails}
      onRailsLoaded={setCachedRails}
      restore={restore}
      onOpenTitle={openTitle}
      onOpenProbe={openProbe}
    />
  );
};

export default App;
