"""Isolated GNOME test. All power actions are replaced with recording stubs."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import time

ROOT = Path(__file__).resolve().parents[1]
UUID = 'desktop-alt-f4@yagyaanshK.github.io'

def inside():
    home = Path(os.environ['HOME'])
    extensions = home / 'data/gnome-shell/extensions'
    dest = extensions / UUID
    shutil.copytree(ROOT, dest, ignore=shutil.ignore_patterns('tests', 'before.json'))
    test = extensions / 'desktop-power-test@test.invalid'
    test.mkdir()
    (test / 'metadata.json').write_text(json.dumps({'uuid': test.name, 'name': 'Power menu test',
        'description': 'Disposable test', 'shell-version': ['50']}))
    result = home / 'result.json'
    script = (ROOT / 'tests/smoke.js').read_text().replace('RESULT_PATH', json.dumps(str(result)))
    (test / 'extension.js').write_text(script)
    subprocess.run(['gsettings', 'set', 'org.gnome.shell', 'enabled-extensions', str([UUID, test.name])], check=True)
    log = home / 'shell.log'
    with log.open('w') as output:
        shell = subprocess.Popen(['gnome-shell', '--headless', '--wayland', '--no-x11',
            '--virtual-monitor=1280x720', '--mode=user'], stdout=output, stderr=output,
            env=dict(os.environ, GNOME_SHELL_SESSION_MODE='user', LIBGL_ALWAYS_SOFTWARE='1'))
        app = None
        try:
            for _ in range(150):
                if (home / 'runtime/wayland-0').exists(): break
                time.sleep(.1)
            app = subprocess.Popen(['/usr/bin/python3', str(ROOT / 'tests/window.py')],
                env=dict(os.environ, WAYLAND_DISPLAY='wayland-0', GDK_BACKEND='wayland', GTK_USE_PORTAL='0'), stdout=output, stderr=output)
            for _ in range(350):
                if result.exists():
                    data = json.loads(result.read_text())
                    print(json.dumps(data, indent=2))
                    if not data['ok']: raise AssertionError('GNOME test failed')
                    return
                if shell.poll() is not None: break
                time.sleep(.1)
            raise AssertionError('Test timed out')
        except Exception:
            print(log.read_text()[-10000:]); raise
        finally:
            if app: app.terminate(); app.wait(timeout=5)
            shell.terminate()
            try: shell.wait(timeout=5)
            except subprocess.TimeoutExpired: shell.kill(); shell.wait()

if __name__ == '__main__':
    if '--inside' in sys.argv:
        inside()
    else:
        with tempfile.TemporaryDirectory(prefix='desktop-power-test-', ignore_cleanup_errors=True) as tmp:
            env = dict(os.environ, HOME=tmp, XDG_CONFIG_HOME=tmp+'/config', XDG_CACHE_HOME=tmp+'/cache',
                XDG_DATA_HOME=tmp+'/data', XDG_RUNTIME_DIR=tmp+'/runtime', GIO_USE_VFS='local')
            for key in ['DCONF_PROFILE', 'GSETTINGS_BACKEND']:
                env.pop(key, None)
            Path(env['XDG_RUNTIME_DIR']).mkdir(mode=0o700)
            # Isolation precedes bus activation; dconf never sees the real HOME.
            try:
                subprocess.run(['dbus-run-session', '--', sys.executable, __file__, '--inside'],
                    env=env, check=True, stderr=subprocess.DEVNULL)
            finally:
                # The disposable document portal may leave a FUSE mount during exit.
                subprocess.run(['fusermount3', '-u', '-z', tmp+'/runtime/doc'],
                    stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False)
