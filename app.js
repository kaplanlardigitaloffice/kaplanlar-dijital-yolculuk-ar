(() => {
  const $ = s => document.querySelector(s);
  const intro = $('#intro'), arView = $('#arView'), video = $('#camera'), startBtn = $('#startBtn');
  const flipBtn = $('#flipBtn'), resetBtn = $('#resetBtn'), audioBtn = $('#audioBtn'), photoBtn = $('#photoBtn'), guide = $('#placementGuide');
  const anchor = $('#arAnchor'), mascotFrame = $('#mascotFrame');
  const mascotA = $('#mascotA'), mascotB = $('#mascotB');
  const errorBox = $('#errorBox'), progressBar = $('#progressBar');
  const captionLabel = $('#captionLabel'), captionStatus = $('#captionStatus'), captionText = $('#captionText');
  const narration = $('#narration');
  const captureCanvas = $('#captureCanvas');

  const frames = {
    idle:'assets/mascot_idle.png',
    curious:'assets/mascot_curious.png',
    warm:'assets/mascot_warm.png',
    future:'assets/mascot_future.png',
    ai:'assets/mascot_ai.png',
    invite:'assets/mascot_invite.png',
    energy:'assets/mascot_energetic.png'
  };

  // Refined script sync tuned to the provided voice-over.
  const cues = [
    {start:0.00,end:2.80,mood:'curious',frame:frames.curious,label:'Merak uyandıran giriş',text:'Bir şeyler değişiyor…'},
    {start:2.80,end:7.20,mood:'warm',frame:frames.warm,label:'Samimi karşılama',text:'Ve bu değişimin parçası olmak için… yerin çoktan hazır.'},
    {start:7.20,end:11.80,mood:'future',frame:frames.future,label:'Yeni yetkinlikler',text:'Yeni fikirler… Yeni yetkinlikler… Yeni bir çalışma biçimi…'},
    {start:11.80,end:15.70,mood:'ai',frame:frames.ai,label:'Yapay zekâ odağı',text:'Yapay zekâyla birlikte yepyeni bir yolculuğa çıkıyoruz.'},
    {start:15.70,end:18.60,mood:'warm',frame:frames.warm,label:'İnsan odağı',text:'Ama bu yolculuk… sensiz eksik.'},
    {start:18.60,end:24.20,mood:'invite',frame:frames.invite,label:'Davet',text:'8 Eylül Perşembe günü, Kaplanlar’ın dijital dönüşüm yolculuğunda sen de yerini al.'},
    {start:24.20,end:28.10,mood:'warm',frame:frames.warm,label:'Birlikte keşif',text:'Merakını yanına al. Gerisini… birlikte keşfedeceğiz.'},
    {start:28.10,end:30.00,mood:'curious',frame:frames.curious,label:'Hazırlık çağrısı',text:'Hazır mısın?'},
    {start:30.00,end:33.10,mood:'energy',frame:frames.energy,label:'Kapanış',text:'Çünkü… yolculuk başlıyor.'}
  ];

  let stream=null, facingMode='environment', placed=false, scale=.88, drag=null, pinchDistance=null;
  let currentCueIndex=-1, activeLayer='A', audioUnlocked=false, idleTimer=null;

  Object.values(frames).forEach(src=>{ const img=new Image(); img.src=src; });

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
      stream=await navigator.mediaDevices.getUserMedia({
        audio:false,
        video:{facingMode:{ideal:facingMode},width:{ideal:1920},height:{ideal:1080}}
      });
      video.srcObject=stream;
      await video.play();
      errorBox.classList.add('is-hidden');
    }catch(err){
      errorBox.innerHTML='<b>Kamera açılamadı.</b><br>HTTPS bağlantısını ve kamera iznini kontrol edin.';
      errorBox.classList.remove('is-hidden');
    }
  }

  function stopCamera(){ if(stream) stream.getTracks().forEach(t=>t.stop()); stream=null; }
  function setAnchorPosition(x,y){ anchor.style.left=`${x}px`; anchor.style.top=`${y}px`; }

  function getActiveLayer(){ return activeLayer==='A' ? mascotB : mascotA; }
  function getVisibleLayer(){ return activeLayer==='A' ? mascotA : mascotB; }

  function crossfadeFrame(src){
    const incoming = activeLayer==='A' ? mascotB : mascotA;
    const outgoing = activeLayer==='A' ? mascotA : mascotB;
    if(outgoing.getAttribute('src')===src && outgoing.classList.contains('is-active')) return;
    incoming.src=src;
    requestAnimationFrame(()=>{
      incoming.classList.add('is-active');
      outgoing.classList.remove('is-active');
      activeLayer = activeLayer==='A' ? 'B' : 'A';
    });
  }

  function setIdle(message='Yolculuk başlıyor.'){
    anchor.dataset.mood='idle';
    anchor.classList.remove('is-speaking');
    crossfadeFrame(frames.idle);
    captionLabel.textContent='Canlı bekleme modu';
    captionStatus.textContent='Hazır';
    captionText.textContent=message;
  }

  function applyCue(index){
    if(index<0 || index>=cues.length || index===currentCueIndex) return;
    currentCueIndex=index;
    const cue=cues[index];
    anchor.dataset.mood=cue.mood;
    crossfadeFrame(cue.frame);
    captionLabel.textContent=cue.label;
    captionStatus.textContent='Sesli anlatım oynuyor';
    captionText.textContent=cue.text;
  }

  function syncNarration(){
    const duration=narration.duration || 33.05;
    const t=narration.currentTime || 0;
    progressBar.style.width=`${Math.min(100,(t/duration)*100)}%`;
    const idx=cues.findIndex(c=>t>=c.start && t<c.end);
    if(idx>=0){
      applyCue(idx);
      anchor.classList.add('is-speaking');
    } else {
      anchor.classList.remove('is-speaking');
    }
  }

  async function playNarration(fromStart=false){
    if(!placed) return;
    clearTimeout(idleTimer);
    try{
      if(fromStart){ narration.currentTime=0; currentCueIndex=-1; }
      narration.volume=1;
      await narration.play();
      updateAudioButton();
      captionStatus.textContent='Sesli anlatım oynuyor';
      photoBtn.classList.remove('flash');
    }catch(err){
      captionStatus.textContent='Sesi başlatmak için dokunun';
      captionText.textContent='Tarayıcı sesi engelledi. Üstteki “Tanıtımı Oynat” düğmesine bir kez dokunun.';
      audioBtn.classList.add('needs-tap');
    }
  }

  function pauseNarration(){
    narration.pause();
    anchor.classList.remove('is-speaking');
    updateAudioButton();
  }

  function updateAudioButton(){
    const playing=!narration.paused && !narration.ended;
    audioBtn.classList.toggle('is-playing',playing);
    audioBtn.classList.remove('needs-tap');
    audioBtn.textContent=playing?'Tanıtımı Durdur':'Tanıtımı Oynat';
  }

  function startIdleLife(){
    clearTimeout(idleTimer);
    const cycle=()=>{
      if(!placed || (!narration.paused && !narration.ended)) return;
      setIdle();
      idleTimer=setTimeout(()=>{
        anchor.dataset.mood='curious';
        crossfadeFrame(frames.curious);
        captionLabel.textContent='Canlı bekleme modu';
        captionStatus.textContent='Hazır';
        captionText.textContent='Kaplanlar Dijital Dönüşüm Yolculuğu';
        idleTimer=setTimeout(()=>{
          setIdle('Kaplanlar Dijital Dönüşüm Yolculuğu');
          idleTimer=setTimeout(cycle,3800);
        },2400);
      },4200);
    };
    cycle();
  }

  async function placeMascot(x,y){
    if(placed) return;
    placed=true;
    guide.classList.add('is-hidden');
    setAnchorPosition(x,y);
    anchor.classList.remove('is-hidden');
    anchor.classList.add('is-placed');
    anchor.style.setProperty('--scale',scale);
    captionLabel.textContent='Tanıtım hazırlanıyor';
    captionStatus.textContent='Başlatılıyor';
    captionText.textContent='Kaplanlar Dijital Dönüşüm Yolculuğu';
    await playNarration(true);
  }

  function resetScene(){
    narration.pause();
    narration.currentTime=0;
    currentCueIndex=-1;
    progressBar.style.width='0%';
    clearTimeout(idleTimer);
    placed=false;
    anchor.classList.add('is-hidden');
    anchor.classList.remove('is-placed','is-speaking');
    guide.classList.remove('is-hidden');
    scale=.88;
    anchor.style.setProperty('--scale',scale);
    anchor.style.left='50%';
    anchor.style.top='58%';
    captionLabel.textContent='Deneyim hazır';
    captionStatus.textContent='Yerleştirme bekleniyor';
    captionText.textContent='Maskotu yerleştirin.';
    updateAudioButton();
  }

  function fitVideoCrop(){
    const vw = video.videoWidth || window.innerWidth;
    const vh = video.videoHeight || window.innerHeight;
    const cw = window.innerWidth;
    const ch = window.innerHeight;
    const scale = Math.max(cw / vw, ch / vh);
    const drawW = vw * scale;
    const drawH = vh * scale;
    const dx = (cw - drawW) / 2;
    const dy = (ch - drawH) / 2;
    return {dx,dy,drawW,drawH,cw,ch};
  }

  async function capturePhoto(){
    if(!placed){
      captionStatus.textContent='Fotoğraf için maskotu yerleştirin';
      return;
    }
    const {dx,dy,drawW,drawH,cw,ch} = fitVideoCrop();
    captureCanvas.width = cw;
    captureCanvas.height = ch;
    const ctx = captureCanvas.getContext('2d');

    // background video
    ctx.drawImage(video, dx, dy, drawW, drawH);

    // subtle top/bottom overlay like UI scene
    const gradTop = ctx.createLinearGradient(0,0,0,ch*0.25);
    gradTop.addColorStop(0,'rgba(4,6,10,0.45)');
    gradTop.addColorStop(1,'rgba(4,6,10,0)');
    ctx.fillStyle = gradTop; ctx.fillRect(0,0,cw,ch*0.25);
    const gradBottom = ctx.createLinearGradient(0,ch*0.7,0,ch);
    gradBottom.addColorStop(0,'rgba(4,6,10,0)');
    gradBottom.addColorStop(1,'rgba(4,6,10,0.55)');
    ctx.fillStyle = gradBottom; ctx.fillRect(0,ch*0.7,cw,ch*0.3);

    // draw mascot/title capture based on DOM layout
    const anchorRect = anchor.getBoundingClientRect();
    const frameRect = mascotFrame.getBoundingClientRect();
    const visible = getVisibleLayer();
    const img = visible;
    const imgRect = visible.getBoundingClientRect();

    // title card
    const title = anchor.querySelector('.holo-title');
    const titleRect = title.getBoundingClientRect();
    ctx.fillStyle = 'rgba(8,11,15,0.90)';
    roundRect(ctx, titleRect.left, titleRect.top, titleRect.width, titleRect.height, 6, true, false);
    ctx.fillStyle = '#d3122f';
    ctx.fillRect(titleRect.left, titleRect.top, 3, titleRect.height);
    ctx.strokeStyle = 'rgba(40,49,64,1)';
    roundRect(ctx, titleRect.left, titleRect.top, titleRect.width, titleRect.height, 6, false, true);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#8895a5';
    ctx.font = '600 10px Inter, Arial';
    ctx.fillText('KAPLANLAR', titleRect.left + titleRect.width/2, titleRect.top + 16);
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 24px Inter, Arial';
    ctx.fillText('Dijital Dönüşüm Yolculuğu', titleRect.left + titleRect.width/2, titleRect.top + 42);
    ctx.fillStyle = '#6d7888';
    ctx.font = '500 10px Inter, Arial';
    ctx.fillText('AI LANSMAN AR DENEYİMİ', titleRect.left + titleRect.width/2, titleRect.top + 58);

    // floor ring
    ctx.strokeStyle = 'rgba(211,18,47,0.85)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(anchorRect.left + anchorRect.width/2, anchorRect.top + anchorRect.height*0.82, anchorRect.width*0.22, anchorRect.height*0.03, 0, 0, Math.PI*2);
    ctx.stroke();

    // mascot shadow
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.34)';
    ctx.shadowBlur = 28;
    ctx.drawImage(img, imgRect.left, imgRect.top, imgRect.width, imgRect.height);
    ctx.restore();

    // voice orb if speaking/ai
    if(anchor.classList.contains('is-speaking')){
      const orbX = anchorRect.left + anchorRect.width*0.78;
      const orbY = anchorRect.top + anchorRect.height*0.22;
      const g = ctx.createRadialGradient(orbX, orbY, 2, orbX, orbY, 34);
      g.addColorStop(0,'rgba(197,244,255,1)');
      g.addColorStop(.18,'rgba(125,199,255,.95)');
      g.addColorStop(.52,'rgba(86,131,255,.38)');
      g.addColorStop(1,'rgba(86,131,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(orbX, orbY, 34, 0, Math.PI*2); ctx.fill();
    }

    // bottom caption simplified
    ctx.fillStyle='rgba(8,11,15,.88)';
    roundRect(ctx, 16, ch-118, cw-32, 92, 8, true, false);
    ctx.strokeStyle='rgba(38,48,60,1)';
    roundRect(ctx, 16, ch-118, cw-32, 92, 8, false, true);
    ctx.fillStyle='#8895a5'; ctx.font='600 10px Inter, Arial';
    ctx.fillText(captionLabel.textContent || 'Kaplanlar', cw/2, ch-92);
    ctx.fillStyle='#fff'; ctx.font='500 18px Inter, Arial';
    wrapText(ctx, captionText.textContent || 'Kaplanlar Dijital Dönüşüm Yolculuğu', 34, ch-66, cw-68, 24);

    const link = document.createElement('a');
    link.download = `kaplanlar-ar-${Date.now()}.png`;
    link.href = captureCanvas.toDataURL('image/png');
    link.click();
    photoBtn.classList.add('flash');
    setTimeout(()=>photoBtn.classList.remove('flash'), 700);
    captionStatus.textContent = 'Fotoğraf indirildi';
  }

  function roundRect(ctx, x, y, width, height, radius, fill, stroke) {
    if (typeof radius === 'number') radius = {tl: radius, tr: radius, br: radius, bl: radius};
    ctx.beginPath();
    ctx.moveTo(x + radius.tl, y);
    ctx.lineTo(x + width - radius.tr, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius.tr);
    ctx.lineTo(x + width, y + height - radius.br);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius.br, y + height);
    ctx.lineTo(x + radius.bl, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius.bl);
    ctx.lineTo(x, y + radius.tl);
    ctx.quadraticCurveTo(x, y, x + radius.tl, y);
    ctx.closePath();
    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
  }

  function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = text.split(' ');
    let line = '';
    let yy = y;
    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && n > 0) {
        ctx.fillText(line.trim(), x + maxWidth/2, yy);
        line = words[n] + ' ';
        yy += lineHeight;
      } else line = testLine;
    }
    ctx.fillText(line.trim(), x + maxWidth/2, yy);
  }

  startBtn.addEventListener('click',async()=>{
    await unlockAudio();
    intro.classList.add('is-hidden');
    arView.classList.remove('is-hidden');
    await startCamera();
  });

  flipBtn.addEventListener('click',async()=>{ facingMode=facingMode==='environment'?'user':'environment'; await startCamera(); });
  resetBtn.addEventListener('click',resetScene);
  photoBtn.addEventListener('click',capturePhoto);

  audioBtn.addEventListener('click',async()=>{
    await unlockAudio();
    if(!placed){ captionText.textContent='Önce maskotu yerleştirin.'; return; }
    if(narration.paused || narration.ended){
      await playNarration(narration.ended || narration.currentTime<.2);
    } else pauseNarration();
  });

  arView.addEventListener('click',async e=>{
    if(e.target.closest('button')||e.target.closest('.caption-panel')||e.target.closest('.error-box')) return;
    if(!placed) await placeMascot(e.clientX,e.clientY-24);
  });

  narration.addEventListener('timeupdate',syncNarration);
  narration.addEventListener('play',()=>{ updateAudioButton(); clearTimeout(idleTimer); captionStatus.textContent='Sesli anlatım oynuyor'; });
  narration.addEventListener('pause',()=>{ updateAudioButton(); if(placed && !narration.ended){ anchor.classList.remove('is-speaking'); captionStatus.textContent='Duraklatıldı'; startIdleLife(); } });
  narration.addEventListener('ended',()=>{ progressBar.style.width='100%'; currentCueIndex=-1; setIdle('Yolculuk başlıyor.'); captionLabel.textContent='Anlatım tamamlandı'; captionStatus.textContent='Canlı bekleme modu'; updateAudioButton(); startIdleLife(); });

  anchor.addEventListener('pointerdown',e=>{
    anchor.setPointerCapture?.(e.pointerId);
    const r=anchor.getBoundingClientRect();
    drag={dx:e.clientX-(r.left+r.width/2),dy:e.clientY-(r.top+r.height/2),id:e.pointerId};
  });
  anchor.addEventListener('pointermove',e=>{ if(!drag||drag.id!==e.pointerId) return; setAnchorPosition(e.clientX-drag.dx,e.clientY-drag.dy); });
  const endDrag=e=>{ if(drag&&drag.id===e.pointerId) drag=null; };
  anchor.addEventListener('pointerup',endDrag); anchor.addEventListener('pointercancel',endDrag);

  const distance=(a,b)=>Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY);
  arView.addEventListener('touchstart',e=>{ if(e.touches.length===2&&placed) pinchDistance=distance(e.touches[0],e.touches[1]); },{passive:true});
  arView.addEventListener('touchmove',e=>{ if(e.touches.length===2&&pinchDistance&&placed){ const d=distance(e.touches[0],e.touches[1]); scale=Math.min(1.75,Math.max(.56,scale*(d/pinchDistance))); anchor.style.setProperty('--scale',scale.toFixed(3)); pinchDistance=d; } },{passive:true});
  arView.addEventListener('touchend',()=>{pinchDistance=null;},{passive:true});

  window.addEventListener('beforeunload',stopCamera);
  if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});
  updateAudioButton();
})();