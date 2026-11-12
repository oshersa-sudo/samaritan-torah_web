/* הסיור הרגלי: החיים והנוף.
   דמויות שהולכות ועוצרות, חיות שרועות, ציפורים, עננים ושעת היום — ובכל כניסה הזירה מעט אחרת,
   כי מי שנמצא, מי שהולך, לאן ומתי נקבעים בהגרלה חדשה. מסביב: הנוף הרחוק כפי שהוא היום, מן הגבהים ומצילום האוויר, ועצים.
   מה שהוא השערה: הדמויות, החיות, הצמחייה. הנוף הרחוק מראה את ההרים של היום, ובכללם היישובים של היום. */
(function () {
  window.GerizimLife = function (cx) {
    const THREE = cx.THREE, W = cx.W, GP = window.GerizimPeople;
    const rngOf = seed => { let a = seed >>> 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
    let cullAt = 0, shown = true;
    let R = Math.random, actors = [], still = [], beasts = [], birds = [], clouds = [], floorsNow = [], time = 0, budget = 0, flock = null;

    /* ---------- אנשים ---------- */
    const FIXED = ['lamb', 'bowl', 'doves', 'horn', 'spear'];          // מי שנושא אותם עומד במקומו
    const WALKS = { man: 0.6, woman: 0.55, elder: 0.4, child: 0.85, merchant: 0.25, levite: 0.3, priest: 0.25 };
    const SPEED = { man: 1.25, woman: 1.1, elder: 0.75, child: 2.1, merchant: 1.1, levite: 1.05, priest: 0.95 };
    const STEP = { child: 0.44, elder: 0.56, woman: 0.6 };              // אורך צעד, במטרים
    const TW = cx.lite ? 104 : 128;                                     // רוחב המרקם של דמות הולכת
    const walkTex = (a, back, stride, force) => {
      const key = 'w' + a.kind + a.carry + a.look + (back ? 'b' : 'f') + stride;
      if (!cx.hasTexture(key)) { if (!force && budget <= 0) return null; budget--; }
      return cx.texture(key, TW, TW * 2, c => GP.drawPerson(c, a.kind, a.carry, a.look + 3, { back, stride }));
    };
    const poseTex = (s, pose, mood, force) => {
      const key = 'p' + s.kind + s.carry + s.seed + pose + mood;
      if (!cx.hasTexture(key)) { if (!force && budget <= 0) return null; budget--; }
      return cx.texture(key, 144, 288, c => GP.drawPerson(c, s.kind, s.carry, s.seed + 3, { pose, mood, back: pose === 'stand' ? undefined : false }));
    };
    function clear(x0, z0, y0, x1, z1) {                               // האם אפשר ללכת בקו ישר, בלי קיר, בלי חפץ בדרך ובלי מדרגה גבוהה מדי
      const d = Math.hypot(x1 - x0, z1 - z0), n = Math.ceil(d / 0.6); let y = y0;
      for (let i = 1; i <= n; i++) { const f = cx.canStand(x0 + (x1 - x0) * i / n, z0 + (z1 - z0) * i / n, y, x0 + (x1 - x0) * (i - 1) / n, z0 + (z1 - z0) * (i - 1) / n); if (!f) return false; y = f.y; }
      return true;
    }
    function pick(a, reach) {
      for (let i = 0; i < 4; i++) {
        if (!a.cand) { const rr = Math.min(a.roam, reach); a.cand = floorsNow.filter(q => Math.hypot(Math.max(q.box[0] - a.hx, 0, a.hx - q.box[2]), Math.max(q.box[1] - a.hz, 0, a.hz - q.box[3])) < rr); if (!a.cand.length) a.cand = floorsNow; }   // המשטחים שבטווח ההליכה שלו
        let f = a.cand[Math.floor(R() * a.cand.length)]; const g = a.cand[Math.floor(R() * a.cand.length)];
        const area = q => (q.box[2] - q.box[0]) * (q.box[3] - q.box[1]); if (area(g) > area(f)) f = g;      // רחבות ורחובות מושכים יותר מפתחים צרים
        const b = f.box, tx = b[0] + 0.6 + R() * Math.max(0.01, b[2] - b[0] - 1.2), tz = b[1] + 0.6 + R() * Math.max(0.01, b[3] - b[1] - 1.2);
        const d = Math.hypot(tx - a.x, tz - a.z);
        if (d < 2.5 || d > reach || Math.hypot(tx - a.hx, tz - a.hz) > a.roam) continue;
        if (clear(a.x, a.z, a.y, tx, tz)) { a.tx = tx; a.tz = tz; return true; }
      }
      a.wait = 0.5 + R() * 1.5; return false;
    }
    function addPeople(root) {
      for (const p of W.people) {
        if (!cx.inPer(p)) continue;
        const placed = !(p.seed > 1000);                                // דמות שהוצבה במקום מסוים (ולא פוזרה ברחוב)
        if (!placed && R() < (cx.lite ? 0.5 : 0.2)) continue;           // לא כולם נמצאים בכל פעם; במכשיר חלש — פחות
        let x = p.x, z = p.z, s = null;
        if (!placed) { const jx = x + (R() - 0.5) * 3.4, jz = z + (R() - 0.5) * 3.4; s = cx.spot(jx, jz); if (s) { x = jx; z = jz; } }
        s = s || cx.spot(x, z); if (!s) continue;
        const carry = p.carry || 'none', fixed = p.kind === 'guard' || FIXED.indexOf(carry) >= 0 || !!p.pose;
        const walks = GP && !fixed && R() < (WALKS[p.kind] || 0) * (placed ? 0.35 : 1);
        if (!walks) {
          const seed = (p.seed || 1) % 16, st = { kind: p.kind, carry, seed, x, z, w: 0.5 + R() * 0.7, ph: R() * 6.3, pose: p.pose || 'stand', talk: 0, t: R() * 4, cur: '' };
          if (st.pose === 'stand') st.sp = cx.sprite(p.kind + carry + seed, 1.07, 2.14, 160, 320, c => GP.drawPerson(c, p.kind, carry, seed + 3));
          else { st.sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: poseTex(st, st.pose, 'calm', true), transparent: true, alphaTest: 0.25, fog: true })); st.sp.center.set(0.5, 0); st.sp.scale.set(1.07, 2.14, 1); }
          st.sp.position.set(x, s.y, z); root.add(st.sp); still.push(st);
          continue;
        }
        const a = { kind: p.kind, carry, look: (p.seed || 1) % (cx.lite ? 3 : 5), x, z, y: s.y, hx: x, hz: z, roam: p.kind === 'child' ? 22 : placed ? 14 : 70,
          v: (SPEED[p.kind] || 1.1) * (0.82 + R() * 0.36), wait: R() < 0.55 ? 0 : R() * 6, tx: null, tz: 0, dist: R() * 3, back: R() < 0.5, key: '', dx: 0, dz: 1, slope: 0 };
        a.sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: walkTex(a, a.back, 0, true), transparent: true, alphaTest: 0.25, fog: true }));
        a.sp.center.set(0.5, 0); a.sp.scale.set(1.07, 2.14, 1); a.sp.position.set(x, s.y, z); root.add(a.sp); actors.push(a);
      }
      // שניים שעומדים קרוב זה לזה — משוחחים: אחד מדבר ומחווה בידו, והשני מקשיב
      for (let i = 0; i < still.length; i++) {
        const a = still[i]; if (a.pose !== 'stand' || a.talk || a.kind === 'guard' || FIXED.indexOf(a.carry) >= 0) continue;
        for (let j = i + 1; j < still.length; j++) { const b = still[j]; if (b.pose !== 'stand' || b.talk || b.kind === 'guard' || FIXED.indexOf(b.carry) >= 0) continue; if (Math.hypot(a.x - b.x, a.z - b.z) < 2.3) { a.talk = 1; b.talk = 2; a.mate = b; b.mate = a; break; } }
      }
    }
    function stepPeople(dt, cam, pos) {
      for (const a of actors) {
        const dc = Math.abs(cam.x - a.x) + Math.abs(cam.z - a.z);
        if (cullAt) { const far = dc > cullAt; a.sp.visible = shown && !far; if (far) continue; }
        let walking = false;
        if (a.wait > 0) { a.wait -= dt; }
        else if (a.tx == null) { if (budget > 0) { budget--; pick(a, 46); } }
        else {
          const ddx = a.tx - a.x, ddz = a.tz - a.z, d = Math.hypot(ddx, ddz);
          if (d < 0.3) { a.tx = null; a.wait = a.kind === 'child' ? 0.3 + R() * 2.5 : 1.5 + R() * 9; }
          else if (Math.hypot(pos.x - a.x, pos.z - a.z) < 1.0 && ddx * (pos.x - a.x) + ddz * (pos.z - a.z) > 0) { a.wait = 0.5; }        // המבקר עומד בדרך: מחכים שיעבור
          else {
            // בעלייה מאטים, ובירידה תלולה נזהרים
            const v = a.v * Math.max(0.5, Math.min(1, 1 - (a.slope > 0 ? a.slope * 1.6 : -a.slope * 0.8)));
            const st = Math.min(d, v * dt), nx = a.x + ddx / d * st, nz = a.z + ddz / d * st, f = cx.canStand(nx, nz, a.y, a.x, a.z);
            if (!f) { a.tx = null; a.wait = 0.4 + R(); }
            else {
              a.slope += ((f.y - a.gy0 || 0) / Math.max(st, 0.001) - a.slope) * Math.min(1, dt * 4); a.gy0 = f.y;
              const ty = f.f.steps && cx.standY ? cx.standY(f.f, nx, nz) : f.y;                 // ברחוב מדורג עומדים על המדרגה עצמה
              a.x = nx; a.z = nz; a.y += (ty - a.y) * Math.min(1, dt * 14); a.dist += st; a.dx = ddx / d; a.dz = ddz / d; walking = true;
            }
          }
        }
        if (a.gy0 == null) a.gy0 = a.y;
        // מי שמתקרב אל הצופה נראה מלפנים, ומי שמתרחק — מאחור
        if (walking) a.back = a.dx * (cam.x - a.x) + a.dz * (cam.z - a.z) < 0;
        // מחזור ההליכה: ארבעה שלבים לכל שני צעדים. הדמות עצמה אינה קופצת — כפות הרגליים מצוירות על הקרקע
        const ph = a.dist / (STEP[a.kind] || 0.66) * 2, full = dc < 70, stride = walking ? (full ? (Math.floor(ph) % 4) + 1 : (Math.floor(ph / 2) % 2) * 2 + 1) : 0, key = (a.back ? 'b' : 'f') + stride;
        if (key !== a.key) { const t = dc > 190 ? null : walkTex(a, a.back, stride, false); if (t) { a.sp.material.map = t; a.key = key; } }
        a.sp.position.set(a.x, a.y, a.z);
        if (walking) { const vx = a.x - cam.x, vz = a.z - cam.z, vl = Math.hypot(vx, vz) || 1, along = Math.abs(a.dx * vx + a.dz * vz) / vl; a.turn = (a.turn == null ? 1 : a.turn) + ((0.6 + 0.4 * along) - (a.turn == null ? 1 : a.turn)) * Math.min(1, dt * 6); }
        else if (a.turn != null) a.turn += (1 - a.turn) * Math.min(1, dt * 3);
        a.sp.scale.x = 1.07 * (a.turn == null ? 1 : a.turn);
        a.sp.material.rotation = walking ? 0 : Math.sin(time * 0.7 + a.hx) * 0.006;
      }
      for (const s of still) {
        if (s.pose === 'stand') s.sp.material.rotation = Math.sin(time * s.w + s.ph) * 0.009;       // מי שעומד — מתנדנד קלות, נושם
        if (!s.talk) continue;
        // שיחה: מתחלפים. כל כמה שניות אחד מדבר והשני מקשיב
        s.t -= dt; if (s.t > 0) continue; s.t = 1.6 + R() * 3.4;
        if (Math.abs(cam.x - s.x) + Math.abs(cam.z - s.z) > 45) continue;
        const speaking = (Math.floor(time / 4.2 + s.ph) + s.talk) % 2 === 0, want = speaking ? 'talk|speak' : 'stand|' + (R() < 0.5 ? 'smile' : 'calm');
        if (want !== s.cur) { const q = want.split('|'), t = poseTex(s, q[0], q[1], false); if (t) { s.sp.material = new THREE.SpriteMaterial({ map: t, transparent: true, alphaTest: 0.25, fog: true }); s.cur = want; } }
      }
    }

    /* ---------- חיות: הולכות, עומדות, רועות, נחות, ומרימות ראש כשמתקרבים ---------- */
    const beastTex = (b, right, stride, mode, force) => {
      const key = 'b' + b.kind + (right ? 'r' : 'l') + stride + mode;
      if (!cx.hasTexture(key)) { if (!force && budget <= 0) return null; budget--; }
      return cx.texture(key, cx.lite ? 168 : 224, cx.lite ? 144 : 192, c => GP.drawAnimal(c, b.kind, { flip: !right, stride, graze: mode === 'g', rest: mode === 'r', look: mode === 'l' }));
    };
    function addBeast(root, kind, x, z) {
      const s = cx.spot(x, z); if (!s) return;
      const grazer = kind === 'sheep' || kind === 'goat';
      const b = { kind, x, z, y: s.y, hx: x, hz: z, v: (grazer ? 0.42 : 0.6) * (0.8 + R() * 0.4), wait: R() * 7, tx: null, tz: 0, dist: R() * 2, right: R() < 0.5, mode: grazer && R() < 0.5 ? 'g' : R() < 0.25 ? 'r' : '', grazer, key: '', mood: 2 + R() * 6 };
      b.sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: beastTex(b, b.right, 0, b.mode, true), transparent: true, alphaTest: 0.25, fog: true }));
      b.sp.center.set(0.5, 0); b.sp.scale.set(2.18, 1.87, 1); b.sp.position.set(x, s.y, z); root.add(b.sp); beasts.push(b);
    }
    function addBeasts(root) {
      if (!GP) return;
      for (const a of W.animals) {
        if (!cx.inPer(a) || R() < (cx.lite ? 0.3 : 0.12)) continue;
        addBeast(root, a.kind, a.x + (R() - 0.5) * 2.4, a.z + (R() - 0.5) * 2.4);
        if ((a.kind === 'sheep' || a.kind === 'goat') && R() < 0.55) addBeast(root, R() < 0.7 ? a.kind : (a.kind === 'sheep' ? 'goat' : 'sheep'), a.x + (R() - 0.5) * 5, a.z + (R() - 0.5) * 5);   // העדר גדול או קטן
      }
    }
    function stepBeasts(dt, cam, yaw, pos) {
      const rx = Math.cos(yaw), rz = Math.sin(yaw);                     // ימין המסך, בעולם
      for (const b of beasts) {
        let walking = false; const near = Math.hypot(pos.x - b.x, pos.z - b.z);
        if (b.wait > 0) {
          b.wait -= dt; b.mood -= dt;
          if (near < 3.2) { if (b.mode !== 'l') { b.mode = 'l'; b.mood = 2.5; } }                  // מישהו מתקרב: הראש מורם
          else if (b.mood < 0) { const r = R(); b.mode = b.grazer && r < 0.5 ? 'g' : r < 0.72 ? 'r' : ''; b.mood = b.mode === 'r' ? 12 + R() * 25 : 3 + R() * 8; if (b.mode === 'r') b.wait = Math.max(b.wait, b.mood); }
        } else if (b.tx == null) {
          const tx = b.hx + (R() - 0.5) * 9, tz = b.hz + (R() - 0.5) * 9;
          if (budget > 0 && Math.hypot(tx - b.x, tz - b.z) > 1.2 && (budget--, clear(b.x, b.z, b.y, tx, tz))) { b.tx = tx; b.tz = tz; b.mode = ''; } else b.wait = 1 + R() * 3;
        } else {
          const ddx = b.tx - b.x, ddz = b.tz - b.z, d = Math.hypot(ddx, ddz);
          if (d < 0.25) { b.tx = null; b.wait = 3 + R() * 14; b.mode = b.grazer && R() < 0.7 ? 'g' : ''; b.mood = 3 + R() * 8; }
          else {
            const st = Math.min(d, b.v * dt), f = cx.canStand(b.x + ddx / d * st, b.z + ddz / d * st, b.y, b.x, b.z);
            if (!f) { b.tx = null; b.wait = 1 + R() * 2; }
            else { b.x += ddx / d * st; b.z += ddz / d * st; b.y += ((f.f.steps && cx.standY ? cx.standY(f.f, b.x, b.z) : f.y) - b.y) * Math.min(1, dt * 12); b.dist += st; walking = true; const side = ddx / d * rx + ddz / d * rz; if (Math.abs(side) > 0.25) b.right = side > 0; b.turn = (b.turn || 1) + ((0.55 + 0.45 * Math.abs(side)) - (b.turn || 1)) * Math.min(1, dt * 5); }
          }
        }
        const stride = walking ? (Math.floor(b.dist / 0.22) % 4) + 1 : 0, mode = walking ? '' : b.mode, key = (b.right ? 'r' : 'l') + stride + mode;
        if (key !== b.key) { const t = beastTex(b, b.right, stride, mode, false); if (t) { b.sp.material.map = t; b.key = key; } }
        b.sp.scale.x = 2.18 * (b.turn || 1);
        b.sp.position.set(b.x, b.y, b.z);
      }
    }

    /* ---------- יונים על הקרקע: מנקרות, ומתעופפות כשמתקרבים אליהן ---------- */
    let doves = [], doveHome = null;
    const doveTex = (right, mode) => cx.texture('dove' + (right ? 'r' : 'l') + mode, 96, 96, c => GP.drawAnimal(c, 'dove', mode[0] === 'f' ? { flip: !right, fly: +mode[1] } : { flip: !right, stride: +mode[1] }));
    function addDoves(root) {
      doves = []; doveHome = null;
      let ok = true; try { doveTex(true, 's1'); } catch (e) { ok = false; }
      if (!ok || !GP) return;
      const yards = floorsNow.filter(f => (f.box[2] - f.box[0]) > 14 && (f.box[3] - f.box[1]) > 14 && !f.ramp); if (!yards.length) return;
      const f = yards[Math.floor(R() * yards.length)], b = f.box; doveHome = { x: b[0] + 4 + R() * (b[2] - b[0] - 8), z: b[1] + 4 + R() * (b[3] - b[1] - 8), y: f.y, f };
      const n = cx.lite ? 4 : 5 + Math.floor(R() * 5);
      for (let i = 0; i < n; i++) {
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: doveTex(true, 's1'), transparent: true, alphaTest: 0.25, fog: true }));
        sp.center.set(0.5, 0.06); sp.scale.set(0.5, 0.5, 1); root.add(sp);
        doves.push({ sp, x: doveHome.x + (R() - 0.5) * 5, z: doveHome.z + (R() - 0.5) * 5, y: f.y, right: R() < 0.5, t: R() * 2, fly: 0, vx: 0, vz: 0, ph: R() * 6.3 });
      }
    }
    function stepDoves(dt, pos) {
      if (!doves.length) return;
      const startle = Math.hypot(pos.x - doveHome.x, pos.z - doveHome.z) < 6;
      for (const d of doves) {
        if (d.fly > 0) {                                                // באוויר: עולות, חגות, ונוחתות במקום אחר באותה רחבה
          d.fly -= dt; const k = Math.max(0, d.fly / 5);
          d.x += d.vx * dt; d.z += d.vz * dt; d.vx += Math.cos(time * 0.9 + d.ph) * dt * 2; d.vz += Math.sin(time * 0.9 + d.ph) * dt * 2;
          d.h = d.fly > 1 ? Math.min(7, (d.h || 0) + dt * 4) : Math.max(0, (d.h || 0) - dt * 7);
          d.sp.material.map = doveTex(d.vx >= 0, 'f' + (Math.sin(time * 26 + d.ph) > 0 ? 1 : 2));
          if (d.fly <= 0) { const b = doveHome.f.box; d.x = Math.max(b[0] + 1, Math.min(b[2] - 1, d.x)); d.z = Math.max(b[1] + 1, Math.min(b[3] - 1, d.z)); d.h = 0; }
          d.sp.position.set(d.x, d.y + (d.h || 0), d.z); continue;
        }
        if (startle && Math.hypot(pos.x - d.x, pos.z - d.z) < 6.5) { const ax = d.x - pos.x, az = d.z - pos.z, l = Math.hypot(ax, az) || 1; d.fly = 4 + R() * 2.5; d.vx = ax / l * 3.2 + (R() - 0.5) * 2; d.vz = az / l * 3.2 + (R() - 0.5) * 2; d.h = 0; continue; }
        d.t -= dt;
        if (d.t < 0) { d.t = 0.25 + R() * 0.5; d.peck = !d.peck; if (R() < 0.3) { d.right = R() < 0.5; d.x += (d.right ? 0.12 : -0.12); d.z += (R() - 0.5) * 0.2; } d.sp.material.map = doveTex(d.right, 's' + (d.peck ? 2 : 1)); }
        d.sp.position.set(d.x, d.y, d.z);
      }
      if (startle) { const b = doveHome.f.box; doveHome.x = b[0] + 3 + R() * (b[2] - b[0] - 6); doveHome.z = b[1] + 3 + R() * (b[3] - b[1] - 6); }
    }

    /* ---------- ציפורים ועננים ---------- */
    function birdTex(up) {
      return cx.texture('bird' + (up ? 1 : 0), 64, 32, c => { const g = c.getContext('2d'); g.strokeStyle = '#2b2620'; g.lineWidth = 3.2; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); if (up) { g.moveTo(6, 8); g.quadraticCurveTo(20, 6, 32, 20); g.quadraticCurveTo(44, 6, 58, 8); } else { g.moveTo(6, 24); g.quadraticCurveTo(20, 12, 32, 18); g.quadraticCurveTo(44, 12, 58, 24); } g.stroke(); g.fillStyle = '#2b2620'; g.beginPath(); g.ellipse(32, 20, 4, 2.4, 0, 0, 6.3); g.fill(); });
    }
    function addBirds(root, pos) {
      const n = Math.floor(R() * 3) === 0 ? 0 : 4 + Math.floor(R() * 9);     // יש כניסות בלי להקה בשמים
      flock = { x: pos.x + (R() - 0.5) * 60, z: pos.z + (R() - 0.5) * 60, y: pos.y };
      for (let i = 0; i < n; i++) {
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: birdTex(true), transparent: true, depthWrite: false, fog: true }));
        sp.scale.set(1.25, 0.62, 1); root.add(sp);
        birds.push({ sp, ang: R() * 6.3, rad: 12 + R() * 34, h: 15 + R() * 26, w: (0.22 + R() * 0.2) * (R() < 0.5 ? 1 : -1), ph: R() * 6.3, up: true });
      }
    }
    function cloudTex(i) {
      return cx.texture('cloud' + i, 256, 128, c => { const g = c.getContext('2d'), q = rngOf(91 + i * 17); for (let k = 0; k < 9; k++) { const x = 50 + q() * 156, y = 50 + q() * 34, r = 26 + q() * 30, gr = g.createRadialGradient(x, y, 2, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,.85)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 256, 128); } });
    }
    function addClouds(root) {
      const n = 2 + Math.floor(R() * (cx.lite ? 4 : 9)), wind = (3 + R() * 6) * (R() < 0.5 ? 1 : -1);
      for (let i = 0; i < n; i++) {
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex(i % 4), transparent: true, depthWrite: false, fog: false, opacity: 0.55 + R() * 0.35 }));
        const s = 900 + R() * 1500; sp.scale.set(s, s * (0.3 + R() * 0.14), 1);
        sp.position.set((R() - 0.5) * 11000, 520 + R() * 900, (R() - 0.5) * 11000); sp.renderOrder = -1; root.add(sp); clouds.push({ sp, wind: wind * (0.7 + R() * 0.6) });
      }
    }
    function stepSky(dt, pos) {
      if (dome) dome.position.set(pos.x, pos.y, pos.z);
      if (sunSp) { const k = 30000 / Math.hypot(sunDir[0], sunDir[1], sunDir[2]); sunSp.position.set(pos.x + sunDir[0] * k, pos.y + sunDir[1] * k, pos.z + sunDir[2] * k); }
      if (flock) { flock.x += (pos.x - flock.x) * Math.min(1, dt * 0.12); flock.z += (pos.z - flock.z) * Math.min(1, dt * 0.12); flock.y += (pos.y - flock.y) * Math.min(1, dt * 0.5); }
      for (const b of birds) {
        b.ang += b.w * dt; const up = Math.sin(time * 9 + b.ph) > 0;
        if (up !== b.up) { b.up = up; b.sp.material.map = birdTex(up); }
        b.sp.position.set(flock.x + Math.cos(b.ang) * b.rad, flock.y + b.h + Math.sin(time * 0.6 + b.ph) * 2.2, flock.z + Math.sin(b.ang) * b.rad * 0.8);
      }
      for (const c of clouds) { c.sp.position.x += c.wind * dt; if (c.sp.position.x > 6500) c.sp.position.x = -6500; if (c.sp.position.x < -6500) c.sp.position.x = 6500; }
    }

    /* ---------- השמש: עומדת בשמים בדיוק במקום שממנו בא האור, כך שהצללים והשעה עקביים ---------- */
    let sunSp = null, sunDir = [-120, 220, 90];
    function addSun(farRoot) {
      const t = cx.texture('sun', 128, 128, c => { const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 2, 64, 64, 62); gr.addColorStop(0, 'rgba(255,255,244,1)'); gr.addColorStop(0.12, 'rgba(255,248,214,.95)'); gr.addColorStop(0.3, 'rgba(255,236,170,.32)'); gr.addColorStop(1, 'rgba(255,230,160,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); });
      sunSp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, fog: false })); sunSp.scale.set(9000, 9000, 1); sunSp.renderOrder = -2; farRoot.add(sunSp);
    }
    /* ---------- שעת היום ---------- */
    const MOODS = [
      { sky: ['#6aa0d4', '#b6d1e6', '#f0e3d2', '#e4d7c0'], fog: 0xe4dccd, hemi: [0xfff1de, 0xb5a688, 0.66], sun: [0xffe7c8, 0.4, [260, 150, -60]] },     // בוקר: השמש במזרח
      { sky: ['#5f9bd0', '#a9cbe2', '#dfe3d6', '#d9d2bd'], fog: 0xdcd8c6, hemi: [0xfff6e4, 0xb9aa8c, 0.72], sun: [0xfff1d6, 0.46, [-120, 220, 90]] },   // צהריים
      { sky: ['#5b8dc2', '#b3c5d6', '#f3d8ae', '#e7cfa5'], fog: 0xe8d6b6, hemi: [0xffeccd, 0xb39f7c, 0.62], sun: [0xffd49a, 0.44, [-270, 105, 80]] }    // אחר הצהריים: אור זהוב ממערב
    ];
    let dome = null, domeTex = null;
    function addSky(farRoot) {
      if (!domeTex) domeTex = new THREE.CanvasTexture(cx.sky);
      dome = new THREE.Mesh(new THREE.SphereGeometry(52000, 24, 16), new THREE.MeshBasicMaterial({ map: domeTex, side: THREE.BackSide, fog: false, depthWrite: false })); dome.renderOrder = -5; farRoot.add(dome);
    }
    function mood() {
      const m = MOODS[Math.floor(R() * MOODS.length)], g = cx.sky.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256);
      gr.addColorStop(0, m.sky[0]); gr.addColorStop(0.34, m.sky[1]); gr.addColorStop(0.495, m.sky[2]); gr.addColorStop(0.56, m.sky[3]); gr.addColorStop(1, m.sky[3]);
      g.fillStyle = gr; g.fillRect(0, 0, 4, 256); if (domeTex) domeTex.needsUpdate = true; if (cx.scene.background && cx.scene.background.isTexture) cx.scene.background.needsUpdate = true;
      cx.scene.fog.color.setHex(m.fog);
      cx.hemi.color.setHex(m.hemi[0]); cx.hemi.groundColor.setHex(m.hemi[1]); cx.hemi.intensity = m.hemi[2] * (cx.shadows ? 0.8 : 1);
      cx.sun.color.setHex(m.sun[0]); cx.sun.intensity = m.sun[1] * (cx.shadows ? 1.2 : 1); cx.sun.position.set(m.sun[2][0], m.sun[2][1], m.sun[2][2]); cx.sun.userData.dir = m.sun[2]; sunDir = m.sun[2];
    }

    /* ---------- הנוף הרחוק: הגבהים של היום, ועליהם צילום האוויר של היום ---------- */
    const FAR = window.GERIZIM_FAR || null, C0 = W.origin || [35.273441, 32.201236], TZ = 13;
    function farY(x, z) {
      if (!FAR) return null;
      const r = Math.max(0, Math.min(FAR.rows - 1.001, (-z - FAR.n0) / FAR.step)), c = Math.max(0, Math.min(FAR.cols - 1.001, (x - FAR.e0) / FAR.step));
      const i = Math.floor(r), j = Math.floor(c), a = r - i, b = c - j, v = FAR.v;
      return v[i][j] * (1 - a) * (1 - b) + v[i + 1][j] * a * (1 - b) + v[i][j + 1] * (1 - a) * b + v[i + 1][j + 1] * a * b + (W.demOff || 0);
    }
    const tileXY = (x, z) => {                                          // מקום בזירה -> מקום ברשת האריחים
      const en = W.toEN(x, z), lon = C0[0] + en[0] / (111320 * Math.cos(C0[1] * Math.PI / 180)), lat = C0[1] + en[1] / 111320, n = Math.pow(2, TZ), la = lat * Math.PI / 180;
      return [(lon + 180) / 360 * n, (1 - Math.log(Math.tan(la) + 1 / Math.cos(la)) / Math.PI) / 2 * n];
    };
    let farTex = null, farBox = null;
    function farTexture() {
      if (farTex) return farTex;
      const x0 = FAR.e0, x1 = FAR.e0 + (FAR.cols - 1) * FAR.step, z0 = -(FAR.n0 + (FAR.rows - 1) * FAR.step), z1 = -FAR.n0;
      const cs = [tileXY(x0, z0), tileXY(x1, z0), tileXY(x0, z1), tileXY(x1, z1)];
      const tx0 = Math.floor(Math.min.apply(null, cs.map(q => q[0]))), tx1 = Math.floor(Math.max.apply(null, cs.map(q => q[0])));
      const ty0 = Math.floor(Math.min.apply(null, cs.map(q => q[1]))), ty1 = Math.floor(Math.max.apply(null, cs.map(q => q[1])));
      const nx = tx1 - tx0 + 1, ny = ty1 - ty0 + 1, P = cx.lite ? 128 : nx * ny > 30 ? 192 : 256;
      farBox = { tx0, ty0, nx, ny };
      const raw = document.createElement('canvas'), out = document.createElement('canvas'); raw.width = out.width = nx * P; raw.height = out.height = ny * P;
      const rg = raw.getContext('2d'), og = out.getContext('2d'), EARTH = '#b3a37c';
      rg.fillStyle = EARTH; rg.fillRect(0, 0, raw.width, raw.height);
      const site = tileXY(40, -40), sx = (site[0] - tx0) * P, sy = (site[1] - ty0) * P, mpp = 40075016 * Math.cos(C0[1] * Math.PI / 180) / Math.pow(2, TZ) / P;
      const compose = () => {
        og.drawImage(raw, 0, 0);
        og.fillStyle = 'rgba(196,180,140,.2)'; og.fillRect(0, 0, out.width, out.height);          // מעט חום ורוך, שהצילום ישתלב בזירה המצוירת
        // סמוך לאתר הצילום של היום נמוג אל צבע האדמה: שם עומדת העיר המשוחזרת, ולא הבתים של היום
        const gr = og.createRadialGradient(sx, sy, 330 / mpp, sx, sy, 1150 / mpp); gr.addColorStop(0, 'rgba(179,163,124,1)'); gr.addColorStop(1, 'rgba(179,163,124,0)');
        og.fillStyle = gr; og.fillRect(0, 0, out.width, out.height);
        farTex.needsUpdate = true;
      };
      farTex = new THREE.CanvasTexture(out); farTex.anisotropy = 4;
      let pending = 0, timer = null;
      const later = () => { if (timer) return; timer = setTimeout(() => { timer = null; compose(); }, 350); };
      for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
        const im = new Image(); im.crossOrigin = 'anonymous'; pending++;
        im.onload = () => { rg.drawImage(im, i * P, j * P, P, P); later(); };
        im.src = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/' + TZ + '/' + (ty0 + j) + '/' + (tx0 + i);
      }
      compose();
      return farTex;
    }
    function addFar(root, near) {                                      // near: [x1, z1, x2, z2] של פני השטח המפורטים
      if (!FAR) return;
      const rows = FAR.rows, cols = FAR.cols, pos = new Float32Array(rows * cols * 3), uv = new Float32Array(rows * cols * 2), idx = [];
      farTexture();
      for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
        const x = FAR.e0 + j * FAR.step, z = -(FAR.n0 + i * FAR.step), k = i * cols + j, t = tileXY(x, z);
        pos[k * 3] = x; pos[k * 3 + 1] = FAR.v[i][j] + (W.demOff || 0) - 0.9; pos[k * 3 + 2] = z;
        uv[k * 2] = (t[0] - farBox.tx0) / farBox.nx; uv[k * 2 + 1] = 1 - (t[1] - farBox.ty0) / farBox.ny;
      }
      for (let i = 0; i + 1 < rows; i++) for (let j = 0; j + 1 < cols; j++) { const a = i * cols + j, b = a + 1, c = a + cols, d = c + 1; idx.push(a, b, c, b, d, c); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
      root.add(new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: farTex })));
    }

    /* ---------- עצים, שיחים וכיסוי הקרקע: מיני ההר — זית, אלון, אלה, חרוב, תאנה, רימון, ברוש, סירה קוצנית, עשב ופרחי בר ---------- */
    function treeTex(kind, v) {
      return cx.texture('tree' + kind + v, 128, 160, c => {
        const g = c.getContext('2d'), q = rngOf(kind.length * 7 + kind.charCodeAt(0) * 3 + v * 13 + 5);
        const blob = (x, y, r, col) => { const gr = g.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r); gr.addColorStop(0, col[0]); gr.addColorStop(0.7, col[1]); gr.addColorStop(1, col[2]); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 6.3); g.fill(); };
        const shade = () => { const sh = g.createRadialGradient(64, 150, 2, 64, 150, 46); sh.addColorStop(0, 'rgba(0,0,0,.35)'); sh.addColorStop(1, 'rgba(0,0,0,0)'); g.save(); g.scale(1, 0.25); g.fillStyle = sh; g.beginPath(); g.arc(64, 600, 46, 0, 6.3); g.fill(); g.restore(); };
        const trunk = (col, wd, lean) => { g.strokeStyle = col; g.lineCap = 'round'; g.lineWidth = wd; g.beginPath(); g.moveTo(64, 154); g.quadraticCurveTo(58 + q() * 12 + lean, 126, 62 + q() * 6 + lean, 100); g.stroke(); g.lineWidth = wd * 0.5; g.beginPath(); g.moveTo(62, 122); g.quadraticCurveTo(48, 108, 42, 90); g.moveTo(64, 118); g.quadraticCurveTo(80, 104, 86, 88); g.stroke(); };
        if (kind === 'grass') {                           // ציצת עשב יבש
          for (let i = 0; i < 26; i++) { const x = 34 + q() * 60, h = 20 + q() * 34; g.strokeStyle = ['#b9a868', '#9c9a58', '#c9b878', '#8a8a4c'][i % 4]; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x, 156); g.quadraticCurveTo(x + (q() - 0.5) * 18, 156 - h * 0.6, x + (q() - 0.5) * 26, 156 - h); g.stroke(); }
          return;
        }
        if (kind === 'flowers') {                         // כתם פרחי בר: כלניות וחרציות בין העשב
          for (let i = 0; i < 18; i++) { const x = 30 + q() * 68, h = 12 + q() * 22; g.strokeStyle = '#7f8a4a'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(x, 156); g.lineTo(x + (q() - 0.5) * 8, 156 - h); g.stroke(); }
          for (let i = 0; i < 14; i++) { const x = 30 + q() * 68, y = 124 + q() * 26; g.fillStyle = i % 3 ? '#b8322a' : '#e3c33c'; g.beginPath(); g.arc(x, y, 3.2 + q() * 1.6, 0, 6.3); g.fill(); g.fillStyle = '#2a1a12'; g.beginPath(); g.arc(x, y, 1, 0, 6.3); g.fill(); }
          return;
        }
        shade();
        if (kind === 'cypress') {
          g.fillStyle = '#4a3a2a'; g.fillRect(61, 128, 6, 26);
          for (let i = 0; i < 16; i++) { const y = 136 - i * 8, r = 17 - i * 0.85 + q() * 3; blob(64 + (q() - 0.5) * 5, y, r, ['#5f7446', '#3c5232', '#27381f']); }
        } else if (kind === 'shrub') {                    // סירה קוצנית: כריות נמוכות, אפורות-ירוקות
          for (let i = 0; i < 10; i++) blob(30 + q() * 68, 130 + q() * 16, 11 + q() * 9, ['#a3a070', '#7b7a50', '#565634']);
        } else if (kind === 'pomegranate') {              // רימון: שיח גבוה, ופירות אדומים
          trunk('#5a4532', 5, 0); for (let i = 0; i < 13; i++) blob(34 + q() * 60, 52 + q() * 52, 12 + q() * 9, ['#86a04e', '#5c7a36', '#3c5424']);
          for (let i = 0; i < 9; i++) { g.fillStyle = '#b23a2c'; g.beginPath(); g.arc(34 + q() * 60, 58 + q() * 46, 3.4, 0, 6.3); g.fill(); }
        } else if (kind === 'fig') {                      // תאנה: נוף רחב ונמוך, עלים גדולים ובהירים
          trunk('#8a8274', 8, 0); for (let i = 0; i < 13; i++) blob(18 + q() * 92, 46 + q() * 52, 16 + q() * 12, ['#9db45c', '#6f8c3e', '#48622a']);
        } else if (kind === 'carob') {                    // חרוב: נוף כהה, צפוף ורחב
          trunk('#4a3a2c', 10, 0); for (let i = 0; i < 17; i++) blob(16 + q() * 96, 36 + q() * 56, 16 + q() * 13, ['#58703a', '#3a5028', '#24361a']);
        } else if (kind === 'terebinth') {                // אלה: נוף מעוגל, ירוק עם גוון אדמדם
          trunk('#5c4636', 8, 4); for (let i = 0; i < 15; i++) blob(24 + q() * 80, 34 + q() * 60, 14 + q() * 12, i % 4 ? ['#84984e', '#5e7438', '#3f5226'] : ['#a8844e', '#86603a', '#5e4428']);
        } else {
          const olive = kind === 'olive', cols = olive ? ['#a9b08c', '#7b8862', '#566244'] : ['#7f9156', '#55693a', '#374726'];
          trunk(olive ? '#5c4a36' : '#4a3828', olive ? 9 : 8, 0);
          for (let i = 0; i < 15; i++) blob(26 + q() * 76, 34 + q() * 62, 15 + q() * 13, cols);
        }
      });
    }
    const TREE_H = { shrub: [1.1, 1.1], cypress: [7, 4.5], oak: [5, 3.4], olive: [3.6, 2.4], terebinth: [4.4, 2.6], carob: [5, 2.6], fig: [3.2, 1.6], pomegranate: [2.4, 1.2], grass: [0.5, 0.35], flowers: [0.45, 0.25] };
    const TREE_W = { cypress: 0.42, shrub: 1.5, grass: 1.3, flowers: 1.5, fig: 1.05, carob: 0.95 };
    function addTrees(root, farRoot, near) {
      const q = rngOf(4711);                              // הצמחייה קבועה: נוף, לא מקרה
      const wild = ['olive', 'olive', 'oak', 'oak', 'terebinth', 'carob', 'shrub', 'shrub', 'shrub', 'cypress', 'olive'], town = ['fig', 'pomegranate', 'olive', 'fig', 'shrub', 'carob'];
      const onFloor = (x, z, m) => { for (const f of W.floors) if (!f.deco && cx.inBox(f.box, x, z, m)) return true; return false; };
      const inSolid = (x, z, m) => { for (const s of W.solids) if (s.h > 0.4 && cx.inBox(s.box, x, z, m)) return true; return false; };
      const plant = (x, z, y, kind, into) => {
        const hh = TREE_H[kind] || TREE_H.olive, h = hh[0] + q() * hh[1];
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: treeTex(kind, Math.floor(q() * 2)), transparent: true, alphaTest: 0.3, fog: true }));
        sp.center.set(0.5, 0.04); sp.scale.set(h * (TREE_W[kind] || 0.8), h, 1); sp.position.set(x, y, z); (into || root).add(sp);
      };
      const nTree = cx.lite ? 80 : 150, nTuft = cx.lite ? 45 : 130, nRock = cx.lite ? 110 : 260;
      for (let i = 0, n = 0; i < 1200 && n < nTree; i++) {     // עצים: בין הבתים — תאנה ורימון; על המדרונות — זית, אלון, אלה, חרוב
        const x = near[0] + q() * (near[2] - near[0]), z = near[1] + q() * (near[3] - near[1]);
        if (onFloor(x, z, 3.5) || inSolid(x, z, 3)) continue;
        const list = inSolid(x, z, 14) ? town : wild; plant(x, z, cx.terrainY(x, z) - 0.15, list[Math.floor(q() * list.length)]); n++;
      }
      for (let i = 0, n = 0; i < 2600 && n < nTuft; i++) {     // עשב ופרחי בר: בשולי הדרכים והחצרות, שם רואים אותם מקרוב
        const f = W.floors[Math.floor(q() * W.floors.length)]; if (f.deco || !cx.inPer(f)) continue;
        const b = f.box, x = b[0] - 5 + q() * (b[2] - b[0] + 10), z = b[1] - 5 + q() * (b[3] - b[1] + 10);
        if (onFloor(x, z, 0.5) || inSolid(x, z, 0.4)) continue;
        plant(x, z, cx.terrainY(x, z) - 0.03, q() < 0.72 ? 'grass' : 'flowers'); n++;
      }
      // אבנים וסלעים על פני השטח: כולם במודל אחד
      const rg = new THREE.DodecahedronGeometry(1, 0), rocks = new THREE.InstancedMesh(rg, new THREE.MeshLambertMaterial({ color: 0xb3a88e }), nRock), m4 = new THREE.Matrix4(), qt = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3(), eu = new THREE.Euler();
      let nr = 0;
      for (let i = 0; i < nRock * 6 && nr < nRock; i++) {
        const x = near[0] + q() * (near[2] - near[0]), z = near[1] + q() * (near[3] - near[1]);
        if (onFloor(x, z, 0.8) || inSolid(x, z, 0.6)) continue;
        const k = 0.18 + q() * q() * 0.9; eu.set(q() * 3, q() * 3, q() * 3); qt.setFromEuler(eu); sc.set(k * (0.8 + q() * 0.7), k * 0.55, k * (0.8 + q() * 0.6)); ps.set(x, cx.terrainY(x, z) + k * 0.12, z);
        m4.compose(ps, qt, sc); rocks.setMatrixAt(nr++, m4);
      }
      rocks.count = nr; rocks.receiveShadow = !!cx.shadows; root.add(rocks);
      if (!FAR) return;
      for (let gI = 0; gI < (cx.lite ? 18 : 34); gI++) {     // סביב: חורשות קטנות על ההר
        const ang = q() * 6.3, rad = 120 + q() * 720, gx = 50 + Math.cos(ang) * rad, gz = 160 + Math.sin(ang) * rad * 1.3, kind = wild[Math.floor(q() * wild.length)], cnt = 3 + Math.floor(q() * 6);
        for (let k = 0; k < cnt; k++) {
          const x = gx + (q() - 0.5) * 46, z = gz + (q() - 0.5) * 46;
          if (x > near[0] && x < near[2] && z > near[1] && z < near[3]) continue;
          plant(x, z, farY(x, z) - 1.3, q() < 0.75 ? kind : 'shrub', farRoot);
        }
      }
    }

    return {
      farY,
      // זירה חדשה: seed קובע מי נמצא ומה קורה; אותו seed נשמר כשמחליפים תקופה בתוך אותה כניסה
      build(root, farRoot, seed, pos, near) {
        R = rngOf(seed); actors = []; still = []; beasts = []; birds = []; clouds = []; time = 0;
        floorsNow = W.floors.filter(f => !f.deco && cx.inPer(f) && (f.box[2] - f.box[0]) * (f.box[3] - f.box[1]) > 3);
        addFar(farRoot, near); addTrees(root, farRoot, near); addSky(farRoot); addSun(farRoot);
        addPeople(root); addBeasts(root); addDoves(root); addBirds(root, pos); addClouds(farRoot); mood();
      },
      cull(dist) { cullAt = dist; },
      show(on) { shown = on; for (const a of actors) a.sp.visible = on; for (const s of still) s.sp.visible = on; for (const b of beasts) b.sp.visible = on; for (const d of doves) d.sp.visible = on; },
      step(dt, cam, pos, yaw) { time += dt; budget = 3; budget = cx.lite ? 2 : 4; stepPeople(dt, cam, pos); stepBeasts(dt, cam, yaw, pos); stepDoves(dt, pos); stepSky(dt, pos); },
      sample: box => ({ walkers: (box ? actors.filter(a => a.x >= box[0] && a.x <= box[2] && a.z >= box[1] && a.z <= box[3]) : actors).slice(0, 10).map(a => [a.kind, +a.x.toFixed(2), +a.y.toFixed(2), +a.z.toFixed(2), a.key, a.tx != null ? 1 : 0, +a.slope.toFixed(2)]), beasts: beasts.slice(0, 8).map(b => [b.kind, +b.x.toFixed(2), +b.z.toFixed(2), b.key]), doves: doves.map(d => [+d.x.toFixed(1), +(d.h || 0).toFixed(1), +d.z.toFixed(1), d.fly > 0 ? 1 : 0]), still: still.filter(q => q.pose !== 'stand' || q.talk).slice(0, 8).map(q => [q.kind, q.pose, q.talk, q.cur]) }),
      counts: () => ({ walkers: actors.length, standing: still.length, seated: still.filter(q => q.pose !== 'stand').length, talking: still.filter(q => q.talk).length, doves: doves.length, resting: beasts.filter(q => q.mode === 'r').length, animals: beasts.length, birds: birds.length, clouds: clouds.length, moving: actors.filter(a => a.tx != null).length })
    };
  };
})();
