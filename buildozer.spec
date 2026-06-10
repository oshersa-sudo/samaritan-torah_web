[app]
title = התורה השומרונית
package.name = samaritantorah
package.domain = net.the-samaritans

source.dir = .
source.include_exts = py,png,jpg,kv,atlas,ttf,db
source.exclude_dirs = scripts,.git,__pycache__,.github
source.include_patterns = data/torah.db,assets/fonts/SBL_Hbrw.ttf,assets/fonts/Sam_font.ttf,assets/icons/*.png,assets/images/*.png,assets/images/*.jpg

version = 1.0

requirements = python3,kivy==2.3.1,arabic-reshaper,python-bidi,pillow

orientation = portrait
fullscreen = 0

icon.filename = assets/icons/app_icon.png

android.permissions = INTERNET
android.api = 33
android.minapi = 24
android.ndk = 25b
android.ndk_api = 24
android.archs = arm64-v8a
android.allow_backup = False
android.build_tools_version = 34.0.0
android.accept_sdk_license = True

[buildozer]
log_level = 2
warn_on_root = 1
