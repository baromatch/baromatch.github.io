// La typographie française des pages générées (gabarits.mjs, insecables) : une espace insécable à l’intérieur des
// guillemets « », et avant « : », « ; », « ? » et « ! », dans tout texte en français que le générateur écrit (les
// textes de generateur/contenu : agenda, partage, affiche, clubs, textes ; les noms venus des données), pages et
// agendas compris. Les images de partage aussi, mesurées avec l’espace insécable de la police. Et la page
// Confidentialité, écrite à la main.
import { test, expect } from '@playwright/test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { racine } from './outils/environnement.mjs';
import { CAPTURE, contenuDuScenario, MAINTENANT_DE_LA_CAPTURE, MAINTENANT_DU_SCENARIO, SCENARIO } from './outils/site-genere.mjs';
import { chargerLeContenu } from '../generateur/contenu.mjs';
import { construire } from '../generateur/construire.mjs';
import { insecables } from '../generateur/gabarits.mjs';
import { lesPolices, lignesDeLaCarte, svgDeLaCarte } from '../generateur/partage.mjs';
import { chargerLeQr } from '../generateur/qr.mjs';

const { qr } = chargerLeQr();
// Une espace ordinaire là où la typographie française veut une insécable.
const FAUTE = /« | »| [:;?!]/;
// Le texte qu’on lit : sans les balises, ni le contenu des scripts (les données structurées gardent leurs propres
// textes, vérifiés à part), ni les commentaires.
const lisible = (html) => html.replace(/<!--[\s\S]*?-->/g, '').replace(/<script\b[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, '');

const dossiers = [];
test.afterAll(() => { for (const d of dossiers) rmSync(d, { recursive: true, force: true }); });

test('l’espace insécable : dans les guillemets, avant « : ; ? ! »', () => {
  expect(insecables('Touche « S’abonner » : c’est fait ; prêt ? Oui !')).toBe('Touche « S’abonner » : c’est fait ; prêt ? Oui !');
  // Ni un commentaire HTML ni une adresse ne changent.
  expect(insecables('<!-- note --> https://baromatch.fr/?a=1')).toBe('<!-- note --> https://baromatch.fr/?a=1');
});

for (const [nom, source, maintenant, contenu] of [
  ['le scénario', `scenario:${SCENARIO}`, MAINTENANT_DU_SCENARIO, contenuDuScenario()],
  ['la capture', `capture:${CAPTURE}`, MAINTENANT_DE_LA_CAPTURE, chargerLeContenu(racine)],
]) {
  test(`aucune page ni aucun agenda en français n’a d’espace ordinaire autour des guillemets ou avant : ; ? ! (${nom})`, async () => {
    const sortie = mkdtempSync(path.join(tmpdir(), 'typographie-'));
    dossiers.push(sortie);
    const { fichiers } = await construire({ source, sortie, maintenant, racine, contenu, rendu: null, qr });
    const francais = fichiers.filter((f) => typeof f.contenu === 'string' && (f.chemin.endsWith('/') || f.chemin.endsWith('.ics')) && !f.chemin.startsWith('/en/'));
    expect(francais.length).toBeGreaterThan(10);
    expect(francais.some((f) => f.contenu.includes('« S’abonner »'))).toBe(true);
    const fautes = francais.flatMap((f) => {
      // Un agenda se lit déplié (RFC 5545 : une ligne longue continue après un retour et une espace).
      const texte = f.chemin.endsWith('.ics') ? f.contenu.replace(/\r\n[ \t]/g, '') : lisible(f.contenu);
      const trouve = texte.match(new RegExp(`.{0,30}(?:${FAUTE.source}).{0,10}`, 'g')) ?? [];
      // Dans la tête : le titre, la description et les textes des aperçus.
      const tete = [...f.contenu.matchAll(/<(?:title)>([^<]*)<|content="([^"]*)"/g)].map((m) => m[1] ?? m[2]).filter((t) => FAUTE.test(t));
      return [...trouve, ...tete].map((t) => `${f.chemin} : « ${t} »`);
    });
    expect(fautes).toEqual([]);
  });
}

test('les images de partage : l’insécable avant « : », mesurée comme une espace par la police', () => {
  const ville = { nom: 'Paris', bars: [{}], soirees: [{ match: { domicile: { court: 'PSG' }, exterieur: { court: 'OL' }, debut: Date.parse('2026-10-25T19:45:00Z') } }] };
  const carte = lignesDeLaCarte({ sorte: 'ville', ville });
  expect(carte.ambre).toBe('Prochaine soirée : PSG – OL, dimanche 25 octobre');
  const { texte } = lesPolices();
  expect(texte.couvrir(carte.ambre)).toBe(carte.ambre);
  expect(texte.largeur(' ', 40)).toBe(texte.largeur(' ', 40));
  expect(svgDeLaCarte(carte, { verre: '<svg viewBox="0 0 200 200"></svg>' })).toContain('Prochaine soirée : PSG – OL');
});

test('la page Confidentialité : aucune espace ordinaire dans ses guillemets, commentaires compris', () => {
  const page = readFileSync(path.join(racine, 'confidentialite.html'), 'utf8');
  expect(page.match(/.{0,40}(?:« | »).{0,10}/g) ?? []).toEqual([]);
});

test('la page « Deviens testeur Android » : une espace insécable dans les guillemets, avant « : ; ? ! », dans le texte qu’on lit', () => {
  const page = readFileSync(path.join(racine, 'testeurs-android.html'), 'utf8');
  // Le contenu de la page, sans le pied de page commun (le même sur toutes les pages, gabarits.mjs).
  const corps = page.slice(page.indexOf('<main'), page.indexOf('</main>'));
  expect(lisible(corps).match(new RegExp(`.{0,30}(?:${FAUTE.source}).{0,10}`, 'g')) ?? []).toEqual([]);
});
