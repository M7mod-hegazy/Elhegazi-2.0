# QR Code Page — Saved Presets Feature

**Date:** 2026-05-17  
**Status:** Approved

---

## Overview

Add a named-preset system to `/admin/qr-codes` that lets the user save, load, rename, and delete snapshots of all QR settings. Saving the selected products is optional. Presets do not auto-update — the user must explicitly save.

---

## Data Model

Stored in `localStorage` under key `qr_presets`.

```ts
interface QRPreset {
  id: string;           // crypto.randomUUID()
  name: string;
  createdAt: number;    // Date.now()
  settings: QRSettings; // full snapshot of all settings
  productIds: string[] | null; // null = products not saved
}
```

---

## UI Components

### 1. Trigger Buttons (top of right settings panel)

Two buttons sit side-by-side above the existing settings:

- `⭐ الإعدادات المحفوظة (N)` — opens the presets modal. N = count of saved presets.
- `+ حفظ` — opens the save dialog directly, skipping the modal.

### 2. Presets Modal

Full list of saved presets. Each preset card (style C — layout preview):

- **Left:** small layout-preview thumbnail (CSS-drawn rectangles representing columns/layout, colored with the preset's bg/fg colors)
- **Middle:** preset name + one-line summary (page format · columns · logo on/off · N products if saved)
- **Right:** `تحميل` button · `✏️` rename icon · `🗑` delete icon
- Currently loaded preset gets a blue border + `محمّل` badge; its `تحميل` button is grayed out

No preview in the modal footer — just the list.

### 3. Save Dialog (simple form, no preview)

Triggered by `+ حفظ` button. A small modal/popover with:

1. **Radio or two-section choice:**
   - `⊕ حفظ كـ preset جديد` → text input for name (autofocused)
   - `↩ الكتابة فوق preset موجود` → dropdown listing existing presets (pre-selects the currently loaded preset if any)
2. **Toggle:** "حفظ المنتجات المحددة" (off by default) — shows count of currently selected products
3. **`💾 حفظ` button** — validates name is not empty, then saves

No design preview inside this dialog.

### 4. Inline Rename

Clicking `✏️` on a preset card turns the name into an `<input>`. `Enter` or blur saves the new name. `Escape` cancels.

---

## Behavior

### Loading a Preset
- Clicking `تحميل` copies `preset.settings` into the page's `settings` state
- If `preset.productIds` is not null, replaces the selected products with those IDs (filtered against currently loaded products list to avoid stale IDs)
- Modal closes
- A subtle toast: `"تم تحميل: [name]"`

### Saving
- **New:** generates a new UUID, pushes to the array, saves to localStorage
- **Overwrite:** replaces the matching entry in the array, keeps same id/createdAt
- After saving: toast `"تم الحفظ: [name]"`

### Deleting
- Confirmation: inline in the card (button turns red → click again to confirm), or a simple `window.confirm`
- If the deleted preset was the currently loaded one, clear the "active preset" indicator

### Active Preset Tracking
- A `activePresetId: string | null` state tracks which preset is currently loaded
- It is cleared whenever the user manually changes any setting after loading (so the badge doesn't mislead)
- This is in-memory only — not persisted

---

## Storage

- Key: `qr_presets`
- Format: JSON array of `QRPreset[]`
- Max suggested: no hard limit (localStorage ~5MB is plenty for settings-only presets)
- Error handling: wrap all reads/writes in try/catch, fail silently

---

## Scope (not included)

- No export/import of presets to file
- No server-side sync
- No preset sharing between users
- No undo for delete (just confirmation)
