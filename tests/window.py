import gi
gi.require_version('Gtk', '4.0')
from gi.repository import Gtk
app = Gtk.Application(application_id='local.desktop.PowerMenuTest')
def activate(app):
    for name in ['Power Test Desktop', 'Power Test Application']:
        win = Gtk.ApplicationWindow(application=app, title=name, default_width=600, default_height=350)
        win.set_child(Gtk.Label(label=name))
        win.present()
app.connect('activate', activate)
app.run([])
