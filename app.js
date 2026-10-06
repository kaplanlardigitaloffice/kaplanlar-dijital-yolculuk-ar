(() => {
  const $ = s => document.querySelector(s);
  const intro = $('#intro'), arView = $('#arView'), video = $('#camera'), startBtn = $('#startBtn');
  const guide = $('#placementGuide'), anchor = $('#arAnchor');
  const mascotA = $('#mascotA'), mascotB = $('#mascotB');
  const replayBtn = $('#replayBtn'), photoBtn = $('#photoBtn'), zoomInBtn = $('#zoomInBtn'), zoomOutBtn = $('#zoomOutBtn');
  const errorBox = $('#errorBox'), toast = $('#toast');
  const narration = $('#narration'), captureCanvas = $('#captureCanvas');
  const photoPreview = $('#photoPreview'), photoPreviewImage = $('#photoPreviewImage');
  const sharePhotoBtn = $('#sharePhotoBtn'), closePreviewBtn = $('#closePreviewBtn');

  const frame = n => `assets/frame_${String(n).padStart(2,'0')}.png`;

  const groups = {
    curious:[frame(1),frame(2),frame(3),frame(4),frame(5),frame(6)],
    invite:[frame(7),frame(8),frame(9),frame(10),frame(11),frame(12)],
    explain:[frame(13),frame(14),frame(15),frame(16),frame(17),frame(18)],
    calm:[frame(19),frame(20),frame(21),frame(22),frame(23),frame(24)]
  };

  // V25: cinematic pacing. Each sentence uses only a few deliberate poses.
  // No fast looping. A pose stays visible long enough to feel like one continuous performance.
  const scriptTimeline = [
    { start:0.00, end:2.80, mood:'curious', shots:[frame(1),frame(3)], ai:false },
    { start:2.80, end:7.20, mood:'warm', shots:[frame(19)], ai:false },
    { start:7.20, end:11.80, mood:'future', shots:[frame(13),frame(18)], ai:false },
    { start:11.80, end:15.70, mood:'ai', shots:[frame(14)], ai:true },
    { start:15.70, end:18.60, mood:'warm', shots:[frame(21)], ai:false },
    { start:18.60, end:24.20, mood:'invite', shots:[frame(7),frame(12)], ai:false },
    { start:24.20, end:28.10, mood:'warm', shots:[frame(22)], ai:false },
    { start:28.10, end:30.00, mood:'curious', shots:[frame(4)], ai:false },
    { start:30.00, end:33.20, mood:'energy', shots:[frame(11)], ai:false }
  ];

  let stream = null, placed = false, scale = 1.16, drag = null, pinchDistance = null;
  let audioUnlocked = false, activeLayer = 'A', currentSegmentIndex = -1, shotTimers = [], quietTimer = null;
  let capturedBlob = null, capturedObjectUrl = null, capturedFileName = '';

  function showToast(msg){
    toast.textContent = msg;
    toast.classList.remove('is-hidden');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => toast.classList.add('is-hidden'), 1800);
  }

  async function unlockAudio(){
    if(audioUnlocked) return true;
    try{
      narration.volume = 0;
      narration.currentTime = 0;
      await narration.play();
      narration.pause();
      narration.currentTime = 0;
      narration.volume = 1;
      audioUnlocked = true;
      return true;
    } catch(e){
      narration.volume = 1;
      return false;
    }
  }

  async function startCamera(){
    stopCamera();
    try{
      stream = await navigator.mediaDevices.getUserMedia({
        audio:false,
        video:{ facingMode:{ ideal:'environment' }, width:{ ideal:1920 }, height:{ ideal:1080 } }
      });
      video.srcObject = stream;
      await video.play();
      errorBox.classList.add('is-hidden');
    } catch(err){
      errorBox.innerHTML = '<b>Kamera açılamadı.</b><br>HTTPS bağlantısını ve kamera iznini kontrol edin.';
      errorBox.classList.remove('is-hidden');
    }
  }

  function stopCamera(){ if(stream) stream.getTracks().forEach(t => t.stop()); stream = null; }
  function setAnchorPosition(x,y){ anchor.style.left = `${x}px`; anchor.style.top = `${y}px`; }
  function visibleLayer(){ return activeLayer === 'A' ? mascotA : mascotB; }

  function crossfadeFrame(src){
    const incoming = activeLayer === 'A' ? mascotB : mascotA;
    const outgoing = activeLayer === 'A' ? mascotA : mascotB;
    if(outgoing.getAttribute('src') === src && outgoing.classList.contains('is-active')) return;
    incoming.src = src;
    requestAnimationFrame(() => {
      incoming.classList.add('is-active');
      outgoing.classList.remove('is-active');
      activeLayer = activeLayer === 'A' ? 'B' : 'A';
    });
  }

  function clearShotTimers(){
    shotTimers.forEach(clearTimeout);
    shotTimers=[];
  }

  function playShots(shots, segmentDurationMs){
    clearShotTimers();
    if(!shots || !shots.length) return;
    crossfadeFrame(shots[0]);
    if(shots.length===1) return;

    // Keep each pose on screen significantly longer for a calmer cinematic feel.
    const safeStep = Math.max(2400, Math.floor(segmentDurationMs / shots.length));
    for(let i=1;i<shots.length;i++){
      const t=Math.min(segmentDurationMs-700, safeStep*i);
      shotTimers.push(setTimeout(()=>crossfadeFrame(shots[i]), t));
    }
  }

  function applyTimelineSegment(index){
    if(index < 0 || index >= scriptTimeline.length || index === currentSegmentIndex) return;
    currentSegmentIndex = index;
    const seg = scriptTimeline[index];
    anchor.dataset.mood = seg.mood;
    anchor.dataset.ai = seg.ai ? 'on' : 'off';
    const durationMs = Math.max(1000, (seg.end - seg.start) * 1000);
    playShots(seg.shots, durationMs);
  }

  function startQuietLife(){
    clearTimeout(quietTimer);
    clearShotTimers();
    anchor.classList.remove('is-speaking');
    anchor.dataset.mood = 'quiet';
    anchor.dataset.ai = 'off';
    crossfadeFrame(groups.calm[0]);

    const idleCycle = () => {
      if(!placed || (!narration.paused && !narration.ended)) return;
      quietTimer = setTimeout(() => {
        crossfadeFrame(groups.calm[1]);
        quietTimer = setTimeout(() => {
          crossfadeFrame(groups.calm[0]);
          quietTimer = setTimeout(() => {
            crossfadeFrame(groups.calm[2]);
            quietTimer = setTimeout(() => {
              crossfadeFrame(groups.calm[0]);
              quietTimer = setTimeout(idleCycle, 7200);
            }, 1600);
          }, 7600);
        }, 1400);
      }, 6400);
    };
    idleCycle();
  }

  function syncNarration(){
    const t = narration.currentTime || 0;
    const idx = scriptTimeline.findIndex(s => t >= s.start && t < s.end);
    if(idx >= 0){
      anchor.classList.add('is-speaking');
      applyTimelineSegment(idx);
    } else {
      anchor.classList.remove('is-speaking');
    }
  }

  async function playNarration(fromStart = false){
    if(!placed) return;
    clearTimeout(quietTimer);
    clearShotTimers();
    try{
      if(fromStart){ narration.currentTime = 0; currentSegmentIndex = -1; }
      narration.volume = 1;
      await narration.play();
      showToast('Ses oynatılıyor');
    } catch(err){
      showToast('Ses için tekrar dokunun');
    }
  }

  async function placeMascot(x,y){
    if(placed) return;
    placed = true;
    guide.classList.add('is-hidden');
    setAnchorPosition(x, y);
    anchor.classList.remove('is-hidden');
    anchor.classList.add('is-placed');
    anchor.style.setProperty('--scale', scale.toFixed(2));
    crossfadeFrame(groups.calm[0]);
    await playNarration(true);
  }

  function fitVideoCrop(){
    const vw = video.videoWidth || innerWidth, vh = video.videoHeight || innerHeight;
    const cw = innerWidth, ch = innerHeight;
    const s = Math.max(cw / vw, ch / vh);
    const drawW = vw * s, drawH = vh * s;
    return { dx:(cw-drawW)/2, dy:(ch-drawH)/2, drawW, drawH, cw, ch };
  }

  function finaliseCaptureWithLogo(ctx, cw, ch){
    const logo = new Image();
    logo.onload = () => {
      const pad = 16;
      const targetW = Math.min(180, cw * 0.28);
      const ratio = logo.height / logo.width;
      const targetH = targetW * ratio;
      ctx.globalAlpha = .92;
      ctx.drawImage(logo, pad, pad, targetW, targetH);
      ctx.globalAlpha = 1;
      captureCanvas.toBlob(blob => {
        if(!blob){ showToast('Fotoğraf oluşturulamadı'); return; }
        if(capturedObjectUrl) URL.revokeObjectURL(capturedObjectUrl);
        capturedBlob = blob;
        capturedObjectUrl = URL.createObjectURL(blob);
        capturedFileName = `kaplanlar-ar-${Date.now()}.png`;
        photoPreviewImage.src = capturedObjectUrl;
        photoPreview.classList.remove('is-hidden');
        const file = new File([blob], capturedFileName, { type:'image/png' });
        const canShareFile = !!(navigator.share && navigator.canShare && navigator.canShare({ files:[file] }));
        sharePhotoBtn.classList.toggle('is-hidden', !canShareFile);
        if(!canShareFile) showToast('Bu cihazda paylaşım desteklenmiyor');
      }, 'image/png', 1);
    };
    logo.onerror = () => {
      captureCanvas.toBlob(blob => {
        if(!blob){ showToast('Fotoğraf oluşturulamadı'); return; }
        if(capturedObjectUrl) URL.revokeObjectURL(capturedObjectUrl);
        capturedBlob = blob;
        capturedObjectUrl = URL.createObjectURL(blob);
        capturedFileName = `kaplanlar-ar-${Date.now()}.png`;
        photoPreviewImage.src = capturedObjectUrl;
        photoPreview.classList.remove('is-hidden');
        const file = new File([blob], capturedFileName, { type:'image/png' });
        const canShareFile = !!(navigator.share && navigator.canShare && navigator.canShare({ files:[file] }));
        sharePhotoBtn.classList.toggle('is-hidden', !canShareFile);
      }, 'image/png', 1);
    };
    logo.src = 'assets/kaplanlar_logo.png';
  }

  async function capturePhoto(){
    if(!placed){ showToast('Önce maskotu yerleştirin'); return; }
    const { dx, dy, drawW, drawH, cw, ch } = fitVideoCrop();
    captureCanvas.width = cw;
    captureCanvas.height = ch;
    const ctx = captureCanvas.getContext('2d');
    ctx.drawImage(video, dx, dy, drawW, drawH);

    const img = visibleLayer();
    const imgRect = img.getBoundingClientRect();
    const anchorRect = anchor.getBoundingClientRect();

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.34)';
    ctx.shadowBlur = 28;
    ctx.drawImage(img, imgRect.left, imgRect.top, imgRect.width, imgRect.height);
    ctx.restore();

    finaliseCaptureWithLogo(ctx, cw, ch);
    showToast('Fotoğraf hazır');
  }

  async function shareCapturedPhoto(){
    if(!capturedBlob) return;
    const file = new File([capturedBlob], capturedFileName || 'kaplanlar-ar.png', { type:'image/png' });
    try {
      if(navigator.share && navigator.canShare && navigator.canShare({ files:[file] })) {
        await navigator.share({ files:[file], title:'Kaplanlar Dijital Dönüşüm Yolculuğu', text:'Kaplanlar AR deneyimi' });
      }
    } catch(err) {
      if(err && err.name !== 'AbortError') showToast('Paylaşım açılamadı');
    }
  }

  function closePhotoPreview(){ photoPreview.classList.add('is-hidden'); }

  function setScale(nextScale){
    scale = Math.min(1.48, Math.max(.68, nextScale));
    anchor.style.setProperty('--scale', scale.toFixed(2));
    showToast(`Boyut: %${Math.round(scale * 100)}`);
  }

  startBtn.addEventListener('click', async() => {
    await unlockAudio();
    intro.classList.add('is-hidden');
    arView.classList.remove('is-hidden');
    await startCamera();
  });

  replayBtn.addEventListener('click', async() => {
    await unlockAudio();
    if(placed) await playNarration(true); else showToast('Önce maskotu yerleştirin');
  });
  photoBtn.addEventListener('click', capturePhoto);
  zoomInBtn.addEventListener('click', e => {
    e.stopPropagation();
    if(!placed){ showToast('Önce maskotu yerleştirin'); return; }
    setScale(scale + .10);
  });
  zoomOutBtn.addEventListener('click', e => {
    e.stopPropagation();
    if(!placed){ showToast('Önce maskotu yerleştirin'); return; }
    setScale(scale - .10);
  });
  sharePhotoBtn.addEventListener('click', shareCapturedPhoto);
  closePreviewBtn.addEventListener('click', closePhotoPreview);
  photoPreview.addEventListener('click', e => { if(e.target === photoPreview) closePhotoPreview(); });

  arView.addEventListener('click', async e => {
    if(e.target.closest('.fab-btn') || e.target.closest('.error-box') || e.target.closest('.photo-preview')) return;
    if(!placed) await placeMascot(e.clientX, e.clientY - 18);
  });

  narration.addEventListener('timeupdate', syncNarration);
  narration.addEventListener('ended', () => {
    currentSegmentIndex = -1;
    anchor.classList.remove('is-speaking');
    startQuietLife();
    showToast('Anlatım tamamlandı');
  });
  narration.addEventListener('pause', () => {
    if(placed && !narration.ended){
      anchor.classList.remove('is-speaking');
      startQuietLife();
    }
  });

  anchor.addEventListener('pointerdown', e => {
    anchor.setPointerCapture?.(e.pointerId);
    const r = anchor.getBoundingClientRect();
    drag = { dx:e.clientX - (r.left + r.width/2), dy:e.clientY - (r.top + r.height/2), id:e.pointerId };
  });
  anchor.addEventListener('pointermove', e => {
    if(!drag || drag.id !== e.pointerId) return;
    setAnchorPosition(e.clientX - drag.dx, e.clientY - drag.dy);
  });
  const endDrag = e => { if(drag && drag.id === e.pointerId) drag = null; };
  anchor.addEventListener('pointerup', endDrag);
  anchor.addEventListener('pointercancel', endDrag);

  const distance = (a,b) => Math.hypot(a.clientX-b.clientX, a.clientY-b.clientY);
  arView.addEventListener('touchstart', e => { if(e.touches.length === 2 && placed) pinchDistance = distance(e.touches[0], e.touches[1]); }, { passive:true });
  arView.addEventListener('touchmove', e => {
    if(e.touches.length === 2 && pinchDistance && placed){
      const d = distance(e.touches[0], e.touches[1]);
      setScale(scale * (d/pinchDistance));
      pinchDistance = d;
    }
  }, { passive:true });
  arView.addEventListener('touchend', () => { pinchDistance = null; }, { passive:true });

  window.addEventListener('beforeunload', stopCamera);
  if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
})();
