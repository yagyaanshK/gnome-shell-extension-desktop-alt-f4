# Maintenance notes

## How it works

`enable()` installs a custom handler for Mutter's `close` binding. Desktop-type
windows open `PowerDialog`; closable application windows receive the same delete
request as native closing. A stage-event fallback handles Alt+F4 when there is no
focused window and GNOME is in normal session mode.

`PowerDialog` is a GNOME modal dialog with focusable buttons. It handles arrows,
Enter, Escape, and a second Alt+F4. It waits for release of the opening F4 before
accepting another press, and dispatches at most one action per dialog.

All power operations call GNOME's `SystemActions.getDefault()` methods:
`activateSuspend`, `activateRestart`, `activatePowerOff`, and `activateLogout`.
The selected action's capability is checked again at dispatch because it may
change after the menu opens. GNOME owns asynchronous D-Bus communication,
confirmation dialogs, inhibitors, and updates. The extension does not connect to
`Main.endSessionDialog`, call its private fields, or send session-manager D-Bus
requests itself. There are no extension-owned asynchronous power callbacks,
cancellables, timers, or lifecycle guard flags.

`disable()` restores the native close handler, disconnects the stage and dialog
signals, releases the modal grab, destroys the dialog, and clears its references.
Normal menu closing uses ModalDialog's animation and destroy-on-close behavior.
Only OPENING or OPENED dialogs can dispatch an action, preventing another request
while the dialog is closing without a separate `_done` flag.

The integration test replaces the SystemActions methods with recording stubs and
checks that the modal grab is released before dispatch. It checks disable while
the menu is open, no interception after disable, and another enable/open/close cycle.

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

The GitHub release does not imply extensions.gnome.org approval. Version 1 was
rejected on 1 October 2026, citing AI-generated code and maintainership. The author
responded explaining the implementation and accepting maintenance responsibility.
On 5 October, the reviewer requested `SystemActions` and questioned `_lifecycle`.
Version 0.2.0, prepared on 8 October, implements both requests and retains the AI
assistance disclosure. It intentionally restores GNOME's standard confirmations.

Shexli previously reported EGO-L-003 for the dialog's destroy signal. The source
tracks and explicitly disconnects that handler before destroying the dialog;
the integration test verifies explicit disconnect and normal dialog cleanup.
Review the current [GNOME guidelines](https://gjs.guide/extensions/review-guidelines/review-guidelines.html)
before uploading the release ZIP at <https://extensions.gnome.org/upload/>.
The website requires a GNOME Extensions account and reviewer approval.

The guidelines require the submitting maintainer to understand and explain the
code, even when AI assisted development. Be transparent about that assistance;
do not present generated code as independently authored or claim prior review.
Reviewers may request further changes to the implementation or keyboard handler.

The GPL-2.0-or-later license is in each source header and LICENSE. The runtime
imports GNOME libraries, uses symbolic icons from the system theme, and bundles
no third-party runtime scripts or binaries.
