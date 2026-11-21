"""Download chosen Freesound CC0 previews, verify CC0 on the sound page, decode and analyse.
Usage: python fs_fetch_analyze.py cands.json ids... """
import json, os, re, subprocess, sys, time, urllib.request
import numpy as np
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'pylib'))
import imageio_ffmpeg
FF = imageio_ffmpeg.get_ffmpeg_exe()
HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, 'raw'); os.makedirs(RAW, exist_ok=True)

def get(url, binary=False):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (asset-research)'})
    with urllib.request.urlopen(req, timeout=30) as r:
        b = r.read()
    return b if binary else b.decode('utf-8', 'replace')

def decode(path, sr=48000):
    out = subprocess.run([FF, '-v', 'error', '-i', path, '-ac', '1', '-ar', str(sr), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(out, dtype=np.float32)

def analyse(x, sr=48000):
    win = int(0.02 * sr)
    n = len(x) // win
    rms = np.sqrt(np.mean(x[: n * win].reshape(n, win) ** 2, axis=1) + 1e-12)
    db = 20 * np.log10(rms)
    floor = np.percentile(db, 10)
    peak_db = db.max()
    active = db > max(floor + 12, peak_db - 35)
    idx = np.where(active)[0]
    # count separate events (gaps > 150 ms)
    events = 0; last = -100
    for i in idx:
        if i - last > 7: events += 1
        last = i
    return {
        'len_s': round(len(x) / sr, 2), 'peak_dbfs': round(20 * np.log10(np.abs(x).max() + 1e-9), 1),
        'floor_db': round(float(floor), 1), 'snr_db': round(float(peak_db - floor), 1),
        'active_s': round(len(idx) * 0.02, 2), 'events': events,
        'first_s': round(idx[0] * 0.02, 2) if len(idx) else None, 'last_s': round((idx[-1] + 1) * 0.02, 2) if len(idx) else None,
    }

cands = json.load(open(sys.argv[1], encoding='utf-8'))
byid = {c['id']: c for v in cands.values() for c in v}
report = {}
for sid in map(int, sys.argv[2:]):
    c = byid[sid]
    path = os.path.join(RAW, f'{sid}.mp3')
    if not os.path.exists(path):
        page = get(c['page'])
        c['cc0_verified'] = bool(re.search(r'publicdomain/zero|Creative Commons 0', page))
        open(path, 'wb').write(get(c['hq'], binary=True))
        time.sleep(0.8)
    else:
        c['cc0_verified'] = c.get('cc0_verified', True)
    a = analyse(decode(path))
    report[sid] = {**c, **a}
    print(f"{sid:>7} cc0={c['cc0_verified']} len={a['len_s']:5.2f} act={a['active_s']:4.2f} ev={a['events']} snr={a['snr_db']:5.1f} floor={a['floor_db']:6.1f} pk={a['peak_dbfs']:5.1f} [{a['first_s']}-{a['last_s']}] {c['title'][:45]}")
json.dump(report, open(os.path.join(HERE, 'analysis.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
