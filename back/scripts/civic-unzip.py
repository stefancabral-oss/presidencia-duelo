"""B02: bounded extraction of one exact TSE CSV; no extractall or path traversal."""
import argparse
import json
from pathlib import Path
import zipfile

parser = argparse.ArgumentParser()
parser.add_argument('archive')
parser.add_argument('member')
parser.add_argument('destination')
args = parser.parse_args()
if '/' in args.member or '\\' in args.member or not args.member.endswith('.csv'):
    raise ValueError('Expected one flat CSV filename')
target = Path(args.destination)
if target.exists():
    raise ValueError('Extraction destination must be new')
with zipfile.ZipFile(args.archive) as archive:
    infos = archive.infolist()
    if len(infos) > 200:
        raise ValueError('ZIP entry limit')
    selected = [entry for entry in infos if entry.filename == args.member]
    if len(selected) != 1:
        raise ValueError('Exact CSV member missing or duplicated')
    entry = selected[0]
    if entry.flag_bits & 1 or entry.file_size > 128 * 1024 * 1024 or entry.compress_size == 0 or entry.file_size > entry.compress_size * 500:
        raise ValueError('ZIP encryption/size/ratio limit')
    target.parent.mkdir(parents=True, exist_ok=True)
    owned_target = False
    try:
        with archive.open(entry) as source, target.open('xb') as destination:
            owned_target = True
            size = 0
            while chunk := source.read(65536):
                size += len(chunk)
                if size > 128 * 1024 * 1024:
                    raise ValueError('ZIP streaming size limit')
                destination.write(chunk)
        if size != entry.file_size:
            raise ValueError('ZIP truncated entry')
    except BaseException:
        if owned_target:
            target.unlink(missing_ok=True)
        raise
print(json.dumps({'member': args.member, 'bytes': size, 'crcVerified': True}))
