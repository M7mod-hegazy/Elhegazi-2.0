# Settings Platform Rollout Checklist

## Environment Parity

- Define API base URL for local and production.
- Verify media upload endpoint is reachable in both environments.
- Ensure `OWNER_VAULT_PASSWORD` and optional emergency reset env vars exist in production.
- Confirm CORS includes admin hostnames for upload and backup APIs.

## Session and Security

- Confirm admin inactivity lock triggers at 15 minutes in local and production.
- Confirm `admin.auth.lockReason` is set to `idle_timeout` when lock occurs.
- Confirm Control Center re-auth flow works after lock.

## Branding

- Save site name and logo in branding tab using upload mode.
- Save site name and logo in branding tab using link mode.
- Verify page title, header/footer logos, splash logo, and meta previews update.
- Verify fallback to `/iconPng.png` and `متجر إلكتروني` when settings are unavailable.

## Backup Center

- Export full backup.
- Export custom backup with selected modules.
- Import a valid global backup with preview and merge mode.
- Import a valid global backup with replace mode.
- Import settings file and verify application.
- Import builder file and verify creation.

## Operational Logs

- Record failed auth attempts.
- Record session timeout events.
- Record backup export/import job outcomes.
- Record branding save events.
