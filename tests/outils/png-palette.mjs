// Une image opaque réduite à une palette (256 couleurs au plus) et enregistrée en PNG à palette : deux fois plus légère
// qu’une capture du navigateur, sans bandes dans les dégradés (l’écart de chaque pixel est reporté sur ses voisins,
// diffusion de Floyd et Steinberg). Rien d’autre que Node : la palette par coupe médiane, le PNG écrit à la main.
import { crc32, deflateSync } from 'node:zlib';

// La palette : les couleurs de l’image (5 bits par canal) coupées en boîtes de même poids, le long de leur plus grand
// écart, jusqu’à `nombre` boîtes ; chaque couleur de la palette est la moyenne des pixels de sa boîte.
const palette = (rgba, nombre) => {
  const comptes = new Map();
  for (let i = 0; i < rgba.length; i += 4) {
    const cle = ((rgba[i] >> 3) << 10) | ((rgba[i + 1] >> 3) << 5) | (rgba[i + 2] >> 3);
    const vu = comptes.get(cle);
    if (vu) { vu.n += 1; vu.r += rgba[i]; vu.g += rgba[i + 1]; vu.b += rgba[i + 2]; } else comptes.set(cle, { n: 1, r: rgba[i], g: rgba[i + 1], b: rgba[i + 2] });
  }
  const couleurs = [...comptes.values()].map((c) => ({ ...c, c: [c.r / c.n, c.g / c.n, c.b / c.n] }));
  const ecart = (boite) => [0, 1, 2].map((k) => {
    const valeurs = boite.map((c) => c.c[k]);
    return Math.max(...valeurs) - Math.min(...valeurs);
  });
  let boites = [couleurs];
  while (boites.length < nombre) {
    const candidates = boites.filter((b) => b.length > 1);
    if (candidates.length === 0) break;
    const boite = candidates.reduce((a, b) => (Math.max(...ecart(a)) * a.length >= Math.max(...ecart(b)) * b.length ? a : b));
    const ecarts = ecart(boite);
    const axe = ecarts.indexOf(Math.max(...ecarts));
    boite.sort((a, b) => a.c[axe] - b.c[axe]);
    const total = boite.reduce((s, c) => s + c.n, 0);
    let cumul = 0;
    let coupe = 1;
    for (; coupe < boite.length - 1; coupe += 1) {
      cumul += boite[coupe - 1].n;
      if (cumul >= total / 2) break;
    }
    boites = boites.filter((b) => b !== boite).concat([boite.slice(0, coupe), boite.slice(coupe)]);
  }
  return boites.map((b) => {
    const n = b.reduce((s, c) => s + c.n, 0);
    return [0, 1, 2].map((k) => Math.round(b.reduce((s, c) => s + c.c[k] * c.n, 0) / n));
  });
};

// Les pixels rangés dans la palette, avec diffusion de l’écart (Floyd et Steinberg) ; la couleur la plus proche est
// cherchée une fois par teinte (6 bits par canal) puis gardée.
const ranger = (rgba, largeur, hauteur, couleurs) => {
  const indices = new Uint8Array(largeur * hauteur);
  const erreurs = new Float32Array(largeur * hauteur * 3);
  const proches = new Map();
  const plusProche = (r, g, b) => {
    const cle = ((r >> 2) << 12) | ((g >> 2) << 6) | (b >> 2);
    let trouve = proches.get(cle);
    if (trouve === undefined) {
      let meilleure = Infinity;
      couleurs.forEach(([pr, pg, pb], i) => {
        const d = (pr - r) ** 2 + (pg - g) ** 2 + (pb - b) ** 2;
        if (d < meilleure) { meilleure = d; trouve = i; }
      });
      proches.set(cle, trouve);
    }
    return trouve;
  };
  const borne = (v) => (v < 0 ? 0 : v > 255 ? 255 : Math.round(v));
  for (let y = 0; y < hauteur; y += 1) {
    for (let x = 0; x < largeur; x += 1) {
      const p = y * largeur + x;
      const voulu = [0, 1, 2].map((k) => borne(rgba[p * 4 + k] + erreurs[p * 3 + k]));
      const i = plusProche(...voulu);
      indices[p] = i;
      for (let k = 0; k < 3; k += 1) {
        const ecart = voulu[k] - couleurs[i][k];
        if (x + 1 < largeur) erreurs[(p + 1) * 3 + k] += (ecart * 7) / 16;
        if (y + 1 < hauteur) {
          if (x > 0) erreurs[(p + largeur - 1) * 3 + k] += (ecart * 3) / 16;
          erreurs[(p + largeur) * 3 + k] += (ecart * 5) / 16;
          if (x + 1 < largeur) erreurs[(p + largeur + 1) * 3 + k] += ecart / 16;
        }
      }
    }
  }
  return indices;
};

const morceau = (type, donnees) => {
  const longueur = Buffer.alloc(4);
  longueur.writeUInt32BE(donnees.length);
  const typeEtDonnees = Buffer.concat([Buffer.from(type, 'ascii'), donnees]);
  const controle = Buffer.alloc(4);
  controle.writeUInt32BE(crc32(typeEtDonnees));
  return Buffer.concat([longueur, typeEtDonnees, controle]);
};

// rgba : les pixels (4 octets chacun, l’opacité est ignorée : l’image est opaque). Rend le fichier PNG.
export const pngAPalette = (rgba, largeur, hauteur, nombre = 256) => {
  const couleurs = palette(rgba, nombre);
  const indices = ranger(rgba, largeur, hauteur, couleurs);
  const lignes = Buffer.alloc((largeur + 1) * hauteur);
  for (let y = 0; y < hauteur; y += 1) {
    lignes[y * (largeur + 1)] = 0; // pas de filtre : le meilleur pour une image à palette
    lignes.set(indices.subarray(y * largeur, (y + 1) * largeur), y * (largeur + 1) + 1);
  }
  const entete = Buffer.alloc(13);
  entete.writeUInt32BE(largeur, 0);
  entete.writeUInt32BE(hauteur, 4);
  entete.set([8, 3, 0, 0, 0], 8); // 8 bits, palette, compression, filtre et entrelacement standard
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    morceau('IHDR', entete),
    morceau('PLTE', Buffer.from(couleurs.flat())),
    morceau('IDAT', deflateSync(lignes, { level: 9 })),
    morceau('IEND', Buffer.alloc(0)),
  ]);
};
