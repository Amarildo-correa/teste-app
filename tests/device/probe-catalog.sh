#!/usr/bin/env bash
# Teste de aparelho — não precisa de build, não toca na tela da TV.
#
# Verifica, contra o Fire Stick de verdade, as premissas em que o app-portal
# se apoia:
#   T1  os componentes do catálogo existem e são lançáveis
#   T2  cada provedor publica um módulo de lançamento com sender-privilege "*"
#   T3  o módulo está no registro do sistema (logo, é declarável em wants.module)
#   T4  https:// NÃO abre os apps (trava de regressão)
#   T5  esquemas do Fire OS (netflix://) NÃO resolvem (trava de regressão)
#   T6  o fallback da Appstore passa sem módulo
#
# Uso:  tests/device/probe-catalog.sh [IP:PORTA]
#
# Só lê estado. Não instala, não lança app, não captura tela.

set -uo pipefail

DEVICE="${1:-192.168.1.2:5555}"
CONTAINER="vega-sdk-dl"
# App de terceiros já instalado, usado como remetente. Tem o mesmo nível de
# privilégio que o app-portal terá — é isso que torna o teste válido.
SENDER="${SENDER_PKG:-com.helloworldtv.app}"

pass=0; fail=0
ok()   { printf '  \033[32mPASS\033[0m %s\n' "$1"; pass=$((pass+1)); }
no()   { printf '  \033[31mFAIL\033[0m %s\n' "$1"; fail=$((fail+1)); }
head() { printf '\n\033[1m%s\033[0m\n' "$1"; }

# --- conexão -----------------------------------------------------------------
docker start "$CONTAINER" >/dev/null 2>&1
if ! docker exec "$CONTAINER" bash -c "export PATH=/root/vega/bin:\$PATH
      vega exec vda connect $DEVICE 2>&1 | grep -qiE 'connected to|already connected'"; then
  echo "Não conectou em $DEVICE."
  echo "O IP vem de DHCP e muda. Procure a porta 5555 pelo PowerShell do Windows."
  exit 1
fi

# Roda um script no aparelho. Pipe/aspas não sobrevivem ao `vda shell` direto,
# por isso vai como arquivo.
on_device() {
  local f; f=$(mktemp)
  cat > "$f"
  docker cp "$f" "$CONTAINER:/tmp/_probe.sh" >/dev/null
  docker exec "$CONTAINER" bash -c 'export PATH=/root/vega/bin:$PATH
    vega exec vda push /tmp/_probe.sh /tmp/_probe.sh >/dev/null 2>&1
    vega exec vda shell sh /tmp/_probe.sh' 2>&1
  rm -f "$f"
}

PROVIDERS="
Prime_Video|com.amazon.frenchpress.main|/com.amazon.frenchpress.main@IDeeplinks
Netflix|com.netflix.kepler.main|/com.netflix.kepler.module@IMod1
Apple_TV|com.apple.atve.amazon.appletv.main|/com.apple.atve.amazon.appletv@IMod1
Pluto_TV|tv.pluto.android.main|/tv.pluto.android.module@ISomeUri1
YouTube|com.amazon.firetv.youtube.main|/com.amazon.firetv.youtube.module@IMod1
Amazon_Music|com.amazon.music.kepler.main|/com.amazon.music.kepler.module@IAmazonMusicModule1
"

echo "Aparelho: $DEVICE   remetente: $SENDER"

# --- coleta tudo de uma vez (cada ida ao aparelho custa segundos) ------------
SNAP=$(on_device <<'EOF'
echo "@@LAUNCHABLE"
timeout 30 vpm list apps --category=com.amazon.category.main 2>&1
echo "@@MODULES"
timeout 30 vpm list modules 2>&1
EOF
)

LAUNCHABLE=$(printf '%s' "$SNAP" | sed -n '/@@LAUNCHABLE/,/@@MODULES/p')
MODULES=$(printf '%s' "$SNAP" | sed -n '/@@MODULES/,$p')

# --- T1 / T3 -----------------------------------------------------------------
head "T1 — componentes existem e estão em com.amazon.category.main"
while IFS='|' read -r name comp _mod; do
  [ -z "$name" ] && continue
  if printf '%s' "$LAUNCHABLE" | grep -qx "[[:space:]]*$comp"; then
    ok "$name -> $comp"
  else
    no "$name -> $comp ausente (app desinstalado, ou o id mudou)"
  fi
done <<< "$PROVIDERS"

head "T3 — módulos estão no registro do sistema (declaráveis em [[wants.module]])"
while IFS='|' read -r name _comp mod; do
  [ -z "$name" ] && continue
  if printf '%s' "$MODULES" | grep -qF "$mod"; then
    ok "$name -> $mod"
  else
    no "$name -> $mod ausente do registro"
  fi
done <<< "$PROVIDERS"

# --- T2 / T4 / T5 / T6 -------------------------------------------------------
build_access_script() {
  echo "PKG=$SENDER"
  while IFS='|' read -r name _c _m; do
    [ -z "$name" ] && continue
    echo "echo \"@@$name\""
  done <<< "$PROVIDERS"
}

ACCESS=$(
  {
    echo "PKG=$SENDER"
    while IFS='|' read -r name comp _mod; do
      [ -z "$name" ] && continue
      echo "echo '@@P:$name'; timeout 15 vmsgr check-access --package=\$PKG 'pkg://$comp' 2>&1"
    done <<< "$PROVIDERS"
    cat <<'EOS'
echo '@@HTTPS'; timeout 15 vmsgr check-access --package=$PKG 'https://www.netflix.com/title/81234567' 2>&1
echo '@@SCHEME'; timeout 15 vmsgr check-access --package=$PKG 'netflix://' 2>&1
echo '@@STORE'; timeout 15 vmsgr check-access --package=$PKG 'pkg://com.amazon.appstorevegatv.main' 2>&1
EOS
  } | on_device
)

section() { printf '%s' "$ACCESS" | awk -v k="@@$1" '$0==k{f=1;next} /^@@/{f=0} f'; }

head "T2 — provedores aceitam remetente qualquer (sender-privilege \"*\")"
while IFS='|' read -r name _c _m; do
  [ -z "$name" ] && continue
  s=$(section "P:$name")
  if printf '%s' "$s" | grep -q 'Required Sender Privilege(s): \*'; then
    ok "$name aceita sender \"*\""
  elif printf '%s' "$s" | grep -q 'No module found'; then
    no "$name — URI não resolve (app ausente?)"
  else
    no "$name — não publica sender \"*\"; lançar exigiria acordo com o parceiro"
  fi
done <<< "$PROVIDERS"

head "T4 — https:// NÃO abre o app (vai para o navegador)"
s=$(section HTTPS)
if printf '%s' "$s" | grep -q 'assume-default-browser-role'; then
  ok "https://netflix.com cai no navegador, como esperado"
else
  no "comportamento de https:// mudou — reavaliar research/00-viabilidade-portal-vega.md"
fi

head "T5 — esquemas do Fire OS NÃO resolvem"
s=$(section SCHEME)
if printf '%s' "$s" | grep -q 'No module found'; then
  ok "netflix:// não resolve, como esperado"
else
  no "netflix:// passou a resolver — reavaliar a arquitetura de links"
fi

head "T6 — fallback da Appstore passa sem declarar módulo"
s=$(section STORE)
if printf '%s' "$s" | grep -q 'Sender Privilege Check:  \[PASS\]'; then
  ok "pkg://com.amazon.appstorevegatv.main liberado"
else
  no "fallback da Appstore bloqueado"
fi

printf '\n\033[1m%d passou, %d falhou\033[0m\n' "$pass" "$fail"
echo
echo "Lembrete: estes testes provam que os apps-alvo ACEITAM ser abertos."
echo "Que o NOSSO app consegue declarar o módulo e enviar só fecha com"
echo "tests/probe-app (riscos R1 e R2)."
[ "$fail" -eq 0 ]
