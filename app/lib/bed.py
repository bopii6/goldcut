# -*- coding: utf-8 -*-
"""合成一段没有版权问题的垫乐：温和的铺底和弦 + 轻的低音脉冲 + 很轻的沙锤。混音时会被人声自动压低。
  python bed.py <输出.wav> [mood]      mood: tense（小调，默认，财经新闻感）/ bright（大调，科技、消费）
只用 numpy，不下载任何东西。"""
import sys, wave
import numpy as np

SR = 44100
out = sys.argv[1]; mood = sys.argv[2] if len(sys.argv) > 2 else 'tense'
BPM = 86 if mood == 'tense' else 96
beat = 60 / BPM; bar = beat * 4
rng = np.random.default_rng(11)
midi = lambda n: 440 * 2 ** ((n - 69) / 12)
# 每个和弦两小节；tense: Am F C G，bright: C G Am F
PROG = {'tense': [[57, 60, 64, 69], [53, 57, 60, 65], [48, 55, 60, 64], [55, 59, 62, 67]],
        'bright': [[48, 55, 60, 64], [55, 59, 62, 67], [57, 60, 64, 69], [53, 57, 60, 65]]}[mood]
ROOT = [p[0] - 12 for p in PROG]
BARS_PER = 2; LOOPS = 3
total = bar * BARS_PER * len(PROG) * LOOPS
N = int(total * SR); t = np.arange(N) / SR
L = np.zeros(N); R = np.zeros(N)


def env(n, a, r):
    e = np.ones(n); ai, ri = int(a * SR), int(r * SR)
    e[:ai] = np.linspace(0, 1, ai) ** 2; e[-ri:] *= np.linspace(1, 0, ri) ** 2; return e


def pad_note(f, dur, det):
    n = int(dur * SR); tt = np.arange(n) / SR; x = np.zeros(n)
    for h in range(1, 7):                                   # 圆一点的锯齿：谐波 1/h，高次再压
        x += np.sin(2 * np.pi * f * det * h * tt + h) / (h ** 1.4)
    return x


def lowpass(x, fc):
    a = np.exp(-2 * np.pi * fc / SR); y = np.zeros_like(x); s = 0.0
    for i in range(0, len(x), 1):
        s = (1 - a) * x[i] + a * s; y[i] = s
    return y


chord_len = bar * BARS_PER
for loop in range(LOOPS):
    for ci, ch in enumerate(PROG):
        start = (loop * len(PROG) + ci) * chord_len
        dur = chord_len + 0.8                                # 和弦之间重叠一点，接得软
        i0 = int(start * SR); n = int(dur * SR)
        if i0 + n > N: n = N - i0
        e = env(n, 0.9, 1.1)
        for k, note in enumerate(ch):
            f = midi(note)
            l = pad_note(f, n / SR, 1 - 0.0016)[:n] * e; r = pad_note(f, n / SR, 1 + 0.0016)[:n] * e
            L[i0:i0 + n] += l * (0.9 if k % 2 else 0.7); R[i0:i0 + n] += r * (0.7 if k % 2 else 0.9)
pad_gain = 0.16
L = lowpass(L, 1400) * pad_gain; R = lowpass(R, 1400) * pad_gain

# 低音：每拍一个根音，短衰减
bass = np.zeros(N)
nb = int(total / beat)
for b in range(nb):
    s = b * beat; ci = int(s // chord_len) % len(PROG); f = midi(ROOT[ci])
    i0 = int(s * SR); n = min(int(beat * SR), N - i0); tt = np.arange(n) / SR
    amp = 0.55 if b % 4 == 0 else 0.32
    bass[i0:i0 + n] += np.sin(2 * np.pi * f * tt) * np.exp(-tt * 5.5) * amp
# 软的底鼓：第 1、3 拍，频率下滑
kick = np.zeros(N)
for b in range(0, nb, 2):
    i0 = int(b * beat * SR); n = min(int(0.32 * SR), N - i0); tt = np.arange(n) / SR
    ph = 2 * np.pi * np.cumsum(45 + 75 * np.exp(-tt * 28)) / SR
    kick[i0:i0 + n] += np.sin(ph) * np.exp(-tt * 9) * 0.5
# 沙锤：八分音符，高通噪声，很轻
shk = np.zeros(N)
noise = rng.standard_normal(N); hp = noise - lowpass(noise, 5000)
for b in range(int(total / (beat / 2))):
    i0 = int(b * beat / 2 * SR); n = min(int(0.07 * SR), N - i0); tt = np.arange(n) / SR
    shk[i0:i0 + n] += hp[i0:i0 + n] * np.exp(-tt * 60) * (0.05 if b % 2 else 0.03)

L += bass + kick + shk * 0.9; R += bass + kick + shk * 1.1
# 简单的空间感：两路不同的延迟回声
for d, g in [(0.231, 0.22), (0.347, 0.15)]:
    k = int(d * SR); L[k:] += R[:-k] * g; R[k:] += L[:-k] * g * 0.9
# 首尾淡入淡出，峰值归一到 -3 dB
fade = int(1.5 * SR); w = np.ones(N); w[:fade] = np.linspace(0, 1, fade); w[-fade:] = np.linspace(1, 0, fade)
st = np.stack([L * w, R * w], 1); st /= np.max(np.abs(st)) + 1e-9; st *= 0.7
with wave.open(out, 'wb') as f:
    f.setnchannels(2); f.setsampwidth(2); f.setframerate(SR); f.writeframes((st * 32767).astype('<i2').tobytes())
print(out, f'{total:.1f}s', mood)
