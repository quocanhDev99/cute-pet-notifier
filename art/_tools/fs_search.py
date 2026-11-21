"""Search Freesound (CC0 only) and list candidates as JSON. Usage: python fs_search.py out.json"""
import json, re, sys, time, urllib.parse, urllib.request, html

QUERIES = {
    'cat': ['kitten meow', 'cat meow cute', 'cat purr', 'cat trill', 'cat chirp'],
    'dog': ['puppy bark', 'puppy whine', 'small dog bark', 'dog sniff', 'puppy yip'],
    'bunny': ['guinea pig squeak', 'rabbit', 'squeak cute', 'sniff sniff'],
    'penguin': ['penguin', 'baby bird chirp', 'chick peep', 'bird trill'],
}

def fetch(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (asset-research)'})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode('utf-8', 'replace')

def search(q):
    url = 'https://freesound.org/search/?' + urllib.parse.urlencode({'q': q, 'f': 'license:"Creative Commons 0"', 's': 'Rating highest first'})
    s = fetch(url)
    out = []
    for m in re.finditer(r'<div\s+class="bw-player"(.*?)tabindex', s, re.S):
        a = dict(re.findall(r'data-([a-z0-9-]+)="([^"]*)"', m.group(1)))
        if 'sound-id' not in a: continue
        tail = s[m.end(): m.end() + 6000]
        rating = re.search(r'Average rating of ([0-9.]+)', tail)
        out.append({
            'id': int(a['sound-id']), 'user': a.get('username'), 'title': html.unescape(a.get('title', '')),
            'duration': float(a.get('duration', 0) or 0), 'downloads': int(a.get('num-downloads', 0) or 0),
            'rating': float(rating.group(1)) if rating else None,
            'hq': a.get('mp3', '').replace('-lq.mp3', '-hq.mp3'),
            'page': f"https://freesound.org/people/{a.get('username')}/sounds/{a['sound-id']}/",
            'query': q,
        })
    return out

res = {}
for species, qs in QUERIES.items():
    seen = {}
    for q in qs:
        try:
            for r in search(q): seen.setdefault(r['id'], r)
        except Exception as e:
            print('ERR', q, e, file=sys.stderr)
        time.sleep(1.0)  # be polite
    res[species] = list(seen.values())
json.dump(res, open(sys.argv[1], 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
for k, v in res.items():
    print(f'== {k}: {len(v)}')
    for r in sorted(v, key=lambda r: -(r['downloads'])):
        if 0.25 <= r['duration'] <= 8:
            print(f"  {r['id']:>7} {r['duration']:5.2f}s dl={r['downloads']:>6} r={r['rating']} [{r['query']}] {r['title'][:60]}")
