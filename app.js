(() => {
  const $ = s => document.querySelector(s);
  const intro = $('#intro'), arView = $('#arView'), video = $('#camera'), startBtn = $('#startBtn');
  const flipBtn = $('#flipBtn'), resetBtn = $('#resetBtn'), guide = $('#placementGuide');
  const anchor = $('#arAnchor'), mascot = $('#mascot'), mascotFrame = $('#mascotFrame');
  const errorBox = $('#errorBox');
  const frames = { neutral:'assets/mascot_neutral.png', greeting:'assets/mascot_greeting.png', presentRight:'assets/mascot_present_right.png', aiHold:'assets/mascot_ai_hold.png', aiLook:'assets/mascot_ai_look.png', hero:'assets/mascot_hero.png', idle:'assets/mascot_idle.png' };
  let stream=null,facingMode='environment',placed=false,scale=.86,drag=null,pinchDistance=null,timers=[];
  Object.values(frames).forEach(src=>{const img=new Image(); img.src=src;});
  const clearTimers=()=>{timers.forEach(clearTimeout); timers=[];};
  const schedule=(fn,ms)=>{const id=setTimeout(fn,ms); timers.push(id); return id;};
  function clearStates(){ anchor.classList.remove('state-greeting','state-present','state-ai','state-ai-focus','state-hero','state-idle','state-neutral'); mascotFrame.classList.remove('mirror'); }
  function swapFrame(src,{mirror=false}={}){ mascotFrame.classList.toggle('mirror',mirror); mascot.classList.add('frame-out'); mascot.classList.remove('frame-in'); schedule(()=>{ mascot.src=src; mascot.classList.remove('frame-out'); mascot.classList.add('frame-in'); schedule(()=>mascot.classList.remove('frame-in'),420); },180); }
  function goState(name,frame,nextFn,holdMs,opts={}){ clearTimers(); clearStates(); anchor.classList.add(`state-${name}`); swapFrame(frame,opts); schedule(nextFn,holdMs); }
  const stateGreeting=()=>goState('greeting',frames.greeting,stateAIHold,2800);
  const stateAIHold=()=>goState('ai',frames.aiHold,stateAILook,3200);
  const stateAILook=()=>goState('ai-focus',frames.aiLook,stateHero,3000);
  const stateHero=()=>goState('hero',frames.hero,stateIdle,3000);
  const stateIdle=()=>goState('idle',frames.idle,stateNeutral,3200);
  const stateNeutral=()=>goState('neutral',frames.neutral,statePresent,2800);
  const statePresent=()=>goState('present',frames.presentRight,stateGreeting,2800);
  function startShowcase(){ clearTimers(); clearStates(); mascot.src=frames.idle; anchor.classList.add('state-idle'); schedule(stateGreeting,1200); }
  async function startCamera(){ stopCamera(); try{ stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:facingMode},width:{ideal:1920},height:{ideal:1080}}}); video.srcObject=stream; await video.play(); errorBox.classList.add('is-hidden'); }catch(err){ console.error(err); errorBox.innerHTML='<b>Kamera açılamadı.</b><br>HTTPS bağlantısını ve tarayıcı kamera iznini kontrol edin.'; errorBox.classList.remove('is-hidden'); } }
  function stopCamera(){ if(stream) stream.getTracks().forEach(t=>t.stop()); stream=null; }
  function setAnchorPosition(x,y){ anchor.style.left=`${x}px`; anchor.style.top=`${y}px`; }
  function placeMascot(x,y){ if(placed) return; placed=true; guide.classList.add('is-hidden'); setAnchorPosition(x,y); anchor.classList.remove('is-hidden'); anchor.classList.add('is-placed'); scale=.86; anchor.style.setProperty('--scale',scale); startShowcase(); }
  function resetScene(){ clearTimers(); placed=false; clearStates(); mascot.src=frames.idle; mascot.classList.remove('frame-out','frame-in'); anchor.classList.add('is-hidden'); anchor.classList.remove('is-placed'); guide.classList.remove('is-hidden'); scale=.86; anchor.style.setProperty('--scale',scale); anchor.style.left='50%'; anchor.style.top='58%'; }
  startBtn.addEventListener('click',async()=>{ intro.classList.add('is-hidden'); arView.classList.remove('is-hidden'); await startCamera(); });
  flipBtn.addEventListener('click',async()=>{ facingMode=facingMode==='environment'?'user':'environment'; await startCamera(); });
  resetBtn.addEventListener('click',resetScene);
  arView.addEventListener('click',e=>{ if(e.target.closest('button')||e.target.closest('.error-box')) return; if(!placed) placeMascot(e.clientX,e.clientY-18); });
  anchor.addEventListener('pointerdown',e=>{ anchor.setPointerCapture?.(e.pointerId); const r=anchor.getBoundingClientRect(); drag={dx:e.clientX-(r.left+r.width/2),dy:e.clientY-(r.top+r.height/2),id:e.pointerId}; });
  anchor.addEventListener('pointermove',e=>{ if(!drag||drag.id!==e.pointerId) return; setAnchorPosition(e.clientX-drag.dx,e.clientY-drag.dy); });
  const endDrag=e=>{ if(drag&&drag.id===e.pointerId) drag=null; }; anchor.addEventListener('pointerup',endDrag); anchor.addEventListener('pointercancel',endDrag);
  const distance=(a,b)=>Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY);
  arView.addEventListener('touchstart',e=>{ if(e.touches.length===2&&placed) pinchDistance=distance(e.touches[0],e.touches[1]); },{passive:true});
  arView.addEventListener('touchmove',e=>{ if(e.touches.length===2&&pinchDistance&&placed){ const d=distance(e.touches[0],e.touches[1]); scale=Math.min(1.7,Math.max(.55,scale*(d/pinchDistance))); anchor.style.setProperty('--scale',scale.toFixed(3)); pinchDistance=d; } },{passive:true});
  arView.addEventListener('touchend',()=>{pinchDistance=null;},{passive:true});
  window.addEventListener('beforeunload',stopCamera);
  if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});
})();
