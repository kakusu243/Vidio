# Téléchargeur de vidéos (Front-end + Example d'API)

📌 **But** : page unique (hébergeable sur GitHub Pages) où l'utilisateur colle un lien de vidéo, voit la miniature, choisit la résolution, puis télécharge la vidéo.

⚠️ **Important — limites légales et techniques**
- Ce dépôt contient un **front-end statique** (hébergeable sur GitHub Pages). Pour fonctionner réellement, il **nécessite une API serveur d'extraction** (exemple fourni) capable d'extraire les formats (préférablement en utilisant yt-dlp/yt-dl).
- N'utilisez cet outil que pour des vidéos dont vous avez le droit de télécharger le contenu. Ne contournez pas les protections (DRM) ni les restrictions légales.

## Contenu
- `index.html` — interface utilisateur (page unique)
- `styles.css`, `app.js` — scripts et styles
- `server/` — exemple de serveur Flask utilisant `yt-dlp` (à déployer séparément)

## Déploiement front-end (GitHub Pages)
1. Placez les fichiers `index.html`, `styles.css`, `app.js` dans la racine d'un repository GitHub.
2. Dans les options du repo > Pages, choisissez la branche `main` (ou `gh-pages`) et la racine `/`.
3. Mettez à jour dans `app.js` la variable `API_BASE` pour pointer vers l'URL de votre API d'extraction (ex : `https://mon-api.example`).

## Tester localement
1. **Installez ffmpeg** (pour une meilleure extraction et la conversion MP3) :
   - **Windows (winget)** : `winget install --id=Gyan.FFmpeg -e` (puis redémarrez le shell ou ajoutez le chemin au PATH : `C:\Users\<username>\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_...\ffmpeg-8.0.1-full_build\bin`)
   - **macOS** : `brew install ffmpeg`
   - **Linux** : `sudo apt install ffmpeg` (ou équivalent sur votre distro)

2. Lancez l'API d'extraction localement (exemple avec Python):

```bash
cd server
python -m venv .venv
.venv\Scripts\activate   # Windows
pip install -r requirements.txt
python app.py
```

3. Servez les fichiers front-end depuis un serveur statique (ne pas ouvrir `index.html` via `file://` car fetch sera bloqué):

```bash
# à la racine du projet
python -m http.server 8000
```

4. Ouvrez `http://localhost:8000` dans votre navigateur et mettez `API_BASE` dans `app.js` à `http://localhost:8080`.

5. Collez une URL de vidéo, cliquez sur « Analyser », choisissez un format (y compris « MP3 » pour conversion audio) puis « Télécharger ». Si vous déployez l'API sur un domaine public, mettez cette URL dans `API_BASE`.

> Note : pour éviter des problèmes CORS en production, configurez correctement les en-têtes CORS sur votre serveur ou déployez front-end et API sur des domaines compatibles.
> 
> **Test MP3 validé** ✅ : conversion audio MP3 fonctionne correctement avec ffmpeg installé (fichier généré ~5 MB pour une vidéo de ~4 min).


## Exemple d'API (Flask + yt-dlp)
Un exemple minimal se trouve dans `server/app.py`. Il expose :
- `GET /api/extract?url=VIDEO_URL` → retourne JSON `{ title, thumbnail, uploader, formats: [...] }`
- `GET /api/download?url=VIDEO_URL&format_id=XXXX` → proxie et renvoie le flux du format choisi. Spécial : `format_id=mp3` déclenche une conversion audio en MP3 (ffmpeg requis) et renvoie le fichier MP3.

Déploiement possible : Render.com, Railway, Fly, Heroku (ou Docker sur un VPS). Assurez-vous que le serveur dispose des droits/ressources pour exécuter `yt-dlp`.

### Sécurité et bonnes pratiques
- **Protégez l'API par une clé** : définissez la variable d'environnement `API_KEY` sur le serveur (par ex. `export API_KEY="ma_cle"`). Si `API_KEY` est définie, **toutes** les requêtes doivent fournir la même clé via l'en-tête `X-API-Key` ou le paramètre `api_key`.
- **Limitation de débit** : activez le limiteur (activé par défaut) et réglez `RATE_LIMIT_PER_MINUTE` pour limiter le nombre d'appels par minute (défaut 60). Exemple : `export RATE_LIMIT_PER_MINUTE=30`.
- **Remarque** : le limiteur présent ici est en mémoire (ex. pour le MVP). Pour la production, utilisez une solution robuste (Redis + Flask-Limiter, Cloudflare rate-limits, ou un WAF) pour une limitation fiable à l'échelle.
- Respectez les conditions des plateformes et les droits d'auteur.

---

## Déploiement de l'API — guides rapides

### Railway (recommandé pour simplicité)
1. Créez un compte sur https://railway.app et installez la CLI (facultatif) :

```bash
# clonez le repo (si nécessaire)
git clone <votre-repo>
cd <votre-repo>/server
# connexion CLI (optionnel):
railway login
railway init
```

2. Déployez :

- Depuis l'interface Railway : importez votre repo GitHub, sélectionnez le dossier `server` et définissez la commande de démarrage `gunicorn app:app --bind 0.0.0.0:$PORT --workers 2`.
- Dans les variables d'environnement (Settings → Variables) ajoutez `API_KEY` (optionnel), `RATE_LIMIT_PER_MINUTE` (optionnel) et `PORT` (Railway fournit généralement `$PORT`).

3. Important : installez `ffmpeg` si possible via buildpack ou Docker pour améliorer les extractions (sinon certains formats peuvent manquer). Railway supporte des déploiements Docker si vous avez besoin d'installer des dépendances système.

> Avantages : intégration Git, déploiement automatique, traces et variables d'environnement faciles à configurer.

### Déploiement automatique via GitHub Actions
J'ai ajouté un workflow GitHub Actions qui construit l'image Docker du dossier `server` et la pousse vers GitHub Container Registry (GHCR). Le fichier est : `.github/workflows/deploy-docker.yml`.

- Il se déclenche sur `push` vers `main` et build/push l'image : `ghcr.io/<owner>/telecharger-api:<sha>`.
- Optionnel : vous pouvez activer le déploiement automatique vers Railway en ajoutant le secret `RAILWAY_API_KEY` (voir la section suivante). Le workflow contient un bloc d'exemple (commenté) pour exécuter la CLI Railway si `RAILWAY_API_KEY` est défini.

> Remarque : configurez les secrets `GITHUB_TOKEN` (déjà fourni), et si vous voulez que le workflow déclenche un `railway up`, ajoutez `RAILWAY_API_KEY` dans les secrets du repo (Settings → Secrets & Variables).


---

### Replit (idéal pour prototype, limitations à connaître)
1. Créez un compte sur https://replit.com et créez un nouveau Repl (Python).
2. Uploadez le contenu du dossier `server` dans le Repl (ou liez votre repo GitHub).
3. Installez les dépendances dans `requirements.txt` (Replit le fera automatiquement si le fichier est présent).
4. Ajoutez les variables d'environnement dans Secrets (`API_KEY`, `RATE_LIMIT_PER_MINUTE`).
5. Modifiez le fichier `replit.nix` ou utilisez Docker si vous avez besoin d'installer `ffmpeg`. Sans `ffmpeg`, certains flux/formatages peuvent être limités.

> Limitations : Replit a des quotas CPU / temps d'exécution ; yt-dlp peut être lourd pour des vidéos longues. Replit est parfait pour un prototype privé ou test, mais pas pour un trafic public important.

---

### Notes d'exploitation et sécurité
- Pour un déploiement public, préférez une solution qui vous permet d'installer `ffmpeg` et de contrôler les ressources (petit VPS, Railway avec Docker, ou Render avec Docker).
- Configurez une solution de rate-limiting persistante (Redis + Flask-Limiter) et une authentification robuste si vous exposez votre API publiquement.
- Limitez la taille des téléchargements et ajoutez des quotas pour éviter les abus.

---

Si vous voulez, je peux :
- préparer un guide détaillé *pas à pas* pour Railway ou Replit (avec captures d'écran et commandes) — voir `docs/railway-deploy.md`,
- créer un Dockerfile optimisé incluant `ffmpeg` et instructions de build (déjà ajouté : `server/Dockerfile`), ou
- automatiser le déploiement avec un workflow GitHub Actions.

Dites-moi quelle option vous préférez et je l'ajoute au README ou je crée les fichiers nécessaires.

