/**
 * Paginacao de um trilho: guarda o que ja chegou e sabe pedir a proxima pagina.
 *
 * Sem React, sem rede e sem SDK, para rodar com `node --test`. Em JS com os
 * tipos em railPager.d.ts porque o Node do WSL nao carrega .ts. Quem desenha le
 * `items` direto, sem copia: um trilho com milhares de titulos nao pode gerar
 * um render de lista a cada pagina (ver PosterRail).
 */

export const createPager = (fetchPage, getId) => {
  const items = [];
  const seen = new Set();
  let status = 'idle';
  let nextPage = 1;

  const loadNext = async () => {
    if (status === 'loading' || status === 'done') {
      return 0;
    }
    status = 'loading';
    try {
      const {items: incoming, totalPages} = await fetchPage(nextPage);
      const before = items.length;
      for (const item of incoming) {
        /* A ordem do servidor muda entre uma pagina e outra, e o mesmo titulo
         * pode voltar: id repetido viraria key repetida no Carousel. */
        const id = getId(item);
        if (!seen.has(id)) {
          seen.add(id);
          items.push(item);
        }
      }
      status = nextPage >= totalPages ? 'done' : 'idle';
      nextPage += 1;
      return items.length - before;
    } catch {
      /* A pagina nao avanca: a proxima chamada repete o mesmo pedido. */
      status = 'error';
      return 0;
    }
  };

  return {
    items,
    get status() {
      return status;
    },
    loadNext,
  };
};
