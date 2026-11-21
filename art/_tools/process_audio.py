"""Cut, clean, loudness-match and encode the chosen CC0 sounds into the repo.
   python process_audio.py <repo_root>
Outputs per character:
   assets/pets/{pet}/sounds/{name}.ogg         (Opus 48 kHz mono, shipped)
   art/{pet}/audio/source/{freesound_id}.mp3   (downloaded CC0 preview, provenance; not shipped)
   art/{pet}/audio/SOURCES.json                (author, link, licence, cut, loudness per file)
"""
import json, os, shutil, subprocess, sys
import numpy as np
from scipy import signal
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, 'pylib'))
import imageio_ffmpeg
FF = imageio_ffmpeg.get_ffmpeg_exe()
SR = 48000
ROOT = sys.argv[1]
cands = json.load(open(os.path.join(HERE, 'cands.json'), encoding='utf-8'))
META = {c['id']: c for v in cands.values() for c in v}

# (pet, name, freesound id, window start, window end, highpass Hz, lowpass Hz, gain dB vs. reference)
PLAN = [
    ('cat_mochi', 'meow_01', 686775, 0.05, 1.00, 250, 9000, 0),
    ('cat_mochi', 'meow_02', 448084, 0.00, 0.58, 300, 9000, 0),
    ('cat_mochi', 'meow_low', 333916, 0.10, 1.34, 200, 5000, -1),
    ('cat_mochi', 'trill_01', 850104, 0.12, 0.92, 120, 4000, -2),
    ('cat_mochi', 'purr_01', 575933, 0.05, 1.20, 40, 2500, -7),
    ('cat_mochi', 'purr_02', 575933, 1.65, 2.75, 40, 2500, -7),
    ('dog_boba', 'bark_01', 583142, 0.05, 0.42, 150, 10000, -1),
    ('dog_boba', 'bark_02', 583142, 0.55, 0.92, 150, 10000, -1),
    ('dog_boba', 'bark_03', 625274, 0.15, 0.58, 150, 10000, -1),
    ('dog_boba', 'bark_04', 630648, 0.68, 1.30, 120, 10000, -1),
    ('dog_boba', 'bark_triple', 583142, 0.00, 1.45, 150, 10000, -2),
    ('dog_boba', 'whine_01', 350593, 0.00, 0.80, 200, 9000, -3),
    ('dog_boba', 'sniff_01', 528939, 0.55, 1.45, 300, 11000, -6),
    ('bunny_cloud', 'squeak_01', 435748, 0.08, 0.38, 300, 10000, -4),
    ('bunny_cloud', 'squeak_02', 435748, 0.42, 0.78, 300, 10000, -4),
    ('bunny_cloud', 'squeak_03', 435748, 0.84, 1.18, 300, 10000, -4),
    ('bunny_cloud', 'squeak_triple', 435748, 0.05, 1.20, 300, 10000, -5),
    ('bunny_cloud', 'squeak_tiny', 800274, 0.00, 0.24, 500, 12000, -6),
    ('bunny_cloud', 'sneeze_01', 205576, 0.52, 0.90, 300, 11000, -6),
    ('penguin_pip', 'squeak_01', 705839, 0.02, 0.30, 300, 11000, -2),
    ('penguin_pip', 'squeak_02', 705839, 0.29, 0.58, 300, 11000, -2),
    ('penguin_pip', 'squeak_double', 705839, 0.00, 0.60, 300, 11000, -3),
    ('penguin_pip', 'chirp_01', 519193, 0.00, 0.20, 800, 12000, -3),
    ('penguin_pip', 'chirp_02', 519193, 0.40, 0.66, 800, 12000, -3),
    ('penguin_pip', 'chirp_run', 519193, 0.00, 1.75, 800, 12000, -5),
]

TARGET_RMS_DB = -18.0   # active-part RMS of the reference (gain 0) sound
PEAK_CEIL_DB = -1.0

def decode(path):
    out = subprocess.run([FF, '-v', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(out, dtype=np.float32).astype(np.float64)

def envelope_db(x, win):
    n = max(1, len(x) // win)
    r = np.sqrt(np.mean(x[: n * win].reshape(n, win) ** 2, axis=1) + 1e-12)
    return 20 * np.log10(r)

def process(x, a, b, hp, lp, gain_db):
    seg = x[int(a * SR): int(b * SR)].copy()
    sos = signal.butter(4, [hp, min(lp, SR / 2 - 100)], btype='band', fs=SR, output='sos')
    seg = signal.sosfiltfilt(sos, seg)
    win = int(0.01 * SR)
    db = envelope_db(seg, win)
    thr = db.max() - 38
    idx = np.where(db > thr)[0]
    s0 = max(0, idx[0] * win - int(0.012 * SR))
    s1 = min(len(seg), (idx[-1] + 1) * win + int(0.06 * SR))
    seg = seg[s0:s1]
    # fades: 6 ms in, 40 ms out (no clicks at the cut)
    fi, fo = int(0.006 * SR), min(int(0.04 * SR), len(seg) // 3)
    seg[:fi] *= np.linspace(0, 1, fi)
    seg[-fo:] *= np.linspace(1, 0, fo) ** 2
    act = envelope_db(seg, win)
    act = act[act > act.max() - 30]
    rms_db = 10 * np.log10(np.mean(10 ** (act / 10)))
    target = TARGET_RMS_DB + gain_db
    g = 10 ** ((target - rms_db) / 20)
    peak = np.abs(seg).max() * g
    if peak > 10 ** (PEAK_CEIL_DB / 20): g *= 10 ** (PEAK_CEIL_DB / 20) / peak
    seg *= g
    out_db = envelope_db(seg, win); out_db = out_db[out_db > out_db.max() - 30]
    return seg.astype(np.float32), {
        'duration_s': round(len(seg) / SR, 3),
        'peak_dbfs': round(20 * np.log10(np.abs(seg).max() + 1e-12), 1),
        'active_rms_dbfs': round(float(10 * np.log10(np.mean(10 ** (out_db / 10)))), 1),
    }

def encode(seg, path):
    subprocess.run([FF, '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '1', '-i', '-',
                    '-c:a', 'libopus', '-b:a', '64k', '-application', 'audio', path], input=seg.tobytes(), check=True)

sources = {}
for pet, name, fid, a, b, hp, lp, gain in PLAN:
    m = META[fid]
    src = os.path.join(HERE, 'raw', f'{fid}.mp3')
    seg, info = process(decode(src), a, b, hp, lp, gain)
    out_dir = os.path.join(ROOT, 'assets', 'pets', pet, 'sounds'); os.makedirs(out_dir, exist_ok=True)
    art_dir = os.path.join(ROOT, 'art', pet, 'audio', 'source'); os.makedirs(art_dir, exist_ok=True)
    encode(seg, os.path.join(out_dir, f'{name}.ogg'))
    shutil.copyfile(src, os.path.join(art_dir, f'{fid}.mp3'))
    size = os.path.getsize(os.path.join(out_dir, f'{name}.ogg'))
    sources.setdefault(pet, []).append({
        'file': f'sounds/{name}.ogg', 'name': name,
        'source': {'site': 'Freesound', 'id': fid, 'title': m['title'], 'author': m['user'], 'url': m['page'],
                   'license': 'CC0 1.0 (Creative Commons 0)', 'licenseUrl': 'https://creativecommons.org/publicdomain/zero/1.0/',
                   'retrieved': '2026-11-21', 'retrievedFile': f'source/{fid}.mp3 (Freesound HQ preview, 128 kbps MP3)'},
        'processing': {'window_s': [a, b], 'bandpass_hz': [hp, lp], 'gainOffset_db': gain, 'target_active_rms_dbfs': TARGET_RMS_DB + gain,
                       'encode': 'Opus 64 kb/s, 48 kHz mono'},
        **info, 'bytes': size, 'humanListened': False,
    })
    print(f"{pet:12} {name:14} {info['duration_s']:5.2f}s pk={info['peak_dbfs']:5.1f} rms={info['active_rms_dbfs']:6.1f} {size:6d}B")

for pet, items in sources.items():
    json.dump({'character': pet, 'generatedBy': 'process_audio.py (Cute Pet Companion asset pipeline, 21/11/2026)',
               'note': 'All sources are CC0 (no attribution required); credits kept anyway. Not yet reviewed by ear — see humanListened.',
               'files': items}, open(os.path.join(ROOT, 'art', pet, 'audio', 'SOURCES.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
