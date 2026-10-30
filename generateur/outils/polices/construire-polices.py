# Les trois fichiers de Bricolage Grotesque que le site sert (fonts/), refaits à l’octet près.
#
# Mode d’emploi
# 1. La source : le paquet npm @fontsource-variable/bricolage-grotesque 5.3.0, c’est-à-dire Bricolage Grotesque 1.001,
#    les fichiers « latin » et « latin étendu » de Google Fonts, sous licence OFL 1.1 (fonts/LICENSE-OFL.txt).
#      npm pack @fontsource-variable/bricolage-grotesque@5.3.0
#      sha256 de l’archive : 6e99e0d844f7bc152bb3b007f9b1493c53e60cc0744cc681bb744e0b5f14665e
#      tar -xzf fontsource-variable-bricolage-grotesque-5.3.0.tgz        (les polices sont dans package/files)
# 2. Python 3 avec fontTools 4.68.0 et brotli 1.2.1, dans un environnement à part (rien à installer dans le dépôt) :
#      python3 -m venv polices && polices/bin/pip install fonttools==4.68.0 brotli==1.2.1
# 3. polices/bin/python -I generateur/outils/polices/construire-polices.py package/files fonts
#    Écrit les trois fichiers et imprime, pour chacun, son poids, ses caractères et son unicode-range : celles des
#    signes et du latin étendu, et leur réunion avec le cœur (la police de secours), se recopient dans styles.css ;
#    tests/police.spec.mjs vérifie qu’elles disent exactement ce que les fichiers ont.
# 4. Le même dessin qu’avant : verifier-identite.py, dans ce dossier (uharfbuzz 0.57.0 en plus).
#
# Ce que garde chaque fichier
# - Le cœur, préchargé par chaque page : le latin de base, chaque lettre du latin-1 (les noms de clubs), la ponctuation
#   française, l’euro, et ‹ › − ; le crénage (kern) et les chiffres tabulaires (tnum) seulement.
# - Les signes : le reste du fichier latin de Google (½, ±, ¿…), sans les accents seuls (U+0300 à U+036F) ni les
#   caractères invisibles ; le crénage.
# - Le latin étendu : ses lettres de U+0100 à U+017F et Ș ș Ț ț (U+0218 à U+021B), hors du cœur ; sans crénage.
# Les trois axes (graisse, largeur, taille optique) restent entiers : le site s’en sert de 400 à 800, de 82 à 100 %, et à
# opsz 16, 72 et 96. L’horodatage de la source est gardé, pour que deux passages donnent les mêmes octets.
import os
import sys

from fontTools import subset
from fontTools.ttLib import TTFont

if len(sys.argv) != 3:
    sys.exit('Usage : python -I construire-polices.py <dossier des polices du paquet> <dossier de sortie>')
source, sortie = sys.argv[1], sys.argv[2]
LATIN = os.path.join(source, 'bricolage-grotesque-latin-standard-normal.woff2')
ETENDU_SOURCE = os.path.join(source, 'bricolage-grotesque-latin-ext-standard-normal.woff2')


def codes(*morceaux):
    res = set()
    for m in morceaux:
        if isinstance(m, tuple):
            res |= set(range(m[0], m[1] + 1))
        elif isinstance(m, str):
            res |= {ord(c) for c in m}
        else:
            res.add(m)
    return res


def cmap(chemin):
    return set(TTFont(chemin).getBestCmap())


COEUR = codes((0x20, 0x7E), 0xA0, '©«®°·»', (0xC0, 0xFF), 'Œœ', 0x2009, '–—‘’‚“”„•…‹›€™−') - {0xF7}
latin, etendu = cmap(LATIN), cmap(ETENDU_SOURCE)
assert COEUR <= latin, sorted(hex(c) for c in COEUR - latin)
SIGNES = latin - COEUR - codes((0x300, 0x36F), 0x200B, 0xFEFF) - etendu
ETENDU = (etendu & codes((0x100, 0x17F), (0x218, 0x21B))) - COEUR - SIGNES


def reduire(chemin, garder, nom, traits):
    police = TTFont(chemin, recalcTimestamp=False)
    options = subset.Options()
    options.layout_features = traits
    options.flavor = 'woff2'
    reducteur = subset.Subsetter(options)
    reducteur.populate(unicodes=sorted(garder))
    reducteur.subset(police)
    fichier = os.path.join(sortie, f'{nom}.woff2')
    police.save(fichier)
    obtenus = set(police.getBestCmap())
    assert obtenus == garder, (nom, sorted(hex(c) for c in garder ^ obtenus))
    return fichier


def plage(liste):
    liste = sorted(liste)
    morceaux, debut = [], liste[0]
    for avant, apres in zip(liste, liste[1:] + [None]):
        if apres == avant + 1:
            continue
        morceaux.append(f'U+{debut:X}' if debut == avant else f'U+{debut:X}-{avant:X}')
        debut = apres
    return ', '.join(morceaux)


os.makedirs(sortie, exist_ok=True)
for nom, chemin, garder, traits in [('bricolage-grotesque', LATIN, COEUR, ['kern', 'tnum']),
                                    ('bricolage-grotesque-signes', LATIN, SIGNES, ['kern']),
                                    ('bricolage-grotesque-etendu', ETENDU_SOURCE, ETENDU, [])]:
    fichier = reduire(chemin, garder, nom, traits)
    print(f'{nom}.woff2 : {os.path.getsize(fichier)} octets, {len(garder)} caractères')
    print(f'  {"".join(chr(c) for c in sorted(garder))}')
    print(f'  unicode-range: {plage(garder)};')
print('La police de secours (la réunion des trois) :')
print(f'  unicode-range: {plage(COEUR | SIGNES | ETENDU)};')
