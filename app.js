(() => {
  const $ = s => document.querySelector(s);
  const intro = $('#intro');
  const arView = $('#arView');
  const video = $('#camera');
  const startBtn = $('#startBtn');
  const flipBtn = $('#flipBtn');
  const resetBtn = $('#resetBtn');
  const guide = $('#placementGuide');
  const anchor = $('#arAnchor');
  const mascot = $('#mascot');
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

  const walkFrames = [1,2,3,4,5,6].map(n => `assets/mascot_${n}.png`);
  const waveFrame = 'assets/mascot_7.png';
  const ACCESS_CODE = 'KAPLAN2026';
  let stream = null, facingMode = 'environment', placed = false;
  let frameIndex = 0, walkTimer = null, waveTimer = null, animationSteps = 0;
  let scale = 1, drag = null, pinchDistance = null;

  function preload() {
    [...walkFrames, waveFrame].forEach(src => { const i = new Image(); i.src = src; });
  }
  preload();

  async function startCamera() {
    stopCamera();
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: facingMode }, width: { ideal: 1920 }, height: { ideal: 1080 } }
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

  startBtn.addEventListener('click', async () => {
    intro.classList.add('is-hidden');
    arView.classList.remove('is-hidden');
    await startCamera();
  });

  flipBtn.addEventListener('click', async () => {
    facingMode = facingMode === 'environment' ? 'user' : 'environment';
    await startCamera();
  });

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
    anchor.classList.add('entering','walking');
    scale = 0.82;
    anchor.style.setProperty('--scale', scale);
    animateEntrance();
  }

  arView.addEventListener('click', e => {
    if (e.target.closest('button') || e.target.closest('.password-panel') || e.target.closest('.video-stage')) return;
    if (!placed) placeMascot(e.clientX, e.clientY - 35);
  });

  function animateEntrance() {
    clearInterval(walkTimer); clearInterval(waveTimer);
    frameIndex = 0; animationSteps = 0; mascot.src = walkFrames[0];
    walkTimer = setInterval(() => {
      frameIndex = (frameIndex + 1) % walkFrames.length;
      mascot.src = walkFrames[frameIndex];
      animationSteps++;
      if (animationSteps >= 18) {
        clearInterval(walkTimer);
        setTimeout(() => {
          anchor.classList.remove('walking','entering');
          anchor.classList.add('waving');
          startWaveLoop();
          journeyBtn.classList.remove('is-hidden');
        }, 120);
      }
    }, 145);
  }

  function startWaveLoop(){
    let toggle = false;
    mascot.src = waveFrame;
    clearInterval(waveTimer);
    waveTimer = setInterval(() => {
      toggle = !toggle;
      mascot.src = toggle ? waveFrame : walkFrames[5];
    }, 520);
  }

  function resetScene() {
    placed = false;
    clearInterval(walkTimer); clearInterval(waveTimer);
    anchor.classList.remove('entering','walking','waving');
    mascot.src = walkFrames[0];
    anchor.classList.add('is-hidden'); guide.classList.remove('is-hidden'); journeyBtn.classList.add('is-hidden');
    passwordPanel.classList.add('is-hidden'); videoStage.classList.add('is-hidden');
    journeyVideo.pause(); journeyVideo.currentTime = 0;
    passwordInput.value = ''; passwordError.textContent = '';
    scale = 1; anchor.style.setProperty('--scale', scale); anchor.style.left = '50%'; anchor.style.top = '54%';
  }
  resetBtn.addEventListener('click', resetScene);

  journeyBtn.addEventListener('click', e => {
    e.stopPropagation();
    passwordPanel.classList.remove('is-hidden');
    setTimeout(() => passwordInput.focus(), 50);
  });
  closePassword.addEventListener('click', () => {
    passwordPanel.classList.add('is-hidden'); passwordError.textContent = ''; passwordInput.value = '';
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
    drag = { dx: e.clientX - (rect.left + rect.width/2), dy: e.clientY - (rect.top + rect.height/2), id: e.pointerId };
  });
  anchor.addEventListener('pointermove', e => {
    if (!drag || drag.id !== e.pointerId) return;
    setAnchorPosition(e.clientX - drag.dx, e.clientY - drag.dy);
  });
  const endDrag = e => { if (drag && drag.id === e.pointerId) drag = null; };
  anchor.addEventListener('pointerup', endDrag); anchor.addEventListener('pointercancel', endDrag);

  function distance(t1, t2) { return Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY); }
  arView.addEventListener('touchstart', e => {
    if (e.touches.length === 2 && placed) pinchDistance = distance(e.touches[0], e.touches[1]);
  }, {passive:true});
  arView.addEventListener('touchmove', e => {
    if (e.touches.length === 2 && pinchDistance && placed) {
      const d = distance(e.touches[0], e.touches[1]);
      scale = Math.min(1.75, Math.max(.5, scale * (d / pinchDistance)));
      anchor.style.setProperty('--scale', scale.toFixed(3)); pinchDistance = d;
    }
  }, {passive:true});
  arView.addEventListener('touchend', () => pinchDistance = null, {passive:true});

  window.addEventListener('beforeunload', stopCamera);
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});
})();
