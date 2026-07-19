<div align="center">

<img src="./src/assets/LOGIA.png" alt="Logia Logo" width="80" />

# Logia

**Track your media progression and organize your collections.**  
Cataloguez et gérez vos films, séries, animes, mangas et jeux vidéo — 100% hors-ligne.

[![License: MIT](https://img.shields.io/badge/License-MIT-purple.svg)](LICENSE)
[![Release](https://img.shields.io/github/v/release/Cosmiir/logia?color=purple)](https://github.com/Cosmiir/logia/releases)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20Linux%20%7C%20macOS-blueviolet)](#installation)
[![Ko-fi](https://img.shields.io/badge/Support-Ko--fi-FF5E5B?logo=ko-fi&logoColor=white)](https://ko-fi.com/cosmiir)

![Logia Dashboard](./screenshots/dashboard.png)

</div>

---

## À propos

Logia est une application desktop **100% hors-ligne** pour suivre votre progression sur tous vos médias. Pas de compte, pas de cloud, pas d'API externe — vos données restent chez vous, dans une base SQLite locale.

Conçu pour les personnes qui consomment des médias variés (films, séries, animes, mangas, jeux vidéo) et veulent un seul endroit pour tout suivre, noter et analyser.

---

## Fonctionnalités

### 📚 Bibliothèque multi-collections
- 5 collections : **Film**, **Série**, **Anime**, **Manga / Manhwa**, **Jeu Vidéo**
- Statuts : À commencer, En cours, Terminé, Abandonné
- Ajout 100% manuel — aucune dépendance à une API externe

### 🔍 Recherche & Filtres
- Recherche full-text (FTS5) sur le titre, le créateur et le synopsis/avis
- Filtres avancés par statut, collection, note, date
- Tri multi-critères
- Deux vues : grille et liste

### ✍️ Fiches détaillées
- Synopsis et avis rédigés avec un éditeur Markdown ([Gravity UI](https://gravity-ui.com/))
- Suivi de progression personnalisé (chapitres, épisodes, heures…)
- Tags de genres
- Système de notation sur 100
- Médias similaires

### 📊 Statistiques
- Répartition par statut et par collection
- Distribution des notes
- Moyenne par collection
- Mieux et moins bien notés
- Filtres par collection et par période

### 🎨 Personnalisation
- 5 thèmes : Nebula, Midnight, Ember, Forest, Arctic
- 3 densités d'affichage : Compact, Normal, Confortable
- Style de boutons de fenêtre : Windows, macOS, Hybride
- Animations d'interface activables/désactivables
- Interface disponible en **Français** et **English**

### 💾 Export des données
- Export texte : **Markdown**, **CSV**, **TSV**
- Export ZIP :
  - Profil seul (collections, paramètres)
  - Profil complet (avec images des médias)

### ⚙️ Autres
- Profils multiples avec base de données indépendante par profil
- Protection par mot de passe par profil
- Raccourcis clavier
- Système de notifications intégré
- Dossier de stockage configurable

---

## Captures d'écran

| Dashboard | Bibliothèque |
|-----------|-------------|
| ![Dashboard](./screenshots/dashboard.png) | ![Library](./screenshots/library.png) |

| Fiche média | Statistiques |
|-------------|-------------|
| ![Media](./screenshots/media.png) | ![Stats](./screenshots/stats.png) |

| Personnalisation | Paramètres |
|-----------------|-----------|
| ![Theme](./screenshots/settings-theme.png) | ![Profile](./screenshots/settings-profile.png) |

---

## Installation

### Téléchargement direct (recommandé)

Rendez-vous sur la page [**Releases**](https://github.com/Cosmiir/logia/releases) et téléchargez l'installeur pour votre plateforme :

| Plateforme | Fichier |
|------------|---------|
| Windows | `Logia_x.x.x_x64-setup.exe` (NSIS) ou `Logia_x.x.x_x64_en-US.msi` |
| macOS | *(non testé officiellement — Tauri supporte macOS)* |
| Linux | *(non testé officiellement — Tauri supporte Linux)* |

### Depuis le code source

**Prérequis :**
- [Node.js](https://nodejs.org/) (v18+)
- [Rust](https://www.rust-lang.org/tools/install) + [Tauri CLI](https://tauri.app/start/prerequisites/)

```bash
# Cloner le repo
git clone https://github.com/Cosmiir/logia.git
cd logia

# Installer les dépendances
npm install

# Lancer en développement
npm run tauri dev

# Compiler une version de production
npm run tauri build
```

---

## Stack technique

| Couche | Technologie |
|--------|-------------|
| Frontend | React 19 + TypeScript + TailwindCSS 4 |
| Backend | Tauri 2.10 (Rust) |
| Base de données | SQLite (WAL + FTS5) |
| State | Zustand 5 + TanStack Query 5 |
| Animations | Framer Motion 11 |

---

## Licence

Distribué sous licence **MIT**. Voir [`LICENSE`](LICENSE) pour plus de détails.

```
Copyright (c) 2026 Cosmiir
```

---

## Support

Logia est gratuit et open source. Si le projet vous est utile et que vous souhaitez soutenir son développement :

[![Ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/cosmiir)

---

<div align="center">
  <sub>Construit avec passion — Open Source ❤️</sub>
</div>