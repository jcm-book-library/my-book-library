"""Compare two screenshot folders. Usage: cmp.py <baseDir> <newDir>
Noise: <=100 differing pixels with max channel diff <=12. Exit 1 if any screen differs beyond noise."""
import sys, os
import numpy as np
from PIL import Image
a, b = sys.argv[1:3]
exact = noise = 0
bad = []
files = sorted(x for x in os.listdir(a) if x.endswith('.png'))
for f in files:
    if not os.path.exists(f'{b}/{f}'):
        bad.append((f, 'missing in new')); continue
    A = np.array(Image.open(f'{a}/{f}').convert('RGB')).astype(int)
    B = np.array(Image.open(f'{b}/{f}').convert('RGB')).astype(int)
    if A.shape != B.shape:
        bad.append((f, 'size', A.shape, B.shape)); continue
    d = np.abs(A - B)
    n = int((d.sum(2) > 0).sum()); m = int(d.max()) if n else 0
    if n == 0: exact += 1
    elif n <= 100 and m <= 12: noise += 1
    else: bad.append((f, f'{n} px differ, max channel diff {m}'))
extra = set(x for x in os.listdir(b) if x.endswith('.png')) - set(files)
for f in sorted(extra): bad.append((f, 'extra in new'))
print(f'screens: {len(files)} total, {exact} identical, {noise} within noise, {len(bad)} different')
for x in bad: print('  DIFF', *x)
sys.exit(1 if bad else 0)
