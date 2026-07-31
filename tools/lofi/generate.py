#!/usr/bin/env python3
"""Rebuild every lo-fi mock in design/lofi/.

    python3 tools/lofi/generate.py

Edit the screen definitions, re-run, commit the SVGs. The SVGs are the artefact
the pipeline reads; this script is how they stay consistent and editable.
"""

import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
os.chdir(os.path.abspath(os.path.join(HERE, "..", "..")))

import screens_backoffice  # noqa: E402
import screens_landing  # noqa: E402
import screens_pos  # noqa: E402

written = []
for mod in (screens_pos, screens_backoffice, screens_landing):
    written += mod.build()

for p in written:
    print(p)
print(f"\n{len(written)} mocks written to design/lofi/")
