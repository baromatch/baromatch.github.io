# Le même dessin : compare deux fichiers de Bricolage Grotesque (l’ancien et le nouveau) avec HarfBuzz, sur chaque
# caractère qu’ils ont tous les deux : le contour et la chasse de chaque glyphe, aux réglages du site (graisses 400 à
# 800, largeurs 82 à 100 %, opsz 16, 72 et 96) et aux bouts des axes ; et le crénage de chaque paire de ces caractères,
# avec et sans chiffres tabulaires, aux réglages que les pages utilisent vraiment.
# Usage : python -I verifier-identite.py <ancien.woff2> <nouveau.woff2>   (fontTools, brotli et uharfbuzz 0.57.0)
# Rend 0 si tout est identique, 1 sinon, en nommant les premiers écarts.
import io
import itertools
import sys

import uharfbuzz as hb
from fontTools.pens.recordingPen import RecordingPen
from fontTools.ttLib import TTFont

if len(sys.argv) != 3:
    sys.exit('Usage : python -I verifier-identite.py <ancien.woff2> <nouveau.woff2>')


def ouvrir(chemin):
    police = TTFont(chemin)
    police.flavor = None
    octets = io.BytesIO()
    police.save(octets)
    return hb.Font(hb.Face(octets.getvalue())), set(police.getBestCmap())


(ancien, ca), (nouveau, cn) = ouvrir(sys.argv[1]), ouvrir(sys.argv[2])
communs = sorted(ca & cn)
print(f'{len(communs)} caractères en commun ; seulement dans l’ancien : {"".join(chr(c) for c in sorted(ca - cn)) or "rien"} ;'
      f' seulement dans le nouveau : {"".join(chr(c) for c in sorted(cn - ca)) or "rien"}')
# Les réglages des pages (graisse, largeur, opsz), relevés dans Chromium le 30 octobre 2026.
REGLAGES = [(400, 100, 16), (500, 100, 16), (600, 100, 16), (650, 100, 16), (700, 100, 16), (750, 100, 16),
            (800, 100, 16), (750, 92, 16), (800, 88, 16), (800, 88, 72), (800, 90, 96), (800, 84, 96), (800, 82, 96)]
GRILLE = list(itertools.product([400, 500, 600, 650, 700, 750, 800], [100, 92, 90, 88, 84, 82], [16, 72, 96]))
GRILLE += [(200, 75, 12), (800, 75, 12), (200, 100, 96), (300, 75, 50)]
ecarts = []


def regler(wght, wdth, opsz):
    for police in (ancien, nouveau):
        police.set_variations({'wght': wght, 'wdth': wdth, 'opsz': opsz})


def dessin(police, glyphe):
    stylo = RecordingPen()
    police.draw_glyph_with_pen(glyphe, stylo)
    return police.get_glyph_h_advance(glyphe), stylo.value


for reglage in GRILLE:
    regler(*reglage)
    for c in communs:
        if dessin(ancien, ancien.get_nominal_glyph(c)) != dessin(nouveau, nouveau.get_nominal_glyph(c)):
            ecarts.append(f'contour ou chasse de « {chr(c)} » à {reglage}')


def positions(police, texte, traits):
    tampon = hb.Buffer()
    tampon.add_str(texte)
    tampon.direction, tampon.script, tampon.language = 'ltr', 'Latn', 'fr'
    hb.shape(police, tampon, traits)
    return [(p.x_advance, p.x_offset, p.y_offset) for p in tampon.glyph_positions]


paires = [chr(a) + chr(b) for a in communs for b in communs]
for reglage in REGLAGES:
    regler(*reglage)
    for traits in ({'kern': True}, {'kern': True, 'tnum': True}):
        for paire in paires:
            if positions(ancien, paire, traits) != positions(nouveau, paire, traits):
                ecarts.append(f'crénage de « {paire} » à {reglage}, {traits}')
print(f'{len(GRILLE)} réglages × {len(communs)} glyphes, {len(REGLAGES)} réglages × 2 × {len(paires)} paires : '
      f'{len(ecarts)} écart(s)')
for ecart in ecarts[:10]:
    print('  ', ecart)
sys.exit(1 if ecarts else 0)
