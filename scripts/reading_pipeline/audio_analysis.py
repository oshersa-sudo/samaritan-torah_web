# -*- coding: utf-8 -*-
"""Core auto-split algorithm, extracted into an importable module (previously
lived inline in batch_genesis.py and got pulled into other scripts via a
fragile `exec(chunk-of-source-text)` trick all evening — cleaned up here).

Two pieces:
  analyze(wav_path)      -> (duration, candidates, median_pitch)
      Silence-gap candidates (>=0.45s) with a melodic-cadence score: the
      final-syllable pitch drop that marks a chapter ending in Samaritan
      cantillation (~100Hz vs ~132Hz normal, i.e. dev <= -2.5 semitones).
  choose_boundaries_dp(cands, expected, total_dur, ...)
      Dynamic-programming selection of exactly len(expected) boundaries,
      maximizing sum(candidate score) - LAM*((time-expected)/total)^2, so a
      recording with no clear pauses still gets text-length-anchored cuts
      (synthetic zero-score fallback candidates guarantee feasibility).
"""
import wave
import numpy as np


def analyze(wav_path):
    with wave.open(wav_path, "rb") as w:
        sr = w.getframerate()
        audio = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768.0
    dur = len(audio) / sr
    hop, win = int(0.02 * sr), int(0.04 * sr)
    nf = (len(audio) - win) // hop
    idx = np.arange(nf)[:, None] * hop + np.arange(win)[None, :]
    rms = np.empty(nf, dtype=np.float32)
    B = 20000
    for s in range(0, nf, B):
        seg = audio[np.minimum(idx[s:s + B], len(audio) - 1)]
        rms[s:s + B] = np.sqrt((seg ** 2).mean(axis=1))
    t = np.arange(nf) * hop / sr
    db_ = 20 * np.log10(rms + 1e-9)
    thr = np.percentile(db_, 60) - 18
    silent = db_ < thr

    sils = []
    i = 0
    while i < nf:
        if silent[i]:
            j = i
            while j < nf and silent[j]:
                j += 1
            a, b = t[i], t[j - 1] + 0.02
            if b - a >= 0.45 and a > 1.0 and b < dur - 1.0:
                sils.append((a, b))
            i = j
        else:
            i += 1

    def pitch_of(seg):
        fw, fh = int(0.04 * sr), int(0.02 * sr)
        f0s = []
        for s in range(0, len(seg) - fw, fh):
            fr = seg[s:s + fw]
            if np.sqrt((fr ** 2).mean()) < 0.01:
                continue
            fr = fr - fr.mean()
            ac = np.correlate(fr, fr, "full")[fw - 1:]
            if ac[0] <= 0:
                continue
            ac /= ac[0]
            lo_, hi_ = int(sr / 350), int(sr / 70)
            if hi_ >= len(ac):
                continue
            k = lo_ + np.argmax(ac[lo_:hi_])
            if ac[k] > 0.45:
                f0s.append(sr / k)
        return float(np.median(f0s)) if len(f0s) >= 3 else 0.0

    cands = []
    for (a, b) in sils:
        tail = audio[int(max(0, (a - 1.2)) * sr):int((a - 0.05) * sr)]
        cands.append(dict(start=round(a, 2), end=round(b, 2), ln=round(b - a, 2), f0=pitch_of(tail)))
    med = np.median([c["f0"] for c in cands if c["f0"] > 0]) if cands else 0
    lens = np.array([c["ln"] for c in cands]) if cands else np.array([0.6])
    mlen, slen = np.median(lens), (np.std(lens) + 1e-9)
    for c in cands:
        c["dev"] = round(12 * np.log2(c["f0"] / med), 2) if (c["f0"] > 0 and med > 0) else 0.0
        z = (c["ln"] - mlen) / slen
        cad = c["dev"] <= -2.5
        c["cad"] = bool(cad)
        c["score"] = round(z + (3.0 if cad else 0.0) + (abs(c["dev"]) / 2 if c["dev"] < 0 else 0), 2)
    return dur, cands, float(med)


def choose_boundaries_dp(cands, expected, total_dur, lam=400.0, gap=5.0, forced_joins=None):
    """cands: candidates from analyze() (start/end/score), already offset into
    a shared timeline if multiple source parts were concatenated.
    expected: list of K expected boundary times (K = n_chapters - 1) from
    cumulative text-length fractions, in the SAME timeline.
    forced_joins: optional list of times that MUST be selected (e.g. seams
    between concatenated source videos) - added as high-score candidates.
    Returns: list of K chosen candidate dicts, in time order. Always
    succeeds (synthetic zero-score fallback candidates at each expected
    position guarantee feasibility even with zero real pauses)."""
    cands = list(cands)
    for e in expected:
        cands.append({"start": e, "end": e, "score": 0.0, "cad": False, "synthetic": True})
    for j in (forced_joins or []):
        cands.append({"start": j, "end": j, "score": 50.0, "cad": True, "forced": True})
    cands.sort(key=lambda c: c["start"])

    K = len(expected)
    C = len(cands)
    NEG = -1e18
    dp = [[NEG] * (K + 1) for _ in range(C)]
    par = [[-1] * (K + 1) for _ in range(C)]

    def val(i, k):
        c = cands[i]
        dev = (c["start"] - expected[k - 1]) / max(total_dur, 1)
        return c["score"] - lam * dev * dev

    for i in range(C):
        dp[i][1] = val(i, 1)
    for k in range(2, K + 1):
        best_j, best_v, ptr = -1, NEG, 0
        for i in range(C):
            while ptr < i and cands[ptr]["start"] <= cands[i]["start"] - gap:
                if dp[ptr][k - 1] > best_v:
                    best_v, best_j = dp[ptr][k - 1], ptr
                ptr += 1
            if best_v > NEG:
                dp[i][k] = best_v + val(i, k)
                par[i][k] = best_j

    end_i = max(range(C), key=lambda i: dp[i][K])
    if dp[end_i][K] < -1e17:
        # infeasible under the min-gap constraint - fall back to pure
        # text-proportion positions (still always succeeds)
        return [{"start": e, "end": e, "score": 0.0, "cad": False, "fallback": True} for e in expected]
    sel, i, k = [], end_i, K
    while k >= 1 and i >= 0:
        sel.append(i)
        i = par[i][k]
        k -= 1
    return [cands[i] for i in sorted(sel)]
