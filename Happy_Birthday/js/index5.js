/*
=============================================================================
MÃ NGUỒN CŨ (2D CANVAS) - ĐƯỢC GIỮ LẠI NGUYÊN VẸN TRONG MỘT HÀM KHÔNG CHẠY
=============================================================================
*/
function OLD_2D_CANVAS_IMPLEMENTATION() {
  /* ------------------- CONFIG & GLOBALS ------------------- */

  let starZoom = 1; // tỉ lệ zoom sao (1 = bình thường)
  const MIN_STAR_ZOOM = 0.3;
  const MAX_STAR_ZOOM = 2.5;

  const sCanvas = document.getElementById("stars");
  const sCtx = sCanvas.getContext("2d");
  let sw = (sCanvas.width = innerWidth);
  let sh = (sCanvas.height = innerHeight);

  const eCanvas = document.getElementById("earth");
  const eCtx = eCanvas.getContext("2d");

  let fov = 900;
  let cameraZ = fov;

  // starfield
  const STAR_COUNT_BASE = 900;
  let STARS3 = [];

  // earth
  let earthRadius = 0;
  let earthYaw = 0;
  let earthPitch = 0;
  let earthUserYawOffset = 0;
  let earthUserPitchOffset = 0;
  let userScale = 1;
  const MIN_SCALE = 0.6,
    MAX_SCALE = 2.2;

  // outer sky rotation
  let outerYaw = 0;
  let outerPitch = 0;
  let outerVelYaw = 0;
  let outerVelPitch = 0;
  let earthAutoYaw = 0;

  const DAMPING = 0.1;

  /* --------------- helpers --------------- */
  function rand(min, max) {
    return Math.random() * (max - min) + min;
  }
  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }
  function scaleFromStarZoom(sz) {
    const t = (sz - MIN_STAR_ZOOM) / (MAX_STAR_ZOOM - MIN_STAR_ZOOM);
    return clamp(MIN_SCALE + t * (MAX_SCALE - MIN_SCALE), MIN_SCALE, MAX_SCALE);
  }
  function starZoomFromScale(scale) {
    const t = (scale - MIN_SCALE) / (MAX_SCALE - MIN_SCALE);
    return clamp(
      MIN_STAR_ZOOM + t * (MAX_STAR_ZOOM - MIN_STAR_ZOOM),
      MIN_STAR_ZOOM,
      MAX_STAR_ZOOM
    );
  }
  function roundedRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  /* ---------------------- INTRO + ICONS ---------------------- */
  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }
  function easeInOutSine(t) {
    return 0.5 * (1 - Math.cos(Math.PI * t));
  }
  const INTRO_PHASES = { START_TO_MID: 900, HOLD: 600, MID_TO_END: 900 };
  const INTRO_TOTAL =
    INTRO_PHASES.START_TO_MID + INTRO_PHASES.HOLD + INTRO_PHASES.MID_TO_END;

  let introActive = true;
  let introStartTs = performance.now();
  let introCompleted = false;
  const introOrig = {
    outerPitch: outerPitch,
    outerYaw: outerYaw,
    userScale: userScale,
    earthUserYawOffset: earthUserYawOffset,
    earthUserPitchOffset: earthUserPitchOffset,
  };

  const ICONS = [];
  const ICON_COUNT = 80; // thay nếu muốn
  const AVATAR_SRC = "../Happy_Birthday/images/cake.png"; // đổi đường dẫn ảnh ở đây
  let avatarImg = null;
  let iconsReady = false;

  function initIcons() {
    avatarImg = new Image();
    avatarImg.onload = () => {
      iconsReady = true;
    };
    avatarImg.onerror = () => {
      iconsReady = true;
    };
    avatarImg.src = AVATAR_SRC;

    ICONS.length = 0;

    // Dense ring around equator (main visual)
    const ringCount = Math.round(ICON_COUNT * 0.75);
    for (let i = 0; i < ringCount; i++) {
      const baseLon = (i / ringCount) * Math.PI * 2 + rand(-0.04, 0.04);
      const baseLat = rand(-0.06, 0.06);
      ICONS.push({
        baseLon,
        baseLat,
        baseSize: rand(8, 22),
        wobbleAmp: rand(0.002, 0.01),
        wobbleSpeed: rand(0.0006, 0.002),
        phase: rand(0, Math.PI * 2),
        altitude: rand(1.08, 1.26), // for ring close outside sphere (these will be moved to star layer)
        orbitSpeed: rand(0.0006, 0.0018),
        type: "ring",
      });
    }

    // scattered icons for depth
    const scatterCount = Math.max(4, ICON_COUNT - ringCount);
    for (let i = 0; i < scatterCount; i++) {
      ICONS.push({
        baseLon: rand(0, Math.PI * 2),
        baseLat: rand(-0.6, 0.6),
        baseSize: rand(12, 36),
        wobbleAmp: rand(0.01, 0.04),
        wobbleSpeed: rand(0.0008, 0.0024),
        phase: rand(0, Math.PI * 2),
        altitude: rand(1.6, 3.0),
        orbitSpeed: rand(0.0003, 0.0011),
        type: "scatter",
      });
    }
  }

  function initIntro() {
    introActive = true;
    introStartTs = performance.now();
    introCompleted = false;

    introOrig.outerPitch = outerPitch;
    introOrig.outerYaw = outerYaw;
    introOrig.userScale = userScale;
    introOrig.earthUserYawOffset = earthUserYawOffset;
    introOrig.earthUserPitchOffset = earthUserPitchOffset;

    outerPitch = -Math.PI * 0.75;
    userScale = MIN_SCALE;
    starZoom = starZoomFromScale(userScale);
  }

  /* --------------- resize/init --------------- */
  function resizeAll() {
    sw = sCanvas.width = innerWidth;
    sh = sCanvas.height = innerHeight;

    const rect = document.querySelector(".earth-wrap").getBoundingClientRect();
    const pxRatio = Math.min(window.devicePixelRatio || 1, 2);
    eCanvas.width = Math.round(rect.width * pxRatio);
    eCanvas.height = Math.round(rect.height * pxRatio);
    eCanvas.style.width = rect.width + "px";
    eCanvas.style.height = rect.height + "px";

    // scale drawing coordinates to pixel ratio for crispness (for earth canvas)
    eCtx.setTransform(pxRatio, 0, 0, pxRatio, 0, 0);

    earthRadius =
      Math.min(eCanvas.width / pxRatio, eCanvas.height / pxRatio) * 0.42;
    initStars3();

    initIcons();
    initIntro();
    applyEarthCssScale();
  }
  window.addEventListener("resize", resizeAll);
  resizeAll();

  /* --------------- init 3D stars --------------- */
  function initStars3() {
    STARS3.length = 0;
    const area = sw * sh;
    const count = Math.round(STAR_COUNT_BASE * Math.sqrt(area / (1280 * 720)));
    const sphereR = Math.max(sw, sh) * 0.7;
    for (let i = 0; i < count; i++) {
      const u = Math.random() * 2 - 1;
      const theta = Math.random() * Math.PI * 2;
      const r3 = sphereR;
      const x = Math.sqrt(1 - u * u) * Math.cos(theta) * r3;
      const y = Math.sqrt(1 - u * u) * Math.sin(theta) * r3;
      const z = u * r3;
      STARS3.push({
        x,
        y,
        z,
        baseA: rand(0.2, 1),
        phase: rand(0, Math.PI * 2),
        twSpeed: rand(0.001, 0.009),
        r: rand(0.6, 2.2),
      });
    }
  }

  /* --------------- 3D rotate & project (used for starfield) --------------- */
  function rotateY(p, ang) {
    const c = Math.cos(ang),
      s = Math.sin(ang);
    const x = p.x * c + p.z * s;
    const z = -p.x * s + p.z * c;
    return { x, y: p.y, z };
  }
  function rotateX(p, ang) {
    const c = Math.cos(ang),
      s = Math.sin(ang);
    const y = p.y * c - p.z * s;
    const z = p.y * s + p.z * c;
    return { x: p.x, y, z };
  }
  function project(p) {
    // same projection used for stars
    const fovZoomed = fov / starZoom;
    const scale = fovZoomed / (fovZoomed + p.z);
    const x2 = p.x * scale + sw / 2;
    const y2 = p.y * scale + sh / 2;
    return { x: x2, y: y2, scale };
  }

  /* --------------- Sphere point projection for earth features --------------- */
  /* lon,lat in radians -> compute rotated 3D point and return x,y,z,scale for 2D */
  function spherePointToScreen(lon, lat, radius, yaw, pitch) {
    const cosLat = Math.cos(lat);
    let x = radius * cosLat * Math.cos(lon);
    let y = radius * Math.sin(lat);
    let z = radius * cosLat * Math.sin(lon);

    // apply yaw then pitch
    let pY = rotateY({ x, y, z }, yaw);
    let p = rotateX(pY, pitch);

    // small perspective/squash effect from depth (keeps circle intact)
    const pers = 1 + clamp(p.z / (radius * 6), -0.12, 0.25);

    return { x: p.x * pers, y: p.y * pers, z: p.z, scale: pers };
  }

  /* --------------- Earth drawing functions (round earth) --------------- */
  function drawEarthFrame(now) {
    const ctx = eCtx;
    const w = eCanvas.width,
      h = eCanvas.height;

    // clear earth canvas safely
    ctx.clearRect(0, 0, w, h);

    const pxRatio = Math.min(window.devicePixelRatio || 1, 2);
    const cx = w / pxRatio / 2,
      cy = h / pxRatio / 2;

    ctx.save();
    ctx.translate(cx, cy);

    const radius = earthRadius * userScale;
    const yaw = earthYaw + earthUserYawOffset;
    const pitch = earthPitch + earthUserPitchOffset;

    // compute light direction & highlight safely
    const lightDir = {
      x: Math.cos(yaw) * Math.cos(pitch),
      y: Math.sin(pitch),
      z: Math.sin(yaw) * Math.cos(pitch),
    };

    const hlLon = Math.atan2(lightDir.z, lightDir.x);
    const hlLat = Math.asin(clamp(lightDir.y, -0.9999, 0.9999));

    let hl = spherePointToScreen(hlLon, hlLat, radius * 0.9, 0, 0);
    if (!hl || !isFinite(hl.x) || !isFinite(hl.y)) {
      hl = { x: 0, y: 0 };
    }

    const grad = ctx.createRadialGradient(
      hl.x,
      hl.y,
      Math.max(1, radius * 0.02),
      0,
      0,
      radius
    );
    grad.addColorStop(0, "#9fd6ff");
    grad.addColorStop(0.4, "#3080bf");
    grad.addColorStop(1, "#00192b");
    ctx.fillStyle = grad;

    // ocean circle
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();

    // atmosphere halo
    ctx.beginPath();
    ctx.arc(0, 0, radius * 1.02, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(0,120,255,0.4)";
    ctx.lineWidth = Math.max(2, radius * 0.03);
    ctx.stroke();

    // land & clouds
    drawContinentBlobs(ctx, radius, yaw, pitch);
    drawCloudsPseudo3D(ctx, radius, yaw, pitch, now);

    // night shadow
    ctx.globalCompositeOperation = "multiply";
    const opposite = spherePointToScreen(
      hlLon + Math.PI,
      -hlLat,
      radius * 0.92,
      0,
      0
    );
    const shGrad = ctx.createRadialGradient(
      opposite.x,
      opposite.y,
      radius * 0.02,
      opposite.x,
      opposite.y,
      radius * 1.2
    );
    shGrad.addColorStop(0, "rgba(0,0,0,0.0)");
    shGrad.addColorStop(0.6, "rgba(0,0,0,0.18)");
    shGrad.addColorStop(1, "rgba(0,0,0,0.32)");
    ctx.fillStyle = shGrad;
    ctx.beginPath();
    ctx.arc(0, 0, radius * 1.05, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";

    // NOTE: icons are intentionally NOT drawn here (they are drawn on star layer)

    ctx.restore();
  }

  /* --------------- Draw icons on star layer (outside planet) --------------- */
  // Draw icons on star layer — STATIC (no orbit/wobble, fixed in world coords)
  function drawOrbitIconsOnStars(now) {
    if (!iconsReady || ICONS.length === 0) return;

    const sphereR = Math.max(sw, sh) * 0.7;
    const drawList = [];

    for (let i = 0; i < ICONS.length; i++) {
      const ic = ICONS[i];

      // <-- NO time-based orbit/wobble here: positions are fixed by baseLon/baseLat -->
      const lon = ic.baseLon || 0;
      const lat = ic.baseLat || 0;

      // ensure big enough orbit radius so icons are outside planet/stars region
      const orbitRadius = sphereR * (ic.altitude || 2.2);

      // compute 3D world point
      const cosLat = Math.cos(lat);
      let x = orbitRadius * cosLat * Math.cos(lon);
      let y = orbitRadius * Math.sin(lat);
      let z = orbitRadius * cosLat * Math.sin(lon);

      // rotate by outerYaw/outerPitch so they move with starfield when user drags
      const p1 = rotateY({ x, y, z }, outerYaw);
      const p2 = rotateX(p1, outerPitch);

      // project to screen
      const proj = project(p2);
      if (
        !proj ||
        !isFinite(proj.x) ||
        !isFinite(proj.y) ||
        !isFinite(p2.z) ||
        !isFinite(proj.scale)
      )
        continue;

      // skip ones far behind
      if (p2.z <= -sphereR * 0.6) continue;

      const size = clamp(ic.baseSize * proj.scale, 6, 140);
      const x2 = proj.x - size / 2;
      const y2 = proj.y - size / 2;
      const alpha = clamp((proj.scale - 0.12) / 1.2, 0.12, 1.0);

      drawList.push({ x: x2, y: y2, size, alpha, depth: p2.z, ic });
    }

    // depth sort (far -> near)
    drawList.sort((a, b) => a.depth - b.depth);

    // render on sCtx
    for (const item of drawList) {
      const { x, y, size, alpha } = item;
      sCtx.globalAlpha = alpha;

      sCtx.fillStyle = "rgba(0,0,0,0.06)";
      roundedRect(
        sCtx,
        x - 3,
        y + Math.max(2, size * 0.05),
        size + 6,
        size + 6,
        Math.max(4, size * 0.12)
      );
      sCtx.fill();

      sCtx.fillStyle = "rgba(255,255,255,0.9)";
      roundedRect(
        sCtx,
        x - 3,
        y - 2,
        size + 6,
        size + 6,
        Math.max(4, size * 0.12)
      );
      sCtx.fill();

      if (avatarImg && avatarImg.complete && avatarImg.naturalWidth !== 0) {
        try {
          sCtx.drawImage(avatarImg, x, y, size, size);
        } catch (err) {
          sCtx.fillStyle = "#ddd";
          sCtx.fillRect(x, y, size, size);
        }
      } else {
        sCtx.fillStyle = "#ddd";
        sCtx.fillRect(x, y, size, size);
      }
    }

    sCtx.globalAlpha = 1.0;
  }

  /* --------------- draw continents & clouds (unchanged) --------------- */
  function drawContinentBlobs(ctx, radius, yaw, pitch) {
    ctx.save();
    ctx.fillStyle = "#1f8b4c";
    const blobs = [
      { lon: -0.6, lat: -0.1, rx: 0.45, ry: 0.28, rot: 0.5 },
      { lon: 0.4, lat: 0.0, rx: 0.26, ry: 0.18, rot: -0.3 },
      { lon: 1.6, lat: 0.35, rx: 0.07, ry: 0.04, rot: 0 },
      { lon: -2.2, lat: 0.45, rx: 0.07, ry: 0.05, rot: 0.1 },
    ];
    for (const b of blobs) {
      const lon = b.lon + yaw;
      const lat = b.lat;
      const pt = spherePointToScreen(lon, lat, radius * 0.92, 0, pitch);
      if (pt.z < -radius * 0.25) continue;
      ctx.save();
      ctx.translate(pt.x, pt.y);
      const s = pt.scale;
      ctx.rotate(b.rot + yaw * 0.1);
      ctx.beginPath();
      ctx.ellipse(
        0,
        0,
        radius * b.rx * s,
        radius * b.ry * s * 0.85,
        0,
        0,
        Math.PI * 2
      );
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  function drawCloudsPseudo3D(ctx, radius, yaw, pitch, now) {
    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,0.65)";
    const clouds = [
      { lon: -0.3 + now * 0.0002, lat: -0.35, rx: 0.5, ry: 0.14, rot: 0.3 },
      { lon: 0.9 - now * 0.00018, lat: -0.05, rx: 0.35, ry: 0.12, rot: -0.2 },
      { lon: -1.1 + now * 0.00012, lat: 0.22, rx: 0.28, ry: 0.1, rot: 0.1 },
    ];
    for (const c of clouds) {
      const pt = spherePointToScreen(
        c.lon + yaw * 1.2,
        c.lat,
        radius * 0.96,
        0,
        pitch
      );
      if (pt.z < -radius * 0.25) continue;
      ctx.save();
      ctx.translate(pt.x, pt.y);
      ctx.rotate(c.rot + yaw * 0.2);
      const s = pt.scale;
      ctx.beginPath();
      ctx.ellipse(
        0,
        0,
        radius * c.rx * s,
        radius * c.ry * s * 0.9,
        0,
        0,
        Math.PI * 2
      );
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  /* --------------- Interaction: starfield drag --------------- */
  let starsDrag = { down: false, lastX: 0, lastY: 0 };
  sCanvas.addEventListener("mousedown", (e) => {
    starsDrag.down = true;
    starsDrag.lastX = e.clientX;
    starsDrag.lastY = e.clientY;
    sCanvas.classList.add("dragging");
    e.preventDefault();
  });
  window.addEventListener("mousemove", (e) => {
    if (!starsDrag.down) return;
    const dx = e.clientX - starsDrag.lastX;
    const dy = e.clientY - starsDrag.lastY;
    outerVelYaw = dx * 0.6;
    outerVelPitch = dy * 0.5;
    outerYaw += dx * 0.008;
    outerPitch += dy * 0.006;
    outerPitch = clamp(outerPitch, -Math.PI * 0.45, Math.PI * 0.45);
    starsDrag.lastX = e.clientX;
    starsDrag.lastY = e.clientY;
  });
  window.addEventListener("mouseup", () => {
    starsDrag.down = false;
    sCanvas.classList.remove("dragging");
  });

  sCanvas.addEventListener(
    "touchstart",
    (e) => {
      if (e.touches.length === 1) {
        starsDrag.down = true;
        starsDrag.lastX = e.touches[0].clientX;
        starsDrag.lastY = e.touches[0].clientY;
      }
    },
    { passive: false }
  );
  sCanvas.addEventListener(
    "touchmove",
    (e) => {
      if (!starsDrag.down) return;
      const t = e.touches[0];
      const dx = t.clientX - starsDrag.lastX;
      const dy = t.clientY - starsDrag.lastY;
      outerVelYaw = dx * 0.6;
      outerVelPitch = dy * 0.5;
      outerYaw += dx * 0.01;
      outerPitch += dy * 0.008;
      outerPitch = clamp(outerPitch, -Math.PI * 0.45, Math.PI * 0.45);
      starsDrag.lastX = t.clientX;
      starsDrag.lastY = t.clientY;
      e.preventDefault();
    },
    { passive: false }
  );
  sCanvas.addEventListener("touchend", () => {
    starsDrag.down = false;
  });

  /* --------------- Interaction: earth drag (disabled) & pinch (kept) --------------- */
  let earthInteractionEnabled = false;

  let earthDrag = { down: false, lastX: 0, lastY: 0 };
  eCanvas.addEventListener("mousedown", (e) => {
    if (!earthInteractionEnabled) return;
    earthDrag.down = true;
    earthDrag.lastX = e.clientX;
    earthDrag.lastY = e.clientY;
    eCanvas.classList.add("dragging");
    e.preventDefault();
  });
  window.addEventListener("mousemove", (e) => {
    if (!earthInteractionEnabled || !earthDrag.down) return;
    const dx = e.clientX - earthDrag.lastX;
    const dy = e.clientY - earthDrag.lastY;
    earthUserYawOffset += dx * 0.006;
    earthUserPitchOffset += dy * 0.004;
    earthUserPitchOffset = clamp(
      earthUserPitchOffset,
      -Math.PI * 0.45,
      Math.PI * 0.45
    );
    earthDrag.lastX = e.clientX;
    earthDrag.lastY = e.clientY;
  });
  window.addEventListener("mouseup", () => {
    if (!earthInteractionEnabled) return;
    earthDrag.down = false;
    eCanvas.classList.remove("dragging");
  });

  let touchState = {
    mode: null,
    lastX: 0,
    lastY: 0,
    startDist: 0,
    startScale: 1,
  };
  eCanvas.addEventListener(
    "touchstart",
    (e) => {
      if (e.touches.length === 1) {
        if (!earthInteractionEnabled) {
          touchState.mode = null;
          return;
        }
        touchState.mode = "drag";
        touchState.lastX = e.touches[0].clientX;
        touchState.lastY = e.touches[0].clientY;
      } else if (e.touches.length === 2) {
        touchState.mode = "pinch";
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        touchState.startDist = Math.hypot(dx, dy);
        touchState.startScale = userScale;
      }
    },
    { passive: false }
  );

  eCanvas.addEventListener(
    "touchmove",
    (e) => {
      if (touchState.mode === "drag" && e.touches.length === 1) {
        if (!earthInteractionEnabled) return;
        const t = e.touches[0];
        const dx = t.clientX - touchState.lastX;
        const dy = t.clientY - touchState.lastY;
        earthUserYawOffset += dx * 0.008;
        earthUserPitchOffset += dy * 0.006;
        earthUserPitchOffset = clamp(
          earthUserPitchOffset,
          -Math.PI * 0.45,
          Math.PI * 0.45
        );
        touchState.lastX = t.clientX;
        touchState.lastY = t.clientY;
        e.preventDefault();
      } else if (touchState.mode === "pinch" && e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        const factor = dist / touchState.startDist;
        userScale = clamp(touchState.startScale * factor, MIN_SCALE, MAX_SCALE);
        starZoom = starZoomFromScale(userScale);
        applyEarthCssScale();
        e.preventDefault();
      }
    },
    { passive: false }
  );

  eCanvas.addEventListener(
    "touchend",
    (e) => {
      if (e.touches.length === 0) touchState.mode = null;
    },
    { passive: false }
  );

  /* --------------- Animation unified loop (with earth auto-rotation) --------------- */
  const EARTH_AUTO_SPEED = 0.0005; // rad / ms

  let lastTime = performance.now();
  function unifiedLoop() {
    lastTime = performance.now();
    function loop(now) {
      const dt = now - lastTime;
      lastTime = now;

      // outer inertia (affects stars / user drag)
      outerYaw += outerVelYaw * dt * 0.001;
      outerPitch += outerVelPitch * dt * 0.001;
      outerVelYaw *= Math.pow(DAMPING, dt * 0.01);
      outerVelPitch *= Math.pow(DAMPING, dt * 0.01);

      // --- INTRO handling ---
      if (introActive && !introCompleted) {
        const t = Math.min(1, (now - introStartTs) / INTRO_TOTAL);
        const a = INTRO_PHASES.START_TO_MID / INTRO_TOTAL;
        const b = (INTRO_PHASES.START_TO_MID + INTRO_PHASES.HOLD) / INTRO_TOTAL;

        if (t < a) {
          const p = easeOutCubic(t / a);
          outerPitch = (1 - p) * (-Math.PI * 0.75) + p * 0.0;
          userScale = (1 - p) * MIN_SCALE + p * 1.0;
          starZoom = starZoomFromScale(userScale);
          applyEarthCssScale();
        } else if (t < b) {
          outerPitch = 0;
          userScale = 1.0;
          starZoom = starZoomFromScale(userScale);
        } else {
          const p = easeInOutSine((t - b) / (1 - b));
          outerPitch = (1 - p) * 0.0 + p * introOrig.outerPitch;
          userScale = (1 - p) * 1.0 + p * introOrig.userScale;
          starZoom = starZoomFromScale(userScale);
          applyEarthCssScale();
          if (t >= 1.0) {
            introCompleted = true;
            introActive = false;
          }
        }
      }

      // --- earth auto-rotation ---
      earthAutoYaw += EARTH_AUTO_SPEED * dt;

      // combine rotations
      earthYaw = outerYaw + earthUserYawOffset + earthAutoYaw;
      earthPitch = clamp(
        outerPitch + earthUserPitchOffset,
        -Math.PI * 0.45,
        Math.PI * 0.45
      );

      // decay user offsets slowly
      earthUserYawOffset *= Math.pow(0.995, dt * 0.06);
      earthUserPitchOffset *= Math.pow(0.995, dt * 0.06);

      // draw stars (rotate by outerYaw)
      sCtx.clearRect(0, 0, sw, sh);
      sCtx.fillStyle = "black";
      sCtx.fillRect(0, 0, sw, sh);
      for (const s of STARS3) {
        s.phase += s.twSpeed * dt;
        const p1 = rotateY(s, outerYaw);
        const p2 = rotateX(p1, outerPitch);
        const proj = project(p2);
        const depthScale = proj.scale;
        const alpha =
          Math.max(0.03, Math.min(1, s.baseA * (0.6 + Math.sin(s.phase) * 0.4))) *
          clamp(depthScale * 1.2, 0.18, 1.2);
        sCtx.globalAlpha = alpha;
        sCtx.beginPath();
        const drawR = Math.max(0.3, s.r * depthScale * 1.6);
        sCtx.arc(proj.x, proj.y, drawR, 0, Math.PI * 2);
        sCtx.fillStyle = "white";
        sCtx.fill();
      }
      sCtx.globalAlpha = 1;

      // DRAW ICONS IN STAR LAYER (outside planet)
      drawOrbitIconsOnStars(now);

      // draw earth over star layer
      drawEarthFrame(now);

      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  }
  unifiedLoop();

  /* ------------------ Global zoom (wheel) and keyboard ------------------ */

  function applyEarthCssScale() {
    eCanvas.style.transform = `scale(${userScale})`;
    eCanvas.style.transformOrigin = "50% 50%";
  }

  function handleGlobalWheelZoom(e) {
    const tag = e.target && e.target.tagName && e.target.tagName.toLowerCase();
    if (
      tag === "input" ||
      tag === "textarea" ||
      tag === "select" ||
      e.target.isContentEditable
    ) {
      return;
    }
    const factor = 1 - e.deltaY * 0.0016;
    userScale = clamp(userScale * factor, MIN_SCALE, MAX_SCALE);
    starZoom = starZoomFromScale(userScale);
    applyEarthCssScale();
    e.preventDefault();
  }
  window.addEventListener("wheel", handleGlobalWheelZoom, { passive: false });

  window.addEventListener("keydown", (e) => {
    if (e.key === "+" || e.key === "=") {
      starZoom = clamp(starZoom * 1.1, MIN_STAR_ZOOM, MAX_STAR_ZOOM);
      userScale = scaleFromStarZoom(starZoom);
      applyEarthCssScale();
    }
    if (e.key === "-") {
      starZoom = clamp(starZoom * 0.9, MIN_STAR_ZOOM, MAX_STAR_ZOOM);
      userScale = scaleFromStarZoom(starZoom);
      applyEarthCssScale();
    }
  });

  /* ------------------ THREE material hack (kept from original) ------------------ */
  if (typeof THREE !== "undefined") {
    try {
      const earthMat = new THREE.MeshPhongMaterial({
        map: typeof texDiffuse !== "undefined" ? texDiffuse : null,
        bumpMap: typeof texBump !== "undefined" ? texBump : null,
        bumpScale: 0.03,
        specularMap: typeof texSpec !== "undefined" ? texSpec : null,
        specular: new THREE.Color(0x222222),
        emissiveMap: typeof texLights !== "undefined" ? texLights : null,
        emissive: 0xffffff,
        emissiveIntensity: 0.8,
      });
      if (typeof dir !== "undefined") {
        const sunDir = new THREE.Vector3().copy(dir.position).normalize();
        earthMat.onBeforeCompile = (shader) => {
          shader.uniforms.sunDirection = { value: sunDir };
          shader.fragmentShader = shader.fragmentShader.replace(
            "vec3 totalEmissiveRadiance = emissive;",
            `
      vec3 N = normalize(vNormal);
      float ndotl = clamp(dot(N, sunDirection), -1.0, 1.0);
      float nightFactor = 1.0 - max(0.0, ndotl);
      vec3 totalEmissiveRadiance = emissive * nightFactor;
      `
          );
          earthMat.userData.shader = shader;
        };
      }
    } catch (err) {
      console.warn("THREE earth material setup skipped:", err);
    }
  }
} // KẾT THÚC HÀM OLD_2D_CANVAS_IMPLEMENTATION

/*
=============================================================================
NEW 3D THREE.JS IMPLEMENTATION - CHẠY 3D THAY CHO CODE 2D CŨ
=============================================================================
*/

import * as THREE from "three";
import { OrbitControls } from "jsm/controls/OrbitControls.js";

// Easing functions
function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function easeOutBack(t) {
  const c1 = 1.4; // overshoot amount
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

// === DANH SÁCH ẢNH SINH NHẬT ===
const IMAGES = [
  "./Happy_Birthday/images/Qua_cute.jpg",
  "./Happy_Birthday/images/Qua_dep.jpg",
  "./Happy_Birthday/images/Qua_deppp.jpg",
  "./Happy_Birthday/images/1.jpg",
  "./Happy_Birthday/images/2.jpg",
  "./Happy_Birthday/images/3.jpg",
  "./Happy_Birthday/images/4.jpg",
  "./Happy_Birthday/images/5.jpg",
  "./Happy_Birthday/images/6.jpg",
  "./Happy_Birthday/images/7.jpg",
  "./Happy_Birthday/images/8.jpg",
  "./Happy_Birthday/images/9.jpg",
  "./Happy_Birthday/images/10.jpg",
  "./Happy_Birthday/images/11.jpg",
  "./Happy_Birthday/images/12.jpg",
  "./Happy_Birthday/images/13.jpg",
  "./Happy_Birthday/images/14.jpg",
  "./Happy_Birthday/images/15.jpg",
  "./Happy_Birthday/images/16.jpg",
  "./Happy_Birthday/images/17.jpg",
  "./Happy_Birthday/images/18.jpg",
  "./Happy_Birthday/images/19.jpg",
  "./Happy_Birthday/images/20.jpg",
  "./Happy_Birthday/images/21.jpg",
  "./Happy_Birthday/images/22.jpg",
  "./Happy_Birthday/images/23.jpg",
  "./Happy_Birthday/images/24.jpg",
  "./Happy_Birthday/images/25.jpg",
  "./Happy_Birthday/images/26.jpg",
  "./Happy_Birthday/images/27.jpg",
  "./Happy_Birthday/images/28.jpg",
  "./Happy_Birthday/images/29.jpg",
  "./Happy_Birthday/images/30.jpg",
  "./Happy_Birthday/images/31.jpg",
  "./Happy_Birthday/images/32.jpg"
];

// === HÀM VẼ THẺ BÀI ẢNH (BẢN ĐẸP 512x512 SIÊU SẮC NÉT & TỐI ƯU HÓA BỘ NHỚ) ===
const textureCache = {};

function getSharedTexture(imageSrc, index) {
  if (textureCache[imageSrc]) {
    return textureCache[imageSrc];
  }

  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.userData = { loaded: false };

  const img = new Image();
  
  // Trì hoãn tải ảnh tăng dần (staggered loading) khoảng 40ms mỗi ảnh độc bản
  // Điều này phân bổ đều CPU decode và băng thông tải lên GPU, loại bỏ hoàn toàn hiện tượng khựng/giật (jank)
  const loadDelay = (index % IMAGES.length) * 40;
  setTimeout(() => {
    img.src = imageSrc;
  }, loadDelay);

  img.onload = () => {
    ctx.clearRect(0, 0, 512, 512);
    
    // Vẽ nền thẻ bài trắng bo góc với hiệu ứng đổ bóng sắc nét (512x512)
    ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
    ctx.shadowBlur = 24;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 12;
    ctx.fillStyle = "rgba(255, 255, 255, 0.96)";
    
    const margin = 32;
    const radius = 64;
    ctx.beginPath();
    ctx.moveTo(margin + radius, margin);
    ctx.lineTo(512 - margin - radius, margin);
    ctx.quadraticCurveTo(512 - margin, margin, 512 - margin, margin + radius);
    ctx.lineTo(512 - margin, 512 - margin - radius);
    ctx.quadraticCurveTo(512 - margin, 512 - margin, 512 - margin - radius, 512 - margin);
    ctx.lineTo(margin + radius, 512 - margin);
    ctx.quadraticCurveTo(margin, 512 - margin, margin, 512 - margin - radius);
    ctx.lineTo(margin, margin + radius);
    ctx.quadraticCurveTo(margin, margin, margin + radius, margin);
    ctx.closePath();
    ctx.fill();

    // Reset shadow
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    // Tính toán tỷ lệ ảnh để vẽ "đầy đủ" (contain) không bị móp méo
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    const ratio = w / h;
    
    const pad = 48; // padding từ viền canvas vào ảnh
    const size = 512 - 2 * pad;
    
    let drawW = size;
    let drawH = size;
    let offsetX = pad;
    let offsetY = pad;
    
    if (ratio > 1) { // Ảnh ngang
      drawH = size / ratio;
      offsetY = pad + (size - drawH) / 2;
    } else { // Ảnh dọc hoặc vuông
      drawW = size * ratio;
      offsetX = pad + (size - drawW) / 2;
    }

    // Cắt góc ảnh theo hình chữ nhật đã tính toán (contain)
    ctx.save();
    const imgRadius = 24;
    ctx.beginPath();
    ctx.moveTo(offsetX + imgRadius, offsetY);
    ctx.lineTo(offsetX + drawW - imgRadius, offsetY);
    ctx.quadraticCurveTo(offsetX + drawW, offsetY, offsetX + drawW, offsetY + imgRadius);
    ctx.lineTo(offsetX + drawW, offsetY + drawH - imgRadius);
    ctx.quadraticCurveTo(offsetX + drawW, offsetY + drawH, offsetX + drawW - imgRadius, offsetY + drawH);
    ctx.lineTo(offsetX + imgRadius, offsetY + drawH);
    ctx.quadraticCurveTo(offsetX, offsetY + drawH, offsetX, offsetY + drawH - imgRadius);
    ctx.lineTo(offsetX, offsetY + imgRadius);
    ctx.quadraticCurveTo(offsetX, offsetY, offsetX + imgRadius, offsetY);
    ctx.closePath();
    ctx.clip();

    ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
    ctx.restore();
    
    texture.needsUpdate = true;
    texture.userData.loaded = true;
    if (texture.onLoadedCallbacks) {
      texture.onLoadedCallbacks.forEach(cb => cb());
      texture.onLoadedCallbacks = null;
    }
  };

  img.onerror = () => {
    console.error("Không thể tải ảnh:", imageSrc);
    // Vẫn kích hoạt loaded để thẻ bài bay ra (dưới dạng khung thẻ trắng) tránh lỗi tắc nghẽn hoạt cảnh
    texture.userData.loaded = true;
    if (texture.onLoadedCallbacks) {
      texture.onLoadedCallbacks.forEach(cb => cb());
      texture.onLoadedCallbacks = null;
    }
  };

  textureCache[imageSrc] = texture;
  return texture;
}

function createCardMaterial(imageSrc, index) {
  const texture = getSharedTexture(imageSrc, index);
  const mat = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    opacity: 0.0, // Bắt đầu ẩn hoàn toàn, khi bay mới fade-in
  });

  mat.userData = { loaded: texture.userData.loaded || false };
  if (!mat.userData.loaded) {
    if (!texture.onLoadedCallbacks) {
      texture.onLoadedCallbacks = [];
    }
    texture.onLoadedCallbacks.push(() => {
      mat.userData.loaded = true;
    });
  }

  return mat;
}

// === KHỞI TẠO CẢNH 3D NGAY LẬP TỨC ===
function init3DScene() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const scene = new THREE.Scene();
  
  // Camera bắt đầu ở cận cảnh gần Trái Đất để tạo hiệu ứng zoom-out ấn tượng
  const camera = new THREE.PerspectiveCamera(75, w / h, 0.1, 1000);
  camera.position.set(0, 0.4, 2.0);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(w, h);
  renderer.domElement.id = "three-canvas";
  document.body.appendChild(renderer.domElement);

  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.minDistance = 2.0;
  controls.maxDistance = 15.0;
  controls.enabled = false; // Khóa điều khiển trong thời gian diễn ra intro camera

  // === ÁNH SÁNG ===
  const sunLight = new THREE.DirectionalLight(0xffffff, 2.0); // Độ sáng 2.0 giống Create Earth
  sunLight.position.set(-2, 0.5, 1.5); // Vị trí giống Create Earth
  scene.add(sunLight);

  // === NHÓM TRÁI ĐẤT ===
  const earthGroup = new THREE.Group();
  earthGroup.rotation.z = (-23.4 * Math.PI) / 180;
  scene.add(earthGroup);

  const loader = new THREE.TextureLoader();

  // Sử dụng detail = 12 giống hệt Create Earth
  const detail = 12;
  const geometry = new THREE.IcosahedronGeometry(1.0, detail);

  // 1. Trái Đất (MeshPhongMaterial giống hệt Create Earth)
  const earthMat = new THREE.MeshPhongMaterial({
    map: loader.load("./Happy_Birthday/textures/00_earthmap1k.jpg"),
    specularMap: loader.load("./Happy_Birthday/textures/02_earthspec1k.jpg"),
    bumpMap: loader.load("./Happy_Birthday/textures/01_earthbump1k.jpg"),
    bumpScale: 0.04, // Giữ 0.04 giống hệt Create Earth
  });
  const earthMesh = new THREE.Mesh(geometry, earthMat);
  earthGroup.add(earthMesh);

  // 2. Ánh đèn thành phố đêm (MeshBasicMaterial & AdditiveBlending giống hệt Create Earth)
  const lightsMat = new THREE.MeshBasicMaterial({
    map: loader.load("./Happy_Birthday/textures/03_earthlights1k.jpg"),
    blending: THREE.AdditiveBlending,
  });
  const lightsMesh = new THREE.Mesh(geometry, lightsMat);
  earthGroup.add(lightsMesh);

  // 3. Mây tự quay (MeshStandardMaterial giống hệt Create Earth)
  const cloudsMat = new THREE.MeshStandardMaterial({
    map: loader.load("./Happy_Birthday/textures/04_earthcloudmap.jpg"),
    transparent: true,
    opacity: 0.8, // Độ mờ 0.8 giống hệt Create Earth
    blending: THREE.AdditiveBlending,
    alphaMap: loader.load("./Happy_Birthday/textures/05_earthcloudmaptrans.jpg"),
  });
  const cloudsMesh = new THREE.Mesh(geometry, cloudsMat);
  cloudsMesh.scale.setScalar(1.003); // Tỉ lệ 1.003 giống hệt Create Earth
  earthGroup.add(cloudsMesh);

  // 4. Hào quang khí quyển Fresnel Glow (giống hệt Create Earth)
  function getFresnelMat({ rimHex = 0x0088ff, facingHex = 0x000000 } = {}) {
    const uniforms = {
      color1: { value: new THREE.Color(rimHex) },
      color2: { value: new THREE.Color(facingHex) },
      fresnelBias: { value: 0.1 },
      fresnelScale: { value: 1.0 },
      fresnelPower: { value: 4.0 },
    };
    const vs = `
    uniform float fresnelBias;
    uniform float fresnelScale;
    uniform float fresnelPower;
    varying float vReflectionFactor;
    void main() {
      vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
      vec4 worldPosition = modelMatrix * vec4( position, 1.0 );
      vec3 worldNormal = normalize( mat3( modelMatrix[0].xyz, modelMatrix[1].xyz, modelMatrix[2].xyz ) * normal );
      vec3 I = worldPosition.xyz - cameraPosition;
      vReflectionFactor = fresnelBias + fresnelScale * pow( 1.0 + dot( normalize( I ), worldNormal ), fresnelPower );
      gl_Position = projectionMatrix * mvPosition;
    }
    `;
    const fs = `
    uniform vec3 color1;
    uniform vec3 color2;
    varying float vReflectionFactor;
    void main() {
      float f = clamp( vReflectionFactor, 0.0, 1.0 );
      gl_FragColor = vec4(mix(color2, color1, vec3(f)), f);
    }
    `;
    return new THREE.ShaderMaterial({
      uniforms: uniforms,
      vertexShader: vs,
      fragmentShader: fs,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false, // Thêm depthWrite: false để tránh che khuất các ảnh lơ lửng
    });
  }
  const fresnelMat = getFresnelMat(); // Sử dụng mặc định giống hệt Create Earth
  const glowMesh = new THREE.Mesh(geometry, fresnelMat);
  glowMesh.scale.setScalar(1.01); // Tỉ lệ 1.01 giống hệt Create Earth
  earthGroup.add(glowMesh);

  // === BẦU TRỜI SAO ===
  function getStarfield({ numStars = 500 } = {}) {
    function randomSpherePoint() {
      const radius = Math.random() * 25 + 25;
      const u = Math.random();
      const v = Math.random();
      const theta = 2 * Math.PI * u;
      const phi = Math.acos(2 * v - 1);
      let x = radius * Math.sin(phi) * Math.cos(theta);
      let y = radius * Math.sin(phi) * Math.sin(theta);
      let z = radius * Math.cos(phi);
      return {
        pos: new THREE.Vector3(x, y, z),
        hue: 0.6,
        minDist: radius,
      };
    }
    const verts = [];
    const colors = [];
    for (let i = 0; i < numStars; i += 1) {
      let p = randomSpherePoint();
      const { pos, hue } = p;
      const col = new THREE.Color().setHSL(hue + (Math.random() - 0.5) * 0.1, 0.3, Math.random() * 0.4 + 0.6);
      verts.push(pos.x, pos.y, pos.z);
      colors.push(col.r, col.g, col.b);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.35,
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      map: loader.load("./Happy_Birthday/textures/stars/circle.png"),
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    return new THREE.Points(geo, mat);
  }
  const stars = getStarfield({ numStars: 2200 });
  scene.add(stars);

  const iconsGroup = new THREE.Group();
  scene.add(iconsGroup);

  // Giảm số lượng xuống 60 để các ảnh giãn cách rộng rãi, hoàn toàn không bị chồng lấn hay dính liền nhau
  const ICON_COUNT = 60;
  const ICONS_DATA = [];
  
  // 1. Phân bổ vành đai xích đạo (xích ra xa và phân bố đứng so le cao hơn)
  const ringCount = Math.round(ICON_COUNT * 0.65);
  for (let i = 0; i < ringCount; i++) {
    const lon = (i / ringCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.15;
    const lat = (Math.random() - 0.5) * 0.9; // Tăng biên độ đứng lên để ảnh so le cực cao rộng
    const altitude = 3.6 + Math.random() * 1.8; // Đẩy quỹ đạo xích ra xa hơn nữa (bán kính 3.6 - 5.4)
    const scale = 0.55 + Math.random() * 0.15; // Tăng đáng kể kích thước để ảnh TO rõ nét
    const imageSrc = IMAGES[i % IMAGES.length];
    ICONS_DATA.push({ lon, lat, altitude, scale, imageSrc });
  }
  
  // 2. Phân bổ rải rác ngoài không gian (xích ra cực xa để tạo độ sâu)
  const scatterCount = ICON_COUNT - ringCount;
  for (let i = 0; i < scatterCount; i++) {
    const lon = Math.random() * Math.PI * 2;
    const lat = (Math.random() - 0.5) * 1.8;
    const altitude = 5.5 + Math.random() * 4.0; // Đẩy ra cực xa ngoài không gian (bán kính 5.5 - 9.5)
    const scale = 0.75 + Math.random() * 0.20; // Thẻ ảnh ở ngoài cực xa sẽ được làm TO ĐÁNG KỂ để nhìn rõ
    const imageSrc = IMAGES[(ringCount + i) % IMAGES.length];
    ICONS_DATA.push({ lon, lat, altitude, scale, imageSrc });
  }

  const sprites = [];
  
  ICONS_DATA.forEach((data, idx) => {
    const spriteMaterial = createCardMaterial(data.imageSrc, idx);
    const sprite = new THREE.Sprite(spriteMaterial);
    
    // Mỗi bức ảnh sẽ xuất phát từ mặt trước Trái Đất hướng về phía Camera (Z dương)
    const startLon = Math.PI / 2 + (Math.random() - 0.5) * 1.5;
    const startLat = (Math.random() - 0.5) * 1.0;
    const startRadius = 1.0; // Bắt đầu ở bề mặt Trái Đất
    
    const cosStartLat = Math.cos(startLat);
    const startX = startRadius * cosStartLat * Math.cos(startLon);
    const startY = startRadius * Math.sin(startLat);
    const startZ = startRadius * cosStartLat * Math.sin(startLon);
    
    sprite.position.set(startX, startY, startZ);
    sprite.scale.set(0.0001, 0.0001, 1.0);
    
    iconsGroup.add(sprite);
    
    sprites.push({
      sprite,
      startLon,
      startLat,
      startRadius,
      targetLon: data.lon,
      targetLat: data.lat,
      targetRadius: data.altitude,
      scale: data.scale,
      delay: Math.random() * 1000,         // Độ trễ từ 0 đến 1.0s sau khi ảnh đã load xong
      duration: 1600 + Math.random() * 600, // Thời gian bay từ 1.6s đến 2.2s
      loadedTime: null                      // Sẽ được gán bằng timestamp khi ảnh tải xong
    });
  });

  // === TỰ ĐỘNG THAY ĐỔI KÍCH THƯỚC TRÌNH DUYỆT ===
  function handleResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }
  window.addEventListener("resize", handleResize);

  // === PHÓNG TO / THU NHỎ BẰNG PHÍM ===
  window.addEventListener("keydown", (e) => {
    if (e.key === "+" || e.key === "=") {
      camera.position.multiplyScalar(0.9);
    }
    if (e.key === "-") {
      camera.position.multiplyScalar(1.1);
    }
  });

  // === VÒNG LẶP HOẠT CẢNH (ANIMATION LOOP) ===
  let lastTime = performance.now();
  let introStartTime = null;
  const camIntroDuration = 2500; // Intro camera kéo dài 2.5s

  function animate(now) {
    requestAnimationFrame(animate);
    const dt = now - lastTime;
    lastTime = now;

    // Quay Trái Đất và các lớp khí quyển với vận tốc chuẩn giống Create Earth
    earthMesh.rotation.y += 0.002;
    lightsMesh.rotation.y += 0.002;
    cloudsMesh.rotation.y += 0.0023;
    glowMesh.rotation.y += 0.002;

    // Quay nền sao và nhóm ảnh
    stars.rotation.y -= 0.0002;
    iconsGroup.rotation.y += 0.0004;

    if (introStartTime === null) introStartTime = now;
    const elapsed = now - introStartTime;

    // 1. Hoạt cảnh Camera Zoom-out lúc mở trang
    if (elapsed < camIntroDuration) {
      const t = elapsed / camIntroDuration;
      const p = easeOutCubic(t);
      
      // Zoom out từ (0, 0.4, 2.0) ra (0, 0, 4.8)
      camera.position.z = 2.0 + (4.8 - 2.0) * p;
      camera.position.y = 0.4 * (1 - p);
      camera.position.x = 0;
    } else if (!controls.enabled) {
      // Khi kết thúc intro, trả lại toàn quyền điều khiển OrbitControls cho người dùng
      camera.position.set(0, 0, 4.8);
      controls.target.set(0, 0, 0);
      controls.enabled = true;
    }

    // 2. Hoạt cảnh các bức ảnh chúc mừng sinh nhật phun trào bay ra (chỉ bắt đầu khi ảnh đã tải xong)
    sprites.forEach(item => {
      // Nếu ảnh của thẻ bài này chưa tải xong, giữ ẩn ở bề mặt Trái Đất
      if (!item.sprite.material.userData.loaded) {
        const cosLat = Math.cos(item.startLat);
        item.sprite.position.set(
          item.startRadius * cosLat * Math.cos(item.startLon),
          item.startRadius * Math.sin(item.startLat),
          item.startRadius * cosLat * Math.sin(item.startLon)
        );
        item.sprite.scale.set(0.0001, 0.0001, 1.0);
        item.sprite.material.opacity = 0.0;
        item.loadedTime = null;
        return;
      }

      // Đánh dấu mốc thời gian load xong
      if (item.loadedTime === null || item.loadedTime === undefined) {
        item.loadedTime = now;
      }

      const timeSinceLoad = now - item.loadedTime;

      if (timeSinceLoad < item.delay) {
        // Giữ ảnh ẩn ở vị trí xuất phát bề mặt Trái Đất trong thời gian delay
        const cosLat = Math.cos(item.startLat);
        item.sprite.position.set(
          item.startRadius * cosLat * Math.cos(item.startLon),
          item.startRadius * Math.sin(item.startLat),
          item.startRadius * cosLat * Math.sin(item.startLon)
        );
        item.sprite.scale.set(0.0001, 0.0001, 1.0);
        item.sprite.material.opacity = 0.0;
      } else {
        let t = (timeSinceLoad - item.delay) / item.duration;
        if (t > 1) t = 1;

        // Tính toán các hệ số Easing
        const pPos = easeOutCubic(t);
        const pScale = easeOutBack(t);

        // Nội suy tọa độ cầu (Spherical Interpolation) tạo đường bay cong bao quanh bề mặt
        const r = item.startRadius + (item.targetRadius - item.startRadius) * pPos;
        const lon = item.startLon + (item.targetLon - item.startLon) * pPos;
        const lat = item.startLat + (item.targetLat - item.startLat) * pPos;

        const cosLat = Math.cos(lat);
        item.sprite.position.set(
          r * cosLat * Math.cos(lon),
          r * Math.sin(lat),
          r * cosLat * Math.sin(lon)
        );

        // Kích thước nảy nhẹ khi đến đích
        const s = item.scale * pScale;
        item.sprite.scale.set(s, s, 1.0);

        // Hiệu ứng mờ dần (fade-in) nhanh hơn quá trình bay một chút
        item.sprite.material.opacity = 0.95 * Math.min(1.0, t * 1.5);
      }
    });

    controls.update();
    renderer.render(scene, camera);
  }
  requestAnimationFrame(animate);
}

// Gọi hàm khởi tạo cảnh 3D ngay lập tức
init3DScene();
