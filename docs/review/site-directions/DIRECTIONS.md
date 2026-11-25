# L’accueil de baromatch.fr : trois pistes, et la critique à froid

Le 25 novembre 2026. Le diagnostic est dans le dossier voisin, `site-diagnostic`. Les trois pistes sont construites
pour de vrai, sans index, sous `preview/` de cette branche ; rien n’est en ligne et aucune page publiée n’a changé.
Les planches : `planches/comparaison.jpg`, puis une par piste.

## Le brief en cinq lignes

- **Qui** : un fan au téléphone, entre 15:00 et l’avant-match ; un patron de bar ; un journaliste ou un partenaire.
- **Quand** : avant le match, souvent le jour même.
- **Le seul travail de l’accueil** : « je comprends en un coup d’œil, et je laisse mon adresse pour l’ouverture » (le
  patron : « je trouve la porte des bars » ; le journaliste : « je comprends et je trouve le contact »).
- **La preuve** : l’inscription visible et utilisable dans le premier écran ; la page en cinq moments au plus ;
  Lighthouse 98 au téléphone ; les trois visiteurs trouvent leur route sans hésiter.
- **Ce qui reste vrai** : les vrais matchs de la semaine, aucun bar inventé (les images : Alvène et Orvèle), rien qui
  pousse à boire, aucun écusson, les mêmes adresses, rien d’un autre site, jamais de « ! ».

## Ce que les trois pistes partagent

- Une seule action dans le premier écran : l’adresse et « Préviens-moi », le seul ambre de la page (les mêmes champs
  qu’en ligne : l’adresse, la ville, repliée sous « Pour Paris · changer de ville »).
- Cinq moments au plus, un seul système visuel du haut en bas, une seule police (Bricolage, en taille d’œil plus
  basse : moins condensée, moins « affiche de sport »).
- Les vrais matchs de la semaine dessinés, pas listés en liens ; « Tous les matchs, clubs et villes » mène à la page
  des matchs, qui garde les liens pour Google.
- Un pied de page léger : huit adresses fixes, le contact, rien d’autre (356 à 368 px au lieu de 1 708).
- La place des nouveaux insignes : chaque club est posé par le dessin du générateur, à 28, 30, 40 ou 96 px ; le jour
  où les nouveaux insignes arrivent, ils prennent ces places sans rien changer d’autre.

## A · La nuit : l’objet d’abord

**L’idée.** Le sous-bock, l’objet de Baromatch, porte la page comme le produit porte la page d’une grande marque :
une image, une phrase, une action. Toute la page est de nuit.

**Le moment signature.** Deux sous-bocks rendus en vraie 3D (Blender, une seule image fixe de 15 à 22 Ko), sur un
comptoir, le soir. Puis la semaine en piles : un sous-bock par match, aux couleurs du club qui reçoit, une pile par
jour ; on touche une pile pour lire ses matchs.

```
téléphone (390)                       ordinateur (1440)
┌──────────────────────────┐          ┌──────────────────────┬─────────────────────┐
│ Baromatch  Bars À propos │          │ Ton match.           │                     │
│   [ image : 2 sous-bocks ]│          │ Ton bar. Ce soir.    │  [ image : les deux │
│ Ton match.               │          │ phrase               │    sous-bocks, la   │
│ Ton bar. Ce soir.        │          │ [adresse][Préviens]  │    nuit du bar ]    │
│ phrase                   │          └──────────────────────┴─────────────────────┘
│ [adresse    ][Préviens-moi]│        Ce soir : 18:45 en grand (insignes 132 px) | puis 21:00
├──────────────────────────┤          La semaine : 7 piles | la liste du jour touché
│ Ce soir  ◯ 18:45 ◯       │          Garde ta place : le verre qu’on tient
│ puis 21:00, 5 lignes     │          Ton bar passe les matchs ? [Proposer mon bar]
├──────────────────────────┤          pied léger
│ La semaine  ▤ ▤ ▤ ▦ ▦ ▫ ▫ │
├──────────────────────────┤
│ Garde ta place  ( verre ) │
│ Ton bar… [Proposer]       │
└──────────────────────────┘
```

**Les pièces de la marque.** Les sous-bocks, le verre de lumière (le geste « maintiens »), la nuit de l’appli.
**Ce qu’il faudrait.** Rien côté appli ; une image 3D par grand moment si la piste est choisie.
**Ce qu’elle abandonne.** Le jour : c’est revenir sur le choix du propriétaire d’octobre (le site est le jour).

## B · Le programme : l’utile d’abord

**L’idée.** Le jour, blanc et net. La promesse et l’action, puis le programme de ce soir en grands chiffres, la
semaine dessinée, trois vrais écrans de l’appli, les bars.

**Le moment signature.** La semaine sur l’axe des heures : un jour par rangée, chaque match posé à son heure, en deux
petits disques aux couleurs de ses clubs. Le samedi après-midi et les soirs de coupe d’Europe se voient d’un coup d’œil.

```
téléphone (390)                       ordinateur (1440)
┌──────────────────────────┐          ┌──────────────────────┬─────────────────────┐
│ Baromatch  Bars À propos │          │ Ton match.           │ Ce soir   mer. 25   │
│ Ton match.               │          │ Ton bar. Ce soir.    │ 18:45 ◐◑ Sabah–Barça│
│ Ton bar. Ce soir.        │          │ phrase               │ 21:00 ◐◑ Bruges–Liv.│
│ phrase                   │          │ [adresse][Préviens]  │       ◐◑ … (5)      │
│ [adresse    ][Préviens-moi]│        └──────────────────────┴─────────────────────┘
│ ─ Ce soir ─────── mer. 25│          La semaine :      12h 14h 16h 18h 20h 22h
│ 18:45 ◐◑ Sabah – Barça    │                    mer. 25                  ●●  ●●●
│ 21:00 ◐◑ Bruges – Liverpool│                   sam. 28        ●●●● ●●  ●●   ●●●
├──────────────────────────┤          Dans l’appli : 3 écrans encadrés, numérotés
│ La semaine (axe des heures)│        Ton bar… 3 faits, [Proposer mon bar]
│ Dans l’appli ▯ ▯ ▯       │          pied léger
│ Ton bar… [Proposer]       │
└──────────────────────────┘
```

**Les pièces de la marque.** Les insignes, les vrais écrans de l’appli dans leurs cadres (la nuit garde ses moments),
les chiffres en colonnes.
**Ce qu’il faudrait.** Rien de neuf.
**Ce qu’elle abandonne.** L’émotion : pas d’objet, pas de lumière ; le blanc pur remplace le papier chaud.

## C · La salle : l’histoire d’abord

**L’idée.** La salle d’un bar, dessinée, reste à l’écran pendant qu’on descend. La page fait l’heure, de 18:42 au
coup d’envoi : la salle se remplit des deux camps, ta place passe à l’ambre quand tu la gardes, et au coup d’envoi la
salle s’éteint et l’écran s’allume aux couleurs des deux clubs.

**Le moment signature.** « Maintiens · 2 places jusqu’à 21:30 » : le bouton se remplit, et dans la salle, ta place
devient ambre. À 20:55 elle est cochée (tu y es).

```
téléphone (390)                       ordinateur (1440)
┌──────────────────────────┐          ┌───────────────────────────┬────────────────┐
│ Baromatch  Bars À propos │          │                           │ Ton match.     │
│ 18:42 [ la salle, axono- │ ← reste  │ 18:42  [ la salle, grande,│ Ton bar.       │
│        métrie, 42 places]│   à      │         reste à l’écran ] │ Ce soir.       │
│ Exemple                  │   l’écran│                           │ [adresse][Pré.]│
├──────────────────────────┤          │                           │ 19:30 Choisis  │
│ Ton match. Ton bar.      │          │                           │ 20:15 Garde    │
│ Ce soir.  [adresse][Pré.]│          │                           │ 20:55 Tu y es  │
│ 19:30 Choisis ton match  │          │                           │ 21:00 Coup     │
│ 20:15 Garde ta place     │          │                           │  d’envoi, bars │
│ 20:55 Tu y es            │          └───────────────────────────┴────────────────┘
│ 21:00 Cette salle, c’est │
│  peut-être la tienne     │
└──────────────────────────┘
```

**Les pièces de la marque.** La salle qui se remplit (déjà la signature de « Pour les bars »), l’ambre pour ta place,
la lumière du match au coup d’envoi, le geste « maintiens ».
**Ce qu’il faudrait.** Rien côté appli. Pour la finition : la salle mérite d’être rendue avec la même lumière que les
sous-bocks de la piste A (des silhouettes, la lumière de l’écran), toujours en images fixes ou en CSS, jamais en WebGL.
**Ce qu’elle abandonne.** La photo : un dessin est moins spectaculaire qu’un rendu 3D. La semaine n’y est qu’esquissée.

## Les réflexes refusés, et ce qui a été changé

- La carte du match en dégradé aux couleurs des clubs, avec halos : retirée des trois pistes (une couleur de club
  remplit un disque, elle ne décore pas un fond).
- Les titres condensés à 84–88 % : la police garde son seul dessin, en taille d’œil plus basse (moins « affiche »).
- Les cartes blanches identiques, les étapes en cartes numérotées : aucune carte. Seuls les trois écrans de la piste B
  sont numérotés, parce qu’ils sont une suite.
- L’ambre en décoration (liens, pastilles, textes ambre sur bouton noir) : un seul ambre par page, l’action ; plus ta
  place, dans les pistes A et C.

## Les preuves

| | Aujourd’hui | A · La nuit | B · Le programme | C · La salle |
|---|---|---|---|---|
| Accueil au téléphone | 7 796 px · 9,2 écrans | 3 892 px · 4,6 | 3 896 px · 4,6 | 2 946 px · 3,5 |
| Sur ordinateur | 6 990 px | 3 652 px | 3 972 px | 3 865 px |
| Le formulaire | à 2 350 px | à 565 px, 1er écran | à 287 px, 1er écran | à 576 px, 1er écran |
| Pied de page | 1 708 px | 368 px | 356 px | 356 px |
| Appels ambre | 6, pour 3 actions | 1 | 1 | 1 |
| Lighthouse téléphone (même machine) | 75 à 84 | 99 | 99 | 100 |
| Accessibilité (Lighthouse) | 97 | 100 | 100 | 100 |
| Temps de blocage | 610 à 1 220 ms | 0 ms | 0 ms | 0 ms |
| Poids total | 181 Kio | 155 Kio | 217 Kio (écrans compris) | 125 Kio |

- Le SEO des aperçus est bas (54 à 58) parce qu’ils sont exprès en « noindex » ; leurs titres, leur titre unique et
  leurs liens sont en ordre.
- Texte à 200 % : aucune page ne déborde en largeur ; les piles de la piste A défilent de côté quand les jours ne
  tiennent plus ; le pied de page passe sur une colonne.
- « Réduire les animations » : chaque page est complète sans animation ; le geste devient un appui ; la salle de la
  piste C change d’état sans fondu.
- Aucune requête vers un autre site (mesuré au chargement), aucune erreur dans la console, aucun formulaire qui part.
- Pas vérifié ici : un vrai iPhone et un vrai Android, un lecteur d’écran réel (VoiceOver, TalkBack), le temps des
  trois visiteurs chronométré avec de vraies personnes.

## La critique à froid

Trois regards, l’un après l’autre, à partir des captures et des mesures seulement.

**Le fan.** A donne le plus envie au premier regard : un objet, la nuit, une action ; c’est la seule piste qui
ressemble à une grande marque dès la première seconde. C raconte le mieux ce que l’appli fait : on comprend en
descendant, sans lire. B est la plus utile (le match de ce soir est là), mais elle ressemble à un programme, pas à une
envie.

**Le bar et ce qu’il gagne.** C parle directement au patron (« Cette salle, c’est peut-être la tienne ») et lui montre
ce qu’il gagne : une salle qui se remplit, des places gardées. A et B le renvoient vers « Pour les bars » en une ligne.

**La confiance et l’accès.** B est la plus sûre et la plus lisible. A porte le seul vrai risque de la série : la nuit,
un comptoir, des sous-bocks et un verre qui se remplit d’ambre, mis ensemble, peuvent évoquer la boisson ; chaque
pièce est permise, l’ensemble demande une relecture Loi Evin. Dans A et B, les clubs sans fiche d’insigne sont dessinés
à l’encre neutre (vrai, mais la semaine paraît plus sombre qu’elle n’est) : la mission des insignes réglera ça.

| Sur 10 | Le fan | Le bar | Confiance et accès | Total |
|---|---|---|---|---|
| A · La nuit | 8,5 | 7 | 7,5 | 23 |
| B · Le programme | 7,5 | 7 | 8,5 | 23 |
| C · La salle | 8 | 8,5 | 8,5 | 25 |

Les six critères des grands prix du design (plaisir, interaction, innovation, image, inclusion, impact) : aucune piste
n’est encore à 9 partout. C est la plus près en interaction, inclusion et impact ; A en image et en plaisir.

**Le choix.** C, « La salle », avec deux greffes qui tiennent dans sa logique : de A, le sous-bock rendu en 3D, au
moment où ta soirée se colle dans l’album (20:55) ; de B, la semaine dessinée sur l’axe des heures, au moment « Choisis
ton match » (19:30). Pour atteindre la barre : la salle rendue avec la lumière des sous-bocks, des silhouettes plutôt que
des points, puis « Pour les bars », les pages des matchs et la Confidentialité dans le même système.

## Ce qui revient au propriétaire

- **La piste** : C recommandée, A si tu veux la nuit pour tout le site (c’est revenir sur le choix du jour), B si tu
  veux le plus sobre.
- **La relecture Loi Evin** de l’image des sous-bocks sur un comptoir, si elle est gardée (piste A, ou greffée dans C).
- **Les liens des clubs, compétitions et villes** quittent le pied de page de l’accueil pour la page des matchs : à
  vérifier avec le référencement avant la mise en ligne.

La ligne de décision, à reporter après le choix : « Accueil de baromatch.fr : piste … retenue sur planches (25 nov.),
une action dans le premier écran, cinq moments, un pied de page léger ; écartées : … ».
