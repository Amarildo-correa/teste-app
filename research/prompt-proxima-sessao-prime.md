# Prompt para a próxima sessão — abrir conteúdo no Prime Video

Copie o bloco abaixo como primeira mensagem de uma sessão nova.

---

Preciso fazer o portal abrir um **título específico dentro do Prime Video**, como já funciona para a Netflix. Leia `research/02-deeplink-netflix.md` antes de tocar em qualquer coisa — ele tem o caminho que deu certo, os que não deram, e as armadilhas de medição que já custaram ciclos.

## O que já está provado para a Netflix

O deep link **não** é URL. É uma chamada do Content Launcher do Matter (cluster 1290 = 0x050A, comando 0 = `LaunchContent`) serializada em JSON e pendurada na query de uma URI `pkg://` comum:

```
pkg://com.netflix.kepler.main?kcp-launch={...}
```

Funciona disparada por `Linking.openURL` de dentro do nosso app, sem Alexa e sem privilégio de plataforma. O app só precisa declarar o módulo do alvo em `[[wants.module]]`. O código está em `tests/probe-app/src/deeplink/netflixTitle.ts`.

Três coisas que a medição fixou e que provavelmente mudam no Prime:

1. **Quem resolve o título é o TEXTO, não o id** (experimento 2×2 no §6).
2. **Mas o par `amzn_id` precisa existir** no `ExternalIDList`, com qualquer
   valor — sem ele o Netflix para na lista de busca.
3. **O `AutoPlay` do Matter é ignorado**: o Netflix sempre reproduz. Não
   existe caminho para a tela de detalhe.

Nada disso é contrato público. Trate como "o que o Netflix faz", não como "o que o Vega garante".

## O que já se sabe do Prime Video, e o que não se sabe

Medido no aparelho (`vpm info`, `vpm list modules`):

| | |
|---|---|
| Package | `com.amazon.frenchpress` (não se adivinha) |
| Componente | `com.amazon.frenchpress.main` |
| Módulo publicado | `/com.amazon.frenchpress.main@IDeeplinks` |
| Serviço oferecido | `com.amazon.frenchpress.interface.provider` |
| Extras DIAL | **não tem** — o caminho DIAL não existe aqui |

Duas diferenças que importam em relação à Netflix:

- O Prime publica um módulo **`@IDeeplinks`**, enquanto a Netflix só publica
  `@IMod1`. Isso sugere que o Prime aceita deep link por path/query — o que
  na Netflix não funcionava. **É hipótese, não medição.**
- O launcher da Fire TV declara querer `com.amazon.frenchpress.interface.provider`
  nos `wants.services`. Isso sugere que o Prime também implementa o Content
  Launcher. **Também é hipótese.**

Não testei nenhuma URI de conteúdo do Prime. Esse é o trabalho.

## Amostragem, não varredura — leia isto antes de planejar

O objetivo **não** é validar títulos um a um. É **descobrir o padrão do
endereço** e deixar em produção uma função que o gera trocando a variável
(id, título, ou o que o provedor usar). São milhares de títulos por
streaming: testar cada um no aparelho é impossível, caro, e colocaria um LLM
no caminho crítico de um app que precisa rodar sozinho na TV do usuário.

A divisão é esta:

| Nível | Como se estabelece | Quantidade |
|---|---|---|
| **Provedor** — package, componente, módulo, forma do payload | medido no aparelho, sempre | 1 por streaming |
| **Título** — o valor que entra na variável | **gerado por código**, a partir do catálogo | milhares |

Meça **5 a 8 títulos por streaming**, escolhidos para *quebrar* o padrão, não
para confirmá-lo:

- um filme e uma série (podem usar caminhos diferentes);
- um título com acento e pontuação (`Jogos Vorazes: A Cantiga...`);
- um título de nome curto e ambíguo (`Alien`, `Up`) — é onde resolução por
  texto erra;
- um título que **não existe** naquele streaming (controle negativo: o que
  acontece? abre errado em silêncio ou falha?);
- um título recém-lançado, que pode não estar no índice ainda.

Se os 5–8 caírem certos, o padrão está estabelecido. Se **um** cair errado,
você descobriu o modo de falha — que vale mais que os cinco acertos, porque
é ele que define o que o código de produção precisa tratar.

### A pergunta que decide se isso vira produção

Na Netflix, **quem resolve é o texto e o id é ignorado**. Isso é frágil em
escala: nome ambíguo abre o título errado e nada rejeita a promise.

Então a primeira coisa a descobrir no Prime é: **existe um campo de ID que
realmente vincula?** Um id determinístico (ASIN, GTI, `amzn1.dv.*`) vale
muito mais que texto, porque a geração passa a ser exata. Desenhe o
experimento para responder isso cedo — payload com id certo e texto errado,
e vice-versa. É o mesmo 2×2 do §6 do documento 02, e ele responde em dois
lançamentos.

Se só houver texto, diga isso com todas as letras no documento e trate como
limitação conhecida do provedor — não como detalhe.

## O método que funcionou, e que eu repetiria

**Capturar antes de inventar.** O payload da Netflix não foi deduzido: foi
lido do card da busca da Fire TV. Faça o mesmo:

1. Peça para o usuário buscar um filme do Prime pela Alexa e clicar no card.
2. Logo depois, leia `vlcm list` — a **última coluna** mostra a URI de
   lançamento que o app recebeu, inteira.
3. Reenvie essa URI por `vmsgr send` (como arquivo de script) e confirme que
   abre fora da Alexa.
4. Só então reduza o payload por tentativa, um campo por vez, com controle
   negativo em cada passo.

Use `vmsgr check-access --package=com.helloworldtv.app <uri>` para saber o
que o OS exige do remetente antes de gastar um ciclo de build.

## Armadilhas já pagas — não as pague de novo

- **Screenshot do Netflix/Prime não serve para ler a tela.**
  `gwsi-tool-screenshooter` falha com `drm: atomic commit failed` e grava **0
  bytes** sempre que há vídeo protegido composto. E quase tudo nesses apps
  tem vídeo: home com preview, página de detalhe com preview, reprodução. Um
  screenshot que *funcionou* pode ser um quadro de transição — foi assim que
  eu confundi o cartão de pré-rolagem com a página do título e escrevi uma
  conclusão errada no documento. **A única leitura válida é pedir para uma
  pessoa olhar a TV.**
- **App já aberto não reprocessa a URI.** Sempre
  `vlcm terminate-app --pkg-id <pkg> --force` antes de cada teste.
- **Matar o app traz o anterior para o primeiro plano**, e o novo lançamento
  vai para background. Use `vlcm trigger-app foreground --inst <inst>`.
- **O seletor de perfil fica na frente de qualquer deep link.**
- `#`, `;`, `|` e aspas **não sobrevivem** ao `vda shell`. Mande script como
  arquivo (`vega exec vda push`), como faz `probe-catalog.sh`.
- `KEY_ENTER` é o OK. `KEY_SELECT` é aceito e não faz nada.
- A TV entra em protetor de tela sozinha. Screenshot de pássaro ou golfinho
  = a medição não aconteceu; acorde com `KEY_DOWN` e repita.

## Ciclo de build

`tests/probe-app/` é a fonte da verdade e **não tem `node_modules`**. O
projeto que compila vive em `/root/work` no container `vega-sdk-dl`:

```bash
cd tests/probe-app
docker cp src/. vega-sdk-dl:/root/work/src/
docker cp manifest.toml vega-sdk-dl:/root/work/manifest.toml
docker exec vega-sdk-dl bash -lc 'export PATH=/root/vega/bin:/root/vega/node22/bin:$PATH
  cd /root/work
  node node_modules/typescript/bin/tsc --noEmit
  node node_modules/.bin/eslint src --ext .ts,.tsx
  node node_modules/.bin/react-native build-vega --build-type Release
  vega device install-app -p build/armv7-release/portalprobe_armv7.vpkg
  vega device launch-app --appName com.portalprobe.app.main'
```

O eslint tem ~20 warnings conhecidos; o que importa é **0 errors**.

Uma armadilha de manifesto já paga: pacote nativo que declara módulo no
próprio `kepler-system-conf.toml` **não é propagado** pelo `build-vega`. O
app compila, instala e **crasha ao abrir**. Confira `vlcm crash-history` e
declare o módulo à mão (foi o caso do `react-native-vector-icons`).

## O que entregar

1. `tests/probe-app/src/deeplink/primeTitle.ts` — uma **função pura** que
   recebe os dados do catálogo e devolve a URI. Sem rede, sem estado, sem
   nada que precise de LLM em tempo de execução: é ela que roda milhares de
   vezes na TV do usuário. Comente o **porquê** de cada campo, incluindo o
   que foi testado e não importou.
2. **Testes de unidade da função geradora**, em `tests/unit/`, rodando com
   `node --test` sem aparelho: a URI gerada para as 5–8 amostras medidas tem
   de bater, caractere por caractere, com a que funcionou no aparelho. É
   isso que impede uma refatoração futura de quebrar o deep link em
   silêncio. Verifique por mutação: altere um byte do payload esperado e
   confirme que o teste falha.
3. **Tratamento do modo de falha no código**, não só no documento. Se a
   resolução for por texto, o app não tem como saber que abriu o título
   errado — então decida e implemente o que fazer (ex.: preferir id quando
   existir, normalizar o título, ou registrar o caso). Nada de promessa que
   o código não cumpre.
4. O `[[wants.module]]` do Prime no `manifest.toml` (já existe; confirme).
5. Um trilho do Prime Video com dado real no `CatalogScreen`, trocando o
   esqueleto. O TMDB tem o provedor do Prime — **confirme o id** em
   `/watch/providers/movie?watch_region=BR` antes de usar; não chute.
6. `research/03-deeplink-prime.md` com a mesma estrutura do 02: tabela de
   veredito, o que foi medido, controles negativos, as amostras usadas (com
   nome e resultado de cada uma) e o que ficou em aberto.

## Disciplina do repositório — leia o CLAUDE.md, mas o resumo é

- **Nada entra no catálogo sem ter sido medido num aparelho** — isto vale
  para **provedor** (package, componente, módulo, forma do payload), que são
  oito. **Não vale para título**: título é gerado por código a partir do
  padrão, validado por amostra. Ler esta regra como "testar cada filme"
  torna o projeto impossível e põe um LLM no caminho crítico de produção.
- **Teste que não morde não vale**: ao criar invariante, quebre o dado de propósito e confirme que o teste falha.
- **Caso negativo vale tanto quanto o positivo.** Todo portão fechado tem um controle que deveria falhar — e falhou.
- **Os documentos preservam o histórico**: não reescreva número antigo para ficar bonito; acrescente a medição nova. Se corrigir uma conclusão errada, deixe registrado que estava errada e por quê — o §6 do documento 02 é o exemplo.
