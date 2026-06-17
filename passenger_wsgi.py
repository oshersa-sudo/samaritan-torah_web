# Entry point for cPanel "Setup Python App" (Phusion Passenger).
# Place this file in the Application Root you set in cPanel; Passenger looks for
# an object named `application`.
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from web.server import app as application   # noqa: E402
