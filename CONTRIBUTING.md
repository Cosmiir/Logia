# Contributing to Logia

Thank you for your interest in contributing to Logia! This document outlines the process and guidelines for contributing.

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [Rust](https://www.rust-lang.org/tools/install) (stable toolchain)
- [Tauri CLI](https://tauri.app/start/prerequisites/)

### Setup

```bash
git clone https://github.com/Cosmiir/logia.git
cd logia
npm install
npm run tauri dev
```

## Development Workflow

1. **Create a branch** from `main` for your feature or bugfix:
   ```bash
   git checkout -b feat/your-feature-name
   ```

2. **Make your changes** following the code style and conventions below.

3. **Test your changes** — ensure the app builds and runs:
   ```bash
   npm run tauri build
   ```

4. **Commit with clear messages** using conventional commits:
   - `feat:` new feature
   - `fix:` bug fix
   - `docs:` documentation only
   - `refactor:` code restructuring
   - `i18n:` translation updates

5. **Open a Pull Request** with a clear description of what and why.

## Code Style

### Frontend (TypeScript / React)

- Use TypeScript strict mode — no `any` types without justification.
- Follow existing naming conventions: `camelCase` for variables/functions, `PascalCase` for components/types.
- Use functional components with hooks.
- Prefer `useTranslation()`'s `t()` function over direct `i18next.t()` calls in components.

### Backend (Rust)

- Replace `unwrap()` with proper error handling (`map_err`, `?` operator) in command functions.
- Use the `log` crate (`log::warn!`, `log::error!`, `log::info!`) instead of `eprintln!`.
- Follow Rust idioms — prefer `Result<T, E>` over panics in non-startup code.

### Internationalization (i18n)

- All user-facing strings must use i18n keys via `t('namespace.key')`.
- When adding new strings, add keys to **both** `src/i18n/locales/en.json` and `src/i18n/locales/fr.json`.
- Never hardcode French or English strings in components.
- For date formatting, use locale-aware functions from `src/lib/utils.ts`.

## Project Structure

```
src/              # Frontend (React + TypeScript)
  components/     # Reusable UI components
  pages/          # Route-level page components
  hooks/          # Custom React hooks
  lib/            # Utilities and configuration
  i18n/locales/   # Translation files (en.json, fr.json)
src-tauri/        # Backend (Rust + Tauri)
  src/commands/   # Tauri command handlers
  src/db/         # Database layer (SQLite)
```

## Reporting Issues

- Use [GitHub Issues](https://github.com/Cosmiir/logia/issues) to report bugs or request features.
- Include steps to reproduce, expected behavior, and actual behavior.
- Mention your OS and Logia version.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
