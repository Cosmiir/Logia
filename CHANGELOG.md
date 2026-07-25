# Changelog

All notable changes to Logia will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.4] - 2026-07-25

### Fixed
- MediaCard flip (back face) normal mode: multi-line titles were clipped — the second line showed only its top half due to flex compression. Added `shrink-0` to the title and header to preserve their natural height.
- Tooltip (`onlyWhenTruncated`): truncation detection now also checks vertical overflow (`scrollHeight > clientHeight`), enabling tooltips on `line-clamp` elements that are truncated vertically.
- Escape key in MediaDetail: when a viewer (MangaReader CBZ or gallery Lightbox) was open, pressing Escape closed the viewer AND triggered a navigation back. Now Escape only closes the viewer; a second Escape is needed to go back. Fixed by adding `data-escape-to-close` attribute to viewer containers and updating the global shortcut handler to check for it before calling `goBack()`. Also moved the Lightbox keyboard listener from `document` to `window` to ensure correct event ordering.
- MediaCard hover: after deleting a media in the library, the first hover on any card caused the title to jump up (info bar expanded to 140px for one frame before the measured height was applied). Fixed by changing the CSS fallback for `--card-info-h-hover` from `140px` to `var(--card-info-h, 64px)`, so the default hover height matches the non-hover height until `handleMouseEnter` sets the correct measured value.
- Export page (ZIP mode): the selection tick on export level cards (DB only / DB + images / Full backup) slid between cards when switching mode due to `layoutId` animation. Replaced with a simple fade + scale transition (0.15s) so the tick appears and disappears in place instead of sliding.
- Export page (format selection): same `layoutId` sliding issue on the format cards (CSV / TSV / Markdown). Replaced with the same fade + scale transition.
- Export page (collection filter): same `layoutId` sliding issue on the collection scope cards (All / Specific). Replaced with the same fade + scale transition.
- Export page: large empty gap between the stepper and content during step transitions. Caused by `AnimatePresence mode="sync"` leaving both old and new content in the DOM simultaneously. Changed to `mode="wait"` and reduced stepper bottom margin from `mb-8` to `mb-4`.
- Image upload: files uploaded during media editing could silently overwrite existing images on disk. Filenames were generated using the upload `position` (e.g. `cover_100_full.webp`), and since `startPosition = 100` is reused on every edit, uploading a file with the same name as an existing image overwrote it. Fixed by replacing the position in the filename with a timestamp + random suffix (`{stem}_{YYMMDD-HHMMSS}_{random}_full.webp`).

### Changed
- MediaCard flip (back face) normal mode: genres now limited to 2 visible pills (was 3) with `max-w-[60px]` truncation and `flex-nowrap` to prevent multi-line wrapping that pushed the attachments count out of view. Tooltip on each genre pill shows the full name on hover. The `+N` badge also has a tooltip listing remaining genres.
- Export ZIP: switched compression method from `Deflated` to `Stored` for all files. Media files (WebP, JPEG, PDF) are already compressed — recompressing them wasted CPU for negligible size gain. The ZIP is now written significantly faster on large backups (e.g. 7+ GB full backup).
- Export ZIP: files are now streamed to the ZIP in 64 KB chunks via `BufReader` instead of being loaded entirely into memory with `std::fs::read()`, reducing RAM usage on large exports.

### Added
- Export ZIP: real-time progress bar during archive creation. Shows percentage, current file name (left-aligned, fixed), file counter X/Y (right-aligned), and bytes processed/total. Uses Tauri's `Channel` IPC for live progress events from the Rust backend.
- MediaCard flip (back face): tooltip on the title when truncated, showing the full title on hover in all density modes (compact, normal, large)
- Library: "Flip all cards" toggle button in the toolbar (between sort and view mode buttons) — when activated, all media cards flip to their back face simultaneously, loading details asynchronously for each card
- Attachment rename: inline rename of CBZ/files attached to a media directly from MediaDetail (pencil icon → edit name → Enter/blur to confirm, Escape to cancel). Renames both the database record and the physical file on disk.
- Attachment drag & drop reorder in MediaCreate: attachments can be reordered via drag & drop (using dnd-kit) during media creation/editing. Order is persisted on save via `reorder_media_attachments`.
- Attachment drag & drop reorder in MediaDetail: attachments can be reordered inline with immediate persistence. Uses optimistic updates with rollback on error.
- Attachment inline rename in MediaCreate: existing attachments can be renamed inline during media editing, with changes saved on submit.
- Database migration: added `position` column to `media_attachments` table with auto-migration for existing databases. Attachments are now ordered by `position` instead of `created_at`.
- New Tauri commands: `rename_media_attachment` (renames file on disk + updates DB) and `reorder_media_attachments` (batch updates positions in a transaction).

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
