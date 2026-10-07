# Changelog

## 0.2.0 — 2026-10-08

- Use GNOME SystemActions for suspend, restart, power-off and logout, as requested
  in review 75786. Standard GNOME confirmation dialogs are retained.
- Remove direct D-Bus calls, private end-session dialog hooks, confirmation
  timers, pending-call tracking and the `_lifecycle` guard.
- Use ModalDialog's state to prevent repeated dispatch while closing.
- Explicitly disconnect the dialog destroy handler during extension disable.
- Test action routing, capability changes, repeated activation, keyboard behavior,
  cleanup and re-enable in an isolated GNOME 50 session with power actions stubbed.

## 0.1.0 — 2026-09-30

- Initial GNOME 50 desktop power menu with keyboard and mouse navigation.
