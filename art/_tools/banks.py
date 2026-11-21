"""Write the sound banks into assets/pets/{id}/pet.json (keeps every other key and the key order)."""
import json, os, sys
ROOT = sys.argv[1]
O = lambda f, rate=None, gain=None: {k: v for k, v in (('file', f), ('rate', rate), ('gain', gain)) if v is not None}
BANKS = {
    'cat_mochi': {
        'happy': ['meow_01.ogg', 'meow_02.ogg'],
        'excited': ['meow_02.ogg', O('meow_01.ogg', rate=1.08), 'trill_01.ogg'],
        'love': ['trill_01.ogg', 'purr_01.ogg'],
        'surprised': [O('meow_02.ogg', rate=1.12)],
        'angry': [O('meow_low.ogg', rate=0.9)],
        'sad': ['meow_low.ogg'],
        'thinking': [O('trill_01.ogg', gain=0.8)],
        'pet': ['purr_01.ogg', 'purr_02.ogg'],
        'grab': ['meow_02.ogg', O('meow_01.ogg', rate=1.1)],
    },
    'dog_boba': {
        'happy': ['bark_01.ogg', 'bark_03.ogg'],
        'excited': ['bark_triple.ogg', 'bark_02.ogg'],
        'love': [O('whine_01.ogg', rate=1.1, gain=0.8), 'sniff_01.ogg'],
        'surprised': ['bark_04.ogg'],
        'angry': [O('bark_04.ogg', rate=0.88)],
        'sad': ['whine_01.ogg'],
        'thinking': ['sniff_01.ogg'],
        'pet': ['sniff_01.ogg', O('whine_01.ogg', rate=1.12, gain=0.7)],
        'grab': ['bark_02.ogg', 'whine_01.ogg'],
    },
    'bunny_cloud': {
        'happy': ['squeak_01.ogg', 'squeak_02.ogg'],
        'excited': ['squeak_triple.ogg', 'squeak_03.ogg'],
        'love': ['squeak_tiny.ogg', 'squeak_03.ogg'],
        'surprised': [O('squeak_02.ogg', rate=1.1)],
        'angry': [O('squeak_01.ogg', rate=0.85)],
        'sad': [O('squeak_tiny.ogg', rate=0.85)],
        'thinking': ['sneeze_01.ogg'],
        'pet': ['squeak_tiny.ogg', 'sneeze_01.ogg'],
        'grab': ['squeak_02.ogg', 'squeak_03.ogg'],
    },
    'penguin_pip': {
        'happy': ['squeak_01.ogg', 'chirp_01.ogg'],
        'excited': ['chirp_run.ogg', 'squeak_double.ogg'],
        'love': ['chirp_02.ogg', 'chirp_01.ogg'],
        'surprised': ['squeak_02.ogg'],
        'angry': [O('squeak_01.ogg', rate=0.85)],
        'sad': [O('chirp_02.ogg', rate=0.85)],
        'thinking': ['chirp_01.ogg'],
        'pet': ['chirp_02.ogg', 'chirp_01.ogg'],
        'grab': ['squeak_double.ogg', 'squeak_02.ogg'],
    },
}
for pet, bank in BANKS.items():
    p = os.path.join(ROOT, 'assets', 'pets', pet, 'pet.json')
    d = json.load(open(p, encoding='utf-8'))
    for files in bank.values():
        for f in files:
            name = f if isinstance(f, str) else f['file']
            assert os.path.exists(os.path.join(ROOT, 'assets', 'pets', pet, 'sounds', name)), (pet, name)
    d['sounds'] = bank
    d['soundCredits'] = 'Recorded CC0 sounds from Freesound — sources, authors and processing in art/' + pet + '/audio/SOURCES.json'
    json.dump(d, open(p, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
    open(p, 'a', encoding='utf-8').write('\n')
    print(pet, sum(len(v) for v in bank.values()), 'entries')
