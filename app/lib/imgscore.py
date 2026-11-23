# -*- coding: utf-8 -*-
"""配图的兜底筛选（DeepSeek 看图失败时才用）：大片完全一样颜色的区域多 → 多半是 logo、横幅、截图。
  python imgscore.py a.jpg b.jpg ...   → 每行一个 JSON：{"file", "uniform"}
实测：照片 0.01–0.54，logo / 横幅 / 截图 0.43–0.84。兜底时只留 < 0.35 的，宁可少用图，也不让 logo 满屏当水印。"""
import json, sys
import numpy as np
from PIL import Image

for f in sys.argv[1:]:
    try:
        im = Image.open(f).convert('RGB'); im.thumbnail((256, 256)); a = np.asarray(im).astype(int)
        dh = np.abs(np.diff(a, axis=1)).sum(2); dv = np.abs(np.diff(a, axis=0)).sum(2)
        uni = float(((dh[:-1, :] <= 3) & (dv[:, :-1] <= 3)).mean())
        print(json.dumps({'file': f, 'uniform': round(uni, 3)}))
    except Exception as e:
        print(json.dumps({'file': f, 'error': str(e), 'uniform': 1}))
