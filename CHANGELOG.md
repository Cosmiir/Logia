# Changelog

All notable changes to Logia will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.1] - 2026-07-20

### Fixed
- CSV import: fixed incorrect column name `progressCurrent` → `progress_current` in the INSERT query, which caused "table media has no column named progressCurrent" errors on every imported row
- Images not loading in production build: fixed CSP `img-src` directive from `https://asset.localhost` to `http://asset.localhost` to match Tauri v2's asset protocol scheme on Windows
