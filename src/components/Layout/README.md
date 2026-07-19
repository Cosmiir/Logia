# Système de Layout - Logia

Ce dossier contient tous les composants de layout réutilisables pour maintenir une cohérence visuelle sur toute l'application.

## 📦 Composants

### `AppShell`
**Wrapper principal pour toutes les pages**

```tsx
<AppShell>
  {/* Contenu de la page */}
</AppShell>
```

**Responsabilités :**
- Structure globale : `h-screen flex flex-col overflow-hidden`
- Fond cosmic mesh : `bg-cosmic-mesh bg-fixed`
- Styles globaux : police, couleurs, sélection

**Utilisation :** Enveloppe chaque page de l'application

---

### `Header`
**Barre de navigation principale**

```tsx
<Header>
  {/* Logo, navigation, profil */}
</Header>
```

**Responsabilités :**
- Hauteur fixe : `h-16` (64px)
- Backdrop blur : `header-glass`
- Utilise `Container` pour aligner le contenu
- Position sticky en haut

**Marges :** Automatiquement alignées avec le reste de l'application via `Container`

---

### `MainContent`
**Zone de contenu principale scrollable**

```tsx
<MainContent>
  {/* Contenu de la page */}
</MainContent>

// Sans Container (pour layout personnalisé)
<MainContent useContainer={false}>
  {/* Contenu personnalisé */}
</MainContent>
```

**Responsabilités :**
- Prend tout l'espace disponible : `flex-1`
- Scroll vertical : `overflow-y-auto`
- Padding : `p-6 md:p-8`
- Scrollbar personnalisée : `custom-scrollbar`
- Utilise `Container` par défaut

**Props :**
- `useContainer` (boolean, default: true) : Utiliser le Container ou non

---

### `Container`
**Conteneur pour le contenu avec marges uniformes de 40px**

```tsx
<Container>
  {/* Contenu */}
</Container>

// Avec className personnalisée
<Container className="py-4">
  {/* Contenu */}
</Container>
```

**Responsabilités :**
- Largeur : `w-full` (100%)
- Padding horizontal : `px-10` (40px)
- Alignement uniforme Header/Body

**Marges :**
- Toutes tailles : `40px` (px-10)

---

## 🎯 Système de Marges Uniformes

### Alignement Horizontal

Tous les éléments sont alignés horizontalement grâce au `Container` :

```
┌─────────────────────────────────────────────────┐
│ ← 40px →  HEADER CONTENT           ← 40px →    │
├─────────────────────────────────────────────────┤
│ ← 40px →  MAIN CONTENT             ← 40px →    │
│           - Stats Cards                         │
│           - Media Grid                          │
│           - Collections                         │
└─────────────────────────────────────────────────┘
```

### Valeurs des Marges

| Élément    | Padding Horizontal |
|------------|-------------------|
| Header     | 40px (px-10)      |
| Body       | 40px (px-10)      |

### Scrollbar

- `scrollbar-gutter: stable` sur MainContent pour compenser la largeur de la scrollbar
- Garantit l'alignement parfait entre Header et Body

---

## 📋 Exemple d'Utilisation Complète

```tsx
import { AppShell, Header, MainContent } from '@/components/Layout';

function MyPage() {
  return (
    <AppShell>
      <Header>
        <div>Logo</div>
        <nav>Navigation</nav>
        <div>Profil</div>
      </Header>

      <MainContent>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Contenu de la page */}
        </div>
      </MainContent>
    </AppShell>
  );
}
```

---

## ✅ Avantages

1. **Cohérence Visuelle** : Toutes les pages utilisent les mêmes marges
2. **Maintenabilité** : Changement centralisé des marges
3. **Responsive** : Adaptation automatique mobile/desktop
4. **Réutilisabilité** : Composants utilisables sur toutes les pages
5. **Alignement Parfait** : Header, body et footer alignés

---

## 🔄 Migration des Pages Existantes

Pour migrer une page existante :

1. Remplacer le `<div>` principal par `<AppShell>`
2. Remplacer le `<header>` par `<Header>`
3. Remplacer le `<main>` par `<MainContent>`
4. Supprimer les classes de marges manuelles
5. Utiliser `Container` si besoin de marges personnalisées

**Avant :**
```tsx
<div className="h-screen flex flex-col overflow-hidden bg-[#050508] bg-cosmic-mesh">
  <header className="h-16 header-glass">
    <div className="max-w-7xl mx-auto px-6 md:px-8">
      {/* Contenu */}
    </div>
  </header>
  <main className="flex-1 overflow-y-auto p-6 md:p-8">
    <div className="max-w-7xl mx-auto">
      {/* Contenu */}
    </div>
  </main>
</div>
```

**Après :**
```tsx
<AppShell>
  <Header>
    {/* Contenu */}
  </Header>
  <MainContent>
    {/* Contenu */}
  </MainContent>
</AppShell>
```

---

## 🎨 Personnalisation

Si vous avez besoin de marges différentes pour une page spécifique :

```tsx
// Sans Container automatique
<MainContent useContainer={false}>
  <div className="px-4">
    {/* Marges personnalisées */}
  </div>
</MainContent>

// Ou avec Container + className
<MainContent>
  <Container className="px-12">
    {/* Marges plus larges */}
  </Container>
</MainContent>
```

---

## 📝 Notes Importantes

- **Ne pas** ajouter de `max-w-*` ou `mx-auto` manuellement dans les pages
- **Ne pas** ajouter de `px-*` manuellement dans les pages
- **Utiliser** les composants de layout pour garantir la cohérence
- **Tester** sur mobile et desktop après migration

---

## 🚀 Pages à Migrer

- [x] Dashboard
- [ ] Bibliothèque
- [ ] Activité
- [ ] Paramètres
- [ ] Stats
- [ ] Collections (détail)
- [ ] Media (détail)
