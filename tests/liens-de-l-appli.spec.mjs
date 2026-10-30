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

// ---------- L’iPhone ----------
// /.well-known/apple-app-site-association (sans extension : c’est le nom qu’Apple lit) dit à l’iPhone que les mêmes
// liens https://baromatch.fr/t/… s’ouvrent dans l’appli fr.baromatch.app du compte de développeur Apple qu’il nomme
// par son identifiant (le Team ID). Un identifiant faux ou un texte « à remplir » ne casse rien d’autre, mais l’iPhone
// ouvre alors le lien dans le navigateur : ce test refuse tout ce qui n’a pas la forme d’un vrai Team ID, et la doc
// (DOC) le nomme, avec l’endroit et la date où il a été lu.
const FICHIER_IPHONE = path.join(racine, '.well-known', 'apple-app-site-association');
// Le Team ID (10 capitales ou chiffres), un point, puis l’appli : un texte à remplir à sa place n’en a pas la forme.
const IDENTIFIANT = /^[A-Z0-9]{10}\.fr\.baromatch\.app$/;

const lireIphone = () => JSON.parse(readFileSync(FICHIER_IPHONE, 'utf8'));

test('iPhone : une seule entrée, pour fr.baromatch.app et un vrai Team ID, que la doc nomme', () => {
  const association = lireIphone();
  expect(Object.keys(association)).toEqual(['applinks']);
  const { details } = association.applinks;
  expect(details).toHaveLength(1);
  const { appIDs } = details[0];
  expect(appIDs, 'un seul identifiant : un vrai Team ID, puis fr.baromatch.app').toEqual([expect.stringMatching(IDENTIFIANT)]);
  // L’identifiant entier, Team ID compris : c’est ce que la doc dit de lire chez Apple pour vérifier.
  const [appId] = appIDs;
  expect(readFileSync(DOC, 'utf8'), `${appId} : la doc ne dit pas d’où vient ce Team ID`).toContain(appId);
});

test('iPhone : seuls les liens de tablée, /t/…, s’ouvrent dans l’appli', () => {
  const { components } = lireIphone().applinks.details[0];
  // Comme sur Android : rien d’autre du site ne s’ouvre dans l’appli, et ce chemin-là n’est pas exclu.
  expect(components.map((composant) => composant['/'])).toEqual(['/t/*']);
  expect(components.filter((composant) => composant.exclude)).toEqual([]);
});

test('iPhone : servi tel quel, 200, sans redirection, le fichier exact', async ({ request }) => {
  expect(existsSync(path.join(racine, '.nojekyll'))).toBe(true);
  const reponse = await request.get('/.well-known/apple-app-site-association', { maxRedirects: 0 });
  expect(reponse.status()).toBe(200);
  // Pas de type exigé ici, contrairement à assetlinks.json : un fichier sans extension part en
  // application/octet-stream, du serveur local comme de GitHub Pages, et le CDN d’Apple, qui lit le fichier pour les
  // iPhone, l’accepte ainsi.
  expect(await reponse.text()).toBe(readFileSync(FICHIER_IPHONE, 'utf8'));
});
