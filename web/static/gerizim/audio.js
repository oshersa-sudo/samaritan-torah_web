/* השמע של גבעת עולם: מוזיקת רקע שקטה לסיור המודרך, וקולות סביבה בסיור הרגלי.
   הכול נוצר בדפדפן (Web Audio) — אין קבצי שמע. שלושה ערוצים נפרדים: מוזיקה, קולות סביבה, ומקום לקריינות;
   כשיש דיבור (speechSynthesis) המוזיקה מונמכת מעצמה. כל ערוץ נדלק ונכבה לעצמו, וההעדפה נשמרת.
   קולות הסביבה תלויים במקום ובתקופה: המולה ליד אנשים ובשוק, אש וקהל ליד המזבח, בעלי חיים, רוח, צעדי ההולך —
   ומתחזקים ככל שמתקרבים אליהם. */
(function () {
  const KEY = 'gerizim-audio';
  const pref = { music: true, amb: true };
  try { Object.assign(pref, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* בלי אחסון */ }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(pref)); } catch (e) { /* בלי אחסון */ } };
  const TXT = {
    he: { snd: 'צליל', musicW: 'מוזיקת רקע (בסיור המודרך)', music: 'מוזיקת רקע', amb: 'קולות סביבה', musicS: 'מוזיקה', musicOn: 'מוזיקת הרקע פועלת — לחיצה משתיקה', musicOff: 'מוזיקת הרקע מושתקת — לחיצה מפעילה' },
    en: { snd: 'Sound', musicW: 'Background music (guided tour)', music: 'Background music', amb: 'Ambient sounds', musicS: 'Music', musicOn: 'Background music is on — tap to mute', musicOff: 'Background music is muted — tap to play' },
    ar: { snd: 'الصوت', musicW: 'موسيقى خلفية (الجولة المرشدة)', music: 'موسيقى خلفية', amb: 'أصوات المكان', musicS: 'موسيقى', musicOn: 'موسيقى الخلفية تعمل — انقر للإسكات', musicOff: 'موسيقى الخلفية صامتة — انقر للتشغيل' }
  };
  let ctx = null, master, musicBus, synBus, ambBus, noise = null, verb = null;
  const MUSIC_LV = 0.16, DUCK_LV = 0.045;
  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume().catch(() => {}); return ctx; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    try { ctx = new AC(); } catch (e) { return null; }
    master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
    try { if (localStorage.getItem('gerizim-audio-mute') === '1') master.gain.value = 0; } catch (e) { /* בדיקות בלי קול */ }
    musicBus = ctx.createGain(); musicBus.gain.value = 0; ambBus = ctx.createGain(); ambBus.gain.value = 0;
    // the synthesized music has a channel of its own inside the music: when the
    // recording takes over it is cut to nothing at once, so the two are never
    // heard together — not even the notes already scheduled ahead
    synBus = ctx.createGain(); synBus.gain.value = 1; synBus.connect(musicBus);
    // חדר: הד קצר ורך, משותף למוזיקה
    verb = ctx.createConvolver(); const len = ctx.sampleRate * 2.6, ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2); }
    verb.buffer = ir; const wet = ctx.createGain(); wet.gain.value = 0.38; verb.connect(wet); wet.connect(master);
    musicBus.connect(master); ambBus.connect(master);
    noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); const nd = noise.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    // ספארי ודפדפנים זהירים מתחילים "מושעים": הלחיצה הבאה מעירה את השמע
    ['pointerdown', 'keydown', 'touchend'].forEach(ev => window.addEventListener(ev, settle, { passive: true }));
    return ctx;
  }
  /* מנוע השמע ממשיך לעבד גם בעוצמה אפס (רחש, מסננים, הד) — ובטלפון זה מורגש. לכן הוא מושעה כשאין מה להשמיע:
     מחוץ לסיור הרגלי ובלי מוזיקה, כשהצלילים כבויים, וכשהדף מוסתר (גם כשהיחידה נסגרה והמסגרת שלה רק הוסתרה). */
  // מסגרת שהוסתרה (display:none) שומרת על מידותיה ואינה "hidden" — אבל היא יוצאת מן התצוגה, וזה מה שנמדד כאן
  let offscreen = false;
  try { new IntersectionObserver(es => { offscreen = !es[es.length - 1].isIntersecting; window.GerizimOffscreen = offscreen; settle(); }).observe(document.documentElement); } catch (e) { /* דפדפן ישן: רק document.hidden */ }
  const hiddenNow = () => document.hidden || offscreen;
  let mapSrc = null, mapBus = null, mapPray = null, mapWant = '';   // התפילה במפה (ראו להלן)
  const needed = () => !!((musicOn && pref.music) || (scene && pref.amb) || (mapSrc && pref.amb));
  let sTimer = 0, verbOn = false;
  function settle() {
    if (!ctx) return;
    clearTimeout(sTimer);
    const want = needed() && !hiddenNow();
    if (want) { if (ctx.state === 'suspended') ctx.resume().catch(() => {}); return; }
    sTimer = setTimeout(() => { if (ctx && !(needed() && !hiddenNow()) && ctx.state === 'running') ctx.suspend().catch(() => {}); }, hiddenNow() ? 0 : 1800);
  }
  document.addEventListener('visibilitychange', settle);
  window.addEventListener('resize', settle);
  const now = () => ctx.currentTime;
  const ramp = (p, v, tc) => { p.cancelScheduledValues(now()); p.setTargetAtTime(v, now(), tc || 0.4); };
  function noiseSrc() { const s = ctx.createBufferSource(); s.buffer = noise; s.loop = true; s.loopStart = Math.random(); s.start(); return s; }

  /* ================= קולות אמיתיים =================
   * Everything below this was made out of noise and oscillators, and still is
   * whenever a recording is missing, slow or refused — nothing here can leave
   * the tour silent. But wind on a bare hill, a market, fire on the altar, a
   * goat: a real recording of those is a different thing altogether, so when
   * one has arrived it is used and the synthetic one steps aside.
   *
   * Small files, fetched only when a scene actually asks for them, and
   * decoded once. (The whole set is 3.4 MB; a bed decodes to a few megabytes
   * of sound in memory, which is the only cost worth watching — see what a
   * whole recording decoded to in אוצר השירה.)
   */
  const SND = 'snd/';
  const bank = {};                       // name → AudioBuffer, null pending, false failed
  function sample(name) {
    if (!ctx) return null;
    if (name in bank) return bank[name] || null;
    bank[name] = null;
    fetch(SND + name + '.mp3')
      .then(r => r.ok ? r.arrayBuffer() : Promise.reject(r.status))
      .then(b => new Promise((ok, no) => {
        const p = ctx.decodeAudioData(b, ok, no); if (p && p.then) p.then(ok, no);
      }))
      .then(buf => { bank[name] = buf; })
      .catch(() => { bank[name] = false; });   // the synthesis keeps the scene
    return null;
  }
  const beds = {};
  /* a bed is started once and left running into its chain's gain — the chain
     is what the distance moves, exactly as it moved the synthetic one */
  function bed(name, dest) {
    const buf = sample(name);
    if (!buf) return false;
    if (!beds[name]) {
      const sc = ctx.createBufferSource(); sc.buffer = buf; sc.loop = true;
      sc.connect(dest); sc.start(0, Math.random() * buf.duration);
      beds[name] = sc;
    }
    return true;
  }
  function one(buf, t, vol, dest, rate) {
    const sc = ctx.createBufferSource(); sc.buffer = buf;
    sc.playbackRate.value = rate || 1;
    const g = ctx.createGain(); g.gain.value = vol;
    sc.connect(g); g.connect(dest); sc.start(t);
  }

  /* ================= מוזיקה: מקאם חיג'אז על רה, משטח רך ופריטות נדירות ================= */
  const SCALE = [0, 1, 4, 5, 7, 8, 10, 12, 13, 16];             // רה, מי במול, פה דיאז, סול, לה, סי במול, דו
  const ROOT = 146.83;                                            // רה
  let musicOn = false, mTimer = 0, mNext = 0, drone = null, phrase = 0, lastDeg = 4;
  const hz = st => ROOT * Math.pow(2, st / 12);
  function pad(f, t, dur, vol) {
    const g = ctx.createGain(), lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; lp.Q.value = 0.4;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + dur * 0.35); g.gain.linearRampToValueAtTime(0, t + dur);
    for (const det of [-6, 5]) { const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f; o.detune.value = det; o.connect(lp); o.start(t); o.stop(t + dur + 0.1); }
    lp.connect(g); g.connect(synBus);
  }
  function pluck(f, t, vol) {                                    // מעין עוד: צליל קצר שדועך
    const g = ctx.createGain(), o = ctx.createOscillator(), o2 = ctx.createOscillator(), lp = ctx.createBiquadFilter();
    o.type = 'sawtooth'; o.frequency.value = f; o2.type = 'sine'; o2.frequency.value = f * 2;
    lp.type = 'lowpass'; lp.frequency.setValueAtTime(2400, t); lp.frequency.exponentialRampToValueAtTime(500, t + 0.9);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.2);
    o.connect(lp); o2.connect(lp); lp.connect(g); g.connect(synBus); o.start(t); o2.start(t); o.stop(t + 2.3); o2.stop(t + 2.3);
  }
  /* the recorded music, once it is here: a flute on a long bed, looping */
  let mbed = null;
  function musicBed() {
    if (!musicOn || !pref.music) return false;
    const buf = sample('music_flute');
    if (!buf) return false;
    if (!mbed) {
      const sc = ctx.createBufferSource(); sc.buffer = buf; sc.loop = true;
      sc.connect(musicBus);
      sc.start(0, Math.random() * Math.max(1, buf.duration - 20));
      mbed = sc;
      synBus.gain.cancelScheduledValues(now()); synBus.gain.setValueAtTime(0, now());   // the synthesis: silent, at once
      stopDrone();                       // the synthetic bed makes way for it
    }
    return true;
  }
  function musicTick() {
    if (!ctx || !musicOn) return;
    const speaking = !!(window.speechSynthesis && speechSynthesis.speaking);
    musicBus.gain.setTargetAtTime(pref.music ? (speaking || duckN > 0 ? DUCK_LV : MUSIC_LV) : 0, now(), 0.5);
    if (musicBed()) return;              // a recording is playing: no notes to write
    while (mNext < now() + 1.2) {
      const t = Math.max(mNext, now() + 0.05);
      if (phrase % 4 === 0) pad(hz(SCALE[[0, 4, 3, 0][(phrase / 4 | 0) % 4]] - 12), t, 9, 0.05);     // משטח ארוך כל כמה תיבות
      // הלחן: צעדים קטנים בסולם, לרוב יורדים אל הבסיס, עם מנוחות
      if (Math.random() > 0.22) { lastDeg = Math.max(0, Math.min(SCALE.length - 1, lastDeg + [-2, -1, -1, 0, 1, 1, 2][Math.floor(Math.random() * 7)])); pluck(hz(SCALE[lastDeg]), t, 0.07 + Math.random() * 0.04); }
      if (Math.random() > 0.8) pluck(hz(SCALE[Math.max(0, lastDeg - 2)]), t + 0.38, 0.045);
      phrase++; mNext = t + [1.15, 1.15, 0.78, 1.55, 2.3][Math.floor(Math.random() * 5)];
    }
  }
  function startDrone() {
    if (drone) return; drone = [];
    const g = ctx.createGain(); g.gain.value = 0; g.connect(synBus); g.gain.setTargetAtTime(0.06, now(), 2);
    for (const f of [ROOT / 2, ROOT * 0.75]) { const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f; o.connect(g); o.start(); drone.push(o); }
    drone.g = g;
  }
  function stopDrone() { if (!drone) return; const d = drone; drone = null; d.g.gain.setTargetAtTime(0, now(), 0.8); setTimeout(() => d.forEach(o => { try { o.stop(); } catch (e) { /* */ } }), 4000); }
  let duckN = 0;
  function music(on) {
    musicOn = !!on;
    if (musicOn && pref.music) { if (!ensure()) return; if (!verbOn) { musicBus.connect(verb); verbOn = true; } if (!musicBed()) startDrone(); mNext = now() + 0.4; clearInterval(mTimer); mTimer = setInterval(musicTick, 250); musicTick(); }
    else if (ctx) { ramp(musicBus.gain, 0, 0.6); stopDrone();
      if (mbed) { try { mbed.stop(); } catch (e) { /* already done */ } mbed = null; }
      if (synBus) synBus.gain.setValueAtTime(1, now());
      clearInterval(mTimer); mTimer = 0; setTimeout(() => { if (verbOn && !(musicOn && pref.music)) { try { musicBus.disconnect(verb); } catch (e) { /* */ } verbOn = false; } }, 3500); }
    settle(); syncButtons();
  }

  /* ================= קולות הסביבה בסיור הרגלי ================= */
  let scene = null, aTimer = 0, last = null, chains = null, stepAcc = 0, nextBleat = 0, nextBird = 0, nextFar = 0;
  const W = () => window.GERIZIM_WALK;
  function inPer(o, per, tl) { return (o.per ? o.per === per : (per !== 'r' || !!o.allr)) && (o.tl == null || (o.tl ? tl : !tl)); }
  // מוקדי המולה קבועים (במטרים של הסיור): השוק, הרחובות, רחבת המזבח ושער החצר
  const SPOTS = [
    { x: 55, z: 330, r: 48, lv: 1, per: 'h' }, { x: 126, z: 72, r: 34, lv: 0.6, per: 'h' }, { x: -10, z: 59, r: 30, lv: 0.5, per: 'h' }, { x: 115, z: -10, r: 34, lv: 0.7, per: 'h' },
    { x: 64, z: -41, r: 42, lv: 0.75, per: 'h' }, { x: 57.6, z: -42, r: 40, lv: 0.7, per: 'p' }, { x: 52, z: -88, r: 30, lv: 0.5, per: 'p' },
    { x: 104, z: 79, r: 36, lv: 0.55, per: 'r' }, { x: 118, z: 80, r: 26, lv: 0.6, per: 'r' }
  ];
  function buildChains() {
    const c = {}, ns = noiseSrc();
    // המולה: רחש בתחום הדיבור, ומעליו הברות קצרות של קולות רחוקים
    c.crowd = ctx.createGain(); c.crowd.gain.value = 0; c.crowd.connect(ambBus);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 620; bp.Q.value = 0.7;
    const hum = ctx.createGain(); hum.gain.value = 0.16; ns.connect(bp); bp.connect(hum); hum.connect(c.crowd);
    c.gHum = hum;                                     // silenced when a recording takes over
    c.babble = ctx.createGain(); c.babble.gain.value = 0.8; const blp = ctx.createBiquadFilter(); blp.type = 'lowpass'; blp.frequency.value = 2300; c.babble.connect(blp); blp.connect(c.crowd);
    // אש: פצפוצים ורחש נמוך
    c.fire = ctx.createGain(); c.fire.gain.value = 0; c.fire.connect(ambBus);
    const flp = ctx.createBiquadFilter(); flp.type = 'lowpass'; flp.frequency.value = 340; const fr = ctx.createGain(); fr.gain.value = 0.32; ns.connect(flp); flp.connect(fr); fr.connect(c.fire);
    c.gFire = fr;
    c.crackle = ctx.createGain(); c.crackle.gain.value = 1; const chp = ctx.createBiquadFilter(); chp.type = 'highpass'; chp.frequency.value = 1700; c.crackle.connect(chp); chp.connect(c.fire);
    // רוח: רחש נמוך שמתנשם לאט
    c.wind = ctx.createGain(); c.wind.gain.value = 0; c.wind.connect(ambBus);
    const wlp = ctx.createBiquadFilter(); wlp.type = 'lowpass'; wlp.frequency.value = 420; wlp.Q.value = 0.6; ns.connect(wlp);
    const wg = ctx.createGain(); wg.gain.value = 1; wlp.connect(wg); wg.connect(c.wind); c.gWind = wg;
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.07; lg.gain.value = 180; lfo.connect(lg); lg.connect(wlp.frequency); lfo.start();
    c.birds = ctx.createGain(); c.birds.gain.value = 0; c.birds.connect(ambBus);           // ציפורי בוקר, כשאין המולה
    c.pray = ctx.createGain(); c.pray.gain.value = 0; c.pray.connect(ambBus);              // תפילה מן המקדש, לפי התקופה
    c.fx = ctx.createGain(); c.fx.gain.value = 1; c.fx.connect(ambBus);                     // צעדים, בעלי חיים, ציפורים
    return c;
  }
  function burst(dest, t, dur, vol, type, freq, q) {
    const s = ctx.createBufferSource(); s.buffer = noise; const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q || 0.8;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.01, dur / 4)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest); s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
  }
  function syllable(t, vol) {                                    // הברה: צליל קולי ושני פורמנטים של תנועה
    const o = ctx.createOscillator(); o.type = 'sawtooth'; const f0 = 105 + Math.random() * 150; o.frequency.setValueAtTime(f0, t); o.frequency.linearRampToValueAtTime(f0 * (0.85 + Math.random() * 0.3), t + 0.2);
    const g = ctx.createGain(), d = 0.09 + Math.random() * 0.2; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    for (const [lo, hi] of [[280, 820], [900, 2300]]) { const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = lo + Math.random() * (hi - lo); f.Q.value = 6; o.connect(f); f.connect(g); }
    g.connect(chains.babble); o.start(t); o.stop(t + d + 0.05);
  }
  function bleat(t, vol) {
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 330 + Math.random() * 140;
    const vib = ctx.createOscillator(), vg = ctx.createGain(); vib.frequency.value = 7 + Math.random() * 3; vg.gain.value = 22; vib.connect(vg); vg.connect(o.frequency);
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1150; f.Q.value = 2.2;
    const g = ctx.createGain(), d = 0.55 + Math.random() * 0.4; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.06); g.gain.setValueAtTime(vol * 0.8, t + d * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(f); f.connect(g); g.connect(chains.fx); o.start(t); vib.start(t); o.stop(t + d + 0.05); vib.stop(t + d + 0.05);
  }
  /* the flock is sheep, goats, donkeys and oxen — and the recordings are the
     same four; without one, the old synthetic bleat still answers */
  const BEAST = { sheep: 'sheep', goat: 'goat', donkey: 'donkey', ox: 'cow', cow: 'cow',
                  chicken: 'hen', hen: 'hen', dog: 'dog' };
  function beast(t, vol, kind) {
    let name = BEAST[kind] || 'goat';
    if (name === 'sheep' && Math.random() < 0.5) name = 'sheep2';   // לא אותה פעייה פעמיים
    const buf = sample(name);
    if (!buf) return bleat(t, vol);
    one(buf, t, Math.min(0.5, vol * 1.7), chains.fx, 0.93 + Math.random() * 0.14);
  }
  function chirp(t, vol) {
    for (let k = 0, n = 2 + Math.floor(Math.random() * 3); k < n; k++) {
      const o = ctx.createOscillator(), g = ctx.createGain(), t0 = t + k * 0.16, f0 = 2600 + Math.random() * 1600;
      o.type = 'sine'; o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(f0 * 1.45, t0 + 0.09);
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.11);
      o.connect(g); g.connect(chains.fx); o.start(t0); o.stop(t0 + 0.13);
    }
  }
  function indoors(D, p, per, tl) {
    const S2 = D.sanct, x = p.x, z = p.z;
    if (per === 'r' && S2 && x > S2.TN.x1 && x < S2.TN.x2 && z > S2.TN.z1 && z < S2.TN.z2) return true;
    const b = tl && D.sanctTB && D.sanctTB[per];
    if (b && x > b.e1 && x < b.e2 && -z > b.n1 && -z < b.n2) return true;
    for (const f of D.floors) if (f.room && (!f.per || f.per === per) && x > f.box[0] && x < f.box[2] && z > f.box[1] && z < f.box[3]) return true;
    return false;
  }
  const fall = (d, r) => { const k = Math.max(0, 1 - d / r); return k * k; };

  /* ── התפילה ───────────────────────────────────────────────────────────────
   * Each period prays in the voice of those who held the mountain then: the
   * congregation of the Days of Favour and of our own day are the community's
   * own singing, out of the recordings archive; the Persian period a low
   * chant, the Hellenistic a lyre. All of them heard as from a distance —
   * muffled and quiet in the file itself — and fading as the walker turns
   * away, like every other sound here.
   */
  const PRAY = { r: 'pray_r', n: 'pray_n', p: 'pray_p', h: 'pray_h' };
  function holyAt(D, per, tl) {
    for (const o of D.solids) if (o.id === 'altar' && inPer(o, per, tl))
      return { x: (o.box[0] + o.box[2]) / 2, z: (o.box[1] + o.box[3]) / 2 };
    const b = D.sanctTB && D.sanctTB[per];
    if (b) return { x: (b.e1 + b.e2) / 2, z: -(b.n1 + b.n2) / 2 };
    const S2 = D.sanct;
    if (S2 && S2.TN) return { x: (S2.TN.x1 + S2.TN.x2) / 2, z: (S2.TN.z1 + S2.TN.z2) / 2 };
    return null;
  }
  /* ── השופר והחצוצרות ──────────────────────────────────────────────────────
   * In the Days of Favour the horn is heard about the Tabernacle, inside and
   * out: תקיעה, שברים, תרועה — each in its turn, and never one upon another.
   * And every few minutes two silver trumpets answer from the front of it.
   */
  const HORN = ['shofar_tekia', 'shofar_shevarim', 'shofar_teruah'];
  let hornI = 0, nextHorn = 0, nextTrump = 0, nextFarHorn = 0, nextCoop = 0;
  function ambTick() {
    const GW = window.GerizimWalk, D = W();
    if (!GW || !GW.active || !D || !scene || !pref.amb) { if (chains) { ramp(chains.crowd.gain, 0); ramp(chains.fire.gain, 0); ramp(chains.wind.gain, 0); } return; }
    if (GW.paused) { ramp(ambBus.gain, 0.25, 0.6); } else ramp(ambBus.gain, 1, 0.6);
    const p = GW._pos(), per = scene.per, tl = scene.tl, t = now() + 0.03;
    // a recording, where one has arrived: the synthetic bed under it is silenced
    // (and the syllables of the synthetic crowd are not even made while the
    //  market is a recording — see below)
    const liveMarket = bed('market', chains.crowd);
    if (liveMarket) { chains.gHum.gain.value = 0; chains.babble.gain.value = 0; }
    const liveFire = bed('fire', chains.fire);
    if (liveFire) { chains.gFire.gain.value = 0; chains.crackle.gain.value = 0; }
    if (bed('wind', chains.wind)) chains.gWind.gain.value = 0;
    // המולה: לפי האנשים הקרובים ולפי מוקדי ההמולה
    let crowd = 0;
    for (const q of D.people) if (inPer(q, per, tl)) { const d = Math.hypot(q.x - p.x, q.z - p.z); if (d < 24) crowd += fall(d, 24) * 0.11; }
    for (const s of SPOTS) if (s.per === per) crowd += fall(Math.hypot(s.x - p.x, s.z - p.z), s.r) * s.lv;
    crowd = Math.min(1, crowd);
    ramp(chains.crowd.gain, crowd * 0.55, 0.35);
    if (crowd > 0.04 && !liveMarket) { const n = Math.random() < crowd * 1.6 ? 1 + (crowd > 0.5 && Math.random() < 0.5 ? 1 : 0) : 0; for (let i = 0; i < n; i++) syllable(t + Math.random() * 0.1, 0.05 + crowd * 0.09); }
    // אש המזבח
    let fire = 0;
    for (const s of D.solids) if (s.id === 'altar' && inPer(s, per, tl)) { const x = (s.box[0] + s.box[2]) / 2, z = (s.box[1] + s.box[3]) / 2; fire = Math.max(fire, fall(Math.hypot(x - p.x, z - p.z), 24)); }
    ramp(chains.fire.gain, fire * 0.6, 0.3);
    if (fire > 0.03 && !liveFire && Math.random() < 0.7) for (let i = 0; i < 2; i++) burst(chains.crackle, t + Math.random() * 0.09, 0.012 + Math.random() * 0.03, 0.08 + fire * 0.35, 'bandpass', 2500 + Math.random() * 3000, 1.2);
    // רוח: חזקה יותר על ראש ההר החשוף של ימי הרצון, ונבלעת בהמולה
    const inside = indoors(D, p, per, tl);
    ramp(chains.wind.gain, (per === 'r' ? 0.5 : 0.3) * (1 - crowd * 0.6) * (inside ? 0.18 : 1), 1.2);
    // בעלי חיים קרובים: פעייה מדי פעם
    // בעלי חיים קרובים — וכל מין בקולו שלו
    if (now() > nextBleat) {
      // לא תמיד הקרובה ביותר — אחרת ליד המשכן נשמעה רק הכבשה, והשור שלידה
      // לא נשמע לעולם. מגרילים מבין כל מי שבטווח, והקרוב — סיכוייו גדולים יותר
      const cand = []; let sum = 0;
      for (const a of D.animals) if (inPer(a, per, tl)) {
        const d = Math.hypot(a.x - p.x, a.z - p.z);
        if (d < 32) { const w = 0.15 + fall(d, 32); cand.push({ d, kind: a.kind, w }); sum += w; }
      }
      if (cand.length) {
        let r = Math.random() * sum, c = cand[0];
        for (const q of cand) { r -= q.w; if (r <= 0) { c = q; break; } }
        beast(t, 0.06 + fall(c.d, 32) * 0.22, c.kind);
      }
      nextBleat = now() + 5 + Math.random() * 9;
    }
    // ציפורים: מצע שקט בחוץ כשאין המולה, ובלעדיו ציוצים כבעבר
    if (bed('birds', chains.birds)) {
      ramp(chains.birds.gain, Math.max(0, 1 - crowd * 1.6) * (inside ? 0.12 : 1) * 0.5, 1.5);
    } else if (now() > nextBird) {
      if (crowd < 0.5) chirp(t, 0.025 + Math.random() * 0.03);
      nextBird = now() + 4 + Math.random() * 10;
    }
    // ליד הלול: האפרוחים מצייצים והתרנגולות מקרקרות — לפי המרחק מן הלול הקרוב
    let coopD = 1e9;
    for (const q of D.props) if ((q.kind === 'coopcart' || q.kind === 'chickpen') && inPer(q, per, tl)) coopD = Math.min(coopD, Math.hypot(q.x - p.x, q.z - p.z));
    if (coopD < 16 && now() > nextCoop) {
      const b = sample(Math.random() < 0.6 ? 'chicks' : 'hen');
      if (b) one(b, t, 0.05 + fall(coopD, 16) * 0.3, chains.fx, 0.95 + Math.random() * 0.1);
      nextCoop = now() + (b ? 7 + Math.random() * 8 : 1);
    }
    // וקולות שמסביב, לעתים: מן הכפר כלב, ועדר חולף (ולא לול, אם כבר עומדים לידו)
    if (now() > nextFar && coopD >= 16) {
      if (!inside) {
        const near = crowd > 0.25;
        const pick = near ? (Math.random() < 0.5 ? 'chicks' : 'hen')
                          : (Math.random() < 0.5 ? 'dog' : 'flock');
        const b = sample(pick);
        if (b && Math.random() < 0.7)
          one(b, t, (near ? 0.07 : 0.04) + Math.random() * 0.03, chains.fx, 0.95 + Math.random() * 0.1);
      }
      nextFar = now() + 30 + Math.random() * 60;
    }
    // תפילה מן המקום הקדוש, לפי התקופה
    const holy = holyAt(D, per, tl);
    const dHoly = holy ? Math.hypot(holy.x - p.x, holy.z - p.z) : 1e9;
    const pname = PRAY[per];
    if (pname && bed(pname, chains.pray)) {
      // קרוב — ברור יותר; בפנים — כאילו מעבר לקיר; ובהמולה היא נבלעת
      ramp(chains.pray.gain, fall(dHoly, 70) * (inside ? 1.25 : 0.85) * (1 - crowd * 0.45), 1.4);
    }
    // קול השופר סביב המשכן: תקיעה, שברים ותרועה לסירוגין
    if (per === 'r' && dHoly < 150) {
      if (now() > nextHorn) {
        const hb = sample(HORN[hornI % HORN.length]);
        if (hb) {
          // מוגבר: קרוב — מלוא הקול, ובתוך המשכן עוד יותר; רחוק — נחלש עם המרחק
          one(hb, t, Math.min(0.9, (0.14 + fall(dHoly, 150) * 0.62) * (inside ? 1.15 : 1)), chains.fx, 0.98 + Math.random() * 0.04);
          hornI++; nextHorn = now() + 16 + Math.random() * 12;
        } else nextHorn = now() + 0.8;               // ההקלטה עוד נטענת: שוב בעוד רגע, ולא בעוד חצי דקה
      }
      // החצוצרות אינן כאן: שני הכהנים התוקעים קוראים להן בעצמם (call), כשהם
      // עומדים בפני המשכן — ולא בשעה שרירותית
      sample('trumpets');                                  // שיהיה מוכן כשיקראו לו
    }
    // ומי שהרחיק מן המרכז הדתי שומע את השופר מעברו השני של ההר: מעומעם,
    // מהדהד, ולעתים רחוקות — הקול עצמו, מן ההקלטה של בעל האפליקציה
    // (בימי הרצון — רק מעבר לטווח שבו השופר הקרוב נשמע: אחד מן השניים, לא שניהם)
    if ((per === 'r' ? dHoly >= 150 : dHoly > 55) && now() > nextFarHorn) {
      const fb = sample('shofar_far');
      if (fb) one(fb, t, 0.08 + Math.max(0, 1 - dHoly / 320) * 0.12, chains.fx, 1);
      nextFarHorn = now() + (fb ? 70 + Math.random() * 110 : 2);
    }
    // צעדי ההולך: לפי המרחק שעבר
    if (last) { const d = Math.hypot(p.x - last.x, p.z - last.z); if (d < 3) { stepAcc += d; if (stepAcc > 0.78) {
      // הצעדים — כפי שהיו: הבעלים ביקש את הצליל המסונתז ולא את ההקלטה
      stepAcc = 0;
      burst(chains.fx, t, 0.07, 0.22, 'lowpass', 700 + Math.random() * 300, 0.9);
      burst(chains.fx, t + 0.005, 0.04, 0.05, 'bandpass', 3200, 1.5);
    } } else stepAcc = 0; }
    last = { x: p.x, z: p.z };
  }
  /* ── התפילה במפה ──────────────────────────────────────────────────────────
   * The Roman, Byzantine and Islamic periods have no walk of their own, so their
   * prayer — and that of every other period — is heard when the period is chosen
   * on the map: a quiet bed, muffled in the file itself, in the voice of those
   * who held the mountain then. "הכול" is silence. Inside the walk the walk's own
   * prayer takes over, and this one waits underneath at nothing.
   */
  const MAPPRAY = { ratzon: 'pray_r', persian: 'pray_p', hellenistic: 'pray_h', roman: 'pray_rom',
                    byzantine: 'pray_b', islamic: 'pray_m', today: 'pray_n' };
  const MAP_LV = 0.42;
  function mapPeriod(id) {
    const name = MAPPRAY[id] || null;
    if (name === mapPray) return;
    mapPray = name;
    if (!ensure()) return;
    if (!mapBus) { mapBus = ctx.createGain(); mapBus.gain.value = 0; mapBus.connect(master); }
    if (mapSrc) {
      const old = mapSrc; mapSrc = null;
      ramp(mapBus.gain, 0, 0.35);
      setTimeout(() => { try { old.stop(); } catch (e) { /* done */ } }, 1600);
    }
    if (!name || !pref.amb) { settle(); return; }
    const go = () => {
      if (mapPray !== name) return;
      const b = sample(name);
      if (!b) { if (bank[name] !== false) setTimeout(go, 300); return; }
      const sc = ctx.createBufferSource(); sc.buffer = b; sc.loop = true;
      sc.connect(mapBus); sc.start(0, Math.random() * b.duration);
      mapSrc = sc;
      ramp(mapBus.gain, scene ? 0 : MAP_LV, 1.2);
      settle();
    };
    go();
  }
  document.addEventListener('click', ev => {
    const b = ev.target && ev.target.closest && ev.target.closest('#periods button');
    if (b) { mapWant = b.dataset.per || ''; mapPeriod(mapWant); }
  }, true);

  function walkScene(per, tl) {
    if (mapBus) ramp(mapBus.gain, (per == null && mapSrc) ? MAP_LV : 0, 0.8);   // the walk's prayer, not the map's
    if (per == null) { scene = null; clearInterval(aTimer); aTimer = 0; if (ctx) ramp(ambBus.gain, 0, 0.5); last = null; settle(); return; }
    // בכל כניסה לימי הרצון השופר נשמע כמעט מיד — ולא אחרי חצי דקה של שקט
    if (ctx && (!scene || scene.per !== per)) { nextHorn = now() + 4 + Math.random() * 3; hornI = Math.floor(Math.random() * 3); nextFarHorn = now() + 30 + Math.random() * 40; }
    scene = { per, tl: !!tl };
    if (!pref.amb) return;
    if (!ensure()) return;
    if (!chains) chains = buildChains();
    ramp(ambBus.gain, 1, 0.8);
    if (!aTimer) aTimer = setInterval(ambTick, 110);
    settle();
  }

  /* ================= כפתורים ================= */
  const lang = () => (document.documentElement.lang || 'he').slice(0, 2);
  const T = (k, lg) => (TXT[lg || lang()] || TXT.he)[k];
  const btns = [];
  function syncButtons() {
    for (const b of btns) b.sync();
  }
  // כפתור הצליל בסיור הרגלי: תפריט קטן עם שני מתגים נפרדים
  function walkButton(btn, getLang) {
    if (!btn || btn.dataset.snd) return; btn.dataset.snd = '1';
    const menu = document.createElement('div'); menu.id = 'walkSndMenu'; menu.hidden = true;
    menu.innerHTML = '<label><input type="checkbox" data-k="amb"><span></span></label><label><input type="checkbox" data-k="music"><span></span></label>';
    const box = document.createElement('span'); box.className = 'sndbox'; btn.parentNode.insertBefore(box, btn); box.appendChild(btn); box.appendChild(menu);
    const sync = () => {
      const lg = getLang ? getLang() : lang(), off = !pref.amb && !pref.music;
      btn.textContent = (off ? '🔇 ' : '🔊 ') + T('snd', lg); btn.setAttribute('aria-label', T('snd', lg)); btn.classList.toggle('on', !menu.hidden);
      menu.querySelectorAll('input').forEach(i => { i.checked = !!pref[i.dataset.k]; i.nextSibling.textContent = T(i.dataset.k === 'music' ? 'musicW' : i.dataset.k, lg); });
    };
    btn.onclick = e => { e.stopPropagation(); menu.hidden = !menu.hidden; sync(); };
    menu.addEventListener('click', e => e.stopPropagation());
    document.addEventListener('pointerdown', e => { if (!menu.hidden && e.target !== btn && !menu.contains(e.target)) { menu.hidden = true; sync(); } });
    menu.querySelectorAll('input').forEach(i => { i.onchange = () => { set(i.dataset.k, i.checked); }; });
    btns.push({ sync }); sync();
    new MutationObserver(sync).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  }
  // כפתור המוזיקה של הסיור המודרך במפה
  function musicButton(btn) {
    if (!btn) return;
    const sync = () => { btn.textContent = (pref.music ? '🎵 ' : '🔇 ') + T('musicS'); btn.classList.toggle('off', !pref.music); btn.title = T(pref.music ? 'musicOn' : 'musicOff'); btn.setAttribute('aria-label', btn.title); btn.setAttribute('aria-pressed', pref.music ? 'true' : 'false'); };
    btn.onclick = e => { e.stopPropagation(); set('music', !pref.music); };
    btns.push({ sync }); sync();
  }
  function set(k, v) {
    pref[k] = !!v; save();
    if (k === 'music') { if (musicOn) { if (pref.music) music(true); else if (ctx) { ramp(musicBus.gain, 0, 0.4); stopDrone(); } } }
    if (k === 'amb') {
      if (pref.amb && scene) walkScene(scene.per, scene.tl); else if (ctx) ramp(ambBus.gain, 0, 0.4);
      // the map's prayer follows the same switch: off is silence, on is the period chosen
      const want = mapWant; mapPray = null; mapPeriod(pref.amb ? want : ''); mapWant = want;
    }
    settle(); syncButtons();
  }
  // קריינות (אם תתווסף): בזמן הדיבור המוזיקה יורדת, ואחריו חוזרת
  function duck(on) { duckN = Math.max(0, duckN + (on ? 1 : -1)); if (ctx && musicOn) musicTick(); }

  /* a sound the walk itself calls for, at a place: the two priests blowing
     their trumpets before the Tabernacle. Heard by its distance from the
     walker, like every other sound here. */
  function call(name, x, z) {
    if (!ctx || !chains || !scene || !pref.amb) return;
    const b = sample(name);
    const GW = window.GerizimWalk, p = GW && GW._pos && GW._pos();
    if (!b || !p) return;
    const d = Math.hypot(x - p.x, z - p.z);
    one(b, now() + 0.05, Math.min(0.85, 0.1 + fall(d, 140) * 0.6), chains.fx, 1);
  }
  window.GerizimAudio = { music, walkScene, walkButton, musicButton, duck, set, call, get pref() { return Object.assign({}, pref); },
    _state: () => ({ ctx: ctx && ctx.state, musicOn, music: ctx ? +musicBus.gain.value.toFixed(3) : 0, amb: ctx ? +ambBus.gain.value.toFixed(3) : 0, scene, chains: chains ? { crowd: +chains.crowd.gain.value.toFixed(3), fire: +chains.fire.gain.value.toFixed(3), wind: +chains.wind.gain.value.toFixed(3) } : null }) };
})();
