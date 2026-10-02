# MyClimb

App Android pour trouver les salles de bloc autour de soi et garder une trace de chaque bloc grimpé.

- **Salles** : salles d'escalade autour de ta position, triées par temps de trajet à pied, en transports ou en voiture (Google Places et Routes). Fiche salle avec trajet sur la carte, horaires et bouton « Y aller ».
- **Blocs** : chaque bloc est relié à une salle, avec photo, couleur des prises, cotation (Fontainebleau ou échelle V), styles, résultat et note. Tout est stocké sur le téléphone (SQLite).

## Installer l'app

Chaque push sur `main` fabrique un APK (GitHub Actions) et le publie dans les **Releases** du dépôt.
Sur le téléphone : ouvre la dernière release, télécharge `MyClimb-vX.apk` et installe-le
(autorise l'installation depuis le navigateur si Android le demande). Les nouvelles versions s'installent par-dessus l'ancienne sans perdre les blocs.

## Clé Google Maps

La clé n'est jamais dans le code. Elle vient de la variable `GOOGLE_MAPS_API_KEY` :
- sur GitHub : secret du dépôt `GOOGLE_MAPS_API_KEY` (Settings > Secrets and variables > Actions) ;
- en local : fichier `.env` (ignoré par git).

API à activer sur la clé : Places API (New), Routes API, Maps SDK for Android.
Pour la restreindre à l'app : nom de paquet `com.clementledo.myclimb` + empreinte SHA-1 de la clé de signature.

## Signature de l'APK

Secrets optionnels `MYCLIMB_KEYSTORE_BASE64` (keystore encodé en base64, alias `myclimb`) et
`MYCLIMB_KEYSTORE_PASSWORD`. Sans eux, l'APK est signé avec la clé de débogage fournie par le modèle Expo :
elle reste la même d'une fabrication à l'autre (les mises à jour s'installent par-dessus), mais elle est publique.
Changer de clé plus tard oblige à désinstaller l'app une fois, ce qui efface les blocs.

## Développer

```bash
npm install
npm run typecheck
npm run lint
```
