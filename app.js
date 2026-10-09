(() => {
  const $ = s => document.querySelector(s);

  const intro = $('#intro'), arView = $('#arView');
  const introOverlay = $('#introOverlay'), launchVideo = $('#launchVideo');
  const videoStartBtn = $('#videoStartBtn'), enterArPanel = $('#enterArPanel'), enterArBtn = $('#enterArBtn');

  const video = $('#camera');
  const quickPhotoBtn = $('#quickPhotoBtn'), conceptTrack = $('#conceptTrack'), mascotTrack = $('#mascotTrack'), refreshMascotsBtn = $('#refreshMascotsBtn');
  const guide = $('#placementGuide'), anchor = $('#arAnchor');
  const mascotA = $('#mascotA'), mascotB = $('#mascotB');
  const photoBtn = $('#photoBtn'), recordBtn = $('#recordBtn'), cameraFlipBtn = $('#cameraFlipBtn');
  const lens05Btn = $('#lens05Btn'), lens1Btn = $('#lens1Btn'), lens15Btn = $('#lens15Btn'), lens2Btn = $('#lens2Btn');
  const lensButtons = [lens05Btn, lens1Btn, lens15Btn, lens2Btn].filter(Boolean);
  const resizeHint = $('#resizeHint');
  const errorBox = $('#errorBox'), toast = $('#toast');
  const captureCanvas = $('#captureCanvas');

  const photoPreview = $('#photoPreview'), photoPreviewImage = $('#photoPreviewImage');
  const saveGalleryBtn = $('#saveGalleryBtn'), sharePhotoBtn = $('#sharePhotoBtn'), closePreviewBtn = $('#closePreviewBtn');

  const videoPreview = $('#videoPreview'), videoPreviewPlayer = $('#videoPreviewPlayer');
  const saveVideoBtn = $('#saveVideoBtn'), shareVideoBtn = $('#shareVideoBtn'), closeVideoPreviewBtn = $('#closeVideoPreviewBtn');

  let selectedMascotSrc = 'assets/mascots/kurumsal/mascot_01.png';
  let mascotOptions = [];
  let mascotConcepts = [];
  let activeConceptId = null;

  let stream = null, cameraTrack = null, placed = false, scale = 1.12, drag = null, pinchDistance = null;
  let activeLayer = 'A', shotTimers = [], quietTimer = null;

  let capturedBlob = null, capturedObjectUrl = null, capturedFileName = '';
  let recordedBlob = null, recordedObjectUrl = null, recordedFileName = '';

  let currentDeviceId = null, defaultRearDeviceId = null, wideRearDeviceId = null;
  let cameraFacing = 'environment';
  let cameraZoom = 1.0, cameraZoomMin = 1.0, cameraZoomMax = 3.0;
  let wideMode = false;

  let recorder = null, recordingStream = null, recordingChunks = [], recordingRAF = null, recording = false;

  function showToast(msg){
    toast.textContent = msg;
    toast.classList.remove('is-hidden');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => toast.classList.add('is-hidden'), 2200);
  }

  function setHint(el, msg){
    el.textContent = msg;
    el.classList.remove('is-hidden');
  }

  function hideHint(el){
    el.classList.add('is-hidden');
    el.textContent = '';
  }

  function setAnchorPosition(x,y){
    anchor.style.left = `${x}px`;
    anchor.style.top = `${y}px`;
  }

  function visibleLayer(){
    return activeLayer === 'A' ? mascotA : mascotB;
  }

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
    shotTimers = [];
  }

  function playShots(shots, segmentDurationMs){
    clearShotTimers();
    if(!shots || !shots.length) return;
    crossfadeFrame(shots[0]);
    if(shots.length === 1) return;
    const safeStep = Math.max(2200, Math.floor(segmentDurationMs / shots.length));
    for(let i=1;i<shots.length;i++){
      const t = Math.min(segmentDurationMs - 600, safeStep * i);
      shotTimers.push(setTimeout(() => crossfadeFrame(shots[i]), t));
    }
  }

  function startQuietLife(){
    clearTimeout(quietTimer);
    clearShotTimers();
    anchor.dataset.mood = 'quiet';
    anchor.dataset.ai = 'off';
    crossfadeFrame(selectedMascotSrc);
  }


  function updateCameraButtons(){
    const isFront = cameraFacing === 'user';

    lensButtons.forEach(btn => {
      const z = Number(btn.dataset.zoom || 1);
      btn.classList.toggle('is-active', Math.abs(z - cameraZoom) < 0.06);

      if(z === 0.5){
        const canUseWide = !isFront && !!wideRearDeviceId;
        btn.classList.toggle('is-hidden', !canUseWide);
        btn.disabled = !canUseWide;
      } else {
        btn.disabled = false;
      }
    });

    if(cameraFlipBtn){
      cameraFlipBtn.classList.toggle('is-front', isFront);
      const label = cameraFlipBtn.querySelector('.camera-flip-label');
      if(label) label.textContent = isFront ? 'Arka' : 'Ön';
      cameraFlipBtn.setAttribute('aria-label', isFront ? 'Arka kameraya geç' : 'Ön kameraya geç');
    }

    recordBtn.classList.toggle('is-recording', recording);
    recordBtn.querySelector('.record-label').textContent = recording ? 'Durdur' : 'Kayıt';
    recordBtn.setAttribute('aria-label', recording ? 'Video kaydını durdur' : 'Video kaydı başlat');
  }

  function applyVideoTransform(){
    const zoomScale = cameraZoom >= 1 ? cameraZoom : 1;
    const mirror = cameraFacing === 'user' ? -1 : 1;
    video.style.transformOrigin = 'center center';
    video.style.transform = `scaleX(${mirror}) scale(${zoomScale})`;
  }

  function applyDigitalCameraZoom(){
    applyVideoTransform();
    updateCameraButtons();
  }

  async function discoverVideoDevices(){
    try{
      const devices = await navigator.mediaDevices.enumerateDevices();
      const vids = devices.filter(d => d.kind === 'videoinput');
      const rear = vids.filter(d => /back|rear|environment|arka|world/i.test(d.label));
      defaultRearDeviceId = (rear[0] || vids[0] || {}).deviceId || null;
      const wideMatch = rear.find(d => /ultra|wide|0\.5|geniş|genis/i.test(d.label) && d.deviceId !== defaultRearDeviceId);
      wideRearDeviceId = wideMatch ? wideMatch.deviceId : null;
      if(!currentDeviceId) currentDeviceId = defaultRearDeviceId;
    } catch(e) {}
  }

  async function refreshTrackCapabilities(){
    cameraTrack = stream?.getVideoTracks?.()[0] || null;
    cameraZoomMin = 1.0;
    cameraZoomMax = 3.0;
    if(cameraTrack && cameraTrack.getCapabilities){
      try{
        const caps = cameraTrack.getCapabilities();
        if(caps && typeof caps.zoom !== 'undefined'){
          cameraZoomMin = Math.max(1, Number(caps.zoom.min ?? 1));
          cameraZoomMax = Math.max(2, Number(caps.zoom.max ?? 3));
        }
      } catch(e) {}
    }
    applyDigitalCameraZoom();
  }

  async function startCamera(){
    stopCamera();
    try{
      const videoConstraints = {
        width:{ ideal: 1920 },
        height:{ ideal: 1080 }
      };

      if(cameraFacing === 'user'){
        videoConstraints.facingMode = { ideal:'user' };
      } else if(currentDeviceId){
        videoConstraints.deviceId = { exact: currentDeviceId };
      } else {
        videoConstraints.facingMode = { ideal:'environment' };
      }

      stream = await navigator.mediaDevices.getUserMedia({ audio:false, video: videoConstraints });
      video.srcObject = stream;
      await video.play();
      errorBox.classList.add('is-hidden');

      await discoverVideoDevices();
      await refreshTrackCapabilities();

      if(cameraFacing === 'user'){
        wideMode = false;
        cameraZoom = Math.max(1, cameraZoom);
      } else if(wideMode && !wideRearDeviceId){
        wideMode = false;
        cameraZoom = 1.0;
      }

      applyVideoTransform();
      updateCameraButtons();
    } catch(err){
      errorBox.innerHTML = '<b>Kamera açılamadı.</b><br>HTTPS bağlantısını ve kamera iznini kontrol edin.';
      errorBox.classList.remove('is-hidden');
    }
  }

  function stopCamera(){
    if(stream) stream.getTracks().forEach(t => t.stop());
    stream = null;
    cameraTrack = null;
  }

  async function openArExperience(){
    try { launchVideo.pause(); } catch(e) {}
    intro.classList.add('is-hidden');
    arView.classList.remove('is-hidden');

    placed = false;
    guide.classList.remove('is-hidden');
    anchor.classList.add('is-hidden');
    anchor.classList.remove('is-placed');

    await startCamera();
    await loadMascotOptions();
  }

  // V47: launch flow is handled directly in index.html.


  quickPhotoBtn?.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    await openArExperience();
    showToast('Maskotu seçin ve yerleştirmek için ekrana dokunun');
  });

  refreshMascotsBtn?.addEventListener('click', async (e) => {
    e.stopPropagation();
    refreshMascotsBtn.disabled = true;
    refreshMascotsBtn.textContent = 'Yükleniyor';
    await loadMascotOptions();
    refreshMascotsBtn.textContent = 'Yenile';
    refreshMascotsBtn.disabled = false;
    const totalMascots = mascotConcepts.reduce((sum,c) => sum + c.mascots.length, 0);
    showToast(`${mascotConcepts.length} konsept • ${totalMascots} maskot`);
  });

  enterArBtn?.addEventListener('click', openArExperience);

  async function placeMascot(x,y){
    if(placed) return;
    placed = true;
    guide.classList.add('is-hidden');
    setAnchorPosition(x, y - 18);
    anchor.classList.remove('is-hidden');
    anchor.classList.add('is-placed');
    anchor.style.setProperty('--scale', scale.toFixed(2));

    crossfadeFrame(selectedMascotSrc);
    anchor.dataset.mood = 'quiet';

    resizeHint?.classList.remove('is-hidden');
    clearTimeout(placeMascot._hintTimer);
    placeMascot._hintTimer = setTimeout(() => resizeHint?.classList.add('is-hidden'), 2400);
  }


  function setScale(nextScale){
    scale = Math.min(1.48, Math.max(.68, nextScale));
    anchor.style.setProperty('--scale', scale.toFixed(2));
  }


  async function imageExists(src){
    return await new Promise(resolve => {
      const img = new Image();
      const timer = setTimeout(() => resolve(false), 5000);
      img.onload = () => { clearTimeout(timer); resolve(true); };
      img.onerror = () => { clearTimeout(timer); resolve(false); };
      img.src = src + (src.includes('?') ? '&' : '?') + `check=${Date.now()}`;
    });
  }

  async function loadConceptsFromJson(){
    try{
      const res = await fetch(`assets/mascots.json?v=${Date.now()}`, { cache:'no-store' });
      if(!res.ok) return [];
      const data = await res.json();
      const rawConcepts = Array.isArray(data?.concepts) ? data.concepts : [];
      const concepts = [];

      for(const concept of rawConcepts){
        const validMascots = [];
        for(const [index,item] of (concept.mascots || []).entries()){
          const mascot = typeof item === 'string'
            ? {name:item.split('/').pop(), src:item}
            : {name:item?.name || `Maskot ${index+1}`, src:item?.src};
          if(mascot.src && await imageExists(mascot.src)) validMascots.push(mascot);
        }

        if(validMascots.length){
          concepts.push({
            id:concept.id || concept.title || `concept-${concepts.length+1}`,
            title:concept.title || concept.id || `Konsept ${concepts.length+1}`,
            mascots:validMascots
          });
        }
      }
      return concepts;
    }catch(e){
      console.warn('mascots.json yüklenemedi', e);
      return [];
    }
  }


  function renderConceptPicker(){
    if(!conceptTrack) return;
    conceptTrack.innerHTML = '';

    const visibleConcepts = mascotConcepts
      .filter(c => Array.isArray(c.mascots) && c.mascots.length > 0);

    visibleConcepts.forEach(concept => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'concept-chip' + (concept.id === activeConceptId ? ' is-selected' : '');
      btn.setAttribute('role','tab');
      btn.setAttribute('aria-selected', concept.id === activeConceptId ? 'true' : 'false');
      btn.textContent = concept.title;

      btn.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        activeConceptId = concept.id;
        renderConceptPicker();
        renderMascotPicker(concept.mascots);
      });

      conceptTrack.appendChild(btn);
    });

    conceptTrack.classList.toggle('is-hidden', visibleConcepts.length === 0);
  }

  function renderMascotPicker(options){
    if(!mascotTrack) return;
    mascotTrack.innerHTML = '';

    mascotOptions = (Array.isArray(options) ? options : [])
      .filter(item => item && item.src);

    mascotOptions.forEach((item, index) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'mascot-option' + (index === 0 ? ' is-selected' : '');
      btn.setAttribute('role','listitem');
      btn.setAttribute('aria-label', item.name || `Maskot ${index+1}`);

      const img = document.createElement('img');
      img.src = item.src + (item.src.includes('?') ? '&' : '?') + `v=${Date.now()}`;
      img.alt = '';
      img.draggable = false;

      btn.appendChild(img);

      btn.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();

        selectedMascotSrc = item.src + (item.src.includes('?') ? '&' : '?') + `v=${Date.now()}`;
        crossfadeFrame(selectedMascotSrc);

        mascotTrack.querySelectorAll('.mascot-option')
          .forEach(el => el.classList.remove('is-selected'));
        btn.classList.add('is-selected');
      });

      mascotTrack.appendChild(btn);
    });

    if(mascotOptions.length){
      selectedMascotSrc = mascotOptions[0].src + (mascotOptions[0].src.includes('?') ? '&' : '?') + `v=${Date.now()}`;
      crossfadeFrame(selectedMascotSrc);
    }
  }

  async function loadMascotOptions(){
    mascotConcepts = await loadConceptsFromJson();

    if(!mascotConcepts.length){
      activeConceptId = null;
      conceptTrack?.classList.add('is-hidden');
      mascotTrack.innerHTML = '';
      showToast('Gösterilecek maskot bulunamadı');
      return;
    }

    conceptTrack?.classList.remove('is-hidden');

    if(!activeConceptId || !mascotConcepts.some(c => c.id === activeConceptId)){
      activeConceptId = mascotConcepts[0].id;
    }

    const active = mascotConcepts.find(c => c.id === activeConceptId) || mascotConcepts[0];
    renderConceptPicker();
    renderMascotPicker(active.mascots);

    if(refreshMascotsBtn){
      const total = mascotConcepts.reduce((sum,c) => sum + c.mascots.length, 0);
      refreshMascotsBtn.title = `${mascotConcepts.length} konsept • ${total} maskot`;
    }
  }


  async function setCameraZoom(nextZoom){
    const target = Number(nextZoom);

    if(target === 0.5){
      if(cameraFacing === 'user'){
        showToast('Ön kamerada 0.5× kullanılamıyor');
        return;
      }
      if(!wideRearDeviceId){
        showToast('Bu cihazda gerçek geniş açı lens görünmüyor');
        return;
      }
      if(currentDeviceId !== wideRearDeviceId){
        currentDeviceId = wideRearDeviceId;
        wideMode = true;
        cameraZoom = 0.5;
        await startCamera();
      } else {
        wideMode = true;
        cameraZoom = 0.5;
      }
      applyVideoTransform();
      updateCameraButtons();
      return;
    }

    if(wideMode && defaultRearDeviceId){
      currentDeviceId = defaultRearDeviceId;
      wideMode = false;
      await startCamera();
    }

    const desired = Math.max(1, target);
    cameraZoom = desired;

    // Try hardware zoom first when supported, otherwise fallback to digital zoom.
    let usedHardware = false;
    if(cameraTrack && cameraTrack.getCapabilities){
      try{
        const caps = cameraTrack.getCapabilities();
        if(caps && typeof caps.zoom !== 'undefined'){
          const z = Math.max(cameraZoomMin, Math.min(cameraZoomMax, desired));
          await cameraTrack.applyConstraints({ advanced:[{ zoom: z }] });
          usedHardware = true;
        }
      } catch(e){}
    }
    if(usedHardware){
      applyVideoTransform();
    } else {
      applyDigitalCameraZoom();
    }
    updateCameraButtons();
  }

  function fitVideoCrop(){
    const vw = video.videoWidth || innerWidth, vh = video.videoHeight || innerHeight;
    const cw = innerWidth, ch = innerHeight;
    const s = Math.max(cw / vw, ch / vh);
    const drawW = vw * s, drawH = vh * s;
    return { dx:(cw - drawW)/2, dy:(ch - drawH)/2, drawW, drawH, cw, ch };
  }

  function renderCompositeToCanvas(includeLogo = true){
    const { dx, dy, drawW, drawH, cw, ch } = fitVideoCrop();
    captureCanvas.width = cw;
    captureCanvas.height = ch;
    const ctx = captureCanvas.getContext('2d');
    ctx.clearRect(0,0,cw,ch);
    if(cameraFacing === 'user'){
      ctx.save();
      ctx.translate(cw, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, dx, dy, drawW, drawH);
      ctx.restore();
    } else {
      ctx.drawImage(video, dx, dy, drawW, drawH);
    }

    if(placed){
      const img = visibleLayer();
      const imgRect = img.getBoundingClientRect();
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,.32)';
      ctx.shadowBlur = 28;
      ctx.drawImage(img, imgRect.left, imgRect.top, imgRect.width, imgRect.height);
      ctx.restore();
    }

    if(includeLogo){
      const logo = new Image();
      logo.src = 'assets/kaplanlar_logo.png';
      if(logo.complete){
        const pad = 16;
        const targetW = Math.min(180, cw * 0.28);
        const ratio = logo.height / logo.width || 0.24;
        const targetH = targetW * ratio;
        ctx.globalAlpha = .92;
        ctx.drawImage(logo, pad, pad, targetW, targetH);
        ctx.globalAlpha = 1;
      }
    }

    return { ctx, cw, ch };
  }

  function finalizePhoto(){
    captureCanvas.toBlob(blob => {
      if(!blob){ showToast('Fotoğraf oluşturulamadı'); return; }
      if(capturedObjectUrl) URL.revokeObjectURL(capturedObjectUrl);
      capturedBlob = blob;
      capturedObjectUrl = URL.createObjectURL(blob);
      capturedFileName = `kaplanlar-ar-${Date.now()}.png`;
      photoPreviewImage.src = capturedObjectUrl;
      photoPreview.classList.remove('is-hidden');
    }, 'image/png', 1);
  }

  function capturePhoto(){
    if(!placed){ showToast('Önce maskotu yerleştirin'); return; }
    renderCompositeToCanvas(true);
    finalizePhoto();
    showToast('Fotoğraf hazır');
  }

  function closePhotoPreview(){
    photoPreview.classList.add('is-hidden');
  }

  function directDownloadBlob(blob, filename){
    if(!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  }

  async function savePhotoToGallery(){
    if(!capturedBlob) return;
    directDownloadBlob(capturedBlob, capturedFileName || `kaplanlar-ar-${Date.now()}.png`);
    showToast('Fotoğraf telefona kaydediliyor');
  }

  async function sharePhoto(){
    if(!capturedBlob) return;
    const file = new File([capturedBlob], capturedFileName || 'kaplanlar-ar.png', { type:'image/png' });
    try{
      if(navigator.share && navigator.canShare && navigator.canShare({ files:[file] })){
        await navigator.share({ files:[file], title:'Kaplanlar AR Fotoğrafı', text:'Kaplanlar AR deneyimi' });
      } else {
        showToast('Bu cihazda paylaşım desteklenmiyor');
      }
    } catch(err){}
  }

  function renderRecordingFrame(){
    if(!recording) return;
    renderCompositeToCanvas(false);
    recordingRAF = requestAnimationFrame(renderRecordingFrame);
  }

  async function startRecording(){
    if(!placed){ showToast('Önce maskotu yerleştirin'); return; }

    try{
      renderCompositeToCanvas(false);
      recordingStream = captureCanvas.captureStream(24);
      recorder = new MediaRecorder(recordingStream, { mimeType: 'video/webm;codecs=vp8,opus' });
      recordingChunks = [];
      recorder.ondataavailable = e => { if(e.data && e.data.size) recordingChunks.push(e.data); };
      recorder.onstop = () => {
        if(recordingRAF) cancelAnimationFrame(recordingRAF);
        recordingRAF = null;
        recording = false;
        updateCameraButtons();

        if(!recordingChunks.length) return;
        if(recordedObjectUrl) URL.revokeObjectURL(recordedObjectUrl);
        recordedBlob = new Blob(recordingChunks, { type:'video/webm' });
        recordedObjectUrl = URL.createObjectURL(recordedBlob);
        recordedFileName = `kaplanlar-ar-video-${Date.now()}.webm`;
        videoPreviewPlayer.src = recordedObjectUrl;
        videoPreview.classList.remove('is-hidden');
        showToast('Video kaydı hazır');
      };

      recorder.start(250);
      recording = true;
      updateCameraButtons();
      renderRecordingFrame();
      showToast('Video kaydı başladı');
    } catch(err){
      recording = false;
      updateCameraButtons();
      showToast('Video kaydı başlatılamadı');
    }
  }

  function stopRecording(){
    if(recorder && recording){
      recorder.stop();
      if(recordingStream) recordingStream.getTracks().forEach(t => t.stop());
      recordingStream = null;
      showToast('Video kaydı durduruldu');
    }
  }

  function closeVideoPreview(){
    videoPreview.classList.add('is-hidden');
    try { videoPreviewPlayer.pause(); } catch(e) {}
  }

  async function saveVideo(){
    if(!recordedBlob) return;
    directDownloadBlob(recordedBlob, recordedFileName || `kaplanlar-ar-video-${Date.now()}.webm`);
    showToast('Video telefona kaydediliyor');
  }

  async function shareVideo(){
    if(!recordedBlob) return;
    const file = new File([recordedBlob], recordedFileName || 'kaplanlar-ar-video.webm', { type:'video/webm' });
    try{
      if(navigator.share && navigator.canShare && navigator.canShare({ files:[file] })){
        await navigator.share({ files:[file], title:'Kaplanlar AR Videosu', text:'Kaplanlar AR deneyimi' });
      } else {
        showToast('Bu cihazda paylaşım desteklenmiyor');
      }
    } catch(err){}
  }

  lensButtons.forEach(btn => btn.addEventListener('click', async e => {
    e.stopPropagation();
    if(btn.disabled) return;
    await setCameraZoom(Number(btn.dataset.zoom));
  }));

  cameraFlipBtn?.addEventListener('click', async e => {
    e.stopPropagation();

    if(recording){
      showToast('Kayıt sırasında kamera değiştirilemez');
      return;
    }

    cameraFacing = cameraFacing === 'environment' ? 'user' : 'environment';
    cameraZoom = 1.0;
    wideMode = false;
    currentDeviceId = cameraFacing === 'environment' ? defaultRearDeviceId : null;

    showToast(cameraFacing === 'user' ? 'Ön kamera açılıyor' : 'Arka kamera açılıyor');
    await startCamera();
  });

  photoBtn.addEventListener('click', capturePhoto);

  recordBtn.addEventListener('click', e => {
    e.stopPropagation();
    if(recording) stopRecording();
    else startRecording();
  });

  saveGalleryBtn.addEventListener('click', savePhotoToGallery);
  sharePhotoBtn.addEventListener('click', sharePhoto);
  closePreviewBtn.addEventListener('click', closePhotoPreview);
  photoPreview.addEventListener('click', e => { if(e.target === photoPreview) closePhotoPreview(); });

  saveVideoBtn.addEventListener('click', saveVideo);
  shareVideoBtn.addEventListener('click', shareVideo);
  closeVideoPreviewBtn.addEventListener('click', closeVideoPreview);
  videoPreview.addEventListener('click', e => { if(e.target === videoPreview) closeVideoPreview(); });

  arView.addEventListener('click', async e => {
    if(e.target.closest('.premium-camera-bar') || e.target.closest('.mascot-picker') || e.target.closest('.photo-preview') || e.target.closest('.error-box')) return;
    if(!placed) await placeMascot(e.clientX, e.clientY);
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

  const distance = (a,b) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  arView.addEventListener('touchstart', e => {
    if(e.touches.length === 2 && placed) pinchDistance = distance(e.touches[0], e.touches[1]);
  }, { passive:true });

  arView.addEventListener('touchmove', e => {
    if(e.touches.length === 2 && pinchDistance && placed){
      const d = distance(e.touches[0], e.touches[1]);
      setScale(scale * (d/pinchDistance));
      pinchDistance = d;
    }
  }, { passive:true });

  arView.addEventListener('touchend', () => { pinchDistance = null; }, { passive:true });

  window.addEventListener('beforeunload', () => {
    if(recording) stopRecording();
    stopCamera();
  });

  updateCameraButtons();
  loadMascotOptions();

  // V52: no service worker registration, preventing stale picker assets.
})();