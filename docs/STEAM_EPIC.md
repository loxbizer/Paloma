# Distribution Steam / Epic Games

XENOSTRIKE est une application Electron : `npm run dist:win|mac|linux` produit dans `dist/`
des exécutables autonomes (installateur NSIS + zip Windows, DMG macOS, AppImage Linux) —
exactement le format attendu par les pipelines de dépôt Steam et Epic.

## Steam (Steamworks)

1. Créez l'app sur [partner.steamgames.com](https://partner.steamgames.com) → récupérez votre **App ID**.
2. Placez un fichier `steam_appid.txt` contenant l'App ID à côté de l'exécutable (dev uniquement).
3. Construisez : `npm run dist:win` → le contenu à déposer est `dist/win-unpacked/`.
4. Déposez avec `steamcmd` :
   ```
   steamcmd +login <compte> +run_app_build ../scripts/app_build_<appid>.vdf +quit
   ```
   Le `content root` du script VDF pointe sur `dist/win-unpacked`, le lanceur est `XENOSTRIKE.exe`.
5. Intégration API (succès, overlay) : ajoutez plus tard le paquet npm `steamworks.js`
   dans `main.js` (l'architecture du jeu n'en dépend pas).

## Epic Games Store

1. Créez le produit sur le [Dev Portal](https://dev.epicgames.com) (Epic Online Services).
2. Construisez : `npm run dist:win`.
3. Déposez `dist/win-unpacked/` avec **BuildPatch Tool** :
   ```
   BuildPatchTool.exe -OrganizationId=... -ProductId=... -ArtifactId=...
     -BuildRoot="dist/win-unpacked" -AppLaunch="XENOSTRIKE.exe" -AppArgs=""
   ```

## Notes

- L'icône applicative : ajoutez `build/icon.ico` / `build/icon.icns` (electron-builder les
  détecte automatiquement).
- Le jeu est servi en interne sur `http://127.0.0.1:<port aléatoire>` par le processus
  principal — aucun accès réseau externe, aucune configuration pare-feu requise.
- Les achats en Xenocoins sont **simulés** localement : pour une vraie boutique, branchez
  les microtransactions Steam (`ISteamMicroTxn`) ou Epic (Ecom) dans `src/ui/shop.js`
  (l'événement `shop:purchase` centralise déjà tous les achats).
