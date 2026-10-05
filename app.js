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
  const panel = $('#journeyPanel');
  const closePanel = $('#closePanel');
  const errorBox = $('#errorBox');

  const walkFrames = [1,2,3,4,5,6].map(n => `assets/mascot_${n}.png`);
  const waveFrame = 'assets/mascot_7.png';
  let stream = null;
  let facingMode = 'environment';
  let placed = false;
  let frameIndex = 0;
  let walkTimer = null;
  let animationSteps = 0;
  let scale = 1;
  let drag = null;
  let pinchDistance = null;

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
    scale = 0.82;
    anchor.style.setProperty('--scale', scale);
    animateEntrance();
  }

  arView.addEventListener('click', e => {
    if (e.target.closest('button') || e.target.closest('.journey-panel')) return;
    if (!placed) placeMascot(e.clientX, e.clientY - 35);
  });

  function animateEntrance() {
    clearInterval(walkTimer);
    frameIndex = 0;
    animationSteps = 0;
    mascot.src = walkFrames[0];
    walkTimer = setInterval(() => {
      frameIndex = (frameIndex + 1) % walkFrames.length;
      mascot.src = walkFrames[frameIndex];
      animationSteps++;
      if (animationSteps >= 18) {
        clearInterval(walkTimer);
        setTimeout(() => {
          mascot.src = waveFrame;
          journeyBtn.classList.remove('is-hidden');
        }, 160);
      }
    }, 145);
  }

  function resetScene() {
    placed = false;
    clearInterval(walkTimer);
    mascot.src = walkFrames[0];
    anchor.classList.add('is-hidden');
    guide.classList.remove('is-hidden');
    journeyBtn.classList.add('is-hidden');
    panel.classList.add('is-hidden');
    scale = 1;
    anchor.style.setProperty('--scale', scale);
    anchor.style.left = '50%';
    anchor.style.top = '54%';
  }
  resetBtn.addEventListener('click', resetScene);

  journeyBtn.addEventListener('click', e => {
    e.stopPropagation();
    panel.classList.remove('is-hidden');
  });
  closePanel.addEventListener('click', () => panel.classList.add('is-hidden'));

  // Drag anchor
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
  anchor.addEventListener('pointerup', endDrag);
  anchor.addEventListener('pointercancel', endDrag);

  // Pinch scaling on the full AR view
  function distance(t1, t2) {
    return Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
  }
  arView.addEventListener('touchstart', e => {
    if (e.touches.length === 2 && placed) pinchDistance = distance(e.touches[0], e.touches[1]);
  }, {passive:true});
  arView.addEventListener('touchmove', e => {
    if (e.touches.length === 2 && pinchDistance && placed) {
      const d = distance(e.touches[0], e.touches[1]);
      scale = Math.min(1.75, Math.max(.5, scale * (d / pinchDistance)));
      anchor.style.setProperty('--scale', scale.toFixed(3));
      pinchDistance = d;
    }
  }, {passive:true});
  arView.addEventListener('touchend', () => pinchDistance = null, {passive:true});

  window.addEventListener('beforeunload', stopCamera);
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});
})();
