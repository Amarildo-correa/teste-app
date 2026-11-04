# Vega Virtual Device no WSL2: dá para ver a interface sem o aparelho? — medição de 2026-11-04

Máquina: Windows 11, WSL2 (Ubuntu 26.04, 7,6 GB de RAM), Docker Desktop, sem nenhuma alteração no Windows. SDK 2.0.13986, Vega CLI 1.4.7. A Amazon não suporta Windows nem WSL para o SDK: tudo aqui funciona fora do suporte e pode quebrar em qualquer atualização.

## Veredito

**Sim, sem engenharia reversa.** O VVD roda em um container, com janela no Windows pelo WSLg. Serve para ver a interface; as medições continuam sendo no Fire Stick.

| Caso | Resultado | Evidência |
|---|---|---|
| Boot sem janela (`--no-gui`) | pronto em 35 s | `Virtual device ready`, `vda devices` lista `emulator-5554` |
| Boot com janela | pronto em 20 s (segundo boot da mesma instalação) | `Virtual device ready`, janela aberta no Windows |
| Instalar e abrir o Portal x86_64 | sem crash | `VISIBLE` em `vlcm list`, `crash-history` com `Size: 0` |
| Portal na tela e setas do teclado | funciona | conferido por uma pessoa na janela, com o build das 05:23 |
| Recompilar e reinstalar com o código atual | sem crash | build de 16 s, `VISIBLE`, `Size: 0`; a tela deste build não foi conferida |
| `gwsi-tool-screenshooter` | **trava** e gera PNG de 0 byte | testado com e sem janela |

## Receita

O container do VVD é separado do `vega-sdk-dl`, que segue sendo o que compila. Os dois usam volumes diferentes, porque o `vega-sdk-dl` foi instalado sem a imagem do VVD.

### 1. Criar o container e instalar o SDK com o VVD

Só uma vez. Baixa cerca de 2,5 GB; o volume fica com 7,4 GB.

```bash
docker run -d --init --name vega-vvd --platform linux/amd64 \
  --device /dev/kvm --cap-add NET_ADMIN \
  --sysctl net.ipv6.conf.all.disable_ipv6=0 --sysctl net.ipv6.conf.lo.disable_ipv6=0 \
  -e DISPLAY=:0 -v /mnt/wslg/.X11-unix:/tmp/.X11-unix \
  -v vega-vvd-home:/root/vega -e NONINTERACTIVE=true -e SKIP_SDK_INSTALL=true \
  ubuntu:22.04 sleep infinity

docker exec vega-vvd bash -c 'export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq
  apt-get install -y -qq --no-install-recommends curl tar jq ca-certificates lz4 iproute2 \
    libx11-6 libxext6 libxcb1 libx11-xcb1 libxrender1 libxi6 libxfixes3 libxcursor1 libxrandr2 \
    libxkbcommon0 libxkbcommon-x11-0 libxcomposite1 libxdamage1 libxtst6 libgl1 libegl1 libgles2 \
    libpulse0 libasound2 libnss3 libnspr4 libdbus-1-3 libglib2.0-0 libfontconfig1 libfreetype6 \
    libsm6 libice6 libbsd0 libdrm2 libgbm1 libxcb-cursor0 libxcb-icccm4 libxcb-image0 \
    libxcb-keysyms1 libxcb-render-util0 libxcb-shape0 libxcb-xinerama0 libxcb-xkb1
  curl -fsSL https://sdk-installer.vega.labcollab.net/get_vvm.sh | bash
  unset SKIP_SDK_INSTALL
  /root/vega/bin/vega sdk install 2.0.13986 --non-interactive
  /root/vega/bin/vega sdk use 2.0.13986'
```

O `vega sdk install` não retoma: em uma queda, rode de novo, ele recomeça do zero. A lista de bibliotecas foi instalada de uma vez e não foi reduzida, então pode ter pacotes sobrando.

### 2. Subir o VVD

```bash
docker start vega-vvd
docker exec vega-vvd bash -c 'export PATH=/root/vega/bin:/root/vega/node22/bin:$PATH
  ip -6 addr add fd00::1/128 dev lo
  vega virtual-device start --timeout 300'
```

O `ip -6 addr add` não persiste: refaça sempre que o container reiniciar. Na primeira abertura aparece o aviso "Emulator Running in Nested Virtualization". Marque "Never show this again" e clique em OK.

### 3. Compilar e instalar o Portal

O VVD exige a arquitetura do PC. O `build-vega` já gera as três, então o mesmo comando produz o armv7 do Stick e o x86_64 do VVD.

```bash
docker cp vega-sdk-dl:/root/work/build/x86_64-release/portalprobe_x86_64.vpkg /tmp/p.vpkg
docker cp /tmp/p.vpkg vega-vvd:/root/p.vpkg
docker exec vega-vvd bash -c 'export PATH=/root/vega/bin:/root/vega/node22/bin:$PATH
  vega run-app /root/p.vpkg com.portalprobe.app.main -d VirtualDevice'
```

### 4. Desligar

```bash
docker exec vega-vvd /root/vega/bin/vega virtual-device stop
docker stop vega-vvd
```

## Por que cada peça existe

Cada linha é um erro real desta medição. O controle negativo é o próprio erro: sem a peça, o boot falhou.

| Sem isto | O que acontece |
|---|---|
| Instalação sem `SKIP_VVD_INSTALL` | `Vega Virtual Device not found at .../vvd/images/tv`. O script de container da skill `vega-os-windows` define essa variável, e por isso a imagem nunca tinha sido baixada. `vega component` não oferece o `vvd` isolado, daí o volume novo |
| `ca-certificates` | `vega sdk list-remote` falha com `x509: certificate signed by unknown authority` |
| Bibliotecas do `apt` | `qemu-img: error while loading shared libraries: libX11.so.6` |
| `--sysctl ...disable_ipv6=0` e `ip -6 addr add` | `address resolution failed for ::1:<porta>: Name or service not known`, seguido de `QEMU main loop exits abnormally`. Só o `--sysctl` não basta: com ele, `lo` ganha `::1` e o erro continua. A explicação provável é o `AI_ADDRCONFIG`, que ignora o loopback; não foi verificada no código do QEMU |
| `/mnt/wslg/.X11-unix` | sem acesso à janela. O caminho `/run/desktop/mnt/host/wslg` monta vazio neste Docker Desktop |

**O sintoma engana:** quando o QEMU morre, a CLI não percebe e espera o prazo inteiro, terminando em `Deadline reached ... unresponsive`. Confira `virtual_device.err` na pasta mais recente de `vvd/instances/`, em vez de aumentar o `--timeout`.

## O que o VVD não substitui

- **Medido aqui:** o screenshot do aparelho não funciona, então quem confere a tela do VVD é uma pessoa olhando a janela.
- **Pela documentação da Amazon, não medido aqui:** sem DRM em host x86, sem Alexa, e chamadas de Content Launcher vindas do sistema não chegam ao VVD. A documentação também diz que o launcher do Fire TV não está incluído, embora o processo `com.amazon.keplerlauncherapp.main` apareça em `vlcm list`. Não verifiquei se é o mesmo launcher.
- **Não testado:** detecção de provedores com `canOpenURL`, abertura de outros apps, caminho da loja e transições. O PC x86 também não reproduz o desempenho do armv7. Qualquer portão ou medição de `research/` continua valendo só no Fire Stick.

## Armadilhas do ambiente

- Atualizar ou reiniciar o Docker Desktop mata o download e os containers, que saem com `Exited (137)`. O cliente `docker` responde `Bus error` enquanto o Docker está fora do ar.
- Com a rede instável, o SDK falhou com `unexpected EOF` em várias tentativas; a instalação completa levou 1408 s na tentativa que deu certo. A mensagem sugere verificar permissões e disco, mas aqui a causa foi a conexão.
- Com o VVD ligado, sobram cerca de 2,5 GB dos 7,6 GB do WSL. A documentação cita falhas por falta de memória abaixo de 2 GB livres.
- A receita foi validada em etapas, ao longo de três recriações do container, e não de uma vez a partir do zero.
