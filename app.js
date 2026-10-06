(() => {
  const $ = s => document.querySelector(s);

  const intro = $('#intro'), arView = $('#arView');
  const introOverlay = $('#introOverlay'), introBanner = $('#introBanner'), launchVideo = $('#launchVideo'), videoShade = $('.video-shade');
  const videoStartBtn = $('#videoStartBtn'), videoFallbackPlay = $('#videoFallbackPlay'), introPlayStatus = $('#introPlayStatus'), enterArPanel = $('#enterArPanel'), enterArBtn = $('#enterArBtn');

  const video = $('#camera');
  const guide = $('#placementGuide'), anchor = $('#arAnchor');
  const mascotA = $('#mascotA'), mascotB = $('#mascotB');
  const photoBtn = $('#photoBtn'), recordBtn = $('#recordBtn');
  const lens05Btn = $('#lens05Btn'), lens1Btn = $('#lens1Btn'), lens15Btn = $('#lens15Btn'), lens2Btn = $('#lens2Btn');
  const lensButtons = [lens05Btn, lens1Btn, lens15Btn, lens2Btn].filter(Boolean);
  const resizeHint = $('#resizeHint');
  const errorBox = $('#errorBox'), toast = $('#toast');
  const captureCanvas = $('#captureCanvas');

  const photoPreview = $('#photoPreview'), photoPreviewImage = $('#photoPreviewImage');
  const saveGalleryBtn = $('#saveGalleryBtn'), sharePhotoBtn = $('#sharePhotoBtn'), closePreviewBtn = $('#closePreviewBtn'), saveHint = $('#saveHint');

  const videoPreview = $('#videoPreview'), videoPreviewPlayer = $('#videoPreviewPlayer');
  const saveVideoBtn = $('#saveVideoBtn'), shareVideoBtn = $('#shareVideoBtn'), closeVideoPreviewBtn = $('#closeVideoPreviewBtn'), videoSaveHint = $('#videoSaveHint');

  const frame = n => `assets/frame_${String(n).padStart(2,'0')}.png`;
  const groups = {
    invite:[frame(7),frame(8),frame(9),frame(10),frame(11),frame(12)],
    calm:[frame(19),frame(20),frame(21),frame(22),frame(23),frame(24)]
  };

  let stream = null, cameraTrack = null, placed = false, scale = 1.12, drag = null, pinchDistance = null;
  let activeLayer = 'A', shotTimers = [], quietTimer = null;

  let capturedBlob = null, capturedObjectUrl = null, capturedFileName = '';
  let recordedBlob = null, recordedObjectUrl = null, recordedFileName = '';

  let currentDeviceId = null, defaultRearDeviceId = null, wideRearDeviceId = null;
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
    crossfadeFrame(groups.calm[0]);

    const idleCycle = () => {
      if(!placed) return;
      quietTimer = setTimeout(() => {
        crossfadeFrame(groups.calm[1]);
        quietTimer = setTimeout(() => {
          crossfadeFrame(groups.calm[0]);
          quietTimer = setTimeout(() => {
            crossfadeFrame(groups.calm[2]);
            quietTimer = setTimeout(() => {
              crossfadeFrame(groups.calm[0]);
              quietTimer = setTimeout(idleCycle, 7600);
            }, 1500);
          }, 6000);
        }, 1200);
      }, 5200);
    };
    idleCycle();
  }

  function updateCameraButtons(){
    lensButtons.forEach(btn => {
      const z = Number(btn.dataset.zoom || 1);
      btn.classList.toggle('is-active', Math.abs(z - cameraZoom) < 0.06);
      if(z === 0.5){
        btn.classList.toggle('is-hidden', !wideRearDeviceId);
        btn.disabled = !wideRearDeviceId;
      } else {
        btn.disabled = false;
      }
    });

    recordBtn.classList.toggle('is-recording', recording);
    recordBtn.querySelector('.record-label').textContent = recording ? 'Durdur' : 'Kayıt';
    recordBtn.setAttribute('aria-label', recording ? 'Video kaydını durdur' : 'Video kaydı başlat');
  }

  function applyDigitalCameraZoom(){
    video.style.transformOrigin = 'center center';
    video.style.transform = `scale(${cameraZoom >= 1 ? cameraZoom : 1})`;
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
      if(currentDeviceId) videoConstraints.deviceId = { exact: currentDeviceId };
      else videoConstraints.facingMode = { ideal:'environment' };

      stream = await navigator.mediaDevices.getUserMedia({ audio:false, video: videoConstraints });
      video.srcObject = stream;
      await video.play();
      errorBox.classList.add('is-hidden');

      await discoverVideoDevices();
      await refreshTrackCapabilities();

      if(wideMode && !wideRearDeviceId){
        wideMode = false;
        cameraZoom = 1.0;
        applyDigitalCameraZoom();
      }
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
    await startCamera();
  }

  let launchStarting = false;

  function setIntroPlayStatus(message=''){
    if(!introPlayStatus) return;
    introPlayStatus.textContent = message;
    introPlayStatus.classList.toggle('is-hidden', !message);
  }

  function showVideoScreen(){
    introOverlay?.classList.add('is-hidden');
    introBanner?.classList.add('is-hidden');
    videoShade?.classList.add('is-playing');
    videoFallbackPlay?.classList.add('is-hidden');
  }

  async function startLaunchExperience(){
    if(launchStarting) return;
    launchStarting = true;

    try{
      // Immediate UI transition from the user click.
      showVideoScreen();

      launchVideo.controls = false;
      launchVideo.currentTime = 0;
      launchVideo.playsInline = true;

      // Explicit click should allow audible playback on most mobile browsers.
      try{
        launchVideo.muted = false;
        launchVideo.volume = 1;
        await launchVideo.play();
      }catch(err){
        // Strong fallback: muted video is broadly allowed.
        launchVideo.muted = true;
        try{
          await launchVideo.play();
        }catch(err2){
          // Final fallback: native controls + direct play button.
          launchVideo.controls = true;
          videoFallbackPlay?.classList.remove('is-hidden');
        }
      }
    }finally{
      launchStarting = false;
    }
  }

  async function fallbackPlay(){
    try{
      launchVideo.muted = false;
      await launchVideo.play();
      launchVideo.controls = false;
      videoFallbackPlay?.classList.add('is-hidden');
    }catch(err){
      launchVideo.muted = true;
      try{
        await launchVideo.play();
        launchVideo.controls = false;
        videoFallbackPlay?.classList.add('is-hidden');
      }catch(err2){
        launchVideo.controls = true;
      }
    }
  }

  // Plain click is the most compatible event across iOS Safari, Android Chrome and desktop.
  // V46: launch button is handled by dependency-free inline controller in index.html.
  // V46: fallback button is handled by dependency-free inline controller in index.html.

  launchVideo.addEventListener('playing', () => {
    videoFallbackPlay?.classList.add('is-hidden');
  });

  launchVideo.addEventListener('error', () => {
    showVideoScreen();
    launchVideo.controls = true;
    videoFallbackPlay?.classList.remove('is-hidden');
  });

  launchVideo.addEventListener('ended', () => {
    enterArPanel.classList.remove('is-hidden');
    requestAnimationFrame(() => enterArPanel.classList.add('is-ready'));
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

    resizeHint?.classList.remove('is-hidden');
    clearTimeout(placeMascot._hintTimer);
    placeMascot._hintTimer = setTimeout(() => resizeHint?.classList.add('is-hidden'), 2600);

    anchor.dataset.mood = 'invite';
    playShots([frame(7), frame(12)], 4800);
    setTimeout(() => startQuietLife(), 5200);
  }

  function setScale(nextScale){
    scale = Math.min(1.48, Math.max(.68, nextScale));
    anchor.style.setProperty('--scale', scale.toFixed(2));
  }

  async function setCameraZoom(nextZoom){
    const target = Number(nextZoom);

    if(target === 0.5){
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
      video.style.transform = 'scale(1)';
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
      video.style.transform = 'scale(1)';
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
    ctx.drawImage(video, dx, dy, drawW, drawH);

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
      hideHint(saveHint);
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

  function platformFamily(){
    const ua = navigator.userAgent || '';
    const isIOS = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isAndroid = /Android/i.test(ua);
    return { isIOS, isAndroid };
  }

  async function shareFileForGallery(file, hintEl, kind='image'){
    const {isIOS, isAndroid} = platformFamily();
    if(navigator.share && navigator.canShare && navigator.canShare({files:[file]})){
      await navigator.share({files:[file], title: kind === 'image' ? 'Kaplanlar AR Fotoğrafı' : 'Kaplanlar AR Videosu'});
      if(isIOS){
        setHint(hintEl, kind === 'image'
          ? 'iPhone/iPad: paylaşım menüsünden “Görüntüyü Kaydet” seçin.'
          : 'iPhone/iPad: paylaşım menüsünden “Videoyu Kaydet” seçin.');
      }else if(isAndroid){
        setHint(hintEl, kind === 'image'
          ? 'Android: paylaşım menüsünden Google Fotoğraflar / Galeri uygulamasını seçin.'
          : 'Android: paylaşım menüsünden Google Fotoğraflar / Galeri uygulamasını seçin.');
      }else{
        setHint(hintEl, 'Açılan sistem menüsünden cihazına kaydetme seçeneğini kullan.');
      }
      return true;
    }
    return false;
  }

  async function savePhotoToGallery(){
    if(!capturedBlob) return;

    const file = new File(
      [capturedBlob],
      capturedFileName || 'kaplanlar-ar.png',
      { type:'image/png' }
    );

    const { isIOS, isAndroid } = platformFamily();

    try{
      // Mobile-first: the only cross-platform web route that can hand the image
      // to Photos/Gallery is the native share sheet.
      if(navigator.share && navigator.canShare && navigator.canShare({files:[file]})){
        await navigator.share({
          files:[file],
          title:'Kaplanlar AR Fotoğrafı'
        });

        if(isIOS){
          setHint(saveHint, 'iPhone/iPad: açılan menüden “Görüntüyü Kaydet” seçin.');
        }else if(isAndroid){
          setHint(saveHint, 'Android: açılan menüden Google Fotoğraflar / Galeri uygulamasını seçin.');
        }else{
          setHint(saveHint, 'Açılan sistem menüsünden cihazına kaydetme seçeneğini kullanın.');
        }
        return;
      }

      // Fallback for browsers that cannot share files:
      // open the generated image in its own page so the user can long-press/save.
      if(isIOS || isAndroid){
        const url = capturedObjectUrl || URL.createObjectURL(capturedBlob);
        const opened = window.open(url, '_blank', 'noopener,noreferrer');
        if(opened){
          setHint(
            saveHint,
            isIOS
              ? 'Yeni açılan fotoğrafa basılı tutup “Fotoğraflara Kaydet” seçin.'
              : 'Yeni açılan fotoğrafa basılı tutup “Görseli indir / Kaydet” seçin.'
          );
          return;
        }
      }

      // Desktop fallback
      const url = URL.createObjectURL(capturedBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = capturedFileName || 'kaplanlar-ar.png';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      setHint(saveHint, 'Fotoğraf cihazına indirildi.');
    }catch(err){
      if(err && err.name !== 'AbortError'){
        setHint(saveHint, 'Kaydetme açılamadı. Paylaş butonunu kullanarak Fotoğraflar / Galeri seçin.');
      }
    }
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
        hideHint(videoSaveHint);
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
    const file = new File([recordedBlob], recordedFileName || 'kaplanlar-ar-video.webm', { type:'video/webm' });
    try{
      const shared = await shareFileForGallery(file, videoSaveHint, 'video');
      if(shared) return;

      const url = recordedObjectUrl || URL.createObjectURL(recordedBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = recordedFileName || 'kaplanlar-ar-video.webm';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setHint(videoSaveHint, 'Video indirildi. Mobil tarayıcı galeriye doğrudan yazmayı desteklemiyor.');
    }catch(err){
      if(err && err.name !== 'AbortError') setHint(videoSaveHint, 'Kaydetme menüsü açılamadı.');
    }
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
    if(e.target.closest('.premium-camera-bar') || e.target.closest('.photo-preview') || e.target.closest('.error-box')) return;
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

  // V45: service worker registration intentionally disabled to avoid stale launch assets during rollout.
})();