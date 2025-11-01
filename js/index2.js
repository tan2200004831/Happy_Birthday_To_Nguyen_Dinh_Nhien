// throttle: số phần tử pháo hoa đang hoạt động (giúp tránh lag)
let _fwActiveCount = 0;
const FW_ACTIVE_LIMIT = 200; // tổng hạt đang sống tối đa; hạ nếu vẫn lag

/* ================== Setup ================== */
const cake = document.getElementById("cake");
const candlesEl = document.getElementById("candles");
const confettiArea = document.getElementById("confettiArea");

// respect reduced motion
const reduced =
  window.matchMedia &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ===== create candles with slight random tilt ===== */
(function createCandles() {
  const CANDLES = 6; // số nến
  for (let i = 0; i < CANDLES; i++) {
    const c = document.createElement("div");
    c.className = "candle";
    c.style.transform = `rotate(${(Math.random() - 0.5) * 8}deg)`;
    c.innerHTML = `<div class="stick" aria-hidden="true"></div>
                       <div class="flame" aria-hidden="true"></div>`;
    candlesEl.appendChild(c);
  }
  if (reduced) {
    // nếu người dùng giảm motion, tắt animation của flame
    document
      .querySelectorAll(".flame")
      .forEach((f) => (f.style.animation = "none"));
  }
})();

/* ================== Confetti (DOM physics) ================== */
function spawnConfetti(px, py, count = 36) {
  // px,py are coordinates relative to cake element (client coords will be computed by caller)
  for (let i = 0; i < count; i++) {
    const piece = document.createElement("div");
    piece.className = "confetti-mini";
    const w = 6 + Math.random() * 10;
    const h = 4 + Math.random() * 6;
    piece.style.width = w + "px";
    piece.style.height = h + "px";
    const hue = Math.floor(Math.random() * 360);
    piece.style.background = `hsl(${hue} 90% 60%)`;
    piece.style.left = px + "px";
    piece.style.top = py + "px";
    piece.style.transform = `translate(-50%,-50%) rotate(${
      Math.random() * 360
    }deg)`;
    piece.style.borderRadius = Math.random() * 40 + "%";
    piece.style.zIndex = 200;
    document.body.appendChild(piece);

    // physics
    const vx = (Math.random() - 0.5) * 8;
    let vy = -(Math.random() * 8 + 2);
    const vr = (Math.random() - 0.5) * 720;
    let life = 90 + Math.random() * 60;

    (function animate() {
      if (!piece.parentElement) return;
      vy += 0.28; // gravity
      const curLeft = parseFloat(piece.style.left);
      const curTop = parseFloat(piece.style.top);
      piece.style.left = curLeft + vx + "px";
      piece.style.top = curTop + vy + "px";
      piece.style.transform = `translate(-50%,-50%) rotate(${
        vr * (1 - life / 200)
      }deg)`;
      piece.style.opacity = Math.max(0, life / 120);
      life -= 2;
      if (life > 0 && parseFloat(piece.style.top) < window.innerHeight + 200) {
        requestAnimationFrame(animate);
      } else {
        piece.remove();
      }
    })();
  }
}

/* ================== Fireworks + Sound ================== */
let audioCtx = null;
let soundEnabled = true;

function ensureAudio() {
  if (audioCtx) return audioCtx;
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  } catch (e) {
    audioCtx = null;
  }
  return audioCtx;
}

function playBirthdaySfx(ctx, offset = 0) {
  if (!ctx || !soundEnabled) return;
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  const now = ctx.currentTime + offset;
  const notes = [880, 1108.73, 1396.91];
  let t = 0;
  for (let i = 0; i < notes.length; i++) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(
      notes[i] * (0.985 + Math.random() * 0.03),
      now + t
    );
    g.gain.setValueAtTime(0.0001, now + t);
    g.gain.exponentialRampToValueAtTime(0.12, now + t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now + t + 0.28);
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 160;
    osc.connect(hp).connect(g).connect(ctx.destination);
    osc.start(now + t);
    osc.stop(now + t + 0.32);
    t += 0.07;
  }
  const popCount = 1 + Math.floor(Math.random() * 2);
  for (let p = 0; p < popCount; p++) {
    const len = Math.floor(ctx.sampleRate * 0.06);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buffer.getChannelData(0);
    for (let i = 0; i < len; i++)
      d[i] = (Math.random() * 2 - 1) * (1 - i / len) * 0.6;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 700 + Math.random() * 1200;
    bp.Q.value = 0.8;
    const gg = ctx.createGain();
    gg.gain.setValueAtTime(0.0001, now + offset + p * 0.02);
    gg.gain.exponentialRampToValueAtTime(0.6, now + offset + p * 0.005 + 0.01);
    gg.gain.exponentialRampToValueAtTime(
      0.0001,
      now + offset + p * 0.005 + 0.09
    );
    src.connect(bp).connect(gg).connect(ctx.destination);
    src.start(now + offset + p * 0.005);
    src.stop(now + offset + p * 0.005 + 0.09);
  }
}

function spawnBirthdayExplosion(cx, cy, opts = {}) {
  // nếu người dùng bật prefers-reduced-motion thì thôi
  if (reduced) return;

  // nếu đã có quá nhiều particle đang hoạt động -> skip this burst
  if (_fwActiveCount >= FW_ACTIVE_LIMIT) return;

  const frag = document.createDocumentFragment();
  const baseHue = Math.floor(Math.random() * 360);

  // fewer main particles => less DOM + GPU work
  const parts = 8 + Math.floor(Math.random() * 6); // 8-13
  for (let i = 0; i < parts; i++) {
    const p = document.createElement("div");
    p.className = "firework";
    // use hsl color so no pure-white
    const hue = (baseHue + Math.floor((Math.random() - 0.5) * 50) + 360) % 360;
    p.style.background = `hsl(${hue} 92% ${52 + Math.random() * 6}%)`;
    p.style.color = `hsl(${hue} 94% ${60 + Math.random() * 6}%)`;
    p.style.left = cx + "px";
    p.style.top = cy + "px";

    // reduced travel and variance
    const angle = (i / parts) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
    const distance = (0.45 + Math.random() * 0.4) * (40 + Math.random() * 60);
    p.style.setProperty("--x", Math.cos(angle) * distance + "px");
    p.style.setProperty("--y", Math.sin(angle) * distance + "px");

    // small, bounded delay
    p.style.animationDelay = Math.random() * 70 + "ms";

    frag.appendChild(p);
    _fwActiveCount++;
    // cleanup
    setTimeout(() => {
      if (p.parentElement) p.remove();
      _fwActiveCount = Math.max(0, _fwActiveCount - 1);
    }, 1400);
  }

  // sparks: gentler and fewer
  const sparks = 6 + Math.floor(Math.random() * 6); // 6-11
  for (let i = 0; i < sparks; i++) {
    const s = document.createElement("div");
    s.className = "firework spark";
    const hue = (baseHue + Math.floor(Math.random() * 80) - 40 + 360) % 360;
    s.style.background = `hsl(${hue} 92% ${56 + Math.random() * 6}%)`;
    s.style.left = cx + "px";
    s.style.top = cy + "px";
    const a = Math.random() * Math.PI * 2;
    const d = 10 + Math.random() * 48;
    s.style.setProperty("--x", Math.cos(a) * d + "px");
    s.style.setProperty("--y", Math.sin(a) * d + "px");
    s.style.setProperty("--rot", Math.random() * 200 - 100 + "deg");
    s.style.animationDelay = Math.random() * 60 + "ms";

    frag.appendChild(s);
    _fwActiveCount++;
    setTimeout(() => {
      if (s.parentElement) s.remove();
      _fwActiveCount = Math.max(0, _fwActiveCount - 1);
    }, 1200);
  }

  // stars: fewer, smaller travel
  const stars = 1 + Math.floor(Math.random() * 2);
  for (let i = 0; i < stars; i++) {
    const st = document.createElement("div");
    st.className = "firework star";
    const shue = (baseHue + Math.floor(Math.random() * 40) - 20 + 360) % 360;
    st.style.background = `linear-gradient(135deg, hsl(${shue} 85% 80%), hsl(${
      (shue + 20) % 360
    } 88% 68%))`;
    st.style.left = cx + (Math.random() - 0.5) * 6 + "px";
    st.style.top = cy + (Math.random() - 0.5) * 6 + "px";
    const a = (Math.random() - 0.5) * Math.PI * 2;
    const d = 28 + Math.random() * 60;
    st.style.setProperty("--x", Math.cos(a) * d + "px");
    st.style.setProperty("--y", Math.sin(a) * d + "px");
    st.style.animationDelay = Math.random() * 90 + "ms";

    frag.appendChild(st);
    _fwActiveCount++;
    setTimeout(() => {
      if (st.parentElement) st.remove();
      _fwActiveCount = Math.max(0, _fwActiveCount - 1);
    }, 1400);
  }

  // confetti: fewer + smaller offsets
  const confettiCount = 4 + Math.floor(Math.random() * 5);
  for (let i = 0; i < confettiCount; i++) {
    const c = document.createElement("div");
    c.className = Math.random() > 0.75 ? "confetti-big" : "confetti-mini";
    const hue = Math.floor(Math.random() * 360);
    c.style.background =
      c.className === "confetti-big"
        ? `linear-gradient(90deg, hsl(${hue} 92% 58%), hsl(${
            (hue + 40) % 360
          } 92% 68%))`
        : `hsl(${hue} 92% 58%)`;
    const offsetX = (Math.random() - 0.5) * 120;
    c.style.left = cx + offsetX + "px";
    c.style.top = cy + 8 + (Math.random() - 0.5) * 40 + "px";
    c.style.transform = `translate(-50%,-50%) rotate(${
      Math.random() * 360
    }deg)`;

    frag.appendChild(c);
    _fwActiveCount++;
    setTimeout(() => {
      if (c.parentElement) c.remove();
      _fwActiveCount = Math.max(0, _fwActiveCount - 1);
    }, 1400 + Math.random() * 400);
  }

  // append all at once -> fewer reflows
  document.body.appendChild(frag);

  // play sound only if explicitly requested and audio allowed
  if (opts.withSound) {
    const ctx = ensureAudio();
    if (ctx) playBirthdaySfx(ctx, 0);
  }
}

// click ở bất cứ đâu -> spawn pháo hoa + confetti
document.addEventListener("click", (e) => {
  const x = e.clientX; // tọa độ click
  const y = e.clientY;
  spawnBirthdayExplosion(x, y, { withSound: true });
  spawnConfetti(x, y, 24);
});

/* =========================================================================
=========================================================================
=========================================================================
=========================================================================
*/

/* ================== Interaction wiring ================== */

// enable audio on first user gesture (so browsers allow play)
function enableAudioOnce() {
  ensureAudio();
  window.removeEventListener("pointerdown", enableAudioOnce);
}
window.addEventListener("pointerdown", enableAudioOnce);

// optional: toggle sound with "m"
window.addEventListener("keydown", (ev) => {
  if (ev.key.toLowerCase() === "m") {
    soundEnabled = !soundEnabled;
  }
});

// respect reduced-motion already applied in CSS for animations
// --- Auto fireworks on page load for ~2s (minimal patch) ---
window.addEventListener("load", () => {
  // respect reduced-motion
  if (
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  )
    return;

  const DURATION_MS = 2000;

  // If your code already has startBirthdayFireworks(ms), call it
  if (typeof startBirthdayFireworks === "function") {
    try {
      // don't force sound; allow startBirthdayFireworks to decide
      startBirthdayFireworks(DURATION_MS);
      return;
    } catch (e) {
      // fall through to fallback
    }
  }

  // Auto fireworks (rockets + optional direct explosions) for DURATION_MS
  const end = performance.now() + DURATION_MS;
  const tick = 110; // interval between bursts
  const timer = setInterval(() => {
    if (performance.now() > end) {
      clearInterval(timer);
      return;
    }

    // 1) rockets: 2..4 rockets per tick
    const rockets = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < rockets; i++) {
      const margin = 40;
      const x = margin + Math.random() * (window.innerWidth - margin * 2);
      launchRocket(x, { withSound: false });
    }

    // 2) optional direct explosions sprinkled between rockets for variety
    // (reduce chance so it's not too dense)
    if (Math.random() < 0.45) {
      const bursts = 1 + Math.floor(Math.random() * 2); // 1..2
      for (let b = 0; b < bursts; b++) {
        const margin = 60;
        const x = margin + Math.random() * (window.innerWidth - margin * 2);
        const y = margin + Math.random() * (window.innerHeight * 0.55);
        if (typeof spawnBirthdayExplosion === "function") {
          spawnBirthdayExplosion(x, y, { withSound: false });
        }
      }
    }
  }, tick);
});

// ---------- Rocket launcher: shoot from bottom -> apex -> explode ----------
function launchRocket(startX, opts = {}) {
  if (reduced) return; // respect prefers-reduced-motion

  // throttle: if too many fireworks active, skip launch
  if (
    typeof FW_ACTIVE_LIMIT !== "undefined" &&
    _fwActiveCount >= FW_ACTIVE_LIMIT
  )
    return;

  const rocket = document.createElement("div");
  rocket.className = "rocket";
  // start slightly off bottom
  let x = startX;
  let y = window.innerHeight + 20;
  rocket.style.left = x + "px";
  rocket.style.top = y + "px";
  document.body.appendChild(rocket);

  // physics initial values (tweak for speed/arc)
  let vy = -(6 + Math.random() * 2.5); // upward speed (negative = up)
  let vx = (Math.random() - 0.5) * 1.2; // small horizontal drift
  // apex target (how high rocket will go)
  const apex = 80 + Math.random() * (window.innerHeight * 0.42);

  // optional: produce small trail using spawnConfetti for visual sparkle
  let frameCount = 0;
  let alive = true;

  function step() {
    if (!alive) return;
    // physics integration
    vy += 0.12; // gravity (makes rocket slow down then fall)
    x += vx;
    y += vy;

    rocket.style.left = x + "px";
    rocket.style.top = y + "px";

    // produce a tiny trail (rarely to keep perf)
    if (frameCount % 3 === 0) {
      // spawn a tiny confetti/trail piece (uses your spawnConfetti which expects page coords)
      if (typeof spawnConfetti === "function") spawnConfetti(x, y + 6, 1);
    }
    frameCount++;

    // condition: when rocket reaches apex (y < apex) OR vertical velocity becomes positive (vy >= 0)
    if (y <= apex || vy >= 0) {
      // explode slightly above current pos for nicer look
      const exX = x;
      const exY = Math.max(40, y - 6);
      // remove rocket
      alive = false;
      rocket.remove();

      // small flash/confetti before explosion (optional)
      if (typeof spawnConfetti === "function") {
        spawnConfetti(exX, exY, 6);
      }

      // call your existing explosion function
      if (typeof spawnBirthdayExplosion === "function") {
        spawnBirthdayExplosion(exX, exY, { withSound: !!opts.withSound });
      } else {
        // fallback to confetti only
        for (let i = 0; i < 3; i++)
          spawnConfetti(
            exX + (Math.random() - 0.5) * 40,
            exY + (Math.random() - 0.5) * 40,
            6
          );
      }
      return;
    }

    // if rocket goes offscreen (safety)
    if (
      y > window.innerHeight + 200 ||
      x < -200 ||
      x > window.innerWidth + 200
    ) {
      alive = false;
      rocket.remove();
      return;
    }

    requestAnimationFrame(step);
  }

  requestAnimationFrame(step);
}

// Convenience: launch rockets across screen
function launchRandomRocket() {
  const margin = 40;
  const startX = margin + Math.random() * (window.innerWidth - margin * 2);
  launchRocket(startX, { withSound: false });
}

// Nghe nhạc
const bg = document.getElementById("bgm");
bg.volume = 0.4; // mức volume mong muốn

window.addEventListener("load", () => {
  // 1) cố gắng play ngay
  bg.play()
    .then(() => {
      // nếu play thành công, đảm bảo unmuted
      bg.muted = false;
      console.log("bgm: playing on load");
    })
    .catch((err) => {
      console.log("bgm: autoplay blocked or failed:", err);
      // 2) fallback: autoplay muted (nhiều browser cho phép)
      bg.muted = true;
      bg.play()
        .then(() => {
          console.log("bgm: playing muted fallback");
          // cố gắng unmute nhẹ nếu trình duyệt cho phép (không đảm bảo)
          setTimeout(() => {
            try {
              bg.muted = false;
              // nếu unmute bị chặn, sẽ không throw nhưng audio vẫn có thể im lặng
            } catch (e) {
              /* ignore */
            }
          }, 600);
        })
        .catch(() => {
          // 3) nếu vẫn bị chặn, chờ 1 tương tác người dùng rồi play
          const resume = () => {
            bg.play().catch(() => {
              /* swallow */
            });
            window.removeEventListener("pointerdown", resume);
            window.removeEventListener("keydown", resume);
            console.log("bgm: attempted play after user gesture");
          };
          window.addEventListener("pointerdown", resume, { once: true });
          window.addEventListener("keydown", resume, { once: true });
          // Bạn có thể hiển thị 1 nút play cho UX tốt hơn
        });
    });
});

// robust resume: on first user gesture -> unmute + set volume + play
(function ensureBgmPlaysAfterGesture() {
  const bg = document.getElementById("bgm");
  if (!bg) return;

  // set sensible defaults
  bg.volume = bg.volume && bg.volume > 0 ? bg.volume : 0.45;
  // if browser allowed autoplay muted earlier, try to unmute on gesture
  const resumePlay = async () => {
    try {
      // unmute explicitly and ensure volume
      bg.muted = false;
      bg.volume = Math.max(0.05, bg.volume);
      await bg.play();
      console.log("bgm: playing after user gesture (resumePlay)");
      cleanup();
    } catch (err) {
      console.warn("bgm: resumePlay failed:", err);
      // if still fails, show explicit play button for user
      showManualPlay();
    }
  };

  // one-time listeners for gestures
  window.addEventListener("pointerdown", resumePlay, {
    once: true,
    passive: true,
  });
  window.addEventListener("keydown", resumePlay, { once: true, passive: true });

  // manual play UI (if needed)
  function showManualPlay() {
    if (document.getElementById("bgPlayOverlay")) return; // already shown
    const overlay = document.createElement("div");
    overlay.id = "bgPlayOverlay";
    Object.assign(overlay.style, {
      position: "fixed",
      inset: 0,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "rgba(0,0,0,0.32)",
      zIndex: 999999,
    });
    const btn = document.createElement("button");
    btn.textContent = "Chạm để bật nhạc";
    Object.assign(btn.style, {
      padding: "12px 18px",
      fontSize: "16px",
      borderRadius: "8px",
      border: "none",
      background: "#ff6fae",
      color: "#fff",
      cursor: "pointer",
      boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
    });
    btn.addEventListener(
      "click",
      async () => {
        try {
          bg.muted = false;
          bg.volume = Math.max(0.05, bg.volume || 0.45);
          await bg.play();
          console.log("bgm: started after manual button click");
          overlay.remove();
        } catch (err) {
          console.warn("bgm: still failed after manual click:", err);
        }
      },
      { once: true }
    );
    overlay.appendChild(btn);
    document.body.appendChild(overlay);
  }

  function cleanup() {
    // remove any leftover overlay if present
    const ol = document.getElementById("bgPlayOverlay");
    if (ol) ol.remove();
  }
})();

// Thời gian của nhạc
function playBgmFor(totalMs = 2000, fadeMs = 200) {
  const bg = document.getElementById("bgm");
  if (!bg) return;

  bg.muted = false;
  bg.volume = Math.max(0.05, bg.volume || 0.4);
  bg.loop = false; // không lặp
  bg.currentTime = 0; // bắt đầu từ đầu

  if (bg._autoStopTimer) clearTimeout(bg._autoStopTimer);
  if (bg._fadeInterval) clearInterval(bg._fadeInterval);

  bg.play().catch(() => {});

  const fadeStart = Math.max(0, totalMs - fadeMs);
  bg._autoStopTimer = setTimeout(() => {
    const startVol = bg.volume;
    const steps = 24;
    let step = 0;
    const intervalMs = Math.max(10, Math.floor(fadeMs / steps));
    bg._fadeInterval = setInterval(() => {
      step++;
      const t = step / steps;
      bg.volume = Math.max(0, startVol * (1 - t));
      if (step >= steps) {
        clearInterval(bg._fadeInterval);
        bg._fadeInterval = null;
        try {
          bg.pause();
          bg.currentTime = 0; // dừng ngay và reset
        } catch (e) {}
        console.log("bgm: stopped after", totalMs / 1000, "s");
      }
    }, intervalMs);
  }, fadeStart);
}

// Animation mở hộp quà
const gift = document.getElementById("gift");

gift.addEventListener("click", () => {
  gift.classList.add("open"); // thêm class để animation chạy

  // Chuyển trang sau khi animation xong
  setTimeout(() => {
    window.location.href = "index3.html";
  }, 500);
});
