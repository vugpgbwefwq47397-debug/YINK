"""Verify the UI package in a disposable installation, including rejection before writes."""
import hashlib
import json
from pathlib import Path
import runpy
import tempfile
import zipfile

project = Path(__file__).resolve().parent.parent
module = runpy.run_path(str(project / 'deploy/apply-ui-update.py'))
install, files = module['install'], module['FILES']
package = project / 'dist/YINK-mobile-update.zip'
with tempfile.TemporaryDirectory(prefix='yink-ui-update-', dir=project / 'tests') as directory:
    root = Path(directory)
    assert root.resolve().is_relative_to(project.resolve())
    for name in files:
        target = root / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(b'old UI')
    database = root / 'server/private.sqlite'
    database.write_bytes(b'private data')
    install(package, root, check_only=True)
    assert all((root / name).read_bytes() == b'old UI' for name in files)
    corrupt = root / 'corrupt.zip'
    with zipfile.ZipFile(package) as source, zipfile.ZipFile(corrupt, 'w') as output:
        for entry in source.infolist():
            output.writestr(entry.filename, b'corrupt' if entry.filename == 'public/index.html' else source.read(entry.filename))
    try:
        install(corrupt, root)
        raise AssertionError('Corrupt update accepted')
    except ValueError as error:
        assert 'Hash mismatch' in str(error)
    assert all((root / name).read_bytes() == b'old UI' for name in files)
    install(package, root)
    with zipfile.ZipFile(package) as archive:
        manifest = json.loads(archive.read('manifest.json'))
    for name, digest in manifest.items():
        assert hashlib.sha256((root / name).read_bytes()).hexdigest() == digest
    assert database.read_bytes() == b'private data'
print('UI update package tests passed')

admin_module=runpy.run_path(str(project/'deploy/apply-admin-update.py'))
with tempfile.TemporaryDirectory(prefix='yink-admin-update-',dir=project/'tests') as directory:
    root=Path(directory)
    assert root.resolve().is_relative_to(project.resolve())
    (root/'server').mkdir()
    private=root/'server/yink.sqlite';private.write_bytes(b'private data')
    admin_module['install'](project/'dist/YINK-admin-update.zip',root,check_only=True)
    assert not (root/'server/app.py').exists()
    admin_module['install'](project/'dist/YINK-admin-update.zip',root)
    assert (root/'server/app.py').read_bytes()==(project/'server/app.py').read_bytes()
    assert private.read_bytes()==b'private data'
print('Admin update package tests passed')
