(() => {
  const $ = s => document.querySelector(s);
  const intro = $('#intro'), arView = $('#arView'), video = $('#camera'), startBtn = $('#startBtn');
  const guide = $('#placementGuide'), anchor = $('#arAnchor');
  const mascotA = $('#mascotA'), mascotB = $('#mascotB');
  const replayBtn = $('#replayBtn'), photoBtn = $('#photoBtn');
  const errorBox = $('#errorBox'), toast = $('#toast');
  const narration = $('#narration'), captureCanvas = $('#captureCanvas');
  const photoPreview = $('#photoPreview'), photoPreviewImage = $('#photoPreviewImage');
  const downloadPhotoBtn = $('#downloadPhotoBtn'), sharePhotoBtn = $('#sharePhotoBtn'), closePreviewBtn = $('#closePreviewBtn');

  const frame = (name) => `assets/${name}`;

  // Finer sync without constant looping. Transitions happen on narration beats only.
  const segments = [
    { start:0.00, end:2.80, mood:'curious', frame:frame('frame_point3d.png'), ai:false },
    { start:2.80, end:5.20, mood:'warm', frame:frame('frame_step1_3d.png'), ai:false },
    { start:5.20, end:7.20, mood:'warm', frame:frame('frame_step2_3d.png'), ai:false },
    { start:7.20, end:9.50, mood:'future', frame:frame('frame_step3_3d.png'), ai:false },
    { start:9.50, end:11.80, mood:'future', frame:frame('frame_step4_3d.png'), ai:false },
    { start:11.80, end:13.90, mood:'ai', frame:frame('frame_step5_3d.png'), ai:true },
    { start:13.90, end:15.70, mood:'ai', frame:frame('frame_point3d.png'), ai:true },
    { start:15.70, end:18.60, mood:'warm', frame:frame('frame_step2_3d.png'), ai:false },
    { start:18.60, end:21.70, mood:'invite', frame:frame('frame_wave3d.png'), ai:false },
    { start:21.70, end:24.20, mood:'invite', frame:frame('frame_point3d.png'), ai:false },
    { start:24.20, end:28.10, mood:'warm', frame:frame('frame_step4_3d.png'), ai:false },
    { start:28.10, end:30.00, mood:'curious', frame:frame('frame_step5_3d.png'), ai:false },
    { start:30.00, end:33.20, mood:'energy', frame:frame('frame_wave3d.png'), ai:false }
  ];

  const quietFrames = [frame('frame_step4_3d.png'), frame('frame_step5_3d.png')];

  let stream = null, placed = false, scale = 1.16, drag = null, pinchDistance = null;
  let audioUnlocked = false, activeLayer = 'A', currentSegmentIndex = -1, quietTimer = null;
  let capturedBlob = null, capturedObjectUrl = null, capturedDataUrl = '', capturedFileName = '';

  function showToast(msg){
    toast.textContent = msg;
    toast.classList.remove('is-hidden');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => toast.classList.add('is-hidden'), 2000);
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
  function setAnchorPosition(x, y){ anchor.style.left = `${x}px`; anchor.style.top = `${y}px`; }
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

  function applySegment(index){
    if(index < 0 || index >= segments.length || index === currentSegmentIndex) return;
    currentSegmentIndex = index;
    const seg = segments[index];
    anchor.dataset.mood = seg.mood;
    anchor.dataset.ai = seg.ai ? 'on' : 'off';
    crossfadeFrame(seg.frame);
  }

  function setQuietPose(frameSrc = quietFrames[0]){
    anchor.dataset.mood = 'quiet';
    anchor.dataset.ai = 'off';
    anchor.classList.remove('is-speaking');
    crossfadeFrame(frameSrc);
  }

  function startQuietLife(){
    clearTimeout(quietTimer);
    setQuietPose(quietFrames[0]);
    const cycle = () => {
      if(!placed || (!narration.paused && !narration.ended)) return;
      quietTimer = setTimeout(() => {
        setQuietPose(quietFrames[1]);
        quietTimer = setTimeout(() => {
          setQuietPose(quietFrames[0]);
          quietTimer = setTimeout(cycle, 7800);
        }, 1350);
      }, 6200);
    };
    cycle();
  }

  function syncNarration(){
    const t = narration.currentTime || 0;
    const idx = segments.findIndex(s => t >= s.start && t < s.end);
    if(idx >= 0){
      anchor.classList.add('is-speaking');
      applySegment(idx);
    } else {
      anchor.classList.remove('is-speaking');
    }
  }

  async function playNarration(fromStart = false){
    if(!placed) return;
    clearTimeout(quietTimer);
    try{
      if(fromStart){ narration.currentTime = 0; currentSegmentIndex = -1; }
      narration.volume = 1;
      await narration.play();
      showToast('Ses oynatılıyor');
    } catch(err){
      showToast('Ses için tekrar dokunun');
    }
  }

  async function placeMascot(x, y){
    if(placed) return;
    placed = true;
    guide.classList.add('is-hidden');
    setAnchorPosition(x, y);
    anchor.classList.remove('is-hidden');
    anchor.classList.add('is-placed');
    anchor.style.setProperty('--scale', scale.toFixed(2));
    crossfadeFrame(frame('frame_step4_3d.png'));
    await playNarration(true);
  }

  function fitVideoCrop(){
    const vw = video.videoWidth || innerWidth, vh = video.videoHeight || innerHeight;
    const cw = innerWidth, ch = innerHeight;
    const s = Math.max(cw / vw, ch / vh);
    const drawW = vw * s, drawH = vh * s;
    return { dx:(cw-drawW)/2, dy:(ch-drawH)/2, drawW, drawH, cw, ch };
  }

  function finaliseCaptureWithLogo(ctx, cw, ch, onDone){
    const logo = new Image();
    logo.onload = () => {
      const pad = 16;
      const targetW = Math.min(180, cw * 0.28);
      const ratio = logo.height / logo.width;
      const targetH = targetW * ratio;
      ctx.globalAlpha = .92;
      ctx.drawImage(logo, pad, pad, targetW, targetH); // top-left as requested
      ctx.globalAlpha = 1;
      captureCanvas.toBlob(blob => {
        if(!blob){ showToast('Fotoğraf oluşturulamadı'); return; }
        if(capturedObjectUrl) URL.revokeObjectURL(capturedObjectUrl);
        capturedBlob = blob;
        capturedObjectUrl = URL.createObjectURL(blob);
        capturedDataUrl = captureCanvas.toDataURL('image/png');
        capturedFileName = `kaplanlar-ar-${Date.now()}.png`;
        photoPreviewImage.src = capturedObjectUrl;
        photoPreview.classList.remove('is-hidden');
        const file = new File([blob], capturedFileName, { type:'image/png' });
        const canShareFile = !!(navigator.share && navigator.canShare && navigator.canShare({ files:[file] }));
        sharePhotoBtn.classList.toggle('is-hidden', !canShareFile);
        onDone && onDone();
      }, 'image/png', 1);
    };
    logo.onerror = () => {
      captureCanvas.toBlob(blob => {
        if(!blob){ showToast('Fotoğraf oluşturulamadı'); return; }
        if(capturedObjectUrl) URL.revokeObjectURL(capturedObjectUrl);
        capturedBlob = blob;
        capturedObjectUrl = URL.createObjectURL(blob);
        capturedDataUrl = captureCanvas.toDataURL('image/png');
        capturedFileName = `kaplanlar-ar-${Date.now()}.png`;
        photoPreviewImage.src = capturedObjectUrl;
        photoPreview.classList.remove('is-hidden');
        const file = new File([blob], capturedFileName, { type:'image/png' });
        const canShareFile = !!(navigator.share && navigator.canShare && navigator.canShare({ files:[file] }));
        sharePhotoBtn.classList.toggle('is-hidden', !canShareFile);
        onDone && onDone();
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

    ctx.strokeStyle = 'rgba(211,18,47,.85)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(anchorRect.left + anchorRect.width/2, anchorRect.top + anchorRect.height*0.82, anchorRect.width*0.22, anchorRect.height*0.03, 0, 0, Math.PI*2);
    ctx.stroke();

    finaliseCaptureWithLogo(ctx, cw, ch, () => showToast('Fotoğraf hazır'));
  }

  async function downloadCapturedPhoto(){
    if(!capturedBlob || !capturedObjectUrl){ showToast('Önce fotoğraf çekin'); return; }
    try {
      if (window.showSaveFilePicker) {
        const handle = await window.showSaveFilePicker({
          suggestedName: capturedFileName,
          types: [{ description: 'PNG Image', accept: { 'image/png': ['.png'] } }]
        });
        const writable = await handle.createWritable();
        await writable.write(capturedBlob);
        await writable.close();
        showToast('Fotoğraf kaydedildi');
        return;
      }
    } catch (err) {
      if(err && err.name !== 'AbortError') console.log(err);
    }

    // Standard explicit download
    const link = document.createElement('a');
    link.href = capturedObjectUrl;
    link.download = capturedFileName || `kaplanlar-ar-${Date.now()}.png`;
    link.rel = 'noopener';
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    link.remove();

    // Mobile fallback: open image directly so user can long-press/save if the browser blocks download.
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if(isMobile){
      setTimeout(() => {
        try { window.open(capturedDataUrl || capturedObjectUrl, '_blank'); } catch(e) {}
      }, 180);
      showToast('Görsel açıldı, gerekirse uzun basarak kaydedin');
    } else {
      showToast('İndirme başlatıldı');
    }
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
  downloadPhotoBtn.addEventListener('click', downloadCapturedPhoto);
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
      scale = Math.min(1.42, Math.max(.84, scale * (d/pinchDistance)));
      anchor.style.setProperty('--scale', scale.toFixed(2));
      pinchDistance = d;
    }
  }, { passive:true });
  arView.addEventListener('touchend', () => { pinchDistance = null; }, { passive:true });

  window.addEventListener('beforeunload', stopCamera);
  if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
})();
