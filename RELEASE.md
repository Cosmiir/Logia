# Releasing a new version of Logia

Logia uses [tauri-plugin-updater](https://v2.tauri.app/plugin/updater/) for auto-updates. Releases are built, signed, and published entirely via GitHub Actions — no manual build step required.

## Prerequisites (one-time setup)

A Tauri signing keypair is required for the updater to verify update integrity.

1. Generate a keypair locally:
   ```bash
   npx tauri signer generate -w ~/.tauri/logia.key
   ```
   This produces a private key (password-protected) and a public key.

2. Add the **public key** to `src-tauri/tauri.conf.json` under `plugins.updater.pubkey` (replace `REPLACE_WITH_PUBLIC_KEY`).

3. Add two secrets to the GitHub repository (Settings → Secrets and variables → Actions):
   - `TAURI_SIGNING_PRIVATE_KEY` — the contents of `~/.tauri/logia.key`
   - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` — the password you chose when generating the key

## Publishing a release

1. Make sure `version` is bumped in all three places (they must match):
   - `package.json`
   - `src-tauri/tauri.conf.json`
   - `src-tauri/Cargo.toml`

2. Commit the version bump, then tag and push:
   ```bash
   git tag v1.0.6
   git push origin v1.0.6
   ```

3. The `Release` workflow (`.github/workflows/release.yml`) triggers automatically on the `v*` tag. It:
   - Builds the Windows NSIS installer + updater bundle (`.zip` + `.sig`)
   - Signs the updater bundle with the private key
   - Generates and uploads `latest.json` to the release (used by the app's updater endpoint)
   - Publishes the GitHub Release (non-draft)

4. Once the workflow completes, the release is live. Existing users on a signed version will see the update modal on next launch.

## Bootstrapping auto-update

The first signed release cannot auto-update users of previous unsigned versions. Users on v1.0.5 (or earlier, pre-updater) must **manually install** the first signed release (v1.0.6). After that, all subsequent updates are delivered automatically.

## Endpoint

The updater fetches:
```
https://github.com/Cosmiir/Logia/releases/latest/download/latest.json
```
This is served by the GitHub CDN (not the REST API), so there is no rate limit and no authentication required. The repo must remain public for this to work.

## Troubleshooting

- **Update not detected**: check that `latest.json` is attached to the latest release, that the `pubkey` in `tauri.conf.json` matches the private key used in CI, and that the version in `latest.json` is higher than the installed version.
- **Signature mismatch**: the private key in CI secrets must match the public key in `tauri.conf.json`. If the key was regenerated, users need to manually reinstall.
- **Workflow fails on build**: check the Actions logs. Common causes: missing secrets, version mismatch between `package.json` / `tauri.conf.json` / `Cargo.toml`.
