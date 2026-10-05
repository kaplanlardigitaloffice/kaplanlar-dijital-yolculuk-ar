(() => {
  const $ = s => document.querySelector(s);
  const intro = $('#intro'), arView = $('#arView'), video = $('#camera'), startBtn = $('#startBtn');
  const guide = $('#placementGuide'), anchor = $('#arAnchor'), mascotFrame = $('#mascotFrame');
  const mascotA = $('#mascotA'), mascotB = $('#mascotB');
  const replayBtn = $('#replayBtn'), photoBtn = $('#photoBtn');
  const errorBox = $('#errorBox'), toast = $('#toast');
  const narration = $('#narration'), captureCanvas = $('#captureCanvas');
  const photoPreview = $('#photoPreview'), photoPreviewImage = $('#photoPreviewImage');
  const downloadPhotoBtn = $('#downloadPhotoBtn'), sharePhotoBtn = $('#sharePhotoBtn'), closePreviewBtn = $('#closePreviewBtn');

  const frame = (name) => `assets/${name}`;
  const cues = [
    { start:0.00, end:2.80, mood:'curious', frames:[frame('frame_curious.png'), frame('frame_idle1.png')], interval:1200 },
    { start:2.80, end:7.20, mood:'warm', frames:[frame('frame_smile.png'), frame('frame_idle2.png')], interval:1300 },
    { start:7.20, end:11.80, mood:'future', frames:[frame('frame_future.png'), frame('frame_walk1.png'), frame('frame_walk2.png')], interval:1000 },
    { start:11.80, end:15.70, mood:'ai', frames:[frame('frame_ai.png'), frame('frame_idle3.png')], interval:1200 },
    { start:15.70, end:18.60, mood:'warm', frames:[frame('frame_smile.png'), frame('frame_idle2.png')], interval:1300 },
    { start:18.60, end:24.20, mood:'invite', frames:[frame('frame_invite.png'), frame('frame_point.png'), frame('frame_wave.png')], interval:950 },
    { start:24.20, end:28.10, mood:'warm', frames:[frame('frame_idle1.png'), frame('frame_smile.png')], interval:1300 },
    { start:28.10, end:30.00, mood:'curious', frames:[frame('frame_curious.png'), frame('frame_idle3.png')], interval:1000 },
    { start:30.00, end:33.20, mood:'energy', frames:[frame('frame_energy.png'), frame('frame_wave.png'), frame('frame_point.png')], interval:900 }
  ];
  const idleFrames = [frame('frame_idle2.png'), frame('frame_idle3.png')];

  let stream = null, placed = false, scale = 1.06, drag = null, pinchDistance = null;
  let audioUnlocked = false, activeLayer = 'A', currentCueIndex = -1, currentFrameTimer = null, currentFramePointer = 0, quietTimer = null;
  let capturedBlob = null, capturedObjectUrl = null, capturedFileName = '';

  function showToast(msg){
    toast.textContent = msg;
    toast.classList.remove('is-hidden');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(()=>toast.classList.add('is-hidden'), 1800);
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
    }catch(e){
      narration.volume = 1;
      return false;
    }
  }

  async function startCamera(){
    stopCamera();
    try{
      stream = await navigator.mediaDevices.getUserMedia({
        audio:false,
        video:{ facingMode:{ideal:'environment'}, width:{ideal:1920}, height:{ideal:1080} }
      });
      video.srcObject = stream;
      await video.play();
      errorBox.classList.add('is-hidden');
    }catch(err){
      errorBox.innerHTML = '<b>Kamera açılamadı.</b><br>HTTPS bağlantısını ve kamera iznini kontrol edin.';
      errorBox.classList.remove('is-hidden');
    }
  }

  function stopCamera(){ if(stream) stream.getTracks().forEach(t=>t.stop()); stream=null; }
  function setAnchorPosition(x,y){ anchor.style.left=`${x}px`; anchor.style.top=`${y}px`; }
  function visibleLayer(){ return activeLayer==='A' ? mascotA : mascotB; }

  function crossfadeFrame(src){
    const incoming = activeLayer==='A' ? mascotB : mascotA;
    const outgoing = activeLayer==='A' ? mascotA : mascotB;
    if(outgoing.getAttribute('src')===src && outgoing.classList.contains('is-active')) return;
    incoming.src = src;
    requestAnimationFrame(()=>{
      incoming.classList.add('is-active');
      outgoing.classList.remove('is-active');
      activeLayer = activeLayer==='A' ? 'B' : 'A';
    });
  }

  function stopFrameCycle(){ clearInterval(currentFrameTimer); currentFrameTimer = null; }
  function startFrameCycle(frames, interval){
    stopFrameCycle();
    if(!frames || !frames.length) return;
    currentFramePointer = 0;
    crossfadeFrame(frames[0]);
    if(frames.length === 1) return;
    currentFrameTimer = setInterval(()=>{
      currentFramePointer = (currentFramePointer + 1) % frames.length;
      crossfadeFrame(frames[currentFramePointer]);
    }, interval || 1200);
  }

  function enterCue(index){
    if(index === currentCueIndex || index < 0 || index >= cues.length) return;
    currentCueIndex = index;
    const cue = cues[index];
    anchor.dataset.mood = cue.mood;
    startFrameCycle(cue.frames, cue.interval);
  }

  function setQuietPose(){
    stopFrameCycle();
    anchor.classList.remove('is-speaking');
    anchor.dataset.mood = 'quiet';
    crossfadeFrame(frame('frame_idle2.png'));
  }

  function startQuietLife(){
    clearTimeout(quietTimer);
    setQuietPose();
    const cycle = () => {
      if(!placed || (!narration.paused && !narration.ended)) return;
      anchor.dataset.mood = 'quiet';
      crossfadeFrame(frame('frame_idle3.png'));
      quietTimer = setTimeout(()=>{
        crossfadeFrame(frame('frame_idle2.png'));
        quietTimer = setTimeout(()=>{
          crossfadeFrame(frame('frame_curious.png'));
          quietTimer = setTimeout(()=>{
            crossfadeFrame(frame('frame_idle2.png'));
            quietTimer = setTimeout(cycle, 6500);
          }, 1400);
        }, 5000);
      }, 1200);
    };
    quietTimer = setTimeout(cycle, 4200);
  }

  function syncNarration(){
    const t = narration.currentTime || 0;
    const idx = cues.findIndex(c => t >= c.start && t < c.end);
    if(idx >= 0){
      anchor.classList.add('is-speaking');
      enterCue(idx);
    } else {
      anchor.classList.remove('is-speaking');
    }
  }

  async function playNarration(fromStart = false){
    if(!placed) return;
    clearTimeout(quietTimer);
    stopFrameCycle();
    try{
      if(fromStart){ narration.currentTime = 0; currentCueIndex = -1; }
      narration.volume = 1;
      await narration.play();
      showToast('Ses oynatılıyor');
    }catch(err){
      showToast('Ses için tekrar dokunun');
    }
  }

  async function placeMascot(x,y){
    if(placed) return;
    placed = true;
    guide.classList.add('is-hidden');
    setAnchorPosition(x,y);
    anchor.classList.remove('is-hidden');
    anchor.classList.add('is-placed');
    anchor.style.setProperty('--scale', scale.toFixed(2));
    await playNarration(true);
  }

  function fitVideoCrop(){
    const vw = video.videoWidth || innerWidth, vh = video.videoHeight || innerHeight;
    const cw = innerWidth, ch = innerHeight;
    const s = Math.max(cw/vw, ch/vh);
    const drawW = vw*s, drawH = vh*s;
    return { dx:(cw-drawW)/2, dy:(ch-drawH)/2, drawW, drawH, cw, ch };
  }

  async function capturePhoto(){
    if(!placed){ showToast('Önce maskotu yerleştirin'); return; }

    const {dx,dy,drawW,drawH,cw,ch} = fitVideoCrop();
    captureCanvas.width = cw;
    captureCanvas.height = ch;
    const ctx = captureCanvas.getContext('2d');

    ctx.drawImage(video, dx, dy, drawW, drawH);

    // Mascot + subtle AR floor ring
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
    ctx.ellipse(
      anchorRect.left + anchorRect.width/2,
      anchorRect.top + anchorRect.height*0.82,
      anchorRect.width*0.22,
      anchorRect.height*0.03,
      0, 0, Math.PI*2
    );
    ctx.stroke();

    // Add Kaplanlar logo before producing the final file
    const logo = new Image();
    logo.onload = () => {
      const pad = 16;
      const targetW = Math.min(180, cw * 0.28);
      const ratio = logo.height / logo.width;
      const targetH = targetW * ratio;

      ctx.globalAlpha = .90;
      ctx.drawImage(logo, cw-targetW-pad, pad, targetW, targetH);
      ctx.globalAlpha = 1;

      captureCanvas.toBlob(blob => {
        if(!blob){
          showToast('Fotoğraf oluşturulamadı');
          return;
        }

        if(capturedObjectUrl) URL.revokeObjectURL(capturedObjectUrl);
        capturedBlob = blob;
        capturedObjectUrl = URL.createObjectURL(blob);
        capturedFileName = `kaplanlar-ar-${Date.now()}.png`;

        photoPreviewImage.src = capturedObjectUrl;
        photoPreview.classList.remove('is-hidden');

        const file = new File([blob], capturedFileName, {type:'image/png'});
        const canShareFile = !!(navigator.share && navigator.canShare && navigator.canShare({files:[file]}));
        sharePhotoBtn.classList.toggle('is-hidden', !canShareFile);

        showToast('Fotoğraf hazır');
      }, 'image/png', 1);
    };
    logo.onerror = () => showToast('Logo yüklenemedi');
    logo.src = 'assets/kaplanlar_logo.png';
  }

  function downloadCapturedPhoto(){
    if(!capturedBlob || !capturedObjectUrl){
      showToast('Önce fotoğraf çekin');
      return;
    }

    // Explicit user-triggered download: more reliable on mobile browsers.
    const link = document.createElement('a');
    link.href = capturedObjectUrl;
    link.download = capturedFileName || `kaplanlar-ar-${Date.now()}.png`;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();

    // Safari/iOS may ignore download= for blob URLs.
    // Keep the preview open so the image can still be long-pressed / saved.
    showToast('İndirme başlatıldı');
  }

  async function shareCapturedPhoto(){
    if(!capturedBlob) return;
    const file = new File([capturedBlob], capturedFileName || 'kaplanlar-ar.png', {type:'image/png'});
    try{
      if(navigator.share && navigator.canShare && navigator.canShare({files:[file]})){
        await navigator.share({
          files:[file],
          title:'Kaplanlar Dijital Dönüşüm Yolculuğu',
          text:'Kaplanlar AR deneyimi'
        });
      }
    }catch(err){
      if(err && err.name !== 'AbortError') showToast('Paylaşım açılamadı');
    }
  }

  function closePhotoPreview(){
    photoPreview.classList.add('is-hidden');
  }

  startBtn.addEventListener('click', async()=>{
    await unlockAudio();
    intro.classList.add('is-hidden');
    arView.classList.remove('is-hidden');
    await startCamera();
  });

  replayBtn.addEventListener('click', async()=>{ await unlockAudio(); if(placed) await playNarration(true); else showToast('Önce maskotu yerleştirin'); });
  photoBtn.addEventListener('click', capturePhoto);
  downloadPhotoBtn.addEventListener('click', downloadCapturedPhoto);
  sharePhotoBtn.addEventListener('click', shareCapturedPhoto);
  closePreviewBtn.addEventListener('click', closePhotoPreview);
  photoPreview.addEventListener('click', e => {
    if(e.target === photoPreview) closePhotoPreview();
  });

  arView.addEventListener('click', async e => {
    if(e.target.closest('.fab-btn') || e.target.closest('.error-box')) return;
    if(!placed) await placeMascot(e.clientX, e.clientY - 18);
  });

  narration.addEventListener('timeupdate', syncNarration);
  narration.addEventListener('ended', ()=>{
    currentCueIndex = -1;
    anchor.classList.remove('is-speaking');
    startQuietLife();
    showToast('Anlatım tamamlandı');
  });
  narration.addEventListener('pause', ()=>{
    if(placed && !narration.ended){
      anchor.classList.remove('is-speaking');
      startQuietLife();
    }
  });

  anchor.addEventListener('pointerdown', e => {
    anchor.setPointerCapture?.(e.pointerId);
    const r = anchor.getBoundingClientRect();
    drag = { dx:e.clientX-(r.left+r.width/2), dy:e.clientY-(r.top+r.height/2), id:e.pointerId };
  });
  anchor.addEventListener('pointermove', e => {
    if(!drag || drag.id!==e.pointerId) return;
    setAnchorPosition(e.clientX-drag.dx, e.clientY-drag.dy);
  });
  const endDrag = e => { if(drag && drag.id===e.pointerId) drag=null; };
  anchor.addEventListener('pointerup', endDrag);
  anchor.addEventListener('pointercancel', endDrag);

  const distance = (a,b)=>Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY);
  arView.addEventListener('touchstart', e=>{ if(e.touches.length===2 && placed) pinchDistance=distance(e.touches[0],e.touches[1]); }, {passive:true});
  arView.addEventListener('touchmove', e=>{
    if(e.touches.length===2 && pinchDistance && placed){
      const d=distance(e.touches[0],e.touches[1]);
      scale=Math.min(1.34,Math.max(.72,scale*(d/pinchDistance)));
      anchor.style.setProperty('--scale', scale.toFixed(2));
      pinchDistance=d;
    }
  }, {passive:true});
  arView.addEventListener('touchend', ()=>{ pinchDistance=null; }, {passive:true});

  window.addEventListener('beforeunload', stopCamera);
  if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});
})();
