# Settings Platform Regression Matrix

## Security and Session

- Admin route access redirects to login when unauthenticated.
- Admin inactivity for 15+ minutes logs out and redirects.
- Opening another tab after lock keeps admin locked.
- Control Center session expires after 15 minutes idle.

## Dynamic Branding

- Changing site name updates document title.
- Changing logo updates visible logo components.
- Caches update (`cached_site_name`, `cached_site_logo`) after save.
- Invalid logo URL/file does not overwrite last valid logo.

## UI/UX

- All settings tabs render correctly on desktop and mobile.
- Sticky save/action flows are clear and do not auto-save unexpectedly.
- Control Center uses neutral naming in visible UI.

## Backup and Import

- Export full backup returns downloadable JSON.
- Import global backup shows preview then applies.
- Merge and replace import modes behave correctly.
- Builder import and settings import paths are detected correctly.

## Notifications and Errors

- User sees clear Arabic error on failed save/import.
- Permission-denied events show clear actionable message.
