"""Package the backend and admin interface, excluding runtime data and credentials."""
import ast
import hashlib
import json
from pathlib import Path
import zipfile

root=Path(__file__).resolve().parent.parent
output=root/'dist/YINK-admin-update.zip'
files=['server/app.py','server/admin.html']
ast.parse((root/files[0]).read_text(encoding='utf-8-sig'))
manifest={name:hashlib.sha256((root/name).read_bytes()).hexdigest() for name in files}
with zipfile.ZipFile(output,'w',zipfile.ZIP_DEFLATED) as archive:
    for name in files:archive.write(root/name,name)
    archive.writestr('manifest.json',json.dumps(manifest,indent=2))
    archive.write(root/'deploy/apply-admin-update.py','apply-admin-update.py')
with zipfile.ZipFile(output) as archive:
    for name,digest in manifest.items():assert hashlib.sha256(archive.read(name)).hexdigest()==digest
print(f'Built and verified: {output} ({output.stat().st_size} bytes)')
