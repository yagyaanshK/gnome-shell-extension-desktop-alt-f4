// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright (C) 2026 Yagyaansh Khaneja

import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Shell from 'gi://Shell';
import Meta from 'gi://Meta';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

const pause = ms => new Promise(resolve => GLib.timeout_add(GLib.PRIORITY_DEFAULT, ms, () => {
    resolve(); return GLib.SOURCE_REMOVE;
}));
function assert(ok, text) { if (!ok) throw new Error(text); }
export default class Test extends Extension {
    enable() {
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 2000, () => {
            this.run().catch(e => this.finish({ok:false, error:e.message, stack:e.stack}));
            return GLib.SOURCE_REMOVE;
        });
    }
    finish(data) { GLib.file_set_contents(RESULT_PATH, JSON.stringify(data)); }
    async run() {
        const ext = Main.extensionManager.lookup('desktop-alt-f4@yagyaanshK.github.io')?.stateObj;
        assert(ext, 'Extension loaded');
        const requests = [];
        // Never allow a real power operation from this test shell.
        const record = id => {
            assert(!ext._dialog._hasModal, 'Release modal grab before SystemActions');
            requests.push(id);
        };
        const actions = {
            canSuspend: true, canRestart: true, canPowerOff: true, canLogout: true,
            activateSuspend: () => record('suspend'),
            activateRestart: () => record('restart'),
            activatePowerOff: () => record('poweroff'),
            activateLogout: () => record('logout'),
        };
        ext._actions = actions;
        const keyboard = Clutter.get_default_backend().get_default_seat().create_virtual_device(Clutter.InputDeviceType.KEYBOARD_DEVICE);
        const key = (symbol, pressed) => keyboard.notify_keyval(GLib.get_monotonic_time(), symbol,
            pressed ? Clutter.KeyState.PRESSED : Clutter.KeyState.RELEASED);
        const tap = async symbol => {key(symbol,true); await pause(40); key(symbol,false); await pause(100);};
        const altF4 = async () => {key(Clutter.KEY_Alt_L,true); await tap(Clutter.KEY_F4); key(Clutter.KEY_Alt_L,false); await pause(120);};
        const windows = () => global.get_window_actors().map(actor => actor.meta_window);
        for (let i=0; i<80 && windows().length<2; i++) await pause(100);
        let normal = windows().find(w => w.title === 'Power Test Application');
        const desktop = windows().find(w => w.title === 'Power Test Desktop');
        assert(normal && desktop, 'Test windows present');
        Main.overview.hide(); await pause(300);
        normal.activate(global.get_current_time()); await pause(150);
        await altF4();
        assert(!windows().some(w => w.title === 'Power Test Application'), 'Normal app Alt+F4 closes window');
        assert(!ext._dialog, 'Normal app close does not open power menu');
        desktop.set_type(Meta.WindowType.DESKTOP);
        desktop.activate(global.get_current_time()); await pause(150);
        await altF4();
        assert(ext._dialog, 'Desktop Alt+F4 opens menu');
        assert(ext._dialog._options[ext._dialog._selected].id === 'poweroff', 'Power Off selected');
        const stream = Gio.File.new_for_path('/tmp/desktop-power-menu-preview.png').replace(null, false, Gio.FileCreateFlags.NONE, null);
        await new Shell.Screenshot().screenshot(false, stream);
        stream.close(null);
        await tap(Clutter.KEY_Up);
        assert(ext._dialog._options[ext._dialog._selected].id === 'restart', 'Up selects restart');
        await tap(Clutter.KEY_Return);
        assert(requests.join() === 'restart', 'Enter requests selected restart');
        await pause(200);
        desktop.activate(global.get_current_time()); await pause(100);
        await altF4(); await tap(Clutter.KEY_Escape); await pause(200);
        assert(!ext._dialog && !ext._dialogDestroyId && requests.length===1, 'Escape cancels and clears dialog handler tracking');
        desktop.activate(global.get_current_time()); await pause(100);
        key(Clutter.KEY_Alt_L,true); key(Clutter.KEY_F4,true); await pause(1100);
        assert(ext._dialog && requests.length===1, 'Holding opening Alt+F4 never powers off');
        key(Clutter.KEY_F4,false); key(Clutter.KEY_Alt_L,false); await pause(150);
        await altF4();
        assert(requests.join() === 'restart,poweroff', 'Second Alt+F4 requests poweroff');
        await pause(200);
        for (const [steps, id] of [[2,'suspend'],[-1,'logout']]) {
            desktop.activate(global.get_current_time()); await pause(100); await altF4();
            for (let i=0;i<Math.abs(steps);i++) await tap(steps>0 ? Clutter.KEY_Up : Clutter.KEY_Down);
            await tap(Clutter.KEY_Return); await pause(200);
            assert(requests.at(-1)===id, `Enter requests ${id}`);
        }
        // A capability can change while the menu is open.
        desktop.activate(global.get_current_time()); await pause(100); await altF4();
        actions.canPowerOff = false;
        const count = requests.length;
        await tap(Clutter.KEY_Return); await pause(200);
        assert(requests.length === count, 'Unavailable action is not dispatched');
        // Initially unavailable actions are omitted, including second-Alt+F4 routing.
        desktop.activate(global.get_current_time()); await pause(100); await altF4();
        assert(!ext._dialog._options.some(option => option.id === 'poweroff'), 'Hide unavailable poweroff');
        await altF4();
        assert(requests.length === count && ext._dialog, 'Second Alt+F4 does not request unavailable poweroff');
        await tap(Clutter.KEY_Escape); await pause(200);
        actions.canPowerOff = true;
        // Only one action is dispatched while the modal is closing.
        desktop.activate(global.get_current_time()); await pause(100); await altF4();
        const closingDialog = ext._dialog;
        closingDialog._run('poweroff');
        closingDialog._run('restart');
        assert(requests.length === count + 1 && requests.at(-1) === 'poweroff', 'Ignore repeated activation during close');
        await pause(200);
        desktop.delete(global.get_current_time()); await pause(300);
        Main.overview.hide(); await pause(300);
        assert(!global.display.focus_window, 'No focused application remains');
        await altF4();
        assert(ext._dialog, 'Alt+F4 also opens menu with no focused window');
        await tap(Clutter.KEY_Escape); await pause(200);
        // Restore native close behavior and remove all hooks.
        ext._showPowerOptions();
        const lastDialog = ext._dialog;
        assert(lastDialog, 'Dialog open before disable');
        const disconnect = lastDialog.disconnect.bind(lastDialog);
        const destroyId = ext._dialogDestroyId;
        let destroyHandlerDisconnected = false;
        lastDialog.disconnect = id => {
            if (id === destroyId)
                destroyHandlerDisconnected = true;
            return disconnect(id);
        };
        ext.disable();
        assert(destroyHandlerDisconnected && !ext._dialogDestroyId, 'Disable explicitly disconnects the dialog destroy handler');
        assert(!lastDialog.get_parent() && !ext._stageEventId, 'Disable removes modal actor and keyboard hook immediately');
        await altF4();
        assert(!ext._dialog, 'Disabled extension no longer intercepts empty-desktop keys');
        ext.enable();
        ext._actions = actions;
        await altF4();
        assert(ext._dialog, 'Menu works after re-enable');
        await tap(Clutter.KEY_Escape); await pause(200);
        ext.disable();
        this.finish({ok:true, requests, checks:['app close', 'desktop menu', 'default selection',
            'arrows', 'Enter', 'Escape', 'held-key guard', 'second Alt+F4', 'SystemActions routing', 'unavailable actions', 'single dispatch', 'empty desktop', 'disable cleanup', 're-enable']});
    }
    disable() {}
}
