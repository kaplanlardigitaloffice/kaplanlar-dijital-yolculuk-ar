(() => {
  const $ = s => document.querySelector(s);
  const intro = $('#intro'), arView = $('#arView'), video = $('#camera'), startBtn = $('#startBtn');
  const flipBtn = $('#flipBtn'), resetBtn = $('#resetBtn'), audioBtn = $('#audioBtn'), guide = $('#placementGuide');
  const anchor = $('#arAnchor'), mascotFrame = $('#mascotFrame');
  const mascotA = $('#mascotA'), mascotB = $('#mascotB');
  const errorBox = $('#errorBox'), progressBar = $('#progressBar');
  const captionLabel = $('#captionLabel'), captionStatus = $('#captionStatus'), captionText = $('#captionText');
  const narration = $('#narration');

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
    {start:0.0,end:3.8,mood:'curious',frame:frames.curious,label:'Merak uyandıran giriş',text:'Bir şeyler değişiyor…'},
    {start:3.8,end:7.7,mood:'warm',frame:frames.warm,label:'İnsan odaklı yaklaşım',text:'Ve bu değişimin parçası olmak için… yerin çoktan hazır.'},
    {start:7.7,end:11.9,mood:'future',frame:frames.future,label:'Yeni yetkinlikler',text:'Yeni fikirler… Yeni yetkinlikler… Yeni bir çalışma biçimi…'},
    {start:11.9,end:15.9,mood:'ai',frame:frames.ai,label:'Yapay zekâ odağı',text:'Yapay zekâyla birlikte yepyeni bir yolculuğa çıkıyoruz.'},
    {start:15.9,end:18.9,mood:'warm',frame:frames.warm,label:'İnsan odağı',text:'Ama bu yolculuk… sensiz eksik.'},
    {start:18.9,end:23.9,mood:'invite',frame:frames.invite,label:'Etkinlik daveti',text:'8 Eylül Perşembe günü, Kaplanlar’ın dijital dönüşüm yolculuğunda sen de yerini al.'},
    {start:23.9,end:27.9,mood:'future',frame:frames.future,label:'Birlikte keşif',text:'Merakını yanına al. Gerisini… birlikte keşfedeceğiz.'},
    {start:27.9,end:30.2,mood:'curious',frame:frames.curious,label:'Hazırlık çağrısı',text:'Hazır mısın?'},
    {start:30.2,end:33.1,mood:'energy',frame:frames.energy,label:'Kapanış',text:'Çünkü… yolculuk başlıyor.'}
  ];

  let stream=null, facingMode='environment', placed=false, scale=.88, drag=null, pinchDistance=null;
  let currentCueIndex=-1, activeLayer='A', audioUnlocked=false, idleTimer=null;

  Object.values(frames).forEach(src=>{ const img=new Image(); img.src=src; });

  async function unlockAudio(){
    if(audioUnlocked) return;
    try{
      narration.volume = 0;
      narration.currentTime = 0;
      await narration.play();
      narration.pause();
      narration.currentTime = 0;
      narration.volume = 1;
      audioUnlocked = true;
    }catch(e){
      narration.volume = 1;
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

  function stopCamera(){
    if(stream) stream.getTracks().forEach(t=>t.stop());
    stream=null;
  }

  function setAnchorPosition(x,y){
    anchor.style.left=`${x}px`;
    anchor.style.top=`${y}px`;
  }

  function crossfadeFrame(src){
    const incoming = activeLayer==='A' ? mascotB : mascotA;
    const outgoing = activeLayer==='A' ? mascotA : mascotB;
    if(incoming.getAttribute('src')===src && incoming.classList.contains('is-active')) return;

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
    }else{
      anchor.classList.remove('is-speaking');
    }
  }

  async function playNarration(fromStart=false){
    if(!placed) return;
    try{
      if(fromStart){
        narration.currentTime=0;
        currentCueIndex=-1;
      }
      narration.volume=1;
      await narration.play();
      updateAudioButton();
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
        idleTimer=setTimeout(()=>{
          setIdle();
          idleTimer=setTimeout(cycle,3200);
        },2200);
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
    captionStatus.textContent='Başlatılıyor';
    captionText.textContent='Kaplanlar Dijital Dönüşüm Yolculuğu';
    // This click is a direct user gesture: start sound here.
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
    setIdle();
    captionLabel.textContent='Deneyim hazır';
    captionStatus.textContent='Yerleştirme bekleniyor';
    captionText.textContent='Maskotu yerleştirin.';
    updateAudioButton();
  }

  startBtn.addEventListener('click',async()=>{
    // Explicitly unlock sound from the first user gesture.
    await unlockAudio();
    intro.classList.add('is-hidden');
    arView.classList.remove('is-hidden');
    await startCamera();
  });

  flipBtn.addEventListener('click',async()=>{
    facingMode=facingMode==='environment'?'user':'environment';
    await startCamera();
  });

  resetBtn.addEventListener('click',resetScene);

  audioBtn.addEventListener('click',async()=>{
    await unlockAudio();
    if(!placed){
      captionText.textContent='Önce maskotu yerleştirin.';
      return;
    }
    if(narration.paused || narration.ended){
      await playNarration(narration.ended || narration.currentTime<.2);
    }else{
      pauseNarration();
    }
  });

  arView.addEventListener('click',async e=>{
    if(e.target.closest('button')||e.target.closest('.caption-panel')||e.target.closest('.error-box')) return;
    if(!placed) await placeMascot(e.clientX,e.clientY-24);
  });

  narration.addEventListener('timeupdate',syncNarration);
  narration.addEventListener('play',()=>{
    updateAudioButton();
    captionStatus.textContent='Sesli anlatım oynuyor';
    clearTimeout(idleTimer);
  });
  narration.addEventListener('pause',()=>{
    updateAudioButton();
    if(placed && !narration.ended){
      anchor.classList.remove('is-speaking');
      captionStatus.textContent='Duraklatıldı';
      startIdleLife();
    }
  });
  narration.addEventListener('ended',()=>{
    progressBar.style.width='100%';
    currentCueIndex=-1;
    setIdle();
    captionLabel.textContent='Anlatım tamamlandı';
    captionStatus.textContent='Canlı bekleme modu';
    captionText.textContent='Yolculuk başlıyor.';
    updateAudioButton();
    startIdleLife();
  });

  anchor.addEventListener('pointerdown',e=>{
    anchor.setPointerCapture?.(e.pointerId);
    const r=anchor.getBoundingClientRect();
    drag={dx:e.clientX-(r.left+r.width/2),dy:e.clientY-(r.top+r.height/2),id:e.pointerId};
  });
  anchor.addEventListener('pointermove',e=>{
    if(!drag||drag.id!==e.pointerId) return;
    setAnchorPosition(e.clientX-drag.dx,e.clientY-drag.dy);
  });
  const endDrag=e=>{ if(drag&&drag.id===e.pointerId) drag=null; };
  anchor.addEventListener('pointerup',endDrag);
  anchor.addEventListener('pointercancel',endDrag);

  const distance=(a,b)=>Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY);
  arView.addEventListener('touchstart',e=>{
    if(e.touches.length===2&&placed) pinchDistance=distance(e.touches[0],e.touches[1]);
  },{passive:true});
  arView.addEventListener('touchmove',e=>{
    if(e.touches.length===2&&pinchDistance&&placed){
      const d=distance(e.touches[0],e.touches[1]);
      scale=Math.min(1.75,Math.max(.56,scale*(d/pinchDistance)));
      anchor.style.setProperty('--scale',scale.toFixed(3));
      pinchDistance=d;
    }
  },{passive:true});
  arView.addEventListener('touchend',()=>{pinchDistance=null;},{passive:true});

  window.addEventListener('beforeunload',stopCamera);
  if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});
  updateAudioButton();
})();