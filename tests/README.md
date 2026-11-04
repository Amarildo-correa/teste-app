# Testes

Três camadas, da mais barata para a mais cara. As duas primeiras rodam agora;
a terceira precisa de um build.

| | O que prova | Custo | Status |
|---|---|---|---|
| `unit/` | O catálogo e o manifesto respeitam as regras descobertas no aparelho | instantâneo | **12/12 passando** |
| `device/` | Os apps de streaming aceitam ser abertos por qualquer app | ~40 s, Fire Stick ligado | **21/21 passando** |
| `probe-app/` | **O nosso app consegue declarar o módulo, detectar e abrir** | build + instalação | **5/5 portões passando** |

```bash
node --test tests/unit/*.test.mjs      # invariantes do catálogo
tests/device/probe-catalog.sh          # aparelho; só lê, não mexe na tela
```

## O que já está provado

- Netflix, Prime Video, Apple TV, Pluto TV, YouTube e Amazon Music publicam
  módulo de lançamento com `sender-privilege: "*"` — **aceitam ser abertos
  por qualquer app**, sem lista branca.
- Os módulos estão no registro do sistema, logo são declaráveis em
  `[[wants.module]]`.
- `https://` e `netflix://` **não** abrem os apps. Só `pkg://`.
- Não existe API de enumeração de apps instalados para terceiros.

- **R1 fechado** — o build aceita `[[wants.module]]` de outro fornecedor
  (`manifest.toml is valid`, 0 erros) e os preserva no `.vpkg`.
- **R2 fechado** — `canOpenURL` discrimina 6/6. **Mas lança exceção em vez de
  devolver `false`**: sem `try/catch` o portal quebra na primeira ausência.
- `openURL` abriu Prime Video e Netflix de verdade; no caso negativo rejeita
  a promise sem derrubar o app.
- **G5** — o build aceita `[[wants.module]]` de módulo **inexistente** no
  sistema. É o que permite listar Disney+/Max/Globoplay (ausentes deste
  aparelho) com o caminho "Instalar na loja". Com 8 cartões: **8/8**.

Detalhes em [`research/01-resultado-app-sonda.md`](../research/01-resultado-app-sonda.md).

## O que falta

- O caso "provedor do catálogo realmente ausente" — os controles cobrem o
  mesmo caminho de código, mas os seis provedores estão todos instalados
  neste aparelho. Fecha desinstalando o Pluto TV e repetindo.
- **R3** — estabilidade dos ids de módulo (`ISomeUri1` parece interno).
- **R4** — política da Appstore sobre lançar concorrentes. Consulta, não teste.

Leia `probe-app/README.md` antes de rodar — ele abre apps de verdade na TV.
