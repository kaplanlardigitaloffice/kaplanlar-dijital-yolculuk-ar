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
  const aiFocusBadge = $('#aiFocusBadge');
  const journeyBtn = $('#journeyBtn');
  const passwordPanel = $('#passwordPanel');
  const closePassword = $('#closePassword');
  const passwordForm = $('#passwordForm');
  const passwordInput = $('#passwordInput');
  const passwordError = $('#passwordError');
  const videoStage = $('#videoStage');
  const journeyVideo = $('#journeyVideo');
  const closeVideo = $('#closeVideo');
  const errorBox = $('#errorBox');

  const walkFrames = [
    'assets/mascot_v7_walk_1.png',
    'assets/mascot_v7_walk_2.png',
    'assets/mascot_v7_walk_3.png',
    'assets/mascot_v7_walk_4.png'
  ];
  const focusLeftFrame = 'assets/mascot_v7_point_left.png';
  const focusRightFrame = 'assets/mascot_v7_point_right.png';
  const turnFrontFrame = 'assets/mascot_v7_turn_front.png';
  const idleFrame = 'assets/mascot_v7_idle.png';
  const waveFrame = 'assets/mascot_v7_wave.png';
  const aiCoreFrame = 'assets/mascot_v8_ai_core.png';
  const ACCESS_CODE = 'KAPLAN2026';

  let stream = null;
  let facingMode = 'environment';
  let placed = false;
  let frameIndex = 0;
  let walkTimer = null;
  let motionTimer = null;
  let motionLoopTimer = null;
  let activeSequence = null;
  let scale = 1;
  let drag = null;
  let pinchDistance = null;

  const chipMap = {
    process: '.chip-process',
    tech: '.chip-tech',
    team: '.chip-team',
    growth: '.chip-growth'
  };

  function preload() {
    [...walkFrames, focusLeftFrame, focusRightFrame, turnFrontFrame, idleFrame, waveFrame, aiCoreFrame].forEach(src => {
      const img = new Image();
      img.src = src;
    });
  }
  preload();

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
      errorBox.innerHTML = `<b>Kamera açılamadı.</b><br><br>Tarayıcı kamera iznini kontrol edin. WebAR için sayfanın <b>HTTPS</b> üzerinden açılması gerekir. iPhone'da Safari, Android'de Chrome önerilir.`;
      errorBox.classList.remove('is-hidden');
    }
  }

  function stopCamera() {
    if (stream) stream.getTracks().forEach(t => t.stop());
    stream = null;
  }

  function clearMotionTimers() {
    clearInterval(walkTimer);
    clearInterval(motionTimer);
    clearTimeout(motionLoopTimer);
    walkTimer = null;
    motionTimer = null;
    motionLoopTimer = null;
  }

  function clearChipFocus() {
    $$('.data-chip').forEach(chip => chip.classList.remove('is-active'));
  }

  function setAnchorPosition(x, y) {
    anchor.style.left = `${x}px`;
    anchor.style.top = `${y}px`;
  }

  function resetStateClasses() {
    anchor.classList.remove(
      'entering', 'walking', 'waving', 'idle', 'focus-left', 'focus-right', 'scan-mode', 'hero', 'portal-active', 'ai-core-mode'
    );
  }

  function hideAiBadge() {
    aiFocusBadge.classList.add('is-hidden');
    aiFocusBadge.setAttribute('aria-hidden', 'true');
  }

  function showAiBadge() {
    aiFocusBadge.classList.remove('is-hidden');
    aiFocusBadge.setAttribute('aria-hidden', 'false');
  }

  function scheduleNext(callback, delay) {
    motionLoopTimer = setTimeout(callback, delay);
  }

  function setMotionState(state, chipKey = null) {
    clearInterval(motionTimer);
    clearTimeout(motionLoopTimer);
    resetStateClasses();
    clearChipFocus();
    hideAiBadge();

    if (state === 'wave') {
      anchor.classList.add('waving');
      let toggle = false;
      mascot.src = waveFrame;
      motionTimer = setInterval(() => {
        toggle = !toggle;
        mascot.src = toggle ? waveFrame : turnFrontFrame;
      }, 460);
      scheduleNext(() => setMotionState('idle'), 2600);
      return;
    }

    if (state === 'idle') {
      anchor.classList.add('idle');
      let toggle = false;
      mascot.src = idleFrame;
      motionTimer = setInterval(() => {
        toggle = !toggle;
        mascot.src = toggle ? idleFrame : turnFrontFrame;
      }, 1150);
      scheduleNext(() => runSequence(), 1800);
      return;
    }

    if (state === 'focus' && chipKey) {
      const chip = $(chipMap[chipKey]);
      const side = chip?.dataset.focus || 'left';
      if (chip) chip.classList.add('is-active');
      anchor.classList.add(side === 'right' ? 'focus-right' : 'focus-left');
      mascot.src = side === 'right' ? focusRightFrame : focusLeftFrame;
      motionTimer = setInterval(() => {
        mascot.classList.toggle('micro-shift');
      }, 760);
      scheduleNext(() => runSequence(), 1900);
      return;
    }

    if (state === 'ai-core') {
      anchor.classList.add('ai-core-mode');
      const techChip = $(chipMap.tech);
      if (techChip) techChip.classList.add('is-active');
      showAiBadge();
      let toggle = false;
      mascot.src = aiCoreFrame;
      motionTimer = setInterval(() => {
        toggle = !toggle;
        mascot.classList.toggle('micro-shift', toggle);
      }, 820);
      scheduleNext(() => runSequence(), 2400);
      return;
    }

    if (state === 'scan') {
      anchor.classList.add('scan-mode');
      mascot.src = turnFrontFrame;
      motionTimer = setInterval(() => {
        mascot.src = mascot.src.includes('mascot_5') ? idleFrame : turnFrontFrame;
      }, 760);
      scheduleNext(() => runSequence(), 2200);
      return;
    }

    if (state === 'hero') {
      anchor.classList.add('hero');
      let toggle = false;
      mascot.src = waveFrame;
      motionTimer = setInterval(() => {
        toggle = !toggle;
        mascot.src = toggle ? waveFrame : idleFrame;
      }, 960);
      scheduleNext(() => {
        activeSequence = 0;
        setMotionState('idle');
      }, 3000);
    }
  }

  const sequence = [
    ['focus', 'process'],
    ['focus', 'tech'],
    ['ai-core'],
    ['focus', 'team'],
    ['focus', 'growth'],
    ['scan'],
    ['hero']
  ];

  function runSequence() {
    const step = sequence[activeSequence % sequence.length];
    activeSequence += 1;
    setMotionState(step[0], step[1]);
  }

  function animateEntrance() {
    clearMotionTimers();
    activeSequence = 0;
    frameIndex = 0;
    let steps = 0;
    mascot.src = walkFrames[0];
    mascot.classList.remove('micro-shift');
    hideAiBadge();
    anchor.classList.add('portal-active', 'entering', 'walking');
    walkTimer = setInterval(() => {
      frameIndex = (frameIndex + 1) % walkFrames.length;
      mascot.src = walkFrames[frameIndex];
      steps += 1;
      if (steps >= 24) {
        clearInterval(walkTimer);
        walkTimer = null;
        mascot.src = turnFrontFrame;
        setTimeout(() => {
          anchor.classList.remove('walking', 'entering');
          setMotionState('wave');
          journeyBtn.classList.remove('is-hidden');
        }, 180);
      }
    }, 145);
  }

  function placeMascot(x, y) {
    if (placed) return;
    placed = true;
    guide.classList.add('is-hidden');
    setAnchorPosition(x, y);
    anchor.classList.remove('is-hidden');
    scale = 0.82;
    anchor.style.setProperty('--scale', scale);
    animateEntrance();
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
    if (e.target.closest('button') || e.target.closest('.password-panel') || e.target.closest('.video-stage')) return;
    if (!placed) placeMascot(e.clientX, e.clientY - 35);
  });

  function resetScene() {
    placed = false;
    clearMotionTimers();
    resetStateClasses();
    clearChipFocus();
    hideAiBadge();
    mascot.src = walkFrames[0];
    mascot.classList.remove('micro-shift');
    hideAiBadge();
    anchor.classList.add('is-hidden');
    guide.classList.remove('is-hidden');
    journeyBtn.classList.add('is-hidden');
    passwordPanel.classList.add('is-hidden');
    videoStage.classList.add('is-hidden');
    journeyVideo.pause();
    journeyVideo.currentTime = 0;
    passwordInput.value = '';
    passwordError.textContent = '';
    scale = 1;
    activeSequence = 0;
    anchor.style.setProperty('--scale', scale);
    anchor.style.left = '50%';
    anchor.style.top = '54%';
  }

  journeyBtn.addEventListener('click', e => {
    e.stopPropagation();
    passwordPanel.classList.remove('is-hidden');
    setTimeout(() => passwordInput.focus(), 50);
  });

  closePassword.addEventListener('click', () => {
    passwordPanel.classList.add('is-hidden');
    passwordError.textContent = '';
    passwordInput.value = '';
  });

  passwordForm.addEventListener('submit', async e => {
    e.preventDefault();
    const code = passwordInput.value.trim().toUpperCase();
    if (code !== ACCESS_CODE) {
      passwordError.textContent = 'Şifre hatalı. Lütfen tekrar deneyin.';
      passwordInput.select();
      return;
    }
    passwordError.textContent = '';
    passwordPanel.classList.add('is-hidden');
    videoStage.classList.remove('is-hidden');
    try { await journeyVideo.play(); } catch (_) {}
  });

  closeVideo.addEventListener('click', () => {
    journeyVideo.pause();
    videoStage.classList.add('is-hidden');
    passwordInput.value = '';
  });

  anchor.addEventListener('pointerdown', e => {
    if (e.pointerType === 'touch' && e.isPrimary === false) return;
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
      scale = Math.min(1.75, Math.max(.5, scale * (d / pinchDistance)));
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
