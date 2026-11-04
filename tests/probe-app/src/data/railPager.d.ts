export type Page<T> = {items: T[]; totalPages: number};
export type FetchPage<T> = (page: number) => Promise<Page<T>>;

/** idle: pode pedir mais. done: acabou. error: a proxima chamada tenta de novo. */
export type PagerStatus = 'idle' | 'loading' | 'error' | 'done';

export type Pager<T> = {
  readonly items: readonly T[];
  readonly status: PagerStatus;
  /**
   * Pede a proxima pagina e devolve quantos itens novos entraram. Nunca rejeita:
   * erro vira `status: 'error'`. Chamada com pedido em voo ou lista completa
   * devolve 0 sem ir a rede, entao pode ser chamada a cada tecla.
   */
  loadNext: () => Promise<number>;
};

export declare const createPager: <T>(
  fetchPage: FetchPage<T>,
  getId: (item: T) => number | string,
) => Pager<T>;
