(() => {
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));

  const intro = $('#intro');
  const arView = $('#arView');
  const video = $('#camera');
  const startBtn = $('#startBtn');
  const flipBtn = $('#flipBtn');
  const resetBtn = $('#resetBtn');
  const guide = $('#placementGuide');
  const anchor = $('#arAnchor');
  const mascot = $('#mascot');
  const mascotFrame = $('#mascotFrame');
  const aiFocusBadge = $('#aiFocusBadge');
  const errorBox = $('#errorBox');

  const frames = {
    idle: 'assets/mascot_premium_idle.png',
    ai: 'assets/mascot_premium_ai.png',
    wave: 'assets/mascot_premium_wave.png',
    spinSide: 'assets/mascot_premium_spin_side.png',
    spinBack: 'assets/mascot_premium_spin_back.png'
  };

  let stream = null;
  let facingMode = 'environment';
  let placed = false;
  let scale = 0.86;
  let drag = null;
  let pinchDistance = null;
  let sequenceTimers = [];

  function preload() {
    Object.values(frames).forEach(src => {
      const img = new Image();
      img.src = src;
    });
  }
  preload();

  function clearTimers() {
    sequenceTimers.forEach(clearTimeout);
    sequenceTimers = [];
  }

  function schedule(fn, delay) {
    const id = setTimeout(fn, delay);
    sequenceTimers.push(id);
    return id;
  }

  function resetVisualStates() {
    anchor.classList.remove('state-idle', 'state-wave', 'state-ai', 'state-spin');
    mascotFrame.classList.remove('mirror');
    mascot.classList.remove('pulse');
    $$('.data-chip').forEach(chip => chip.classList.remove('is-active'));
    aiFocusBadge.classList.add('is-hidden');
    aiFocusBadge.setAttribute('aria-hidden', 'true');
  }

  function setChip(key) {
    $$('.data-chip').forEach(chip => chip.classList.toggle('is-active', chip.dataset.key === key));
  }

  function setFrame(src, { mirror = false, pulse = false } = {}) {
    mascot.src = src;
    mascotFrame.classList.toggle('mirror', mirror);
    mascot.classList.toggle('pulse', pulse);
  }

  function setState(state) {
    clearTimers();
    resetVisualStates();
    anchor.classList.add(`state-${state}`);

    if (state === 'idle') {
      setFrame(frames.idle);
      setChip('process');
      schedule(() => setState('wave'), 1800);
      return;
    }

    if (state === 'wave') {
      setFrame(frames.wave, { pulse: true });
      setChip('team');
      schedule(() => setState('ai'), 2200);
      return;
    }

    if (state === 'ai') {
      setFrame(frames.ai, { pulse: true });
      setChip('tech');
      aiFocusBadge.classList.remove('is-hidden');
      aiFocusBadge.setAttribute('aria-hidden', 'false');
      schedule(() => runSpinSequence(), 2500);
      return;
    }

  }

  function runSpinSequence() {
    clearTimers();
    resetVisualStates();
    anchor.classList.add('state-spin');
    setChip('process');

    const steps = [
      () => setFrame(frames.spinSide, { mirror: false }),
      () => setFrame(frames.spinBack, { mirror: false }),
      () => setFrame(frames.spinSide, { mirror: true }),
      () => setFrame(frames.idle, { mirror: false })
    ];
    const delays = [0, 520, 1040, 1560];
    steps.forEach((fn, i) => schedule(fn, delays[i]));
    schedule(() => setState('wave'), 2500);
  }

  function startShowcase() {
    clearTimers();
    resetVisualStates();
    setFrame(frames.idle);
    schedule(() => setState('wave'), 900);
  }

  async function startCamera() {
    stopCamera();
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      });
      video.srcObject = stream;
      await video.play();
      errorBox.classList.add('is-hidden');
    } catch (err) {
      console.error(err);
      errorBox.innerHTML = '<b>Kamera açılamadı.</b><br><br>Tarayıcı kamera iznini kontrol edin. WebAR için sayfanın <b>HTTPS</b> üzerinden açılması gerekir. iPhone\'da Safari, Android\'de Chrome önerilir.';
      errorBox.classList.remove('is-hidden');
    }
  }

  function stopCamera() {
    if (stream) stream.getTracks().forEach(t => t.stop());
    stream = null;
  }

  function setAnchorPosition(x, y) {
    anchor.style.left = `${x}px`;
    anchor.style.top = `${y}px`;
  }

  function placeMascot(x, y) {
    if (placed) return;
    placed = true;
    guide.classList.add('is-hidden');
    setAnchorPosition(x, y);
    anchor.classList.remove('is-hidden');
    anchor.classList.add('is-placed');
    scale = 0.86;
    anchor.style.setProperty('--scale', scale);
    startShowcase();
  }

  function resetScene() {
    clearTimers();
    placed = false;
    resetVisualStates();
    setFrame(frames.idle);
    anchor.classList.add('is-hidden');
    anchor.classList.remove('is-placed');
    guide.classList.remove('is-hidden');
    scale = 0.86;
    anchor.style.setProperty('--scale', scale);
    anchor.style.left = '50%';
    anchor.style.top = '58%';
  }

  startBtn.addEventListener('click', async () => {
    intro.classList.add('is-hidden');
    arView.classList.remove('is-hidden');
    await startCamera();
  });

  flipBtn.addEventListener('click', async () => {
    facingMode = facingMode === 'environment' ? 'user' : 'environment';
    await startCamera();
  });

  resetBtn.addEventListener('click', resetScene);

  arView.addEventListener('click', e => {
    if (e.target.closest('button') || e.target.closest('.error-box')) return;
    if (!placed) placeMascot(e.clientX, e.clientY - 20);
  });

  anchor.addEventListener('pointerdown', e => {
    anchor.setPointerCapture?.(e.pointerId);
    const rect = anchor.getBoundingClientRect();
    drag = {
      dx: e.clientX - (rect.left + rect.width / 2),
      dy: e.clientY - (rect.top + rect.height / 2),
      id: e.pointerId
    };
  });

  anchor.addEventListener('pointermove', e => {
    if (!drag || drag.id !== e.pointerId) return;
    setAnchorPosition(e.clientX - drag.dx, e.clientY - drag.dy);
  });

  const endDrag = e => {
    if (drag && drag.id === e.pointerId) drag = null;
  };
  anchor.addEventListener('pointerup', endDrag);
  anchor.addEventListener('pointercancel', endDrag);

  function distance(t1, t2) {
    return Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
  }

  arView.addEventListener('touchstart', e => {
    if (e.touches.length === 2 && placed) pinchDistance = distance(e.touches[0], e.touches[1]);
  }, { passive: true });

  arView.addEventListener('touchmove', e => {
    if (e.touches.length === 2 && pinchDistance && placed) {
      const d = distance(e.touches[0], e.touches[1]);
      scale = Math.min(1.8, Math.max(0.5, scale * (d / pinchDistance)));
      anchor.style.setProperty('--scale', scale.toFixed(3));
      pinchDistance = d;
    }
  }, { passive: true });

  arView.addEventListener('touchend', () => {
    pinchDistance = null;
  }, { passive: true });

  window.addEventListener('beforeunload', stopCamera);
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
})();
