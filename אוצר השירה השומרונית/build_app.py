# -*- coding: utf-8 -*-
"""Make the archive into one file you can double-click.

    py -3 build_app.py

Produces dist/אוצר השירה השומרונית.exe — a single file, no console, nothing
to install. It carries the page, the stylesheet, the script, the sounds, the
fonts and the catalogue inside it; the recordings themselves stay where they
have always been, on the drive and on the media server, because nobody wants
a 25 GB program.

What is deliberately NOT bundled: the editor's own files. additions.json and
its companions are read from beside the executable if they are there, so that
an archive edited today is not frozen into a program built last month. Put the
exe in the unit's own folder and it finds everything; put it elsewhere and it
falls back to what was built in.
"""
import os
import shutil
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
NAME = 'אוצר השירה השומרונית'

# what the page itself needs. Folders are copied whole.
BUNDLE = ['index.html', 'unit.css', 'unit.js', 'VERSION', 'serve.py',
          'scripts', 'data/catalog.json', 'data/pix_sources.json',
          'data/local_media.json', 'img', 'fonts', 'sounds']


def add_data(rel):
    src = os.path.join(HERE, rel)
    if not os.path.exists(src):
        return []
    dest = os.path.dirname(rel).replace('/', os.sep) or '.'
    return ['--add-data', '%s%s%s' % (src, os.pathsep, dest)]


def main():
    args = [sys.executable, '-m', 'PyInstaller',
            '--noconfirm', '--clean', '--onefile', '--windowed',
            '--name', NAME,
            '--distpath', os.path.join(HERE, 'dist'),
            '--workpath', os.path.join(HERE, 'build'),
            '--specpath', os.path.join(HERE, 'build'),
            # pywebview reaches its backend at run time, so it has to be told
            '--hidden-import', 'webview.platforms.winforms',
            '--hidden-import', 'clr_loader',
            '--collect-all', 'webview',
            ]
    icon = os.path.join(HERE, 'img', 'icon.ico')
    if os.path.exists(icon):
        args += ['--icon', icon]
    for rel in BUNDLE:
        args += add_data(rel)
    args += [os.path.join(HERE, 'desktop.py')]

    print('building %s …\n' % NAME)
    r = subprocess.run(args, cwd=HERE)
    if r.returncode:
        return r.returncode
    exe = os.path.join(HERE, 'dist', NAME + '.exe')
    if os.path.exists(exe):
        print('\n%s' % exe)
        print('%.1f MB' % (os.path.getsize(exe) / 1e6))
        print('\nהעתק אותו לתיקיית היחידה והפעל בלחיצה כפולה.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
