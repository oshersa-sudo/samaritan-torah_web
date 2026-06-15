# -*- coding: utf-8 -*-
"""
Share a PNG (a screenshot of the current results) to WhatsApp / e-mail / Facebook.

On Android the image is published to the gallery via MediaStore (which yields a
shareable content:// URI without needing a FileProvider) and handed to an
ACTION_SEND intent, targeting the chosen app's package (falling back to the
system chooser when the app isn't installed, and always for e-mail). On the
desktop there are no such apps, so the saved image is simply opened — the real
sharing is exercised on the device.
"""
import os
from kivy.utils import platform

_PKG = {'whatsapp': 'com.whatsapp', 'facebook': 'com.facebook.katana'}


def share_image(path, target, text=''):
    """target in {'whatsapp','email','facebook'}. Returns True on success."""
    if not path or not os.path.exists(path):
        return False
    try:
        if platform == 'android':
            _share_android(path, target, text)
        else:
            _share_desktop(path)
        return True
    except Exception as e:                      # never crash the UI over a share
        print('share error:', e)
        return False


def _share_android(path, target, text):
    from jnius import autoclass, cast
    PythonActivity = autoclass('org.kivy.android.PythonActivity')
    Intent = autoclass('android.content.Intent')
    Uri = autoclass('android.net.Uri')
    Media = autoclass('android.provider.MediaStore$Images$Media')
    String = autoclass('java.lang.String')
    activity = PythonActivity.mActivity

    url = Media.insertImage(activity.getContentResolver(), path, 'samaritan_torah', '')
    uri = Uri.parse(url)

    def build():
        i = Intent(Intent.ACTION_SEND)
        i.setType('image/png')
        i.putExtra(Intent.EXTRA_STREAM, cast('android.os.Parcelable', uri))
        if text:
            i.putExtra(Intent.EXTRA_TEXT, cast('java.lang.CharSequence', String(text)))
            i.putExtra(Intent.EXTRA_SUBJECT, cast('java.lang.CharSequence', String(text)))
        i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        return i

    pkg = _PKG.get(target)
    if pkg:
        i = build()
        i.setPackage(pkg)
        try:
            activity.startActivity(i)
            return
        except Exception:
            pass                                # app not installed -> chooser
    chooser = Intent.createChooser(build(), cast('java.lang.CharSequence', String('שיתוף')))
    chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    activity.startActivity(chooser)


def _share_desktop(path):
    if os.name == 'nt':
        os.startfile(os.path.abspath(path))     # noqa: P204 (Windows only)
    else:
        import webbrowser
        webbrowser.open('file://' + os.path.abspath(path))
