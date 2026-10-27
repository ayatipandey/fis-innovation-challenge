"""Vercel Function: the Python AI service (moment engine, Pilot, insights)."""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "services", "recommender"))

from app.main import app  # noqa: E402,F401
