# Changelog

All notable changes to Logia will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
