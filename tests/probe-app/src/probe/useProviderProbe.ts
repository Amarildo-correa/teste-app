/**
 * A medicao em si — G3 e G4 isolados da interface.
 *
 * G3: `Linking.canOpenURL('pkg://<componente>')` distingue app disponivel de
 *     app ausente?  Decide o destino do botao do titulo e o selo do diagnostico.
 * G4: `Linking.openURL(...)` traz o app de streaming para a frente?
 *     E o "Abrir no app" do diagnostico.
 *
 * Medido no aparelho em 2026-11-03: canOpenURL devolve `true` para app
 * disponivel e **lanca excecao** para ausente, em vez de devolver `false`.
 * Lanca tambem discrimina, entao a deteccao funciona — mas so com try/catch.
 * Um canOpenURL solto derruba a renderizacao da lista inteira.
 */
import {useCallback, useEffect, useMemo, useState} from 'react';
import {Linking} from 'react-native';
import {PROVIDERS, type Provider} from '../data/providers';

/** `available: null` = ainda medindo. `threw` = canOpenURL lancou. */
export type Probe = {available: boolean | null; threw: boolean};
export type Probes = Record<string, Probe>;

const INITIAL: Probes = PROVIDERS.reduce<Probes>((acc, p) => {
  acc[p.key] = {available: null, threw: false};
  return acc;
}, {});

export type ProbeResult = {
  probes: Probes;
  /** Veredito do G3, pronto para desenhar. */
  verdict: string;
  /** Resultado bruto por provedor, pronto para desenhar. */
  detail: string;
  /** Ultimo resultado de G4. */
  lastAction: string;
  /** Ha medicao em andamento — o botao de reler se desabilita durante ela. */
  measuring: boolean;
  /** Quantas leituras ja rodaram. 1 = a da montagem. */
  reading: number;
  open: (provider: Provider) => void;
  /** Descarta o resultado atual e mede tudo de novo. */
  remeasure: () => void;
};

export const useProviderProbe = (): ProbeResult => {
  const [probes, setProbes] = useState<Probes>(INITIAL);
  const [lastAction, setLastAction] = useState<string>('nenhuma ainda');
  /* Cada incremento e uma leitura nova. A da montagem e a de numero 1. */
  const [reading, setReading] = useState<number>(1);

  /* G3 — mede na montagem e a cada `remeasure`. */
  useEffect(() => {
    let cancelled = false;

    const run = async (): Promise<void> => {
      const next: Probes = {};
      for (const provider of PROVIDERS) {
        try {
          const can = await Linking.canOpenURL(provider.uri);
          next[provider.key] = {available: can, threw: false};
        } catch {
          // A excecao e o sinal de ausencia. Sem este catch o app quebra.
          next[provider.key] = {available: false, threw: true};
        }
      }
      if (!cancelled) {
        setProbes(next);
      }
    };

    void run();
    return () => {
      // Releitura disparada no meio de uma medicao: a anterior e descartada
      // aqui, senao o resultado velho chega depois e sobrescreve o novo.
      cancelled = true;
    };
  }, [reading]);

  const measuring = useMemo(
    () => PROVIDERS.some(p => probes[p.key].available === null),
    [probes],
  );

  const remeasure = useCallback((): void => {
    // Volta a `null` de proposito: o selo tem de dizer VERIFICANDO outra vez,
    // em vez de deixar o resultado velho na tela como se fosse o novo.
    setProbes(INITIAL);
    setLastAction('nenhuma ainda');
    setReading(n => n + 1);
  }, []);

  /* G4 — abre o app de verdade.
   * G6 — quando o app NAO esta instalado, manda para a pagina dele na
   *      Appstore, que e onde existe o botao Baixar.
   *
   * O alvo da loja e `com.amazon.appstorevegatv.details`, que declara aceitar
   * `amzn://apps`. O parametro `?p=` quer o package ANDROID, nao o id Vega.
   *
   * Duas coisas medidas no aparelho que mandam neste codigo:
   *
   *   - package desconhecido NAO rejeita a promise: a loja abre e pinta uma
   *     tela de "Erro / Go Back" por cima do portal. Por isso `storeId: null`
   *     tem de ser barrado AQUI, antes do openURL — depois nao da mais.
   *   - `amzn://apps/android?s=<busca>` nao serve de plano B: a loja entra e
   *     fica num spinner que nao termina. Sem id certo, nao ha caminho.
   */
  const open = useCallback((provider: Provider): void => {
    const installed = probes[provider.key]?.available === true;

    if (installed) {
      Linking.openURL(provider.uri)
        .then(() => setLastAction(`openURL resolveu para ${provider.name}`))
        .catch(() => setLastAction(`openURL rejeitou ${provider.name} (sem crash)`));
      return;
    }

    if (provider.storeId === null) {
      setLastAction(`${provider.name}: sem storeId, loja nao chamada`);
      return;
    }

    const storeUri = `amzn://apps/android?p=${provider.storeId}`;
    Linking.openURL(storeUri)
      .then(() => setLastAction(`loja abriu em ${provider.name}`))
      .catch(() => setLastAction(`loja rejeitou ${provider.name} (sem crash)`));
  }, [probes]);

  const verdict = useMemo(() => {
    const done = PROVIDERS.every(p => probes[p.key].available !== null);
    if (!done) {
      return 'G3  medindo...';
    }
    const hits = PROVIDERS.filter(p => probes[p.key].available === p.expectAvailable).length;
    const discriminates =
      PROVIDERS.some(p => probes[p.key].available === true) &&
      PROVIDERS.some(p => probes[p.key].available === false);
    return discriminates
      ? `G3  ${hits}/${PROVIDERS.length} como esperado  ·  discrimina SIM  ·  selo INSTALADO viavel`
      : `G3  ${hits}/${PROVIDERS.length} como esperado  ·  discrimina NAO  ·  ver Plano B no README`;
  }, [probes]);

  const detail = useMemo(
    () =>
      PROVIDERS.map(p => {
        const {available, threw} = probes[p.key];
        if (available === null) {
          return `${p.name}: ...`;
        }
        return `${p.name}: ${available ? 'true' : threw ? 'excecao' : 'false'}`;
      }).join('   ·   '),
    [probes],
  );

  return {probes, verdict, detail, lastAction, measuring, reading, open, remeasure};
};
