// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright (C) 2026 Yagyaansh Khaneja

import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as ModalDialog from 'resource:///org/gnome/shell/ui/modalDialog.js';
import * as SystemActions from 'resource:///org/gnome/shell/misc/systemActions.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

const OPTIONS = [
    {id: 'suspend', label: 'Suspend', icon: 'media-playback-pause-symbolic', capability: 'canSuspend'},
    {id: 'restart', label: 'Restart', icon: 'view-refresh-symbolic', capability: 'canRestart'},
    {id: 'poweroff', label: 'Power Off', icon: 'system-shutdown-symbolic', capability: 'canPowerOff'},
    {id: 'logout', label: 'Log Out', icon: 'system-log-out-symbolic', capability: 'canLogout'},
];

export const PowerDialog = GObject.registerClass(class PowerDialog extends ModalDialog.ModalDialog {
    _init(actions, activate) {
        super._init({styleClass: 'desktop-power-dialog'});
        this._activate = activate;
        // The opening F4 press must be released before a second press can request power-off.
        this._f4Released = false;
        this._options = OPTIONS.filter(option => actions[option.capability]);
        this._selected = Math.max(0, this._options.findIndex(option => option.id === 'poweroff'));
        this.contentLayout.add_child(new St.Icon({
            icon_name: 'system-shutdown-symbolic', style_class: 'desktop-power-icon',
            x_align: Clutter.ActorAlign.CENTER,
        }));
        this.contentLayout.add_child(new St.Label({
            text: 'Power options', style_class: 'desktop-power-title',
            x_align: Clutter.ActorAlign.CENTER,
        }));
        this._rows = this._options.map((option, index) => {
            const row = new St.Button({style_class: 'desktop-power-row',
                can_focus: true, x_expand: true, accessible_name: option.label});
            const box = new St.BoxLayout({style_class: 'desktop-power-row-content'});
            box.add_child(new St.Icon({icon_name: option.icon, icon_size: 20}));
            box.add_child(new St.Label({text: option.label, y_align: Clutter.ActorAlign.CENTER}));
            row.set_child(box);
            row.connect('clicked', () => this._run(option.id));
            row.connect('key-focus-in', () => this._select(index, false));
            this.contentLayout.add_child(row);
            return row;
        });
        this.contentLayout.add_child(new St.Label({
            text: '↑ ↓ Choose   ·   Enter Select   ·   Esc Cancel',
            style_class: 'desktop-power-hint', x_align: Clutter.ActorAlign.CENTER,
        }));
        this.contentLayout.add_child(new St.Label({
            text: 'Alt+F4 again opens power-off confirmation', style_class: 'desktop-power-hint',
            x_align: Clutter.ActorAlign.CENTER,
        }));
        this.addButton({label: 'Cancel', action: () => this.close()});
        if (this._rows.length) {
            this._select(this._selected, false);
            this.setInitialKeyFocus(this._rows[this._selected]);
        }
        this.connect('captured-event', (_actor, event) => this._handleEvent(event));
    }

    _select(index, focus = true) {
        this._selected = index;
        this._rows.forEach((row, i) => {
            if (i === index)
                row.add_style_pseudo_class('selected');
            else
                row.remove_style_pseudo_class('selected');
        });
        if (focus)
            this._rows[index]?.grab_key_focus();
    }

    _handleEvent(event) {
        const type = event.type();
        if (type !== Clutter.EventType.KEY_PRESS && type !== Clutter.EventType.KEY_RELEASE)
            return Clutter.EVENT_PROPAGATE;
        const key = event.get_key_symbol();
        if (type === Clutter.EventType.KEY_RELEASE) {
            if (key === Clutter.KEY_F4)
                this._f4Released = true;
            return Clutter.EVENT_PROPAGATE;
        }
        if (key === Clutter.KEY_F4 && (event.get_state() & Clutter.ModifierType.MOD1_MASK)) {
            if (this._f4Released)
                this._run('poweroff');
            return Clutter.EVENT_STOP;
        }
        if (key === Clutter.KEY_Escape) {
            this.close();
            return Clutter.EVENT_STOP;
        }
        const count = this._rows.length;
        if (count && [Clutter.KEY_Up, Clutter.KEY_Left, Clutter.KEY_Down, Clutter.KEY_Right].includes(key)) {
            const step = [Clutter.KEY_Up, Clutter.KEY_Left].includes(key) ? -1 : 1;
            this._select((this._selected + step + count) % count);
            return Clutter.EVENT_STOP;
        }
        if (count && [Clutter.KEY_Return, Clutter.KEY_KP_Enter].includes(key) &&
            this._rows.includes(global.stage.key_focus)) {
            this._run(this._options[this._selected].id);
            return Clutter.EVENT_STOP;
        }
        return Clutter.EVENT_PROPAGATE;
    }

    _run(id) {
        if (![ModalDialog.State.OPENED, ModalDialog.State.OPENING].includes(this.state) ||
            !this._options.some(option => option.id === id))
            return;
        // Release the modal grab before GNOME begins its own session-end flow.
        this.close();
        this._activate(id);
    }
});

export default class DesktopAltF4 extends Extension {
    enable() {
        this._actions = SystemActions.getDefault();
        this._stageEventId = global.stage.connect('captured-event', (_stage, event) => {
            if (Main.actionMode === Shell.ActionMode.NORMAL && !global.display.focus_window &&
                event.type() === Clutter.EventType.KEY_PRESS && event.get_key_symbol() === Clutter.KEY_F4 &&
                (event.get_state() & Clutter.ModifierType.MOD1_MASK)) {
                this._showPowerOptions();
                return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_PROPAGATE;
        });
        Meta.keybindings_set_custom_handler('close', (_display, window, event) => {
            if (window?.get_window_type() === Meta.WindowType.DESKTOP)
                this._showPowerOptions();
            else if (window?.can_close())
                window.delete(event?.get_time() ?? global.get_current_time());
        });
    }

    disable() {
        Meta.keybindings_set_custom_handler('close', null);
        if (this._stageEventId)
            global.stage.disconnect(this._stageEventId);
        this._stageEventId = 0;
        if (this._dialog) {
            if (this._dialogDestroyId)
                this._dialog.disconnect(this._dialogDestroyId);
            this._dialogDestroyId = 0;
            this._dialog.popModal();
            this._dialog.destroy();
        }
        this._dialog = null;
        this._actions = null;
    }

    _showPowerOptions() {
        if (this._dialog)
            return;
        const dialog = new PowerDialog(this._actions, id => this._execute(id));
        this._dialog = dialog;
        this._dialogDestroyId = dialog.connect('destroy', () => {
            if (this._dialog === dialog) {
                this._dialog = null;
                this._dialogDestroyId = 0;
            }
        });
        if (!dialog.open())
            dialog.destroy();
    }

    _execute(id) {
        const option = OPTIONS.find(item => item.id === id);
        if (!option || !this._actions[option.capability])
            return;
        try {
            switch (id) {
            case 'suspend':
                this._actions.activateSuspend();
                break;
            case 'restart':
                this._actions.activateRestart();
                break;
            case 'poweroff':
                this._actions.activatePowerOff();
                break;
            case 'logout':
                this._actions.activateLogout();
                break;
            }
        } catch (error) {
            Main.notifyError('Power action could not complete', error.message);
        }
    }
}
