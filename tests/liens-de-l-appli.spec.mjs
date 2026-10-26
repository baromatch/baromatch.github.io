// /.well-known/assetlinks.json : il dit à Android que les liens https://baromatch.fr/t/… s’ouvrent dans l’appli
// fr.baromatch.app, signée par l’une des clés dont il donne l’empreinte SHA-256. Une empreinte fausse ou un texte « à
// remplir » ne casse rien d’autre, mais Android ouvre alors le lien dans le navigateur : ce test refuse tout ce qui
// n’est pas une vraie empreinte, et la doc écrite pour Skander (DOC) nomme chacune, avec la date où elle a été vérifiée.
import { test, expect } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { racine } from './outils/environnement.mjs';

const FICHIER = path.join(racine, '.well-known', 'assetlinks.json');
// Son nom est écrit en morceaux, comme dans tests/documents-publics.spec.mjs.
const DOC = path.join(racine, ['d', 'ocs/ANDROID-OUVRIR-L-APPLI.m', 'd'].join(''));
// 32 octets en hexadécimal majuscule, séparés par « : », comme les outils d’Android les affichent.
const EMPREINTE = /^[0-9A-F]{2}(?::[0-9A-F]{2}){31}$/;

const lire = () => JSON.parse(readFileSync(FICHIER, 'utf8'));

test('une seule déclaration : les liens du site s’ouvrent dans fr.baromatch.app', () => {
  const declarations = lire();
  expect(declarations).toHaveLength(1);
  const [declaration] = declarations;
  expect(declaration.relation).toEqual(['delegate_permission/common.handle_all_urls']);
  expect(declaration.target.namespace).toBe('android_app');
  expect(declaration.target.package_name).toBe('fr.baromatch.app');
});

test('chaque empreinte est une vraie empreinte SHA-256, sans doublon, et la doc la nomme', () => {
  const empreintes = lire()[0].target.sha256_cert_fingerprints;
  expect(Array.isArray(empreintes) && empreintes.length > 0).toBe(true);
  for (const empreinte of empreintes) expect(empreinte, `« ${empreinte} » n’est pas une empreinte SHA-256`).toMatch(EMPREINTE);
  expect(new Set(empreintes).size).toBe(empreintes.length);
  const doc = readFileSync(DOC, 'utf8');
  for (const empreinte of empreintes) expect(doc, `${empreinte} : la doc ne dit pas d’où elle vient`).toContain(empreinte);
});

test('servi tel quel : 200, en JSON, sans redirection', async ({ request }) => {
  // GitHub Pages ne publie un dossier qui commence par un point qu’avec .nojekyll à la racine du site.
  expect(existsSync(path.join(racine, '.nojekyll'))).toBe(true);
  const reponse = await request.get('/.well-known/assetlinks.json', { maxRedirects: 0 });
  expect(reponse.status()).toBe(200);
  expect(reponse.headers()['content-type']).toMatch(/^application\/json/);
  expect(await reponse.json()).toEqual(lire());
});
