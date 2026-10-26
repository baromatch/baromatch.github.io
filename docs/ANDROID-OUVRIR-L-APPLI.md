# Ouvrir l’appli depuis un lien baromatch.fr (Android)

Mis à jour le 26 octobre 2026.

## En bref

- Le fichier `https://baromatch.fr/.well-known/assetlinks.json` est **en ligne** depuis le 12 octobre 2026.
  Google le lit sans erreur (vérifié le 26 octobre 2026).
- Son empreinte a été **vérifiée le 26 octobre 2026** : c’est bien celle de la clé qui signe l’appli aujourd’hui.
  **Rien à changer.**
- Si un jour une autre clé signe l’appli (par exemple celle de Google Play), il faudra **ajouter** son empreinte à
  côté de l’actuelle, sans retirer celle-ci.
- Une empreinte **n’est pas un secret** : tu peux la copier dans une conversation sans risque.

## À quoi sert ce fichier

Quand un pote touche un lien `baromatch.fr/t/…` (dans WhatsApp, par SMS…) :

- **il a l’appli** : Android ouvre directement l’invitation dans l’appli, à condition que ce fichier contienne
  l’empreinte de la clé qui a signé l’appli installée sur son téléphone ;
- **il n’a pas l’appli** (ou l’empreinte manque) : le lien s’ouvre dans le navigateur, sur la page de la tablée.
  Sur Android, cette page propose aussi « Ouvrir dans l’appli », pour qui l’a quand même.

Une empreinte, c’est 32 paires de chiffres et de lettres séparées par « : »
(par exemple `7C:26:27:…:8C:F2`). Chaque clé de signature a la sienne.

## Ce qui est en ligne aujourd’hui

| Empreinte | Vérifiée | Pour qui |
|---|---|---|
| `7C:26:27:DF:FB:2B:E5:7F:AC:CC:0D:74:96:DF:2C:BE:DA:FA:CD:75:8C:BD:7F:26:0C:19:6B:83:FC:37:8C:F2` | le 26 octobre 2026 | la clé qui signe l’appli aujourd’hui |

## Ajouter une empreinte

Les étapes pour lire l’empreinte d’une clé ne sont pas écrites ici : ce dépôt est public. Elles t’ont été données
dans la conversation du 26 octobre 2026 ; une mission Claude peut te les redonner.

Quand tu as une nouvelle empreinte, écris dans une conversation Claude sur ce dépôt
(`baromatch/baromatch.github.io`), par exemple :
« Ajoute cette empreinte à assetlinks.json : AB:CD:…:EF ».

Elle s’ajoute **à côté** de l’actuelle, jamais à sa place : les téléphones qui ont l’appli signée par l’ancienne clé
en ont encore besoin. Le site refuse tout ce qui n’est pas une vraie empreinte (un test le vérifie) : jamais de texte
« à remplir » en ligne.

## Vérifier que ça marche

- **Dans un navigateur** : ouvre
  https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://baromatch.fr&relation=delegate_permission/common.handle_all_urls
  La réponse doit citer `fr.baromatch.app` et chaque empreinte du tableau.
- **Sur un téléphone avec l’appli** : Android vérifie le fichier quand l’appli s’installe ou se met à jour. Après un
  changement du fichier, mets l’appli à jour (ou réinstalle-la), puis touche un lien de tablée depuis WhatsApp :
  l’appli doit s’ouvrir directement.
- **Avec un ordinateur et un câble** (facultatif) : `adb shell pm get-app-links fr.baromatch.app` doit dire
  `baromatch.fr: verified`.

## Rien à faire pour l’iPhone

Il n’y a pas d’appli iPhone. Le jour où il y en a une, il faudra un autre fichier (`apple-app-site-association`) :
ce sera une autre mission.

## Pour mémoire : la page d’un lien de tablée

C’est la page que voit un pote qui n’a pas l’appli (`404.html` et `tablee.js`). Elle montre le bar, son adresse, le
match, l’heure du coup d’envoi, l’heure d’arrivée prévue et les places qui restent. **Aucun pseudo**, ni de l’hôte ni
de la tablée. Elle dit qu’on peut venir sans l’appli, puis comment l’avoir : « Deviens testeur » (Android) et « Me
prévenir au lancement ». Sur Android, « Ouvrir dans l’appli » ouvre l’invitation dans l’appli, ou mène à la page des
testeurs si l’appli n’est pas installée.

Le jour où l’appli est en téléchargement public sur Google Play, deux retouches : le texte du bloc « L’appli Baromatch »
dans `404.html`, et `SANS_L_APPLI` dans `tablee.js`, qui doit alors mener à la fiche Google Play de l’appli.
