# Guide pas-à-pas : déployer l'API sur Railway (avec captures d'écran)

Ce guide montre comment déployer le dossier `server/` contenant l'API Flask + `yt-dlp` sur Railway, en utilisant Docker (pour inclure `ffmpeg`). Les étapes incluent les endroits où prendre des captures d'écran pour la documentation.

---

## Prérequis
- Compte sur https://railway.app
- Repo GitHub contenant votre projet (ou vous pouvez importer le repo dans Railway).
- Dockerfile (fourni dans `server/`) qui installe `ffmpeg` (déjà préparé dans ce dépôt).

---

## Étapes (UI Web, avec captures à faire)

1) Importer le dépôt
- Ouvrez Railway → "New Project" → "Deploy from GitHub".
- Sélectionnez le repository contenant votre projet.

**Capture #1** : page "Select Repository" (fichier : `screenshots/railway-01-select-repo.png`)

2) Configurer le service
- Railway détecte le dossier racine ; choisissez le dossier `server` comme service à déployer.
- Choisissez "Docker" comme méthode de build (ou laissez Railway détecter automatiquement si Dockerfile présent).

**Capture #2** : page de configuration du service (fichier : `screenshots/railway-02-configure-service.png`)

3) Variables d'environnement
- Dans Settings → Variables, ajoutez :
  - `API_KEY` (ex : `ma_cle_secrete`) — si vous souhaitez protéger l'API.
  - `RATE_LIMIT_PER_MINUTE` (optionnel, ex : `30`).

**Capture #3** : page "Variables" (fichier : `screenshots/railway-03-env-vars.png`)

4) Build & déploiement
- Lancez le déploiement (Deploy). Railway utilisera le Dockerfile pour installer `ffmpeg` et construire l'image.
- Surveillez les logs de build et de runtime pour détecter d'éventuelles erreurs (ex : erreurs d'installation d'une dépendance système).

**Capture #4** : logs de build (fichier : `screenshots/railway-04-build-logs.png`)

5) Tester l'API en production
- Une fois le service démarré, copiez l'URL fournie par Railway (ex : `https://your-app.up.railway.app`).
- Testez :

```
GET https://your-app.up.railway.app/api/extract?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ
```

- Si `API_KEY` est activée, ajoutez en header `X-API-Key: ma_cle_secrete`.

**Capture #5** : test de requête API (fichier : `screenshots/railway-05-test-api.png`)

---

## Commandes (option CLI / local)

- Construire localement l'image Docker (test):

```bash
cd server
docker build -t telecharger-api:latest .
# Exécuter localement
docker run -p 8080:8080 -e PORT=8080 -e API_KEY="ma_cle" telecharger-api:latest
```

- Vérifier l'endpoint localement :

```bash
curl -s "http://127.0.0.1:8080/api/extract?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ"
```

---

## Notes et conseils pour les captures
- Utilisez des images claires et annotées (encerclez le bouton/cliquez, mettez un petit commentaire en légende si nécessaire).
- Exemples d'outils pour captures : Windows Snipping Tool, macOS Screenshot, Flameshot.
- Stockez vos captures dans `docs/screenshots/` et ajoutez les images au repo (ou au dossier `screenshots/` à côté du guide). Mettez des noms explicites.

---

## Remarques sur coûts & limites
- Railway propose un niveau gratuit avec crédits. Pour usages intensifs, un VPS (DigitalOcean, Hetzner, Scaleway) ou un hébergement payant est préférable.
- Assurez-vous d'avoir `ffmpeg` installé (Dockerfile inclus). Sans `ffmpeg`, certaines conversions/extractions peuvent échouer.

---

Si vous le souhaitez, je peux :
- générer les captures d'écran d'exemple (images d'interface annotées) avec contenu fictif pour votre README, ou
- préparer un fichier `docs/screenshots.zip` contenant des captures d'exemple prêtes à insérer.

Dites-moi si vous voulez que je prépare les captures d'exemple (je peux créer des images illustratives et les ajouter au dépôt).