/* 触れるMV 共通の音まわり（曲が変わっても使い回せる部分）
   - ステム（歌／伴奏…）を頭ぴったり同時再生。ステムが無ければ full 1本で動く
   - 長押し用：伴奏だけローパス＋音量ダウン、歌は少し前へ（setHold）
   - 拍の時計（BPMと頭の位置から）と、拍に寄せて鳴らす効果音（太鼓・琴・鈴）
   使い方：const P=new StemPlayer({dir:'audio/',stems:['vocal','inst'],full:'full',bpm:182,phase:0.51});
           await P.load(p=>…); P.start(); 毎フレーム P.time() */
class StemPlayer{
  constructor(o){
    this.o=o;this.bpm=o.bpm;this.spb=60/o.bpm;this.phase=o.phase||0;
    const AC=window.AudioContext||window.webkitAudioContext;
    this.ac=new AC({latencyHint:'interactive'});
    const ac=this.ac;
    this.out=ac.createGain();this.out.gain.value=1;
    this.limit=ac.createDynamicsCompressor();this.limit.threshold.value=-3;this.limit.ratio.value=12;this.limit.attack.value=.002;this.limit.release.value=.12;
    this.an=ac.createAnalyser();this.an.fftSize=256;this.an.smoothingTimeConstant=.55;this.fd=new Uint8Array(this.an.frequencyBinCount);
    this.out.connect(this.limit);this.limit.connect(this.an);this.an.connect(ac.destination);
    // 曲：伴奏は lp→hp→instGain、歌は vocalGain
    this.music=ac.createGain();this.music.gain.value=.84;this.music.connect(this.out);
    this.lp=ac.createBiquadFilter();this.lp.type='lowpass';this.lp.frequency.value=20000;this.lp.Q.value=4;
    this.hp=ac.createBiquadFilter();this.hp.type='highpass';this.hp.frequency.value=10;this.hp.Q.value=3;
    this.instGain=ac.createGain();this.vocalGain=ac.createGain();
    this.lp.connect(this.hp);this.hp.connect(this.instGain);this.instGain.connect(this.music);this.vocalGain.connect(this.music);
    // 効果音：少し残響っぽいディレイつき
    this.se=ac.createGain();this.se.gain.value=.5;this.se.connect(this.out);
    const dl=ac.createDelay(1);dl.delayTime.value=this.spb*.75;const fb=ac.createGain();fb.gain.value=.28;const dlp=ac.createBiquadFilter();dlp.type='lowpass';dlp.frequency.value=2600;
    this.se.connect(dl);dl.connect(dlp);dlp.connect(fb);fb.connect(dl);const wet=ac.createGain();wet.gain.value=.35;dlp.connect(wet);wet.connect(this.out);
    this.noise=ac.createBuffer(1,ac.sampleRate,ac.sampleRate);const d=this.noise.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
    this.buf={};this.src=[];this.t0=0;this.playing=false;this.hasStems=false;this.duration=0;this.muted=false;this.onended=null;
  }
  async _get(name,prog){
    const r=await fetch(this.o.dir+name+'.mp3');if(!r.ok)throw new Error('no '+name);
    const total=+r.headers.get('content-length')||0;let ab;
    if(r.body&&total){const rd=r.body.getReader(),chunks=[];let got=0;for(;;){const{done,value}=await rd.read();if(done)break;chunks.push(value);got+=value.length;prog(got/total)}
      const u=new Uint8Array(got);let p=0;for(const c of chunks){u.set(c,p);p+=c.length}ab=u.buffer}
    else ab=await r.arrayBuffer();
    return await new Promise((ok,ng)=>this.ac.decodeAudioData(ab,ok,ng));
  }
  async load(onProgress=()=>{}){
    const names=this.o.stems||[];let ok=names.length>0;
    if(ok){ // ステムがあるか先に確認（無ければ full へ）
      for(const n of names){try{const h=await fetch(this.o.dir+n+'.mp3',{method:'HEAD'});if(!h.ok)ok=false}catch(e){ok=false}}
    }
    const list=ok?names:[this.o.full];const pr=list.map(()=>0);
    const bufs=await Promise.all(list.map((n,i)=>this._get(n,p=>{pr[i]=p;onProgress(pr.reduce((a,b)=>a+b,0)/list.length)})));
    list.forEach((n,i)=>this.buf[n]=bufs[i]);this.hasStems=ok;this.music.gain.value=ok?(this.o.stemGain||1):.84;this.duration=Math.max(...bufs.map(b=>b.duration));onProgress(1);
  }
  unlock(){ // タップの中で呼ぶ（iPhoneの消音スイッチ対策つき）
    try{if(navigator.audioSession)navigator.audioSession.type='playback'}catch(e){}
    return this.ac.resume();
  }
  start(offset=0){
    this.stop();const ac=this.ac,when=ac.currentTime+.08;
    for(const n in this.buf){const s=ac.createBufferSource();s.buffer=this.buf[n];s.connect(n==='vocal'?this.vocalGain:this.lp);s.start(when,offset);this.src.push(s)}
    this.t0=when-offset;this.playing=true;this._endT=0;
    const first=this.src[0];first.onended=()=>{if(this.src[0]===first&&this.time()>=this.duration-.3){this.playing=false;this._endT=this.duration;this.onended&&this.onended()}};
  }
  stop(){this.src.forEach(s=>{s.onended=null;try{s.stop()}catch(e){}});this.src=[];this.playing=false}
  pause(){return this.ac.suspend()}
  resume(){return this.ac.resume()}
  time(){return this.playing?Math.max(0,Math.min(this.duration,this.ac.currentTime-this.t0)):(this._endT||0)}
  beats(t=this.time()){return (t-this.phase)/this.spb}
  setMuted(m){this.muted=m;this.out.gain.setTargetAtTime(m?0:1,this.ac.currentTime,.03)}
  /* 長押し：a=0〜1（かかり具合）、depth=0〜1（1で一番こもる） */
  setHold(a,depth=.6){
    const now=this.ac.currentTime,cut=a>0?20000*Math.pow(.012+(1-depth)*.1,a):20000;
    this.lp.frequency.setTargetAtTime(Math.max(180,cut),now,.07);
    this.instGain.gain.setTargetAtTime(1-a*(this.hasStems?.6:.35),now,.08);
    this.vocalGain.gain.setTargetAtTime(1+a*.35,now,.08);
  }
  /* 回す操作：x=0〜1 で低音を抜いていく */
  setSweep(x){this.hp.frequency.setTargetAtTime(10+Math.pow(Math.min(1,x),2)*1800,this.ac.currentTime,.05)}
  /* いまの音の大きさ：{low,mid,all}（0〜1） */
  level(){this.an.getByteFrequencyData(this.fd);let l=0,m=0,a=0;const f=this.fd;for(let i=0;i<4;i++)l+=f[i];for(let i=8;i<40;i++)m+=f[i];for(let i=0;i<64;i++)a+=f[i];return{low:l/4/255,mid:m/32/255,all:a/64/255}}
  /* 次の「1拍のdiv分の1」の時刻（すぐ手前なら今）。操作の音を曲に寄せる */
  q(div=2){const g=this.spb/div,now=this.ac.currentTime,t=now-this.t0-this.phase,n=Math.round(t/g)*g;const w=this.t0+this.phase+n;return w<now?(now-w<.05?now:w+g):w}
  _env(g,t,a,peak,d){g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(peak,t+a);g.gain.exponentialRampToValueAtTime(.0001,t+a+d)}
  _osc(type,f,t,dur,dest){const o=this.ac.createOscillator();o.type=type;o.frequency.setValueAtTime(f,t);o.connect(dest);o.start(t);o.stop(t+dur+.05);return o}
  _noise(t,dur,dest){const s=this.ac.createBufferSource();s.buffer=this.noise;s.connect(dest);s.start(t,Math.random()*.5);s.stop(t+dur)}
  static hz(m){return 440*Math.pow(2,(m-69)/12)}
  taiko(t=this.ac.currentTime,v=1,pan=0){const ac=this.ac,p=this._pan(pan);const g=ac.createGain();g.connect(p);this._env(g,t,.003,v,.42);const o=this._osc('sine',118,t,.5,g);o.frequency.exponentialRampToValueAtTime(48,t+.22);
    const f=ac.createBiquadFilter();f.type='bandpass';f.frequency.value=900;const g2=ac.createGain();f.connect(g2);g2.connect(p);this._env(g2,t,.001,v*.5,.05);this._noise(t,.08,f)}
  koto(m,t=this.ac.currentTime,v=.5,pan=0){const ac=this.ac,hz=StemPlayer.hz(m),p=this._pan(pan);const f=ac.createBiquadFilter();f.type='lowpass';f.frequency.setValueAtTime(5200,t);f.frequency.exponentialRampToValueAtTime(800,t+.5);
    const g=ac.createGain();f.connect(g);g.connect(p);this._env(g,t,.003,v,.8);const o=this._osc('triangle',hz*1.014,t,.9,f);o.frequency.exponentialRampToValueAtTime(hz,t+.035);
    const g2=ac.createGain();g2.gain.value=.22;g2.connect(f);this._osc('sawtooth',hz,t,.1,g2)}
  bell(m,t=this.ac.currentTime,v=.3,pan=0){const hz=StemPlayer.hz(m),p=this._pan(pan);[1,2.76,5.4,8.9].forEach((r,i)=>{const g=this.ac.createGain();g.connect(p);this._env(g,t,.002,v/(1+i*1.4),1.3/(1+i*.6));this._osc('sine',hz*r,t,1.4,g)})}
  _pan(x){if(!this.ac.createStereoPanner)return this.se;const p=this.ac.createStereoPanner();p.pan.value=Math.max(-1,Math.min(1,x));p.connect(this.se);return p}
}
