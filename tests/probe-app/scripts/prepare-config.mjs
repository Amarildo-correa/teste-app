/**
 * Garante que `src/config/tmdbKey.ts` exista antes de qualquer build.
 *
 * O arquivo e ignorado pelo git porque carrega a chave do TMDB. Sem este
 * script, um clone novo quebraria no `tsc` com "cannot find module" — o tipo
 * de erro que faz alguem commitar o segredo "so para destravar".
 *
 * Nunca sobrescreve um arquivo existente: rodar duas vezes nao apaga chave
 * de ninguem.
 */
import {copyFileSync, existsSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const target = resolve(here, '../src/config/tmdbKey.ts');
const template = resolve(here, '../src/config/tmdbKey.example.ts');

if (existsSync(target)) {
  console.log('prepare-config: src/config/tmdbKey.ts ja existe, nada a fazer');
  process.exit(0);
}

if (!existsSync(template)) {
  console.error('prepare-config: falta src/config/tmdbKey.example.ts');
  process.exit(1);
}

copyFileSync(template, target);
console.log(
  'prepare-config: criado src/config/tmdbKey.ts a partir do modelo (chave vazia).\n' +
    '  Ponha a sua chave do TMDB nele; sem ela os trilhos ficam em esqueleto.',
);
