"""Apply the admin update without touching site data, passwords or settings."""
import ast
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import time
import urllib.request
import zipfile

FILES = {'server/app.py', 'server/admin.html'}


def install(package, root=Path('/opt/yink'), check_only=False):
    root = Path(root).resolve(strict=True)
    with zipfile.ZipFile(package) as archive:
        names = archive.namelist()
        if len(names) != len(set(names)) or set(names) != FILES | {'manifest.json','apply-admin-update.py'}:
            raise ValueError('Unexpected update contents')
        manifest = json.loads(archive.read('manifest.json'))
        if set(manifest) != FILES: raise ValueError('Invalid manifest')
        contents = {}
        for name in FILES:
            data = archive.read(name)
            if hashlib.sha256(data).hexdigest() != manifest[name]: raise ValueError('Hash mismatch: '+name)
            target = root/name
            if not target.resolve().is_relative_to(root) or not target.parent.is_dir(): raise ValueError('Invalid path')
            contents[name] = data
        ast.parse(contents['server/app.py'].decode('utf-8-sig'))
    if check_only:
        print('Verified admin update: 2 files; no changes made')
        return
    for name in sorted(FILES):
        target=root/name
        fd,staged=tempfile.mkstemp(prefix='.yink-admin-',dir=target.parent)
        try:
            with os.fdopen(fd,'wb') as output:
                output.write(contents[name]);output.flush();os.fsync(output.fileno())
            os.chmod(staged,0o644);os.replace(staged,target)
        finally:
            if os.path.exists(staged):os.unlink(staged)
    for name in FILES:
        if hashlib.sha256((root/name).read_bytes()).hexdigest()!=manifest[name]:raise RuntimeError('Installed hash mismatch')
    print('Admin update installed and verified: 2 files')


if __name__=='__main__':
    check='--check-only' in sys.argv[2:]
    install(sys.argv[1],check_only=check)
    if not check:
        subprocess.run(['systemctl','restart','yink'],check=True,timeout=45)
        healthy=False
        for attempt in range(12):
            try:
                with urllib.request.urlopen('http://127.0.0.1:8766/api/health',timeout=2) as response:
                    healthy=json.load(response).get('ok') is True
                if healthy:break
            except Exception:pass
            time.sleep(.5)
        if not healthy:raise RuntimeError('Service health check failed; inspect systemctl status yink')
        print('YINK service healthy; admin update ready')
