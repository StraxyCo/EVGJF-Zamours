# 🎮 Lancer le jeu en local (Offline)

## Démarrage rapide

### Option 1 : Script shell (recommandé)
```bash
./start-server.sh
```
Le serveur se lance sur **http://localhost:8000**

### Option 2 : Commande directe
```bash
cd /Users/xavierdecamy/Documents/GitHub/EVGJF-Zamours
python3 -m http.server 8000
```

## Mode Offline complet

Après le premier chargement du jeu:
1. Le Service Worker s'installe automatiquement
2. Tous les assets (HTML, CSS, JS, images, audio, fonts) sont mis en cache
3. **Le jeu fonctionne 100% offline** — tu peux fermer la connexion et continuer

### Vérifier le cache
1. Ouvre DevTools (F12)
2. Application → Service Workers → tu dois voir "zamours-v3" **enregistré**
3. Cache Storage → zamours-v3 → tous les assets dedans
4. Ferme le serveur et actualise la page — ça marche toujours ✅

## Notes

- Pas de build nécessaire — c'est du HTML/CSS/JS statique
- Le Service Worker cache tout automatiquement au premier chargement
- Les données du jeu (questions, scores) sont persistées en localStorage
