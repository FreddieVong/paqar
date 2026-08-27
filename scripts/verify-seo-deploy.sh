#!/usr/bin/env bash
#
# Post-deploy check for the SEO/GEO change (be2831e). Run against PRODUCTION,
# a couple of minutes after Vercel reports the deploy green:
#
#     bash scripts/verify-seo-deploy.sh
#
# Distinct from scripts/seo-check.mjs, which inspects LOCAL build output before
# a deploy. This asserts on what the live site actually serves, because two of
# the things it checks — the add-on gate and the numeric coercion — depend on
# the production environment and cannot be proven from a local build.
#
# Every claim here was false in production on 2026-08-27 and is the reason the
# corresponding line of code exists.
ok=0; bad=0
chk() { # name | expected | actual
  if [ "$2" = "$3" ]; then printf '  \033[32mPASS\033[0m  %s\n' "$1"; ok=$((ok+1))
  else printf '  \033[31mFAIL\033[0m  %s\n        expected: %s\n        got:      %s\n' "$1" "$2" "$3"; bad=$((bad+1)); fi
}
echo "Checking https://paqar.my …"; echo

chk "llms.txt no longer denies selling the add-on" \
    "0" "$(curl -s https://paqar.my/llms.txt | grep -c 'does not currently sell')"

chk "llms.txt states the two-payment structure" \
    "1" "$(curl -s https://paqar.my/llms.txt | grep -c 'TWO SEPARATE PRODUCTS')"

chk "llms.txt names the operating company" \
    "1" "$(curl -s https://paqar.my/llms.txt | grep -c 'Operated by TENTEC SDN BHD')"

chk "report page advertises the real price to Google" \
    '"price":"29"' \
    "$(curl -s https://paqar.my/laporan-pembeli-kereta-terpakai | grep -o '\"price\":\"[0-9]*\"' | head -1)"

chk "valuation API labels its fallback" \
    '"matchedBy":"make_year_model"' \
    "$(curl -s 'https://paqar.my/api/v1/valuation?nvic=X&make=Honda&year=2020&model=City' | grep -o '\"matchedBy\":\"[^\"]*\"')"

chk "wmNewPrice is a number, not a string" \
    "number" \
    "$(curl -s 'https://paqar.my/api/v1/valuation?nvic=X&make=Honda&year=2020&model=City' | python3 -c 'import json,sys;print(type(json.load(sys.stdin)["wmNewPrice"]).__name__.replace("int","number").replace("float","number"))' 2>/dev/null)"

chk "guides declare they were revised" \
    '"dateModified":"2026-08-27"' \
    "$(curl -s https://paqar.my/faq/roadtax-by-state | grep -o '\"dateModified\":\"[^\"]*\"' | head -1)"

chk "no free price check in the hub description" \
    "0" "$(curl -s https://paqar.my/harga-kereta-terpakai | grep -c 'Semak harga percuma')"

echo; if [ $bad -eq 0 ]; then printf '\033[32m✓ all %d checks passed — deploy is live and correct\033[0m\n' $ok
else printf '\033[31m✗ %d of %d failed\033[0m — if only the llms.txt ones failed, JOMCHECK_ENABLED is not true in Vercel\n' $bad $((ok+bad)); fi
