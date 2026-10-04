"""Install the verified UI-only update. Index is replaced last; no service restart."""
import hashlib
import json
import os
from pathlib import Path
import sys
import tempfile
import zipfile

FILES = {
    'public/index.html', 'public/css/mobile.css', 'public/js/mobile-ui.js',
    'public/js/chart.js', 'public/js/editor/ui.js', 'public/js/editor/render.js',
    'public/js/i18n.js', 'public/js/hero-motion.js', 'public/js/hosted.js',
    'server/admin.html', 'server/privacy.html',
}


def install(package, root=Path('/opt/yink'), check_only=False):
    root = Path(root).resolve(strict=True)
    with zipfile.ZipFile(package) as archive:
        names = archive.namelist()
        if len(names) != len(set(names)) or set(names) != FILES | {'manifest.json', 'apply-ui-update.py'}:
            raise ValueError('Unexpected update contents')
        manifest = json.loads(archive.read('manifest.json'))
        if set(manifest) != FILES:
            raise ValueError('Invalid update manifest')
        contents = {}
        for name in FILES:
            data = archive.read(name)
            if hashlib.sha256(data).hexdigest() != manifest[name]:
                raise ValueError('Hash mismatch: ' + name)
            target = root / name
            # Resolve symlinks before writing; every path must remain inside the installation.
            if not target.resolve().is_relative_to(root) or not target.parent.is_dir():
                raise ValueError('Invalid installation path: ' + name)
            contents[name] = data
    if check_only:
        print('Verified UI update:', len(contents), 'files; no changes made')
        return
    ordered = sorted(FILES - {'public/index.html'}) + ['public/index.html']
    for name in ordered:
        target = root / name
        fd, staged = tempfile.mkstemp(prefix='.yink-ui-', dir=target.parent)
        try:
            with os.fdopen(fd, 'wb') as output:
                output.write(contents[name])
                output.flush()
                os.fsync(output.fileno())
            os.chmod(staged, 0o644)
            os.replace(staged, target)
        finally:
            if os.path.exists(staged):
                os.unlink(staged)
    for name in FILES:
        if hashlib.sha256((root / name).read_bytes()).hexdigest() != manifest[name]:
            raise RuntimeError('Installed file mismatch: ' + name)
    print('UI update installed and verified:', len(contents), 'files')


if __name__ == '__main__':
    install(sys.argv[1], check_only='--check-only' in sys.argv[2:])
