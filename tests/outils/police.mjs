// Ce que la police sait dessiner, lu dans ses fichiers, sans dépendance : les caractères de chaque fichier woff2 de
// fonts/ (sa table cmap) et, dans styles.css, les @font-face de Bricolage Grotesque (fichier et unicode-range).
// Un woff2 : un en-tête, la liste de ses tables, puis toutes les tables compressées ensemble en brotli, bout à bout
// (https://www.w3.org/TR/WOFF2/). La table cmap n’est jamais transformée : on la lit telle quelle.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { brotliDecompressSync } from 'node:zlib';
import { racine } from './environnement.mjs';

// Les tables connues de woff2, dans l’ordre de la norme (un drapeau de 0 à 62 les nomme sans écrire leur nom).
const TABLES = ['cmap', 'head', 'hhea', 'hmtx', 'maxp', 'name', 'OS/2', 'post', 'cvt ', 'fpgm', 'glyf', 'loca', 'prep',
  'CFF ', 'VORG', 'EBDT', 'EBLC', 'gasp', 'hdmx', 'kern', 'LTSH', 'PCLT', 'VDMX', 'vhea', 'vmtx', 'BASE', 'GDEF', 'GPOS',
  'GSUB', 'EBSC', 'JSTF', 'MATH', 'CBDT', 'CBLC', 'COLR', 'CPAL', 'SVG ', 'sbix', 'acnt', 'avar', 'bdat', 'bloc', 'bsln',
  'cvar', 'fdsc', 'feat', 'fmtx', 'fvar', 'gvar', 'hsty', 'just', 'lcar', 'mort', 'morx', 'opbd', 'prop', 'trak', 'Zapf',
  'Silf', 'Glat', 'Gloc', 'Feat', 'Sill'];

// Un entier UIntBase128 (de 1 à 5 octets) : rend [valeur, position suivante].
const base128 = (octets, position) => {
  let valeur = 0;
  for (let i = 0; i < 5; i += 1) {
    const octet = octets[position + i];
    valeur = valeur * 128 + (octet & 0x7f);
    if (!(octet & 0x80)) return [valeur, position + i + 1];
  }
  throw new Error('woff2 : un entier UIntBase128 de plus de 5 octets');
};

// Les tables d’un fichier woff2 décompressé : { étiquette: Buffer }.
export const tablesDuWoff2 = (fichier) => {
  const octets = readFileSync(fichier);
  if (octets.toString('latin1', 0, 4) !== 'wOF2') throw new Error(`${fichier} : pas un fichier woff2`);
  const nombre = octets.readUInt16BE(12);
  const compresse = octets.readUInt32BE(20);
  let position = 48;
  const liste = [];
  for (let i = 0; i < nombre; i += 1) {
    const drapeau = octets[position];
    position += 1;
    let etiquette = TABLES[drapeau & 0x3f];
    if ((drapeau & 0x3f) === 63) {
      etiquette = octets.toString('latin1', position, position + 4);
      position += 4;
    }
    const version = drapeau >> 6;
    let longueur;
    [longueur, position] = base128(octets, position);
    // glyf et loca sont transformés à la version 0 ; les autres tables, à toute version sauf 0.
    const transformee = ['glyf', 'loca'].includes(etiquette) ? version === 0 : version !== 0;
    if (transformee) [longueur, position] = base128(octets, position);
    liste.push({ etiquette, longueur });
  }
  const donnees = brotliDecompressSync(octets.subarray(position, position + compresse));
  const tables = {};
  let debut = 0;
  for (const { etiquette, longueur } of liste) {
    tables[etiquette] = donnees.subarray(debut, debut + longueur);
    debut += longueur;
  }
  return tables;
};

// Les caractères (points de code) qu’une table cmap relie à un glyphe : ses sous-tables Unicode, formats 4 et 12.
export const caracteresDeLaCmap = (cmap) => {
  const codes = new Set();
  const nombre = cmap.readUInt16BE(2);
  for (let i = 0; i < nombre; i += 1) {
    const plateforme = cmap.readUInt16BE(4 + i * 8);
    const codage = cmap.readUInt16BE(6 + i * 8);
    if (!(plateforme === 0 || (plateforme === 3 && (codage === 1 || codage === 10)))) continue;
    const t = cmap.subarray(cmap.readUInt32BE(8 + i * 8));
    const format = t.readUInt16BE(0);
    if (format === 4) {
      const segments = t.readUInt16BE(6) / 2;
      const fins = 14;
      const debuts = fins + segments * 2 + 2;
      const deltas = debuts + segments * 2;
      const decalages = deltas + segments * 2;
      for (let s = 0; s < segments; s += 1) {
        const fin = t.readUInt16BE(fins + s * 2);
        const debut = t.readUInt16BE(debuts + s * 2);
        const delta = t.readInt16BE(deltas + s * 2);
        const decalage = t.readUInt16BE(decalages + s * 2);
        for (let code = debut; code <= fin && code !== 0xffff; code += 1) {
          let glyphe;
          if (decalage === 0) glyphe = (code + delta) & 0xffff;
          else {
            const ici = decalages + s * 2 + decalage + (code - debut) * 2;
            glyphe = t.readUInt16BE(ici);
            if (glyphe !== 0) glyphe = (glyphe + delta) & 0xffff;
          }
          if (glyphe !== 0) codes.add(code);
        }
      }
    } else if (format === 12) {
      const groupes = t.readUInt32BE(12);
      for (let g = 0; g < groupes; g += 1) {
        const debut = t.readUInt32BE(16 + g * 12);
        const fin = t.readUInt32BE(20 + g * 12);
        const premier = t.readUInt32BE(24 + g * 12);
        for (let code = debut; code <= fin; code += 1) if (premier + (code - debut) !== 0) codes.add(code);
      }
    }
  }
  return codes;
};

export const caracteresDuFichier = (fichier) => caracteresDeLaCmap(tablesDuWoff2(fichier).cmap);

// « U+A1-A3, U+131 » → [[0xA1, 0xA3], [0x131, 0x131]].
const lirePlages = (texte) => texte.split(',').map((morceau) => {
  const m = /^\s*U\+([0-9A-F]+)(?:-([0-9A-F]+))?\s*$/i.exec(morceau);
  if (!m) throw new Error(`unicode-range illisible : « ${morceau} »`);
  return [parseInt(m[1], 16), parseInt(m[2] ?? m[1], 16)];
});

// Les @font-face de styles.css, dans leur ordre : { famille, fichier (le woff2, ou rien pour une police locale), plages
// (null : tout), dans(code) }.
export const lireLesFaces = (feuille = readFileSync(path.join(racine, 'styles.css'), 'utf8')) => [...feuille.matchAll(/@font-face\s*\{([^}]*)\}/g)]
  .map(([, corps]) => {
    const famille = /font-family:\s*"([^"]+)"/.exec(corps)?.[1];
    const fichier = /url\("([^"]+\.woff2)"\)/.exec(corps)?.[1];
    const plage = /unicode-range:\s*([^;]+);/.exec(corps)?.[1];
    const plages = plage ? lirePlages(plage) : null;
    return { famille, fichier, plages, dans: (code) => !plages || plages.some(([a, b]) => code >= a && code <= b) };
  });

// Celles de Bricolage Grotesque, ses trois fichiers.
export const facesDeBricolage = (feuille) => lireLesFaces(feuille).filter((face) => face.famille === 'Bricolage Grotesque');

// La face que le navigateur essaie d’abord pour un caractère : la dernière déclarée dont l’unicode-range le contient.
// Elle doit avoir le caractère ; sinon le navigateur charge son fichier pour rien avant d’essayer la suivante.
export const premiereFace = (faces) => (code) => [...faces].reverse().find((face) => face.dans(code)) ?? null;
