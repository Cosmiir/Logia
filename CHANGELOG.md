# Changelog

All notable changes to Logia will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-02-21

### Added
- Multi-collection library (Film, Series, Anime, Manga/Manhwa, Video Games)
- Full-text search (FTS5) across title, creator, and synopsis/review
- Advanced filtering by status, collection, rating, and date
- Grid and list view modes
- Detailed media cards with Markdown editor (Gravity UI)
- Customizable progress tracking (chapters, episodes, hours, etc.)
- Genre tagging system
- Rating system on a 100-point scale
- Similar media linking
- Statistics dashboard with status/collection breakdown, rating distribution, and seasonality
- 5 themes: Nebula, Midnight, Ember, Forest, Arctic
- 3 display densities: Compact, Normal, Comfortable
- Window button styles: Windows, macOS, Hybrid
- Toggleable interface animations
- Bilingual interface: French and English
- Data export: Markdown, CSV, TSV
- ZIP backup export (database only, with images, or full with attachments)
- Multiple profiles with independent databases
- Per-profile password protection (bcrypt)
- Keyboard shortcuts
- Integrated notification system (stagnation, near-completion, objectives, monthly reports)
- Configurable storage directory
- Objective tracking with progress visualization
- Review templates with variable insertion
- People management with roles and photos
- Custom date picker with calendar UI

### Technical
- Frontend: React 19, TypeScript, TailwindCSS 4
- Backend: Tauri 2.10 (Rust)
- Database: SQLite with WAL mode and FTS5
- State management: Zustand 5 + TanStack Query 5
- Animations: Framer Motion 11
- Content Security Policy enabled
- i18n via react-i18next with locale-aware date formatting
