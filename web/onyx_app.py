# -*- coding: utf-8 -*-
"""
onyx_app — unified production app for onyx-study.com
====================================================
One Flask process that serves BOTH:

  * the multi-subject trainer  (/, /exam, /static/*)  — English / Hebrew / Math
  * the learning backend       (/api/*, /parent, /health)  — accounts,
    6-digit verification codes, result syncing and the parent portal.

Because both live on the same origin, the trainer syncs to the backend with
plain same-origin requests — no CORS, no second domain needed.

Run locally:
    python3 web/onyx_app.py            # → http://127.0.0.1:8000/exam

Production (behind Nginx, see web/deploy/onyx-study.conf):
    gunicorn -w 3 -b 127.0.0.1:8000 web.onyx_app:app

Environment:
    APP_VERSION   version string shown in the UI (default 1.0)
    PORT          dev port (default 8000)
    LEARN_DB      sqlite path (default web/learn.db)
    LEARN_DEV     "1" in dev → verification codes returned in the API/console;
                  set to "0" in production so codes only go out by e-mail
    SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS/SMTP_FROM   e-mail the codes
    LEARN_BACKEND override the sync origin passed to the page (default: same
                  origin as the incoming request, which is what you want)
"""
import os, sys
from flask import Flask, render_template, request, send_from_directory

# make `import learn_backend` work no matter how gunicorn loads this module
BASE = os.path.dirname(os.path.abspath(__file__))
if BASE not in sys.path:
    sys.path.insert(0, BASE)

import learn_backend as lb
app = Flask(__name__,
            template_folder=os.path.join(BASE, "templates"),
            static_folder=os.path.join(BASE, "static"))

# initialise the sqlite schema and mount all backend routes on this app
lb.init_db()
app.register_blueprint(lb.bp)


@app.route("/")
@app.route("/exam")
def exam():
    # Same-origin by default: the page talks to /api/* on this very host.
    origin = os.environ.get("LEARN_BACKEND") or request.url_root.rstrip("/")
    return render_template("exam.html",
                           version=os.environ.get("APP_VERSION", "1.0"),
                           learn_backend=origin,
                           pic_key=os.environ.get("PIXABAY_KEY", ""))


@app.route("/sw.js")
def service_worker():
    # served from the root so its scope covers "/" and "/exam"
    resp = send_from_directory(app.static_folder, "learn_sw.js",
                               mimetype="application/javascript")
    resp.headers["Service-Worker-Allowed"] = "/"
    resp.headers["Cache-Control"] = "no-cache"
    return resp


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8000"))
    print(f"[onyx] trainer + backend on http://127.0.0.1:{port}/exam  (parent portal: /parent)")
    app.run(host="0.0.0.0", port=port)
