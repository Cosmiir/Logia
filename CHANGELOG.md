# Changelog

All notable changes to Logia will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.3] - 2026-07-22

### Fixed
- Database corruption prevention: added `PRAGMA wal_checkpoint(TRUNCATE)` on app exit via `RunEvent::ExitRequested` handler, ensuring WAL data is properly merged into the main database file before shutdown
- `create_media` and `update_media`: wrapped all 3 operations (media insert/update + genre linking + credit linking) in a single atomic transaction instead of separate unchecked transactions, preventing partial writes if one step fails
- `switch_profile`: lock file is now acquired for the new profile BEFORE updating the manifest, preventing an inconsistent state where the manifest says profile B is active but the connection is still on profile A
- `switch_profile`: WAL checkpoint on the old connection before swapping to the new profile's database

### Added
- Lock file (`logia.db.lock`) using Windows `LockFile` API to prevent two instances of Logia from using the same profile database simultaneously. Lock is acquired at startup and on profile switch, with RAII cleanup on exit.
- GFS (Grandfather-Father-Son) automatic database backup: creates a daily copy of `logia.db` in `backups/` on app startup and on profile switch. Rotation keeps 7 daily, 4 weekly, and 12 monthly backups, deleting older ones automatically.

### Changed
- `genres::link_to_media` and `people::link_to_media`: removed inner `unchecked_transaction` since callers (`create_media`/`update_media`) now wrap operations in a global transaction
- Backup rotation: weekly grouping now uses `(year, week)` instead of `week` alone to avoid cross-year collisions
- Backup rotation: monthly retention now uses calendar date comparison instead of `age_days <= 365` for precise 12-month retention

## [1.0.2] - 2026-07-22

### Fixed
- MediaCard flip (back face) compact mode: creators were hidden, now visible with icon-based compact layout (1 creator + `+N` count)
- MediaCard flip compact mode: genres now hidden to free space for creator display
- MediaCard flip compact mode: creator `+N` count merged as superscript next to the pill instead of a separate truncated element
- MediaCard flip all modes: creator pills with long names (e.g. "Everything Unlimited Ltd.") now truncate with ellipsis and show full name in a tooltip on hover
- Library: creator filter popup showed an empty list because `useDistinctCreators` was only enabled when the filter presets menu was open (`isFilterOpen`), not when a creator filter pill popup was opened. Now also enabled when an active creator filter exists.

## [1.0.1] - 2026-07-20

### Fixed
- CSV import: fixed incorrect column name `progressCurrent` → `progress_current` in the INSERT query, which caused "table media has no column named progressCurrent" errors on every imported row
- Images not loading in production build: fixed CSP `img-src` directive from `https://asset.localhost` to `http://asset.localhost` to match Tauri v2's asset protocol scheme on Windows
- Media sort by "recently added" broken after CSV import: imported media used RFC 3339 timestamps (`2026-07-20T17:47:00+00:00`) while media created normally used SQLite format (`2026-07-20 17:47:00`). Since SQLite sorts DATETIME lexicographically, `T` (ASCII 84) > space (ASCII 32), causing all imported media to sort before manually created media regardless of actual date. Fixed by using SQLite-compatible timestamp format in CSV/profile imports.
- CSP: added `blob:` to `img-src` directive to allow blob URL images to load

### Changed
- Fonts: replaced Google Fonts CDN (`fonts.googleapis.com`) with local `@fontsource/inter` package to eliminate external network dependency and improve offline reliability
