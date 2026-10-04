"""Build a small update containing the pending notice and mobile changes."""
import hashlib
import json
from pathlib import Path
import zipfile

root = Path(__file__).resolve().parent.parent
files = ['index.html', 'css/mobile.css', 'js/mobile-ui.js', 'js/chart.js',
         'js/editor/ui.js', 'js/editor/render.js', 'js/i18n.js', 'js/hero-motion.js',
         'js/hosted.js', 'server/admin.html', 'server/privacy.html']
manifest = {}
output = root / 'dist/YINK-mobile-update.zip'
output.parent.mkdir(exist_ok=True)
with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as archive:
    for source in files:
        name = source if source.startswith('server/') else 'public/' + source
        data = (root / source).read_bytes()
        manifest[name] = hashlib.sha256(data).hexdigest()
        archive.writestr(name, data)
    archive.writestr('manifest.json', json.dumps(manifest, indent=2))
    archive.write(root / 'deploy/apply-ui-update.py', 'apply-ui-update.py')
with zipfile.ZipFile(output) as archive:
    for name, digest in manifest.items():
        assert hashlib.sha256(archive.read(name)).hexdigest() == digest
print(f'Built and verified: {output} ({output.stat().st_size} bytes)')
