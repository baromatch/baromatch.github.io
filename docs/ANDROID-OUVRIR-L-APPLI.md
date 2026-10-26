# Ouvrir l’appli depuis un lien baromatch.fr (Android)

Mis à jour le 26 octobre 2026.

## En bref

- Le fichier `https://baromatch.fr/.well-known/assetlinks.json` est **déjà en ligne** (depuis le 12 octobre 2026),
  avec une empreinte. Google le lit sans erreur (vérifié le 26 octobre 2026).
- **Il te reste deux vérifications** : que cette empreinte est bien celle d’expo.dev, puis, après le premier envoi sur
  Google Play, celle de la Play Console. Si l’une est différente, tu me la donnes et je l’ajoute.
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

| Empreinte | D’où elle vient | Pour qui |
|---|---|---|
| `7C:26:27:DF:FB:2B:E5:7F:AC:CC:0D:74:96:DF:2C:BE:DA:FA:CD:75:8C:BD:7F:26:0C:19:6B:83:FC:37:8C:F2` | posée le 12 octobre 2026 ; **à confirmer** : ce doit être celle d’expo.dev | l’appli des testeurs (l’APK) |

## Ce que tu dois faire

### 1. Vérifier l’empreinte d’expo.dev (5 minutes, maintenant)

1. Va sur https://expo.dev et connecte-toi.
2. Ouvre le projet Baromatch, puis **Credentials** (dans le menu de gauche).
3. Choisis **Android**, puis `fr.baromatch.app`, puis la clé (**Keystore**) du profil de build.
4. Note la ligne **SHA-256 Fingerprint**.
5. Compare-la avec celle du tableau ci-dessus :
   - **identique** : rien à faire ;
   - **différente** : envoie-la-moi (la ligne entière).

### 2. Après le premier envoi sur Google Play (5 minutes)

1. Play Console → Baromatch → **Tester et publier** → **Configuration** → **Intégrité de l’appli** →
   **Signature d’applications**.
2. Note le SHA-256 du **« Certificat de la clé de signature d’application »**.
   Attention : la même page montre aussi le certificat de la **clé d’importation** ; ce n’est pas celui-là.
3. Compare-le avec celui d’expo.dev :
   - **identique** (au premier envoi, tu as donné à Google la clé d’expo.dev, le choix conseillé) : rien à faire ;
   - **différent** (Google a créé sa propre clé) : envoie-le-moi. Je l’ajoute **à côté** de celui d’expo.dev, sans
     retirer ce dernier : les testeurs qui gardent l’APK en ont encore besoin.

### Comment me donner une empreinte

Dans une conversation Claude sur ce dépôt (`baromatch/baromatch.github.io`), écris par exemple :
« Ajoute cette empreinte à assetlinks.json : AB:CD:…:EF (Play Console, clé de signature d’application) ».

Le site refuse tout ce qui n’est pas une vraie empreinte (un test le vérifie) : jamais de texte « à remplir » en ligne.

## Vérifier que ça marche

- **Dans un navigateur** : ouvre
  https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://baromatch.fr&relation=delegate_permission/common.handle_all_urls
  La réponse doit citer `fr.baromatch.app` et chaque empreinte du tableau.
- **Sur un téléphone avec l’appli** : Android vérifie le fichier quand l’appli s’installe ou se met à jour. Après un
  changement du fichier, mets l’appli à jour (ou réinstalle-la), puis touche un lien de tablée depuis WhatsApp :
  l’appli doit s’ouvrir directement.
- **Avec un ordinateur et un câble** (facultatif) : `adb shell pm get-app-links fr.baromatch.app` doit dire
  `baromatch.fr: verified`.

## Rien à faire pour

- **L’iPhone** : il n’y a pas d’appli iPhone. Le jour où il y en a une, il faudra un autre fichier
  (`apple-app-site-association`) : ce sera une autre mission.
- **www.baromatch.fr** : l’appli ne connaît que `baromatch.fr`, et le site renvoie toujours vers `https://baromatch.fr`.

## Pour mémoire : la page d’un lien de tablée

C’est la page que voit un pote qui n’a pas l’appli (`404.html` et `tablee.js`). Elle montre le bar, son adresse, le
match, l’heure du coup d’envoi, l’heure d’arrivée prévue et les places qui restent. **Aucun pseudo**, ni de l’hôte ni
de la tablée. Elle dit qu’on peut venir sans l’appli, puis comment l’avoir : « Deviens testeur » (Android) et « Me
prévenir au lancement ». Sur Android, « Ouvrir dans l’appli » ouvre l’invitation dans l’appli, ou mène à la page des
testeurs si l’appli n’est pas installée.

Le jour où l’appli est en téléchargement public sur Google Play, deux retouches : le texte du bloc « L’appli Baromatch »
dans `404.html`, et `SANS_L_APPLI` dans `tablee.js`, qui doit alors mener à la fiche Google Play de l’appli.
