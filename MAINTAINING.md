# Maintenance notes

## How it works

`enable()` installs a custom handler for Mutter's `close` binding. Desktop-type
windows open `PowerDialog`; closable application windows receive the same delete
request as native closing. A stage-event fallback handles Alt+F4 when there is no
focused window and GNOME is in normal session mode.

`PowerDialog` is a GNOME modal dialog with focusable buttons. It handles arrows,
Enter, Escape, and a second Alt+F4. It waits for release of the opening F4 before
accepting another press, and dispatches at most one action per dialog.

Suspend uses GNOME's `SystemActions`. Shutdown, reboot and logout call the local
Session Manager. Logout uses mode 1 (no redundant confirmation), never forced
mode 2. Shutdown/reboot attach a temporary listener to GNOME's end-session dialog.
The listener confirms only a matching, open, ordinary dialog without application
inhibitors, other sessions or update choices. Failed checks leave the native
confirmation in place. The listener expires after 15 seconds and is removed on
close, request completion, or extension disable.

GNOME 50's private fields `_type`, `_applications`, `_sessions`, `_checkBox`,
`_loginManager`, and `_confirm` are deliberately used here. Dialog types are
logout=0, shutdown=1, restart=2, update-restart=3. Review these against each new
GNOME version before adding it to `shell-version`. Do not treat metadata edits as
compatibility testing. The native-dialog integration test helps catch changes.

`disable()` restores the native close handler, disconnects stage and confirmation
signals, removes timeouts, cancels outstanding D-Bus callbacks, and immediately
removes the modal actor. Cancellation of a D-Bus call does not undo a power action
already accepted by the session manager.

Another extension that replaces the same Mutter handler can conflict. There is
no supported getter for an arbitrary prior custom handler; native behavior is
restored on disable. Avoid enabling both versions of this extension at once.

## Release checks

1. Review changes, especially callback lifetimes and power-action routing.
2. Run `node --check extension.js` and `node --check tests/smoke.js`.
3. Run `python3 tests/smoke.py` on GNOME 50; final power actions must stay stubbed.
4. Run `python3 tools/package.py`. Inspect the ZIP and checksum.
5. Keep personal configuration, installation records, and credentials outside git.
6. Tag a release and attach the ZIP and checksum. State tested GNOME versions.

The test scripts are development tools and are excluded from the install ZIP.
The build script uses an explicit file allowlist and fixed ZIP timestamps.

## GNOME Extensions submission

The GitHub release does not imply extensions.gnome.org approval.
Review the current [GNOME guidelines](https://gjs.guide/extensions/review-guidelines/review-guidelines.html)
before uploading the release ZIP at <https://extensions.gnome.org/upload/>.
The website requires a GNOME Extensions account and reviewer approval.

The guidelines require the submitting maintainer to understand and explain the
code, even when AI assisted development. Be transparent about that assistance;
do not present generated code as independently authored or claim prior review.
Reviewers may request changes to the confirmation integration or keyboard handler.

The GPL-2.0-or-later license is in each source header and LICENSE. The runtime
imports GNOME libraries, uses symbolic icons from the system theme, and bundles
no third-party runtime scripts or binaries.
