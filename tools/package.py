#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-2.0-or-later
"""Build a deterministic extension ZIP from an explicit public-file allowlist."""
import hashlib
import json
from pathlib import Path
import zipfile

root = Path(__file__).resolve().parents[1]
metadata = json.loads((root / 'metadata.json').read_text())
output = root / 'dist'
output.mkdir(exist_ok=True)
archive = output / (metadata['uuid'] + '.shell-extension.zip')
files = ['extension.js', 'metadata.json', 'stylesheet.css', 'LICENSE']
with zipfile.ZipFile(archive, 'w', compression=zipfile.ZIP_DEFLATED) as bundle:
    for name in files:
        info = zipfile.ZipInfo(name, date_time=(2026, 1, 1, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = 0o100644 << 16
        bundle.writestr(info, (root / name).read_bytes())
digest = hashlib.sha256(archive.read_bytes()).hexdigest()
(output / 'SHA256SUMS').write_text(f'{digest}  {archive.name}\n')
with zipfile.ZipFile(archive) as bundle:
    assert bundle.namelist() == files
    assert bundle.testzip() is None
print(archive)
print(digest)
