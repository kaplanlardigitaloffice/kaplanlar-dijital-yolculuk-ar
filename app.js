(() => {
  const $ = s => document.querySelector(s);
  const intro = $('#intro'), arView = $('#arView'), video = $('#camera'), startBtn = $('#startBtn');
  const guide = $('#placementGuide');
  const anchor = $('#arAnchor'), mascotFrame = $('#mascotFrame');
  const mascotA = $('#mascotA'), mascotB = $('#mascotB');
  const errorBox = $('#errorBox');
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

  const cues = [
    {start:0.00,end:2.80,mood:'curious',frame:frames.curious},
    {start:2.80,end:7.20,mood:'warm',frame:frames.warm},
    {start:7.20,end:11.80,mood:'future',frame:frames.future},
    {start:11.80,end:15.70,mood:'ai',frame:frames.ai},
    {start:15.70,end:18.60,mood:'warm',frame:frames.warm},
    {start:18.60,end:24.20,mood:'invite',frame:frames.invite},
    {start:24.20,end:28.10,mood:'warm',frame:frames.warm},
    {start:28.10,end:30.00,mood:'curious',frame:frames.curious},
    {start:30.00,end:33.10,mood:'energy',frame:frames.energy}
  ];

  let stream=null, placed=false, scale=.88, drag=null, pinchDistance=null;
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
        video:{facingMode:{ideal:'environment'},width:{ideal:1920},height:{ideal:1080}}
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

  function setIdle(){
    anchor.dataset.mood='idle';
    anchor.classList.remove('is-speaking');
    crossfadeFrame(frames.idle);
  }

  function applyCue(index){
    if(index<0 || index>=cues.length || index===currentCueIndex) return;
    currentCueIndex=index;
    const cue=cues[index];
    anchor.dataset.mood=cue.mood;
    crossfadeFrame(cue.frame);
  }

  function syncNarration(){
    const t=narration.currentTime || 0;
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
    }catch(err){
      // user can tap again if blocked
    }
  }

  function startIdleLife(){
    clearTimeout(idleTimer);
    const cycle=()=>{
      if(!placed || (!narration.paused && !narration.ended)) return;
      setIdle();
      idleTimer=setTimeout(()=>{
        anchor.dataset.mood='curious';
        crossfadeFrame(frames.curious);
        idleTimer=setTimeout(()=>{
          setIdle();
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
    await playNarration(true);
  }

  function fitVideoCrop(){
    const vw = video.videoWidth || window.innerWidth;
    const vh = video.videoHeight || window.innerHeight;
    const cw = window.innerWidth;
    const ch = window.innerHeight;
    const s = Math.max(cw / vw, ch / vh);
    const drawW = vw * s, drawH = vh * s;
    return {dx:(cw-drawW)/2, dy:(ch-drawH)/2, drawW, drawH, cw, ch};
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

  async function capturePhoto(){
    if(!placed) return;
    const {dx,dy,drawW,drawH,cw,ch} = fitVideoCrop();
    captureCanvas.width = cw; captureCanvas.height = ch;
    const ctx = captureCanvas.getContext('2d');
    ctx.drawImage(video, dx, dy, drawW, drawH);

    const anchorRect = anchor.getBoundingClientRect();
    const img = getVisibleLayer();
    const imgRect = img.getBoundingClientRect();

    // draw mascot shadow + mascot
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.34)';
    ctx.shadowBlur = 28;
    ctx.drawImage(img, imgRect.left, imgRect.top, imgRect.width, imgRect.height);
    ctx.restore();

    // floor ring
    ctx.strokeStyle = 'rgba(211,18,47,0.85)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(anchorRect.left + anchorRect.width/2, anchorRect.top + anchorRect.height*0.82, anchorRect.width*0.22, anchorRect.height*0.03, 0, 0, Math.PI*2);
    ctx.stroke();

    // small top-right transparent logo in photo
    const logo = new Image();
    logo.onload = () => {
      const pad = 16;
      const targetW = Math.min(180, cw*0.28);
      const ratio = logo.height / logo.width;
      const targetH = targetW * ratio;
      ctx.globalAlpha = 0.92;
      ctx.drawImage(logo, cw-targetW-pad, pad, targetW, targetH);
      ctx.globalAlpha = 1;
      const link = document.createElement('a');
      link.download = `kaplanlar-ar-${Date.now()}.png`;
      link.href = captureCanvas.toDataURL('image/png');
      link.click();
    };
    logo.src='assets/kaplanlar_logo.png';
  }

  startBtn.addEventListener('click',async()=>{
    await unlockAudio();
    intro.classList.add('is-hidden');
    arView.classList.remove('is-hidden');
    await startCamera();
  });

  // Tap top-right logo to replay narration, double tap to capture photo.
  const logoEl = document.querySelector('.floating-logo');
  let lastTap=0;
  logoEl?.addEventListener('click', async()=>{
    const now=Date.now();
    if(now-lastTap<320){
      await capturePhoto();
      lastTap=0;
      return;
    }
    lastTap=now;
    await unlockAudio();
    if(placed) await playNarration(true);
  });

  arView.addEventListener('click',async e=>{
    if(e.target.closest('.floating-logo')||e.target.closest('.error-box')) return;
    if(!placed) await placeMascot(e.clientX,e.clientY-24);
  });

  narration.addEventListener('timeupdate',syncNarration);
  narration.addEventListener('pause',()=>{ if(placed && !narration.ended){ anchor.classList.remove('is-speaking'); startIdleLife(); } });
  narration.addEventListener('ended',()=>{ currentCueIndex=-1; setIdle(); startIdleLife(); });

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
})();