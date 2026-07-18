/* ================================================
   穿越天山 - Script
   Web Audio soundscape + Scroll interactions + ECharts
   ================================================ */
(function(){
'use strict';

/* ========== ECHARTS CDN LOAD ========== */
function loadScript(src,cb){
  const s=document.createElement('script');
  s.src=src;s.async=true;
  s.onload=cb;s.onerror=cb;
  document.head.appendChild(s);
}

/* ========== AUDIO ENGINE ========== */
let audioCtx,masterGain,analyser,noiseBuffer;
let buses={};
let currentAct=-1;
let audioReady=false;
let muted=false;

const actTargets=[
  {wind:0.55,windHowl:0.35,gust:0.30},       // 01 危途 - 暴风雪：强风+呼啸+阵风
  {tbm:0.46},                                  // 02 凿穿
  {highway:0.38,voices:0.30,chatter:0.25,honk:0.15}, // 03 坦途 - 公路+人声+聊天+喇叭
  {crowd:0.22,vendor:0.38,market:0.12},       // 04 繁荣 - 明快巴扎
  {melody:0.22}                                 // 05 未来 - 轻快旋律
];
const actColors=['#E2693F','#E0A23D','#4FC3C0','#E0628A','#9AA5B1'];
const actNames=['危途','凿穿','坦途','繁荣','未来'];

function makeNoiseSource(){
  const src=audioCtx.createBufferSource();
  src.buffer=noiseBuffer;src.loop=true;src.start();
  return src;
}

function initAudio(){
  if(audioReady) return;
  audioCtx=new(window.AudioContext||window.webkitAudioContext)();
  masterGain=audioCtx.createGain();
  masterGain.gain.value=0.85;
  analyser=audioCtx.createAnalyser();
  analyser.fftSize=64;
  masterGain.connect(analyser);
  masterGain.connect(audioCtx.destination);

  const len=audioCtx.sampleRate*2;
  noiseBuffer=audioCtx.createBuffer(1,len,audioCtx.sampleRate);
  const d=noiseBuffer.getChannelData(0);
  for(let i=0;i<len;i++) d[i]=Math.random()*2-1;

  /* ========== ACT 01: 暴风雪 ========== */
  // Layer 1: Deep rumbling wind
  const windSrc=makeNoiseSource();
  const windFilter=audioCtx.createBiquadFilter();
  windFilter.type='lowpass';windFilter.frequency.value=420;windFilter.Q.value=0.7;
  const windLFO=audioCtx.createOscillator();windLFO.frequency.value=0.12;
  const windLFOGain=audioCtx.createGain();windLFOGain.gain.value=280;
  windLFO.connect(windLFOGain).connect(windFilter.frequency);windLFO.start();
  const windBus=audioCtx.createGain();windBus.gain.value=0;
  windSrc.connect(windFilter).connect(windBus);

  // Layer 2: High howling wind
  const windHowlSrc=makeNoiseSource();
  const windHowlFilter=audioCtx.createBiquadFilter();
  windHowlFilter.type='bandpass';windHowlFilter.frequency.value=1800;windHowlFilter.Q.value=1.2;
  const windHowlLFO=audioCtx.createOscillator();windHowlLFO.frequency.value=0.07;
  const windHowlLFOGain=audioCtx.createGain();windHowlLFOGain.gain.value=700;
  windHowlLFO.connect(windHowlLFOGain).connect(windHowlFilter.frequency);windHowlLFO.start();
  // Extra howl wobble
  const windHowlLFO2=audioCtx.createOscillator();windHowlLFO2.frequency.value=0.22;
  const windHowlLFOGain2=audioCtx.createGain();windHowlLFOGain2.gain.value=400;
  windHowlLFO2.connect(windHowlLFOGain2).connect(windHowlFilter.frequency);windHowlLFO2.start();
  const windHowlBus=audioCtx.createGain();windHowlBus.gain.value=0;
  windHowlSrc.connect(windHowlFilter).connect(windHowlBus);

  // Layer 3: Gusts (random bursts of louder wind)
  const gustSrc=makeNoiseSource();
  const gustFilter=audioCtx.createBiquadFilter();
  gustFilter.type='bandpass';gustFilter.frequency.value=1100;gustFilter.Q.value=0.5;
  const gustLFO=audioCtx.createOscillator();gustLFO.frequency.value=0.35;
  const gustLFOGain=audioCtx.createGain();gustLFOGain.gain.value=500;
  gustLFO.connect(gustLFOGain).connect(gustFilter.frequency);gustLFO.start();
  const gustBus=audioCtx.createGain();gustBus.gain.value=0;
  gustSrc.connect(gustFilter).connect(gustBus);

  windBus.connect(masterGain);
  windHowlBus.connect(masterGain);
  gustBus.connect(masterGain);
  buses.wind=windBus;buses.windHowl=windHowlBus;buses.gust=gustBus;

  /* ========== ACT 02: TBM 掘进 (keep existing) ========== */
  const tbmSrc=makeNoiseSource();
  const tbmFilter=audioCtx.createBiquadFilter();tbmFilter.type='lowpass';tbmFilter.frequency.value=190;
  const tbmOsc=audioCtx.createOscillator();tbmOsc.type='sawtooth';tbmOsc.frequency.value=38;
  const tbmTremolo=audioCtx.createGain();tbmTremolo.gain.value=0.8;
  const tbmPulse=audioCtx.createOscillator();tbmPulse.type='sine';tbmPulse.frequency.value=2.3;
  const tbmPulseDepth=audioCtx.createGain();tbmPulseDepth.gain.value=0.16;
  tbmPulse.connect(tbmPulseDepth).connect(tbmTremolo.gain);tbmPulse.start();
  const tbmBus=audioCtx.createGain();tbmBus.gain.value=0;
  tbmSrc.connect(tbmFilter).connect(tbmTremolo).connect(tbmBus).connect(masterGain);
  tbmOsc.connect(tbmTremolo);tbmOsc.start();
  buses.tbm=tbmBus;

  /* ========== ACT 03: 坦途 - 公路驾驶 + 人声 ========== */
  // Highway engine
  const hwOsc=audioCtx.createOscillator();hwOsc.type='sawtooth';hwOsc.frequency.value=62;
  const hwFilter=audioCtx.createBiquadFilter();hwFilter.type='lowpass';hwFilter.frequency.value=340;
  const hwBus=audioCtx.createGain();hwBus.gain.value=0;
  hwOsc.connect(hwFilter).connect(hwBus).connect(masterGain);hwOsc.start();
  buses.highway=hwBus;
  // Voices formant (vowel-like "ah" crowd murmur)
  const vOsc1=audioCtx.createOscillator();vOsc1.type='sawtooth';vOsc1.frequency.value=130;
  const vFilt1=audioCtx.createBiquadFilter();vFilt1.type='bandpass';vFilt1.frequency.value=700;vFilt1.Q.value=6;
  const vBus=audioCtx.createGain();vBus.gain.value=0;
  vOsc1.connect(vFilt1).connect(vBus).connect(masterGain);vOsc1.start();
  // Add second formant for richness
  const vOsc2=audioCtx.createOscillator();vOsc2.type='sawtooth';vOsc2.frequency.value=145;
  const vFilt2=audioCtx.createBiquadFilter();vFilt2.type='bandpass';vFilt2.frequency.value=1200;vFilt2.Q.value=5;
  vOsc2.connect(vFilt2).connect(vBus);vOsc2.start();
  // Volume wobble to simulate multiple people talking
  const vLFO=audioCtx.createOscillator();vLFO.frequency.value=2.1;
  const vLFOGain=audioCtx.createGain();vLFOGain.gain.value=0.12;
  vLFO.connect(vLFOGain).connect(vBus.gain);vLFO.start();
  buses.voices=vBus;
  // Chatter (babble-like noise bursts)
  const chatSrc=makeNoiseSource();
  const chatFilter=audioCtx.createBiquadFilter();chatFilter.type='bandpass';chatFilter.frequency.value=1800;chatFilter.Q.value=2.5;
  const chatBus=audioCtx.createGain();chatBus.gain.value=0;
  chatSrc.connect(chatFilter).connect(chatBus).connect(masterGain);
  buses.chatter=chatBus;
  // Occasional honk
  const honkOsc=audioCtx.createOscillator();honkOsc.type='sawtooth';honkOsc.frequency.value=320;
  const honkFilter=audioCtx.createBiquadFilter();honkFilter.type='lowpass';honkFilter.frequency.value=900;
  const honkBus=audioCtx.createGain();honkBus.gain.value=0;
  honkOsc.connect(honkFilter).connect(honkBus).connect(masterGain);honkOsc.start();
  buses.honk=honkBus;

  /* ========== ACT 04: 繁荣 - 明快巴扎氛围 ========== */
  // Warm bright pad (lighter than sawtooth, uses triangle)
  const bzPad1=audioCtx.createOscillator();bzPad1.type='triangle';bzPad1.frequency.value=196; // G3
  const bzPad2=audioCtx.createOscillator();bzPad2.type='triangle';bzPad2.frequency.value=247; // B3
  const bzPad3=audioCtx.createOscillator();bzPad3.type='sine';bzPad3.frequency.value=294; // D4
  const bzPadBus=audioCtx.createGain();bzPadBus.gain.value=0;
  bzPad1.connect(bzPadBus).connect(masterGain);bzPad1.start();
  bzPad2.connect(bzPadBus);bzPad2.start();
  bzPad3.connect(bzPadBus);bzPad3.start();
  // Gentle pad volume wobble for organic feel
  const bzLFO=audioCtx.createOscillator();bzLFO.frequency.value=0.3;
  const bzLFOG=audioCtx.createGain();bzLFOG.gain.value=0.03;
  bzLFO.connect(bzLFOG).connect(bzPadBus.gain);bzLFO.start();
  buses.crowd=bzPadBus;

  // Bright bazaar chimes (sine pentatonic, random timing)
  const bzChimeBus=audioCtx.createGain();bzChimeBus.gain.value=0;
  bzChimeBus.connect(masterGain);
  const chimeScale=[523.3,587.3,659.3,784,880,1047,1175,1319]; // C5 pentatonic+
  function playChime(){
    if(!audioReady) return;
    const freq=chimeScale[Math.floor(Math.random()*chimeScale.length)];
    const now=audioCtx.currentTime;
    const o=audioCtx.createOscillator();o.type='sine';o.frequency.value=freq;
    const g=audioCtx.createGain();
    g.gain.setValueAtTime(.001,now);
    g.gain.linearRampToValueAtTime(0.08+Math.random()*0.06,now+0.02);
    g.gain.exponentialRampToValueAtTime(.001,now+0.5+Math.random()*0.4);
    o.connect(g).connect(bzChimeBus);o.start(now);o.stop(now+1.2);
    // Occasionally add a harmonic
    if(Math.random()<0.3){
      const o2=audioCtx.createOscillator();o2.type='sine';o2.frequency.value=freq*2;
      const g2=audioCtx.createGain();
      g2.gain.setValueAtTime(.001,now);
      g2.gain.linearRampToValueAtTime(0.03,now+0.02);
      g2.gain.exponentialRampToValueAtTime(.001,now+0.3);
      o2.connect(g2).connect(bzChimeBus);o2.start(now);o2.stop(now+0.5);
    }
  }
  // Chime timing: random interval 300-900ms
  function scheduleChime(){
    playChime();
    const next=300+Math.random()*600;
    bzChimeTimer=setTimeout(scheduleChime,next);
  }
  let bzChimeTimer=null;
  buses.vendor=bzChimeBus;
  // Start chimes immediately (they'll be gated by bus gain)
  scheduleChime();

  // Light chatter/presence noise (high-pass, bright)
  const bzNoiseSrc=makeNoiseSource();
  const bzNoiseFilt=audioCtx.createBiquadFilter();
  bzNoiseFilt.type='highpass';bzNoiseFilt.frequency.value=1200;
  const bzNoiseBus=audioCtx.createGain();bzNoiseBus.gain.value=0;
  bzNoiseSrc.connect(bzNoiseFilt).connect(bzNoiseBus).connect(masterGain);
  buses.market=bzNoiseBus;

  /* ========== ACT 05: 未来 - 中国风轻音乐 ========== */
  // Chinese pentatonic: C4 D4 E4 G4 A4 C5 D5 E5 G5 A5
  // A minor pentatonic for slightly more emotional feel: A C D E G
  const melodyPool=[440.0,523.3,587.3,659.3,784.0, 880.0,1047,1175,1319,1568];
  const melodyGain=audioCtx.createGain();melodyGain.gain.value=0;

  // Warm pad - Am chord (A2 C3 E3)
  const padOsc1=audioCtx.createOscillator();padOsc1.type='sine';padOsc1.frequency.value=110;
  const padOsc2=audioCtx.createOscillator();padOsc2.type='sine';padOsc2.frequency.value=130.8;
  const padOsc3=audioCtx.createOscillator();padOsc3.type='sine';padOsc3.frequency.value=164.8;
  // Slight detune for warmth
  const padOsc1b=audioCtx.createOscillator();padOsc1b.type='sine';padOsc1b.frequency.value=110.3;
  const padOsc2b=audioCtx.createOscillator();padOsc2b.type='sine';padOsc2b.frequency.value=131.1;
  const padFilter=audioCtx.createBiquadFilter();padFilter.type='lowpass';padFilter.frequency.value=800;
  // Slow pad swell
  const padLFO=audioCtx.createOscillator();padLFO.frequency.value=0.15;
  const padLFOGain=audioCtx.createGain();padLFOGain.gain.value=150;
  padLFO.connect(padLFOGain).connect(padFilter.frequency);padLFO.start();
  const padBus=audioCtx.createGain();padBus.gain.value=0.22;
  padOsc1.connect(padFilter);padOsc2.connect(padFilter);padOsc3.connect(padFilter);
  padOsc1b.connect(padFilter);padOsc2b.connect(padFilter);
  padFilter.connect(padBus).connect(melodyGain).connect(masterGain);
  padOsc1.start();padOsc2.start();padOsc3.start();
  padOsc1b.start();padOsc2b.start();

  // High shimmer - soft triangle octave
  const shimOsc=audioCtx.createOscillator();shimOsc.type='triangle';shimOsc.frequency.value=440;
  const shimFilter=audioCtx.createBiquadFilter();shimFilter.type='lowpass';shimFilter.frequency.value=900;
  const shimBus=audioCtx.createGain();shimBus.gain.value=0.06;
  const shimLFO=audioCtx.createOscillator();shimLFO.frequency.value=0.08;
  const shimLFOGain=audioCtx.createGain();shimLFOGain.gain.value=80;
  shimLFO.connect(shimLFOGain).connect(shimFilter.frequency);shimLFO.start();
  shimOsc.connect(shimFilter).connect(shimBus).connect(melodyGain);shimOsc.start();

  // Melody sequencer - arpeggiated with variable rhythm
  let melodyInterval=null;
  let melodyStarted=false;
  function startMelody(){
    if(melodyStarted) return;
    melodyStarted=true;
    let idx=0;
    // Patterns: [noteIndex, durationMs, velocity]
    const pattern=[
      [0,380,0.14],[2,280,0.11],[4,500,0.16],[3,320,0.12],
      [5,600,0.18],[4,300,0.13],[2,400,0.14],[0,350,0.11],
      [3,450,0.15],[5,280,0.12],[7,550,0.16],[5,350,0.13],
      [4,400,0.14],[2,300,0.11],[0,500,0.15],[3,380,0.12],
      [6,450,0.16],[4,320,0.13],[2,400,0.14],[0,600,0.18]
    ];
    let patIdx=0;
    function playNote(){
      const p=pattern[patIdx%pattern.length];
      const freq=melodyPool[p[0]%melodyPool.length];
      const dur=p[1]/1000;
      const vel=p[2];
      const now=audioCtx.currentTime;
      // Main tone
      const o=audioCtx.createOscillator();o.type='triangle';o.frequency.value=freq;
      const g=audioCtx.createGain();
      g.gain.setValueAtTime(0.001,now);
      g.gain.linearRampToValueAtTime(vel,now+0.05);
      g.gain.setValueAtTime(vel*0.8,now+dur*0.4);
      g.gain.exponentialRampToValueAtTime(0.001,now+dur*0.95);
      o.connect(g).connect(melodyGain);
      o.start(now);o.stop(now+dur);
      // Soft overtone
      const o2=audioCtx.createOscillator();o2.type='sine';o2.frequency.value=freq*2;
      const g2=audioCtx.createGain();
      g2.gain.setValueAtTime(0.001,now);
      g2.gain.linearRampToValueAtTime(vel*0.3,now+0.05);
      g2.gain.exponentialRampToValueAtTime(0.001,now+dur*0.7);
      o2.connect(g2).connect(melodyGain);
      o2.start(now);o2.stop(now+dur);
      patIdx++;
    }
    playNote();
    let time=pattern[0][1];
    function scheduleNext(){
      if(!melodyStarted) return;
      playNote();
      const p=pattern[patIdx%pattern.length];
      melodyInterval=setTimeout(scheduleNext,p[1]);
    }
    melodyInterval=setTimeout(scheduleNext,pattern[0][1]);
  }
  function stopMelody(){
    melodyStarted=false;
    if(melodyInterval){clearTimeout(melodyInterval);melodyInterval=null;}
  }
  // Override setActiveAct to handle melody start/stop
  const _origSetActiveAct=setActiveAct;
  setActiveAct=function(i){
    _origSetActiveAct(i);
    if(i===4) startMelody();
    else stopMelody();
  };
  buses.melody=melodyGain;

  audioReady=true;
}

function setActiveAct(i){
  if(!audioReady) return;
  const targets=actTargets[i]||{};
  Object.keys(buses).forEach(k=>{
    const g=buses[k];
    const target=targets[k]!==undefined?targets[k]:0;
    const now=audioCtx.currentTime;
    g.gain.cancelScheduledValues(now);
    g.gain.setValueAtTime(g.gain.value,now);
    g.gain.linearRampToValueAtTime(target,now+1.8);
  });
}

/* ---- Interactive looped soundscapes (button-triggered) ---- */
let interactiveNodes=null;
let interactiveTimers=[];
let activeInteractiveBtn=null;

function clearInteractiveTimers(){
  interactiveTimers.forEach(id=>clearInterval(id));
  interactiveTimers=[];
}

function stopInteractive(){
  if(interactiveNodes){
    const now=audioCtx.currentTime;
    interactiveNodes.gain.gain.cancelScheduledValues(now);
    interactiveNodes.gain.gain.setValueAtTime(interactiveNodes.gain.gain.value,now);
    interactiveNodes.gain.gain.linearRampToValueAtTime(0,now+0.6);
    const toStop=interactiveNodes;
    setTimeout(()=>{try{toStop.stopAll();}catch(e){}},700);
    interactiveNodes=null;
  }
  clearInteractiveTimers();
  if(activeInteractiveBtn){
    activeInteractiveBtn.classList.remove('playing');
    activeInteractiveBtn=null;
  }
}

function playInteractive(type,btn){
  if(!audioReady) return;
  if(activeInteractiveBtn===btn){stopInteractive();return;}
  stopInteractive();
  const now=audioCtx.currentTime;
  const out=audioCtx.createGain();out.gain.value=0;
  out.connect(masterGain);
  out.gain.linearRampToValueAtTime(0.8,now+0.5);
  const localOsc=[];const localSrc=[];

  function bell(time,freq){
    const o=audioCtx.createOscillator();o.type='sine';o.frequency.value=freq;
    const g=audioCtx.createGain();
    g.gain.setValueAtTime(0,time);
    g.gain.linearRampToValueAtTime(0.18,time+0.02);
    g.gain.exponentialRampToValueAtTime(0.001,time+0.5);
    o.connect(g).connect(out);o.start(time);o.stop(time+0.55);
  }
  function honk(time,freq,dur,vol){
    const o=audioCtx.createOscillator();o.type='sawtooth';o.frequency.value=freq;
    const f=audioCtx.createBiquadFilter();f.type='lowpass';f.frequency.value=900;
    const g=audioCtx.createGain();
    g.gain.setValueAtTime(0,time);
    g.gain.linearRampToValueAtTime(vol,time+0.05);
    g.gain.exponentialRampToValueAtTime(0.001,time+dur);
    o.connect(f).connect(g).connect(out);o.start(time);o.stop(time+dur+0.05);
  }
  function chatterBurst(time,dur,freqBase){
    const src=audioCtx.createBufferSource();src.buffer=noiseBuffer;
    const f=audioCtx.createBiquadFilter();f.type='bandpass';f.frequency.value=freqBase;f.Q.value=4;
    const g=audioCtx.createGain();
    g.gain.setValueAtTime(0,time);
    g.gain.linearRampToValueAtTime(0.10,time+dur*0.3);
    g.gain.linearRampToValueAtTime(0,time+dur);
    src.connect(f).connect(g).connect(out);src.start(time);src.stop(time+dur+0.05);
    localSrc.push(src);
  }
  function clank(time,vol){
    const src=audioCtx.createBufferSource();src.buffer=noiseBuffer;
    const f=audioCtx.createBiquadFilter();f.type='highpass';f.frequency.value=2200;
    const g=audioCtx.createGain();
    g.gain.setValueAtTime(vol,time);g.gain.exponentialRampToValueAtTime(0.001,time+0.18);
    src.connect(f).connect(g).connect(out);src.start(time);src.stop(time+0.2);
    localSrc.push(src);
  }

  let gainObj={gain:out.gain};
  let stopAllFn=function(){
    clearInteractiveTimers();
    localOsc.forEach(o=>{try{o.stop();}catch(e){}});
    localSrc.forEach(s=>{try{s.stop();}catch(e){}});
    try{out.disconnect();}catch(e){}
  };

  if(type==='caravan'){
    // Camel bells + wind
    const bellId=setInterval(()=>{
      bell(audioCtx.currentTime+0.05, 600+Math.random()*400);
      if(Math.random()<0.3) bell(audioCtx.currentTime+0.15, 800+Math.random()*300);
    },800);
    interactiveTimers.push(bellId);
  } else if(type==='tbm'){
    // TBM drilling
    const gSrc=makeNoiseSource();localSrc.push(gSrc);
    const gF=audioCtx.createBiquadFilter();gF.type='lowpass';gF.frequency.value=200;
    const gOsc=audioCtx.createOscillator();gOsc.type='sawtooth';gOsc.frequency.value=36;localOsc.push(gOsc);
    const gTremolo=audioCtx.createGain();gTremolo.gain.value=0.85;
    const gPulse=audioCtx.createOscillator();gPulse.frequency.value=2.6;localOsc.push(gPulse);
    const gPulseDepth=audioCtx.createGain();gPulseDepth.gain.value=0.18;
    gPulse.connect(gPulseDepth).connect(gTremolo.gain);gPulse.start();
    gSrc.connect(gF).connect(gTremolo).connect(out);gOsc.connect(gTremolo);gOsc.start();
    // Occasional blast
    const blastId=setInterval(()=>{
      if(Math.random()<0.15){
        const bs=audioCtx.createBufferSource();bs.buffer=noiseBuffer;
        const bf=audioCtx.createBiquadFilter();bf.type='lowpass';bf.frequency.value=220;
        const bg=audioCtx.createGain();
        const t=audioCtx.currentTime;
        bg.gain.setValueAtTime(0.6,t);bg.gain.exponentialRampToValueAtTime(0.001,t+0.5);
        bs.connect(bf).connect(bg).connect(out);bs.start(t);bs.stop(t+0.55);
      }
    },2000);
    interactiveTimers.push(blastId);
  } else if(type==='roadtrip'){
    // Highway driving
    const eOsc=audioCtx.createOscillator();eOsc.type='sawtooth';eOsc.frequency.value=58;localOsc.push(eOsc);
    const eF=audioCtx.createBiquadFilter();eF.type='lowpass';eF.frequency.value=320;
    const eG=audioCtx.createGain();eG.gain.value=0.35;
    eOsc.connect(eF).connect(eG).connect(out);eOsc.start();
    const chatId=setInterval(()=>{
      chatterBurst(audioCtx.currentTime+0.05,0.4+Math.random()*0.3,1800+Math.random()*600);
    },1100);
    interactiveTimers.push(chatId);
    const honkId=setInterval(()=>{
      if(Math.random()<0.4) honk(audioCtx.currentTime+0.05,320,0.3,0.12);
    },2600);
    interactiveTimers.push(honkId);
  } else if(type==='freight'){
    // Freight truck
    const tOsc=audioCtx.createOscillator();tOsc.type='sawtooth';tOsc.frequency.value=44;localOsc.push(tOsc);
    const tF=audioCtx.createBiquadFilter();tF.type='lowpass';tF.frequency.value=240;
    const tG=audioCtx.createGain();tG.gain.value=0.4;
    tOsc.connect(tF).connect(tG).connect(out);tOsc.start();
    const clankId=setInterval(()=>{
      clank(audioCtx.currentTime+0.05,0.18+Math.random()*0.12);
    },600);
    interactiveTimers.push(clankId);
  } else if(type==='market'){
    // Market ambience
    const mSrc=makeNoiseSource();localSrc.push(mSrc);
    const mF=audioCtx.createBiquadFilter();mF.type='bandpass';mF.frequency.value=1100;mF.Q.value=0.5;
    const mG=audioCtx.createGain();mG.gain.value=0.22;
    const flutter=audioCtx.createOscillator();flutter.frequency.value=2.1;localOsc.push(flutter);
    const flutterG=audioCtx.createGain();flutterG.gain.value=0.07;
    flutter.connect(flutterG).connect(mG.gain);flutter.start();
    mSrc.connect(mF).connect(mG).connect(out);
    const accentId=setInterval(()=>{
      chatterBurst(audioCtx.currentTime+0.05,0.3,2400+Math.random()*800);
    },850);
    interactiveTimers.push(accentId);
  } else if(type==='future'){
    // Uplifting pentatonic melody - "路还在延伸"
    const scale=[440,523.3,587.3,659.3,784,880,1047,1175];
    const pattern=[
      [0,320,.16],[2,240,.13],[4,400,.18],[3,280,.14],
      [5,480,.20],[4,240,.15],[2,360,.16],[0,300,.13],
      [3,400,.17],[5,260,.14],[7,440,.19],[5,320,.15],
      [4,360,.16],[2,280,.13],[0,420,.18],[3,300,.14],
      [6,400,.18],[4,280,.14],[2,360,.16],[0,500,.20]
    ];
    let pi=0;
    function playMelodyNote(){
      if(!interactiveNodes) return;
      const p=pattern[pi%pattern.length];
      const freq=scale[p[0]%scale.length];
      const dur=p[1]/1000;const vel=p[2];
      const now=audioCtx.currentTime;
      const o=audioCtx.createOscillator();o.type='triangle';o.frequency.value=freq;
      const g=audioCtx.createGain();
      g.gain.setValueAtTime(.001,now);g.gain.linearRampToValueAtTime(vel,now+.04);
      g.gain.setValueAtTime(vel*.8,now+dur*.4);g.gain.exponentialRampToValueAtTime(.001,now+dur*.95);
      o.connect(g).connect(out);o.start(now);o.stop(now+dur);
      const o2=audioCtx.createOscillator();o2.type='sine';o2.frequency.value=freq*2;
      const g2=audioCtx.createGain();
      g2.gain.setValueAtTime(.001,now);g2.gain.linearRampToValueAtTime(vel*.25,now+.04);
      g2.gain.exponentialRampToValueAtTime(.001,now+dur*.65);
      o2.connect(g2).connect(out);o2.start(now);o2.stop(now+dur);
      pi++;
    }
    playMelodyNote();
    const melId=setTimeout(function sched(){
      if(!interactiveNodes) return;
      playMelodyNote();
      const nxt=pattern[pi%pattern.length];
      interactiveTimers.push(setTimeout(sched,nxt[1]));
    },pattern[0][1]);
    interactiveTimers.push(melId);
  }

  interactiveNodes={gain:gainObj,stopAll:stopAllFn};
  activeInteractiveBtn=btn;
  btn.classList.add('playing');
}

/* ---- Audio Meter ---- */
function drawMeter(){
  const canvas=document.getElementById('meter');
  if(!canvas||!analyser) return;
  const ctx=canvas.getContext('2d');
  const bufLen=analyser.frequencyBinCount;
  const data=new Uint8Array(bufLen);
  analyser.getByteFrequencyData(data);
  ctx.clearRect(0,0,80,28);
  const barW=3,gap=2;
  const bars=Math.min(bufLen,12);
  for(let i=0;i<bars;i++){
    const v=data[i]/255;
    const h=Math.max(1,v*24);
    const x=i*(barW+gap);
    ctx.fillStyle=actColors[currentAct]||'#eae8e4';
    ctx.globalAlpha=0.3+v*0.7;
    ctx.fillRect(x,28-h,barW,h);
  }
  ctx.globalAlpha=1;
  requestAnimationFrame(drawMeter);
}

/* ========== SCROLL / INTERSECTION ========== */
const actSections=document.querySelectorAll('.act-section');
const dotLinks=document.querySelectorAll('.dot-nav a');
const summaryEl=document.getElementById('chapter-summary');
const summaryLabel=summaryEl.querySelector('.summary-label');
const summaryText=summaryEl.querySelector('.summary-text');
const progressBar=document.getElementById('progress-bar');
const actLabel=document.getElementById('current-act-label');

const chapterSummaries=[
  '海拔4280米胜利达坂，南北疆唯一翻越通道，7小时漫长旅途',
  '22.13公里世界最长高速公路隧道，52个月凿穿天山',
  '从7小时到3.5小时，距离被重新定义',
  '通车后文旅消费增长36.4%，南北疆经济加速融合',
  '2025年新疆接待游客3.23亿人次，路还在继续延伸'
];

function updateUI(actIndex){
  // Stop interactive sounds when leaving their section
  if(interactiveNodes && activeInteractiveBtn){
    const btnSound=activeInteractiveBtn.dataset.sound;
    const actSounds=['caravan','tbm','roadtrip','freight','market','future'];
    const soundActMap={caravan:0,tbm:1,roadtrip:2,freight:3,market:3,future:4};
    const soundBelongsTo=soundActMap[btnSound];
    if(soundBelongsTo!==undefined && actIndex!==soundBelongsTo){
      stopInteractive();
    }
  }
  // Dot nav
  dotLinks.forEach((link,i)=>{
    link.classList.remove('active','passed');
    if(i===actIndex) link.classList.add('active');
    else if(i<actIndex) link.classList.add('passed');
  });
  // Progress line
  const dots=[...dotLinks];
  if(dots[actIndex]){
    const rect=dots[actIndex].getBoundingClientRect();
    const navRect=document.getElementById('dot-nav').getBoundingClientRect();
    const h=rect.top-navRect.top+rect.height/2;
    document.getElementById('dot-nav-progress').style.height=h+'px';
  }
  // Act label
  actLabel.textContent=actNames[actIndex]||'——';
  actLabel.style.color=actColors[actIndex]||'#eae8e4';
  // Chapter summary
  summaryEl.style.setProperty('--act-color',actColors[actIndex]||'#eae8e4');
  summaryLabel.textContent='ACT 0'+(actIndex+1)+' · '+actNames[actIndex];
  summaryText.textContent=chapterSummaries[actIndex]||'';
  summaryEl.classList.add('visible');
  // Progress bar color
  progressBar.style.background=actColors[actIndex]||'#eae8e4';
  // Audio
  if(actIndex!==currentAct){
    currentAct=actIndex;
    setActiveAct(actIndex);
    // One-shot effects
    if(actIndex===2) playOneShot('skid');
    if(actIndex===1) setTimeout(()=>playOneShot('blast'),600);
    if(actIndex===3) setTimeout(()=>playOneShot('sparkle'),800);
  }
}

function playOneShot(type){
  if(!audioReady) return;
  const now=audioCtx.currentTime;
  if(type==='skid'){
    const src=audioCtx.createBufferSource();src.buffer=noiseBuffer;
    const filt=audioCtx.createBiquadFilter();filt.type='highpass';
    filt.frequency.setValueAtTime(3200,now);
    filt.frequency.exponentialRampToValueAtTime(500,now+0.35);
    const g=audioCtx.createGain();
    g.gain.setValueAtTime(0.45,now);g.gain.exponentialRampToValueAtTime(0.001,now+0.4);
    src.connect(filt).connect(g).connect(masterGain);
    src.start(now);src.stop(now+0.45);
  }else if(type==='blast'){
    const src=audioCtx.createBufferSource();src.buffer=noiseBuffer;
    const filt=audioCtx.createBiquadFilter();filt.type='lowpass';filt.frequency.value=220;
    const g=audioCtx.createGain();
    g.gain.setValueAtTime(0.6,now);g.gain.exponentialRampToValueAtTime(0.001,now+0.5);
    src.connect(filt).connect(g).connect(masterGain);
    src.start(now);src.stop(now+0.55);
    const osc=audioCtx.createOscillator();osc.type='sine';
    osc.frequency.setValueAtTime(70,now);osc.frequency.exponentialRampToValueAtTime(34,now+0.3);
    const og=audioCtx.createGain();
    og.gain.setValueAtTime(0.55,now);og.gain.exponentialRampToValueAtTime(0.001,now+0.4);
    osc.connect(og).connect(masterGain);
    osc.start(now);osc.stop(now+0.45);
  }else if(type==='cheer'){
    const src=audioCtx.createBufferSource();src.buffer=noiseBuffer;
    const filt=audioCtx.createBiquadFilter();filt.type='bandpass';filt.frequency.value=1500;filt.Q.value=0.6;
    const g=audioCtx.createGain();
    g.gain.setValueAtTime(0.0,now);
    g.gain.linearRampToValueAtTime(0.32,now+0.3);
    g.gain.linearRampToValueAtTime(0.0,now+2.0);
    src.connect(filt).connect(g).connect(masterGain);
    src.start(now);src.stop(now+2.1);
  }else if(type==='sparkle'){
    // Bright ascending chime burst (bazaar entry)
    const freqs=[784,880,1047,1175,1319,1568];
    freqs.forEach((f,i)=>{
      const o=audioCtx.createOscillator();o.type='sine';o.frequency.value=f;
      const g=audioCtx.createGain();
      const t=now+i*0.06;
      g.gain.setValueAtTime(.001,t);
      g.gain.linearRampToValueAtTime(0.12,t+0.02);
      g.gain.exponentialRampToValueAtTime(.001,t+0.35);
      o.connect(g).connect(masterGain);o.start(t);o.stop(t+0.4);
    });
  }else if(type==='ding'){
    const osc=audioCtx.createOscillator();osc.type='triangle';osc.frequency.value=880;
    const g=audioCtx.createGain();
    g.gain.setValueAtTime(0.22,now);g.gain.exponentialRampToValueAtTime(0.001,now+0.5);
    osc.connect(g).connect(masterGain);
    osc.start(now);osc.stop(now+0.55);
  }
}

/* ---- Intersection Observer ---- */
const observer=new IntersectionObserver((entries)=>{
  entries.forEach(entry=>{
    if(entry.isIntersecting){
      const idx=parseInt(entry.target.dataset.actIndex);
      if(!isNaN(idx)) updateUI(idx);
    }
  });
},{threshold:0.15});

actSections.forEach(s=>observer.observe(s));

/* ---- Transition reveal ---- */
const transEls=document.querySelectorAll('.act-transition');
const transObs=new IntersectionObserver((entries)=>{
  entries.forEach(entry=>{
    if(entry.isIntersecting){
      entry.target.classList.add('in-view');
      // Trigger UI update for the NEXT act when transition appears
      const tIdx=parseInt(entry.target.dataset.transition);
      if(!isNaN(tIdx)) updateUI(tIdx);
    }
  });
},{threshold:0.3});
transEls.forEach(t=>transObs.observe(t));

/* ---- Station staggered reveal (Act 3) ---- */
const stationObs=new IntersectionObserver((entries)=>{
  entries.forEach(entry=>{
    if(entry.isIntersecting){
      const items=entry.target.querySelectorAll('.station-item');
      items.forEach((item,i)=>{
        setTimeout(()=>item.classList.add('visible'),i*120);
      });
      stationObs.unobserve(entry.target);
    }
  });
},{threshold:0.25});
const stationEl=document.getElementById('route-stations');
if(stationEl) stationObs.observe(stationEl);

/* ---- Tourism compare slider (Act 5) ---- */
const slider=document.getElementById('tourism-slider');
if(slider){
  const data=[
    {year:2015,val:0.61,spend:'—',growth:'—'},
    {year:2019,val:2.13,spend:'—',growth:'—'},
    {year:2020,val:1.58,spend:'—',growth:'-25.8%'},
    {year:2023,val:2.65,spend:'2872 亿元',growth:'+117.7%'},
    {year:2025,val:3.23,spend:'3700 亿元',growth:'+8.0%'}
  ];
  const bar2025=document.querySelector('.compare-2025');
  const growthEl=document.getElementById('compare-growth');
  const spendEl=document.getElementById('cs-spend');
  const growthRateEl=document.getElementById('cs-growth');

  function updateCompare(pct){
    const idx=Math.round((pct/100)*(data.length-1));
    const d=data[idx];
    const barW=Math.max(5,(d.val/3.23)*100);
    bar2025.style.width=barW+'%';
    bar2025.querySelector('span').textContent=d.val+' 亿';
    const mult=(d.val/0.61).toFixed(1);
    growthEl.innerHTML='增长 <strong>'+mult+' 倍</strong>（'+d.year+'年）';
    spendEl.textContent=d.spend+'（'+d.year+'）';
    growthRateEl.textContent=d.growth;
  }
  slider.addEventListener('input',function(){updateCompare(parseInt(this.value));});
}

/* ---- Scroll progress ---- */
function updateProgress(){
  const scrollTop=window.scrollY;
  const docHeight=document.documentElement.scrollHeight-window.innerHeight;
  const pct=Math.min((scrollTop/docHeight)*100,100);
  progressBar.style.width=pct+'%';
}

/* ---- Big number counter ---- */
function animateBigNums(){
  document.querySelectorAll('.big-num').forEach(el=>{
    // Skip dual-value elements (handled separately)
    if(el.dataset.dual) return;
    const target=parseFloat(el.dataset.target);
    if(isNaN(target)) return;
    const suffix=el.dataset.suffix||'';
    const decimals=parseInt(el.dataset.decimals)||0;
    const rect=el.getBoundingClientRect();
    if(rect.top<window.innerHeight*0.85&&rect.bottom>0&&!el.dataset.animated){
      el.dataset.animated='1';
      const duration=2000;
      const start=performance.now();
      function step(ts){
        const p=Math.min((ts-start)/duration,1);
        const ease=1-Math.pow(1-p,3);
        const val=target*ease;
        el.textContent=(decimals>0?val.toFixed(decimals):Math.round(val))+suffix;
        if(p<1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    }
  });
}

/* ---- Dual big number counter (static prefix + animated suffix) ---- */
function animateDualNums(){
  document.querySelectorAll('.big-num[data-dual]').forEach(el=>{
    const rect=el.getBoundingClientRect();
    if(rect.top<window.innerHeight*0.85&&rect.bottom>0&&!el.dataset.animated){
      el.dataset.animated='1';
      const staticText=el.dataset.dualStatic||'';
      const target=parseFloat(el.dataset.dualTarget)||0;
      const suffix=el.dataset.dualSuffix||'';
      const decimals=parseInt(el.dataset.dualDecimals)||0;
      const duration=2200;
      const start=performance.now();
      el.textContent=staticText+'0'+suffix;
      function step(ts){
        const p=Math.min((ts-start)/duration,1);
        const ease=1-Math.pow(1-p,3);
        const val=target*ease;
        el.textContent=staticText+(decimals>0?val.toFixed(decimals):Math.round(val))+suffix;
        if(p<1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    }
  });
}

/* ========== ECHARTS ========== */
let echartsLoaded=false;
let tourismChart=null,comparisonChart=null,highwayChart=null;

function initCharts(){
  if(typeof echarts==='undefined') return;
  // Tourism chart
  const tourismEl=document.getElementById('echart-tourism');
  if(tourismEl&&!tourismChart){
    tourismChart=echarts.init(tourismEl,null,{renderer:'canvas'});
    tourismChart.setOption({
      backgroundColor:'transparent',
      tooltip:{trigger:'axis',backgroundColor:'rgba(10,22,40,.92)',borderColor:'rgba(255,255,255,.1)',textStyle:{color:'#eae8e4',fontSize:12}},
      legend:{data:['游客接待量（亿人次）','旅游收入（亿元）'],top:12,right:16,textStyle:{color:'rgba(234,232,228,.5)',fontSize:11},itemWidth:14,itemHeight:3},
      grid:{top:50,bottom:36,left:50,right:50},
      xAxis:{type:'category',data:['2019','2020','2021','2022','2023','2024','2025'],
        axisLine:{lineStyle:{color:'rgba(255,255,255,.08)'}},
        axisLabel:{color:'rgba(234,232,228,.4)',fontSize:11},axisTick:{show:false}},
      yAxis:[
        {type:'value',name:'亿人次',nameTextStyle:{color:'rgba(234,232,228,.3)',fontSize:10},
         axisLine:{show:false},axisLabel:{color:'rgba(234,232,228,.35)',fontSize:10},
         splitLine:{lineStyle:{color:'rgba(255,255,255,.04)'}}},
        {type:'value',name:'亿元',nameTextStyle:{color:'rgba(234,232,228,.3)',fontSize:10},
         axisLine:{show:false},axisLabel:{color:'rgba(234,232,228,.35)',fontSize:10},
         splitLine:{show:false}}
      ],
      series:[
        {name:'游客接待量（亿人次）',type:'line',yAxisIndex:0,
         data:[2.13,1.58,1.91,1.25,2.65,3.02,3.23],smooth:true,symbol:'circle',symbolSize:5,
         lineStyle:{color:'#4FC3C0',width:2},itemStyle:{color:'#4FC3C0'},
         areaStyle:{color:new echarts.graphic.LinearGradient(0,0,0,1,[{offset:0,color:'rgba(79,195,192,.25)'},{offset:1,color:'rgba(79,195,192,.02)'}])},
         animationDuration:2000},
        {name:'旅游收入（亿元）',type:'line',yAxisIndex:1,
         data:[3632,1416,1917,960,2780,3200,3700],smooth:true,symbol:'diamond',symbolSize:5,
         lineStyle:{color:'#E0628A',width:2},itemStyle:{color:'#E0628A'},
         areaStyle:{color:new echarts.graphic.LinearGradient(0,0,0,1,[{offset:0,color:'rgba(224,98,138,.15)'},{offset:1,color:'rgba(224,98,138,.02)'}])},
         animationDuration:2000,animationDelay:300}
      ]
    });
  }
  // Highway mileage bar chart
  var hwEl=document.getElementById('echart-highway');
  if(hwEl&&!highwayChart){
    highwayChart=echarts.init(hwEl,null,{renderer:'canvas'});
    var hwYears=['1949','1960','1978','2024','2025年底'];
    var hwData=[0.34,1.87,2.38,23,24.6];
    var hwDetails=[
      '新中国成立初期，新疆公路通车里程仅3361公里，平均每万平方公里仅20公里公路',
      '经过11年建设，公路里程增长5.5倍，但仍远低于全国平均水平',
      '改革开放前夕，公路里程达2.38万公里，但天山仍无高等级公路',
      '新疆公路总里程突破23万公里，但跨越天山的唯一通道仍是老路',
      '乌尉高速通车，公路里程达24.6万公里，76年增长72倍'
    ];
    highwayChart.setOption({
      backgroundColor:'transparent',
      tooltip:{
        trigger:'axis',
        backgroundColor:'rgba(10,22,40,.95)',borderColor:'rgba(255,255,255,.12)',
        textStyle:{color:'#eae8e4',fontSize:13,lineHeight:1.6},
        formatter:function(p){
          var d=p[0];
          return '<b style="font-size:14px">'+d.name+'年</b><br/>公路里程：<b style="color:#E0A23D;font-size:16px">'+d.value+'</b> 万公里<br/><span style="color:rgba(234,232,228,.6);font-size:12px">'+hwDetails[d.dataIndex]+'</span>';
        }
      },
      grid:{top:24,bottom:40,left:60,right:20},
      xAxis:{type:'category',data:hwYears,
        axisLine:{lineStyle:{color:'rgba(255,255,255,.08)'}},
        axisLabel:{color:'rgba(234,232,228,.5)',fontSize:12,fontFamily:'JetBrains Mono'},
        axisTick:{show:false}},
      yAxis:{type:'value',
        axisLine:{show:false},
        axisLabel:{color:'rgba(234,232,228,.35)',fontSize:11,fontFamily:'JetBrains Mono',formatter:'{value}万'},
        splitLine:{lineStyle:{color:'rgba(255,255,255,.05)'}}},
      series:[{
        type:'bar',data:hwData,barWidth:'36%',
        itemStyle:{
          borderRadius:[4,4,0,0],
          color:new echarts.graphic.LinearGradient(0,0,0,1,[
            {offset:0,color:'#E0A23D'},
            {offset:1,color:'rgba(224,162,61,.25)'}
          ])
        },
        emphasis:{
          itemStyle:{
            color:new echarts.graphic.LinearGradient(0,0,0,1,[
              {offset:0,color:'#F0C060'},
              {offset:1,color:'rgba(224,162,61,.5)'}
            ])
          }
        },
        animationDuration:1500,animationEasing:'cubicOut'
      }]
    });
    highwayChart.on('click',function(p){/* tooltip handles detail */});
  }
  // Comparison chart
  const compEl=document.getElementById('echart-comparison');
  if(compEl&&!comparisonChart){
    comparisonChart=echarts.init(compEl,null,{renderer:'canvas'});
    comparisonChart.setOption({
      backgroundColor:'transparent',
      tooltip:{trigger:'axis',backgroundColor:'rgba(10,22,40,.92)',borderColor:'rgba(255,255,255,.1)',textStyle:{color:'#eae8e4',fontSize:12}},
      legend:{data:['南疆','北疆'],top:12,textStyle:{color:'rgba(234,232,228,.5)',fontSize:11},itemWidth:14,itemHeight:10},
      grid:{top:50,bottom:36,left:50,right:20},
      xAxis:{type:'category',data:['2023','2024','2025'],
        axisLine:{lineStyle:{color:'rgba(255,255,255,.08)'}},
        axisLabel:{color:'rgba(234,232,228,.4)',fontSize:12},axisTick:{show:false}},
      yAxis:{type:'value',axisLine:{show:false},axisLabel:{color:'rgba(234,232,228,.35)',fontSize:10},
        splitLine:{lineStyle:{color:'rgba(255,255,255,.04)'}}},
      series:[
        {name:'南疆',type:'bar',barWidth:'30%',data:[5744,6128,6439],
         itemStyle:{color:new echarts.graphic.LinearGradient(0,0,0,1,[{offset:0,color:'#E0628A'},{offset:1,color:'rgba(224,98,138,.2)'}]),borderRadius:[3,3,0,0]},
         animationDuration:1500},
        {name:'北疆',type:'bar',barWidth:'30%',data:[11811,12681,13192],
         itemStyle:{color:new echarts.graphic.LinearGradient(0,0,0,1,[{offset:0,color:'#E0A23D'},{offset:1,color:'rgba(224,162,61,.2)'}]),borderRadius:[3,3,0,0]},
         animationDuration:1500,animationDelay:200}
      ]
    });
  }
}

function handleResize(){
  if(tourismChart) tourismChart.resize();
  if(comparisonChart) comparisonChart.resize();
  if(highwayChart) highwayChart.resize();
  // Mobile: increase chart font sizes
  const isMobile=window.innerWidth<=768;
  const fs=isMobile?13:11;
  const fsLabel=isMobile?13:10;
  if(tourismChart){
    tourismChart.setOption({
      tooltip:{textStyle:{fontSize:isMobile?14:12}},
      legend:{textStyle:{fontSize:isMobile?13:11}},
      xAxis:{axisLabel:{fontSize:isMobile?13:11}},
      yAxis:[
        {nameTextStyle:{fontSize:isMobile?12:10},axisLabel:{fontSize:isMobile?12:10}},
        {nameTextStyle:{fontSize:isMobile?12:10},axisLabel:{fontSize:isMobile?12:10}}
      ]
    });
  }
  if(comparisonChart){
    comparisonChart.setOption({
      tooltip:{textStyle:{fontSize:isMobile?14:12}},
      legend:{textStyle:{fontSize:isMobile?13:11}},
      xAxis:{axisLabel:{fontSize:isMobile?14:12}},
      yAxis:{axisLabel:{fontSize:isMobile?12:10}}
    });
  }
}

/* ========== INIT ========== */
document.addEventListener('DOMContentLoaded',function(){
  // Load ECharts
  loadScript('https://cdn.jsdelivr.net/npm/echarts@5.5.0/dist/echarts.min.js',function(){
    echartsLoaded=true;
    initCharts();
  });

  // Start button
  document.getElementById('start-btn').addEventListener('click',function(){
    initAudio();
    // Mobile fix: resume AudioContext after user gesture
    if(audioCtx && audioCtx.state==='suspended'){
      audioCtx.resume().then(function(){
        // Audio now active on mobile
      });
    }
    document.getElementById('start-overlay').classList.add('hidden');
    document.getElementById('control-bar').style.opacity='1';
    drawMeter();
    // Force-activate Act 1 (first visible section)
    currentAct=-1; // reset so setActiveAct fires
    updateUI(0);
    // Init charts after a short delay for layout
    setTimeout(initCharts,500);
    // Clear all animated flags so numbers animate fresh on scroll
    document.querySelectorAll('.big-num').forEach(el=>{delete el.dataset.animated;});
    // Trigger initial number animation check
    setTimeout(function(){animateBigNums();animateDualNums();},300);
  });

  // Mute button
  document.getElementById('mute-btn').addEventListener('click',function(){
    muted=!muted;
    if(masterGain){
      masterGain.gain.linearRampToValueAtTime(muted?0:0.85,audioCtx.currentTime+0.3);
    }
    this.textContent=muted?'🔇 已静音':'🔊 声音开启';
  });

  // Audio trigger buttons
  document.querySelectorAll('.audio-trigger-btn').forEach(btn=>{
    btn.addEventListener('click',function(){
      const type=this.dataset.sound;
      if(type) playInteractive(type,this);
    });
  });

  // Dot nav click
  dotLinks.forEach(link=>{
    link.addEventListener('click',function(e){
      e.preventDefault();
      const target=document.getElementById(this.getAttribute('href').slice(1));
      if(target) target.scrollIntoView({behavior:'smooth'});
    });
  });

  // Compare table click interaction
  var ctRows=document.querySelectorAll('#compare-table tbody tr');
  var ctPanel=document.getElementById('compare-detail-panel');
  if(ctRows.length&&ctPanel){
    ctRows.forEach(function(row){
      row.addEventListener('click',function(){
        var detail=this.getAttribute('data-detail');
        var label=this.querySelector('td').textContent;
        if(!detail) return;
        ctRows.forEach(function(r){r.classList.remove('active-row');});
        this.classList.add('active-row');
        ctPanel.style.display='block';
        ctPanel.innerHTML='<b style="color:var(--ink)">'+label+'：</b>'+detail;
      });
    });
  }

  // ===== Text entrance animations =====
  function initTextAnimations(){
    const map=[
      {sel:'.prose-block',cls:'anim-slide-up'},
      {sel:'.pull-quote',cls:'anim-slide-up'},
      {sel:'.data-callout',cls:'anim-slide-left'},
      {sel:'.injected-image',cls:'anim-fade-in'},
      {sel:'.big-stat',cls:'anim-scale-in'},
      {sel:'.sub-heading',cls:'anim-slide-up'},
      {sel:'.audio-trigger-wrap',cls:'anim-fade-in'},
      {sel:'.triple-stat',cls:'anim-slide-up'},
      {sel:'.ending-cta',cls:'anim-fade-in'},
      {sel:'.act-header',cls:'anim-slide-up'},
      {sel:'.data-table-wrap',cls:'anim-fade-in'},
      {sel:'.tourism-compare',cls:'anim-fade-in'},
      {sel:'#route-stations',cls:'anim-fade-in'},
      {sel:'.section-tag',cls:'anim-fade-in'},
      {sel:'.compare-table',cls:'anim-slide-up'},
      {sel:'.soul-quote',cls:'anim-fade-in'}
    ];
    map.forEach(function(item){
      document.querySelectorAll(item.sel).forEach(function(el){
        el.classList.add(item.cls);
      });
    });
  }
  initTextAnimations();

  const textAnimObs=new IntersectionObserver(function(entries){
    entries.forEach(function(entry){
      if(entry.isIntersecting){
        entry.target.classList.add('visible');
        textAnimObs.unobserve(entry.target);
      }
    });
  },{threshold:0.1,rootMargin:'0px 0px -40px 0px'});

  document.querySelectorAll('.anim-slide-up,.anim-slide-left,.anim-fade-in,.anim-scale-in,.anim-slide-right').forEach(function(el){
    textAnimObs.observe(el);
  });

  // Scroll
  window.addEventListener('scroll',function(){
    updateProgress();
    animateBigNums();
    animateDualNums();
  },{passive:true});
  window.addEventListener('resize',handleResize);

  // Initial big num check
  animateBigNums();
  animateDualNums();
});

})();