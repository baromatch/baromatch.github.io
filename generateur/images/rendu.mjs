// Le rendu des images de partage : un SVG (generateur/partage.mjs) devient un PNG de 1200 × 630, avec les polices
// de generateur/images/polices et elles seules (aucune police du système : la même image partout).
// La bibliothèque (@resvg/resvg-js, version exacte dans package.json, à côté) n’est installée que par l’Action
// (npm ci dans ce dossier) : rien n’en est servi aux visiteurs. Sans elle, chargerLeRendu rend null avec la raison, et
// le générateur garde l’image générale du site sur chaque page.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pngOpaque } from './png.mjs';

const ICI = path.dirname(fileURLToPath(import.meta.url));

export const chargerLeRendu = async ({ polices }) => {
  let Resvg;
  let version;
  try {
    const exiger = createRequire(path.join(ICI, 'package.json'));
    ({ Resvg } = exiger('@resvg/resvg-js'));
    version = JSON.parse(readFileSync(exiger.resolve('@resvg/resvg-js/package.json'), 'utf8')).version;
  } catch (erreur) {
    return { rendu: null, raison: `le rendu des images n’est pas installé (cd generateur/images && npm ci) : ${erreur.code ?? erreur.message}` };
  }
  const fichiers = polices.map((p) => p.fichier);
  // La signature du rendu : la bibliothèque, les polices et ce code. Elle entre dans l’empreinte de chaque image : une
  // autre version, une police ou un rendu retouchés, et chaque image est refaite.
  const sources = [...fichiers, fileURLToPath(import.meta.url), path.join(ICI, 'png.mjs')].map((f) => readFileSync(f));
  const signature = `resvg-js ${version} ${createHash('sha256').update(Buffer.concat(sources)).digest('base64url').slice(0, 16)}`;
  return {
    raison: null,
    rendu: {
      signature,
      // Le rendu, puis le PNG réécrit par png.mjs (le même dessin, plus léger).
      rendre: (svg) => {
        const image = new Resvg(svg, {
          font: { fontFiles: fichiers, loadSystemFonts: false, defaultFontFamily: polices.at(-1).famille },
          fitTo: { mode: 'original' },
          shapeRendering: 2,
          textRendering: 1,
        }).render();
        return pngOpaque(image.pixels, image.width, image.height);
      },
    },
  };
};
