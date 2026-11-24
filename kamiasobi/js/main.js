/* 「神様、あそびましょ。」触れるMV 本体
   背景＝WebGLのシェーダー（和紙→色がにじんで広がる空・柄）
   手前＝2Dキャンバス（咲いた花やお札は world に焼き付けて残す／龍・花火・月・鈴・弦・ウノ）
   曲の時間（P.time()）で場面が進み、触ると映像と音が変わる */
(()=>{'use strict';
const S=SONG,$=id=>document.getElementById(id);
const app=$('app'),world=$('world'),glc=$('bg'),cv=$('fx'),ctx=cv.getContext('2d');
const P=new StemPlayer({dir:S.audio.dir,stems:S.audio.stems,full:S.audio.full,stemGain:S.audio.stemGain,bpm:S.bpm,phase:S.phase});
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
const INK='#1c1238',PINK='#ff4fb3',CYAN='#35d6ff',YEL='#ffe14a',PUR='#8a5cff';
const POP=[PINK,CYAN,YEL,PUR,'#ff9ad5','#ffffff'],PETAL=['#ff8fcf','#ffc1e3','#ffffff','#ff4fb3','#ffd6f0'];
const KAN='一二三四五六七八九十';
const rnd=(a=1,b)=>b===undefined?Math.random()*a:a+Math.random()*(b-a);
const pick=a=>a[Math.random()*a.length|0];
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const hex=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255);
const TAU=Math.PI*2;
let W=1,H=1,DPR=1,T=0,songT=0,running=false,ended=false,pulse=0,beats=0,shake=0;

/* ---------- 背景（シェーダー） ---------- */
const gl=glc.getContext('webgl',{antialias:false,alpha:false});
const U={};const rip=new Float32Array(12).fill(-9);let ripI=0;
if(gl){
  const FS=`precision highp float;
uniform vec2 uRes;uniform float uT,uPulse,uInk,uPat,uAmt,uDark,uSpin,uHue,uStar;uniform vec3 uA,uB,uC;uniform vec3 uRip[4];
float h(vec2 p){p=fract(p*vec2(.1031,.1030));p+=dot(p,p.yx+33.33);return fract((p.x+p.y)*p.x);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1.,0.)),f.x),mix(h(i+vec2(0.,1.)),h(i+1.),f.x),f.y);}
float fbm(vec2 p){float a=.5,s=0.;for(int i=0;i<4;i++){s+=a*n(p);p=p*2.03+7.1;a*=.5;}return s;}
float seig(vec2 p){float hit=-1.;for(int dj=2;dj>=-2;dj--){float j=floor(p.y*2.)+float(dj);for(int di=-1;di<=1;di++){vec2 c=vec2(floor(p.x)+float(di)+.5*mod(j,2.),j*.5);float d=length(p-c);if(d<.5)hit=d;}}return hit<0.?0.:step(.5,fract(hit*6.));}
void main(){
 vec2 uv=gl_FragCoord.xy/uRes;float asp=uRes.x/uRes.y;vec2 p=(uv-.5)*vec2(asp,1.);
 for(int i=0;i<4;i++){vec3 r=uRip[i];float age=uT-r.z;vec2 d=p-(r.xy-.5)*vec2(asp,1.);float l=length(d);p+=d/(l+1e-4)*sin(l*34.-age*13.)*.02*exp(-age*2.2)*step(l,age*1.1)*step(0.,age);}
 float fib=fbm(p*5.+2.)*.6+fbm(vec2(p.x*46.,p.y*3.)+9.)*.4;
 vec3 paper=vec3(.965,.937,.878)-.075*fib+.03*(h(gl_FragCoord.xy)-.5);
 float cs=cos(uSpin),sn=sin(uSpin);vec2 q=mat2(cs,-sn,sn,cs)*p;
 vec3 sky=mix(uB,uA,smoothstep(-.45,.5,q.y+.06*sin(q.x*4.+uT*.4)));
 float m=0.;
 if(uPat>.5&&uPat<1.5)m=seig(q*4.+vec2(0.,uT*.12));
 else if(uPat>1.5&&uPat<2.5){vec2 c=q+vec2(0.,.12);m=step(.5,fract(atan(c.y,c.x)/6.2832*20.+uT*.1));m=mix(m,1.,step(length(c),.15+uPulse*.03));}
 else if(uPat>2.5){vec2 g=q*5.+vec2(uT*.15);m=mod(floor(g.x)+floor(g.y),2.);}
 sky=mix(sky,uC,m*uAmt*.6);
 sky+=step(.9975,h(floor(q*110.)))*(.6+.4*sin(uT*3.+q.x*40.))*uStar;
 float l0=dot(sky,vec3(.3,.59,.11));sky=mix(sky,vec3(l0*.3)+vec3(.02,.02,.09),uDark);
 float ch=cos(uHue),sh=sin(uHue);vec3 k=vec3(.57735);sky=sky*ch+cross(k,sky)*sh+k*dot(k,sky)*(1.-ch);
 float th=uInk*1.55-.02;float edge=fbm(p*3.+7.)*.7+length(p)*.55;float mask=smoothstep(edge-.06,edge+.06,th);
 vec3 col=mix(paper,sky*(.93+.12*fib),mask);
 col=mix(col,vec3(.11,.07,.22),(1.-smoothstep(0.,.035,abs(edge-th)))*.8*step(.01,uInk)*step(uInk,.995));
 col+=uPulse*.035*mask;col*=1.-.25*pow(length(p)*1.05,3.);
 gl_FragColor=vec4(col,1.);}`;
  const mk=(t,s)=>{const o=gl.createShader(t);gl.shaderSource(o,s);gl.compileShader(o);if(!gl.getShaderParameter(o,gl.COMPILE_STATUS))console.error(gl.getShaderInfoLog(o));return o};
  const pr=gl.createProgram();gl.attachShader(pr,mk(gl.VERTEX_SHADER,'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}'));gl.attachShader(pr,mk(gl.FRAGMENT_SHADER,FS));gl.linkProgram(pr);gl.useProgram(pr);
  gl.bindBuffer(gl.ARRAY_BUFFER,gl.createBuffer());gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
  const loc=gl.getAttribLocation(pr,'p');gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
  ['uRes','uT','uPulse','uInk','uPat','uAmt','uDark','uSpin','uHue','uStar','uA','uB','uC'].forEach(n=>U[n]=gl.getUniformLocation(pr,n));U.uRip=gl.getUniformLocation(pr,'uRip[0]');
}
/* いまの見た目（場面の値へなめらかに寄せる） */
const V={ink:0,amt:0,dark:0,uno:0,star:0,worldA:1,A:hex('#f6efe0'),B:hex('#f6efe0'),C:hex('#ff4fb3'),pat:0};
let moonAng=0,spinVel=0,hueAdd=0;
function renderBG(){
  if(!gl)return;
  gl.viewport(0,0,glc.width,glc.height);
  gl.uniform2f(U.uRes,glc.width,glc.height);gl.uniform1f(U.uT,T);gl.uniform1f(U.uPulse,reduce?0:pulse);gl.uniform1f(U.uInk,V.ink);gl.uniform1f(U.uPat,V.pat);gl.uniform1f(U.uAmt,V.amt);
  gl.uniform1f(U.uDark,clamp(V.dark));gl.uniform1f(U.uSpin,moonAng*.25);gl.uniform1f(U.uHue,moonAng*.5+hueAdd);gl.uniform1f(U.uStar,V.star);
  gl.uniform3fv(U.uA,V.A);gl.uniform3fv(U.uB,V.B);gl.uniform3fv(U.uC,V.C);gl.uniform3fv(U.uRip,rip);
  gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
}
function ripple(x,y){rip[ripI*3]=x/W;rip[ripI*3+1]=1-y/H;rip[ripI*3+2]=T;ripI=(ripI+1)%4}

/* ---------- 画像（ウノ） ---------- */
const IMG={b:[],f:[],sil:[]};
const loadImg=src=>new Promise(r=>{const i=new Image();i.onload=()=>r(i);i.onerror=()=>r(null);i.src=src});
IMG.c=[];
function silOf(im){const c=document.createElement('canvas');c.width=im.width>>1;c.height=im.height>>1;const x=c.getContext('2d');x.drawImage(im,0,0,c.width,c.height);x.globalCompositeOperation='source-in';x.fillStyle=INK;x.fillRect(0,0,c.width,c.height);return c}
async function loadImages(){
  const job=[];
  for(let i=0;i<4;i++){job.push(loadImg('chars/b'+i+'.webp').then(im=>IMG.b[i]=im));job.push(loadImg('chars/f'+i+'.webp').then(im=>IMG.f[i]=im))}
  for(let i=1;i<=6;i++)job.push(loadImg('chars/c'+i+'.webp').then(im=>IMG.c[i]=im));
  await Promise.all(job);
  IMG.b[4]=IMG.c[4]||IMG.b[3];IMG.b[5]=IMG.c[5]||IMG.b[2];IMG.b[6]=IMG.c[6]||IMG.b[0]; // 4=膝を抱える 5=手を差し伸べる 6=跳ぶ
  IMG.b.forEach((im,i)=>{if(im)IMG.sil[i]=silOf(im)});IMG.csil=IMG.c.map(im=>im?silOf(im):null);
}

/* ---------- 残るもの（花・お札・創ったもの） ---------- */
const wc=document.createElement('canvas'),wctx=wc.getContext('2d');
let made=[],prevMade=[];const blooms=[];
const st={flowers:0,dragons:0,spin:0,hits:0,touches:0,together:0,count:4,create:0,lap:1,eclipse:false,pokes:0,bells:0,strings:0,pinch:0,gold:false,hundred:false,angry:false};
function blob(c,cs,fill,lw){c.fillStyle=INK;cs.forEach(a=>{c.beginPath();c.arc(a[0],a[1],a[2]+lw,0,TAU);c.fill()});c.fillStyle=fill;cs.forEach(a=>{c.beginPath();c.arc(a[0],a[1],a[2],0,TAU);c.fill()})}
function poly(c,pts,fill,lw){c.beginPath();pts.forEach((p,i)=>i?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1]));c.closePath();c.lineJoin='round';c.strokeStyle=INK;c.lineWidth=lw*2;c.stroke();c.fillStyle=fill;c.fill()}
function sakura(c,r,col,n){
  for(let pass=0;pass<2;pass++)for(let i=0;i<n;i++){c.save();c.rotate(i/n*TAU);const w=5/n;c.beginPath();c.moveTo(0,0);c.bezierCurveTo(-r*.55*w,-r*.35,-r*.5*w,-r*.95,-r*.12*w,-r);c.lineTo(0,-r*.82);c.lineTo(r*.12*w,-r);c.bezierCurveTo(r*.5*w,-r*.95,r*.55*w,-r*.35,0,0);
    if(!pass){c.lineJoin='round';c.lineWidth=r*.2;c.strokeStyle=INK;c.stroke()}else{c.fillStyle=col;c.fill()}c.restore()}
  c.fillStyle=YEL;c.beginPath();c.arc(0,0,r*.2,0,TAU);c.fill();c.strokeStyle=INK;c.lineWidth=r*.06;c.stroke();
}
function drawStamp(c,s,k=1,a=1){
  const z=s.z*W,lw=z*.09;c.save();c.globalAlpha=a;c.translate(s.x*W,s.y*H);c.rotate(s.r);c.scale(k,k);
  switch(s.k){
    case 'f':sakura(c,z,s.col,s.n);break;
    case 'cloud':blob(c,[[-z*.55,z*.05,z*.36],[0,-z*.15,z*.5],[z*.58,z*.08,z*.32]],'#fff',lw);break;
    case 'mount':poly(c,[[-z,z*.6],[0,-z*.75],[z,z*.6]],s.col,lw);poly(c,[[-z*.3,-z*.3],[0,-z*.75],[z*.3,-z*.3],[z*.1,-z*.42],[-z*.08,-z*.26]],'#fff',lw*.5);break;
    case 'torii':{const r='#ff3b4e';poly(c,[[-z*.62,-z*.3],[-z*.42,-z*.3],[-z*.38,z*.8],[-z*.66,z*.8]],r,lw);poly(c,[[z*.42,-z*.3],[z*.62,-z*.3],[z*.66,z*.8],[z*.38,z*.8]],r,lw);poly(c,[[-z*.8,-z*.12],[z*.8,-z*.12],[z*.8,z*.08],[-z*.8,z*.08]],r,lw);poly(c,[[-z*1.05,-z*.72],[z*1.05,-z*.72],[z*.92,-z*.42],[-z*.92,-z*.42]],r,lw);break}
    case 'pine':poly(c,[[-z*.12,z*.2],[z*.12,z*.2],[z*.14,z*.85],[-z*.14,z*.85]],'#a86a3c',lw);blob(c,[[-z*.4,z*.05,z*.4],[z*.4,z*.05,z*.4],[0,-z*.4,z*.48]],'#3fd08a',lw);break;
    case 'star':{const p=[];for(let i=0;i<10;i++){const r=i%2?z*.42:z,a2=i/10*TAU-Math.PI/2;p.push([Math.cos(a2)*r,Math.sin(a2)*r])}poly(c,p,YEL,lw);break}
    case 'ofuda':poly(c,[[-z*.42,-z],[z*.42,-z],[z*.42,z],[-z*.42,z]],'#fffdf2',lw);c.strokeStyle='#ff3b4e';c.lineWidth=lw*.8;c.strokeRect(-z*.28,-z*.84,z*.56,z*1.68);c.fillStyle=INK;c.font=`${z*.62}px "Dela Gothic One",sans-serif`;c.textAlign='center';c.textBaseline='middle';c.fillText(KAN[s.n%10],0,0);break;
    case 'daruma':blob(c,[[0,z*.1,z*.8],[0,-z*.35,z*.6]],'#ff3b4e',lw);c.fillStyle='#ffe9cf';c.beginPath();c.ellipse(0,-z*.3,z*.42,z*.34,0,0,TAU);c.fill();c.fillStyle=INK;[-1,1].forEach(d=>{c.beginPath();c.arc(d*z*.18,-z*.32,z*.09,0,TAU);c.fill()});c.fillStyle=YEL;c.fillRect(-z*.22,z*.25,z*.44,z*.1);break;
    case 'ball':blob(c,[[0,0,z*.7]],s.col,lw);c.save();c.beginPath();c.arc(0,0,z*.7,0,TAU);c.clip();for(let i=0;i<6;i++){c.rotate(TAU/6);c.fillStyle=i%2?YEL:'#fff';c.beginPath();c.ellipse(0,-z*.42,z*.12,z*.4,0,0,TAU);c.fill()}c.restore();break;
    case 'wheel':c.strokeStyle=INK;c.lineWidth=lw*1.6;c.beginPath();c.moveTo(0,0);c.lineTo(z*.25,z*1.3);c.stroke();for(let i=0;i<4;i++){c.rotate(TAU/4);poly(c,[[0,0],[z*.75,-z*.05],[z*.4,-z*.55]],[PINK,CYAN,YEL,PUR][i],lw*.7)}blob(c,[[0,0,z*.12]],'#fff',lw*.6);break;
    case 'light':{const g=c.createRadialGradient(0,0,0,0,0,z*2.4);g.addColorStop(0,'rgba(255,244,190,.95)');g.addColorStop(.25,'rgba(255,225,74,.5)');g.addColorStop(1,'rgba(255,225,74,0)');c.fillStyle=g;c.beginPath();c.arc(0,0,z*2.4,0,TAU);c.fill();break}
  }
  c.restore();
}
function addStamp(k,x,y,o={}){
  const s=Object.assign({k,x:x/W,y:y/H,z:rnd(.075,.115),r:rnd(-.35,.35),col:pick(PETAL),n:5},o);
  blooms.push({s,t0:T});return s;
}
function bake(s){drawStamp(wctx,s);if(made.length<900)made.push(s)}
function rebake(list=made){wctx.setTransform(DPR,0,0,DPR,0,0);wctx.clearRect(0,0,W,H);list.forEach(s=>drawStamp(wctx,s))}

/* ---------- 飛ぶもの ---------- */
const parts=[],rings=[],cracks=[],dragons=[],floats=[];
function part(o){if(parts.length>560)parts.shift();o.max=o.life;o.r=o.r||0;parts.push(o)}
function petals(x,y,n,sp=5){for(let i=0;i<n;i++){const a=rnd(TAU),v=rnd(1,sp);part({ty:'p',x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v-1.5,g:.07,life:rnd(.7,1.5),z:rnd(5,11),col:pick(PETAL),vr:rnd(-.3,.3)})}}
function inkSplash(x,y,n){for(let i=0;i<n;i++){const a=rnd(TAU),v=rnd(1,7);part({ty:'i',x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,g:.12,life:rnd(.3,.65),z:rnd(1.5,5.5),col:INK})}}
function sparks(x,y,n,col,sp=6){for(let i=0;i<n;i++){const a=rnd(TAU),v=rnd(sp*.3,sp);part({ty:'s',x,y,px:x,py:y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,g:.05,life:rnd(.5,1.1),z:rnd(2,4.5),col:col||pick(POP)})}}
function firework(x,y,big=1){const c1=pick(POP),c2=pick(POP),n=(reduce?26:54)*big|0;for(let i=0;i<n;i++){const a=i/n*TAU+rnd(.1),v=(i%2?7.5:4.6)*big*(W/390)*rnd(.9,1.1);part({ty:'s',x,y,px:x,py:y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,g:.06,drag:.955,life:rnd(.9,1.4),z:rnd(2.5,4.5),col:i%2?c1:c2})}ring(x,y,'#fff',W*.26)}
function hearts(x,y,n){for(let i=0;i<n;i++)part({ty:'h',x:x+rnd(-20,20),y,vx:rnd(-1,1),vy:rnd(-3.5,-1.5),g:-.01,life:rnd(.7,1.2),z:rnd(9,16),col:pick([PINK,'#ff9ad5','#fff'])})}
function ring(x,y,col,max){rings.push({x,y,t0:T,col:col||'#fff',max:max||W*.2});if(rings.length>24)rings.shift()}
function crack(x,y){const ls=[];const n=6+(Math.random()*3|0);for(let i=0;i<n;i++){let a=i/n*TAU+rnd(-.3,.3),px=x,py=y;const l=[[px,py]];for(let j=0;j<5;j++){a+=rnd(-.5,.5);const d=rnd(.05,.11)*W;px+=Math.cos(a)*d;py+=Math.sin(a)*d;l.push([px,py])}ls.push(l)}cracks.push({ls,t0:T});if(cracks.length>8)cracks.shift()}
function floatText(txt,x,y,size,col){floats.push({txt,x,y,size,col:col||'#fff',t0:T,r:rnd(-.25,.25)});if(floats.length>14)floats.shift()}
function light(x,y){for(let i=0;i<3;i++)part({ty:'l',x:x+rnd(-14,14),y:y+rnd(-14,14),vx:rnd(-.3,.3),vy:rnd(-.9,-.2),g:0,life:rnd(1.6,3),z:rnd(5,10),col:YEL})}
function newDragon(x,y,o={}){
  if(dragons.length>=4)return null;
  st.dragons++;const gold=st.dragons%8===0;
  const pal=gold?[YEL,'#fff']:pick([[CYAN,PUR],[PINK,YEL],[PUR,'#ff9ad5'],['#3fd08a',CYAN]]);
  const d=Object.assign({pts:Array.from({length:gold?52:38},()=>({x,y})),tx:x,ty:y,free:false,ang:0,life:2.6,seed:rnd(9),c1:pal[0],c2:pal[1],sc:gold?1.5:1},o);
  dragons.push(d);if(gold){st.gold=true;toast('黄金の龍！')}return d;
}

/* ---------- 月・鈴・弦 ---------- */
const bells=[0,1,2,3,4].map(i=>({i,a:0,v:0,cool:0}));
const strs=[0,1,2,3,4,5].map(i=>({i,amp:0}));
let moonA=0,bellA=0,strA=0;
const moonPos=()=>[W*.5,H*.31,Math.min(W*.3,H*.2)];
const bellPos=b=>{const x=W*(b.i+1)/6,y0=H*.058,l=H*.052;return[x+Math.sin(b.a)*l,y0+Math.cos(b.a)*l,x,y0]};
function ringBell(b,v=1){if(T-b.cool<.12)return;b.cool=T;st.bells++;b.v+=(Math.random()<.5?-1:1)*.25*v;const[x,y]=bellPos(b);sparks(x,y,5,YEL,3);if(running)P.bell(S.key[5+b.i]+12,P.q(2),.22*v,(b.i-2)/2.5)}
function pluck(s,v=1){s.amp=1;st.strings++;if(running)P.koto(S.key[2+s.i],P.q(4),.5*v,(s.i-2.5)/3)}

/* ---------- ウノ ---------- */
const uno={pose:0,want:0,jump:0,vy:0,sq:0,over:-1,overT:0,pokes:[],peek:0,peekTo:0,idle:0};
const POSE_K=[1,1,1,1,.6,.94,.98];
const unoH=()=>Math.min(V.uno*H,V.uno*W*1.95)*POSE_K[uno.pose];
const unoBox=()=>{const h=unoH(),im=IMG.b[uno.pose],w=im?h*im.width/im.height:h*.6;return{x:W*.5,y:H*.985,w,h}};
function hitUno(x,y){if(V.uno<.2)return false;const b=unoBox();return Math.abs(x-b.x)<b.w*.3&&y>b.y-b.h*.97&&y<b.y}
function poke(x,y){
  st.touches++;st.pokes++;uno.vy=-9*(H/800);uno.sq=.14;uno.pokes=uno.pokes.filter(t=>T-t<4);uno.pokes.push(T);
  const angry=uno.pokes.length>=7;uno.over=angry?1:pick([0,2,3].filter(p=>p!==uno.pose));uno.overT=T+1.3;
  hearts(x,y,angry?0:5);if(angry){st.angry=true;toast('もうっ！');uno.pokes=[];inkSplash(x,y,10)}
  ring(x,y,PINK);if(running)P.bell(S.key[7]+12+(angry?-12:0),P.ac.currentTime,.25,0);
}

/* ---------- アップの絵の割り込み ---------- */
// [出る, 消える, 絵の番号, 指先の位置(絵の中の割合) または null]
const CUTS=[[37.3,39.95,1,[.166,.46]],[40.04,42.5,3,null],[66.34,68.95,1,[.166,.46]]];
function cutNow(){
  if(!running)return null;const now=P.time(),c=CUTS.find(c=>now>=c[0]&&now<c[1]);if(!c)return null;const im=IMG.c[c[2]];if(!im)return null;
  const u=clamp((now-c[0])/.28),o=clamp((c[1]-now)/.2),e0=1+2.7*Math.pow(u-1,3)+1.7*Math.pow(u-1,2),e=Math.min(e0,o*1.2);
  const h=Math.min(H*.58,W*1.45),w=h*im.width/im.height,yB=H*.92,x=W*.5-w*.5+(1-e)*W*1.25+(c[3]?W*.06:0),y=yB-h+W*.02;
  return[im,e,{x,y,w,h,yB,tip:c[3]?[x+w*c[3][0],y+h*c[3][1]]:null},c[2]];
}
function tipTap(x,y){ // 突き出した指先に「ちょん」
  const cu=cutNow();if(!cu||!cu[2].tip)return false;const[tx,ty]=cu[2].tip;if(Math.hypot(x-tx,y-ty)>W*.17)return false;
  st.touches++;st.chon=(st.chon||0)+1;floatText('ちょん',tx+W*.12,ty-W*.16,W*.13,PINK);ring(tx,ty,YEL,W*.3);ripple(tx,ty);sparks(tx,ty,14,YEL,7);
  for(let i=0;i<5;i++){const a=i/5*TAU+rnd(.5),r=W*rnd(.12,.26);setTimeout(()=>running&&flower(tx+Math.cos(a)*r,ty+Math.sin(a)*r,.9),i*55);P.koto(S.key[2+i]+12,P.q(4)+i*P.spb/2,.4,0)}
  return true;
}

/* ---------- 文字まわり（歌詞・案内） ---------- */
const lyEl=$('lyrics'),hintEl=$('hint'),toastEl=$('toast'),countEl=$('count');
let lyI=0,lySide=0;const lyLive=[];
function showLyric(l){
  const cls=l[3]||'',flat=cls==='title'||cls==='shout'||cls==='top',d=document.createElement('div');d.className='ly '+cls+' '+(flat?'':(lySide++%2?'L':'R'));
  if(cls==='w'||cls==='soft'){d.classList.remove('L','R');d.style.left='50%';d.style.transform='translateX(-50%)'}
  let n=0;l[2].split('|').forEach((seg,ci)=>{const c=document.createElement('span');c.className='col';if(ci&&!flat)c.style.paddingTop=(ci*1.6)+'em';
    [...seg].forEach(ch=>{const s=document.createElement('span');s.className='ch';s.textContent=ch===' '?'　':ch;s.style.animationDelay=(n++*(cls==='w'||cls==='soft'?.11:.035))+'s';c.appendChild(s)});d.appendChild(c)});
  lyEl.appendChild(d);lyLive.push({d,e:l[1]});
}
function updLyrics(t){
  while(lyI<S.lyrics.length&&S.lyrics[lyI][0]<=t){if(S.lyrics[lyI][1]>t)showLyric(S.lyrics[lyI]);lyI++}
  for(let i=lyLive.length-1;i>=0;i--)if(lyLive[i].e<=t){const d=lyLive[i].d;d.classList.add('out');setTimeout(()=>d.remove(),320);lyLive.splice(i,1)}
}
let hintTm=0;function hint(txt,dur=3200){hintEl.firstElementChild.textContent=txt;hintEl.classList.add('on');clearTimeout(hintTm);hintTm=setTimeout(()=>hintEl.classList.remove('on'),dur)}
function toast(txt){toastEl.textContent=txt;toastEl.classList.remove('on');void toastEl.offsetWidth;toastEl.classList.add('on')}

/* ---------- タップで起きること ---------- */
let sec=S.sections[0],secI=0;
const CREATE=['cloud','mount','pine','torii','star','cloud'],TOYS=['daruma','ball','wheel'];
function flower(x,y,k=1){
  addStamp('f',x,y,{z:rnd(.052,.098)*k,n:pick([5,5,5,6,8])});petals(x,y,reduce?3:8);st.flowers++;
  if(st.flowers===50)toast('五十輪！');
  if(st.flowers===100){st.hundred=true;toast('百花繚乱');for(let i=0;i<90;i++)part({ty:'p',x:rnd(W),y:rnd(-H*.3,0),vx:rnd(-1,1),vy:rnd(2,6),g:.02,life:rnd(1.5,3),z:rnd(6,13),col:pick(PETAL),vr:rnd(-.3,.3)})}
}
function doTap(x,y){
  const pan=x/W*2-1,note=S.key[clamp(Math.floor(x/W*S.key.length),0,S.key.length-1)],now=P.ac.currentTime;
  st.touches++;ripple(x,y);ring(x,y,pick(POP));
  switch(sec.tap){
    case 'ink':inkSplash(x,y,9);P.bell(note+12,now,.16,pan);break;
    case 'taiko':inkSplash(x,y,14);sparks(x,y,8,PINK);P.taiko(P.q(2),.9,pan);st.hits++;shake=7;break;
    case 'create':addStamp(CREATE[st.create++%CREATE.length],x,y,{z:rnd(.09,.14),r:rnd(-.12,.12),col:pick([PUR,CYAN,'#7f8cff'])});sparks(x,y,6,'#fff',4);P.koto(note,P.q(2),.5,pan);break;
    case 'ofuda':{const n=st.count++;addStamp('ofuda',x,y,{n,z:rnd(.08,.11),r:rnd(-.3,.3)});floatText(KAN[n%10],x,y-W*.14,W*.16,YEL);P.koto(S.key[n%S.key.length],P.q(2),.5,pan);break}
    case 'flower':flower(x,y);P.koto(note,P.q(2),.5,pan);break;
    case 'hit':crack(x,y);flower(x,y,.75);ring(x,y,'#fff',W*.36);P.taiko(P.q(2),1,pan);st.hits++;shake=11;break;
    case 'light':light(x,y);addStamp('light',x,y,{z:.02,r:0});P.bell(note+12,P.q(1),.18,pan);break;
    case 'fire':firework(x,y);flower(x,y);P.taiko(P.q(2),.75,pan);st.hits++;shake=6;break;
  }
  if(strA>.5){let b=strs[0];strs.forEach(s=>{if(Math.abs(W*(s.i+1)/7-x)<Math.abs(W*(b.i+1)/7-x))b=s});pluck(b)}
  if(bellA>.5)bells.forEach(b=>{const[bx,by]=bellPos(b);if(Math.hypot(bx-x,by-y)<W*.1)ringBell(b)});
}

/* ---------- 指 ---------- */
const ptr=new Map();let lastTouch=0,holdA=0,holdPt=null,flipOn=false,zoom=1,zoomTo=1,pinch=null,near=false;const zoomEl=$('zoom');
function pos(e){const r=app.getBoundingClientRect();let x=e.clientX-r.left,y=e.clientY-r.top;if(flipOn){x=W-x;y=H-y}return[(x-W/2)/zoom+W/2,(y-H/2)/zoom+H/2]}
/* 2本指でつまむ：世界を引いて眺める／ウノに寄る */
function pinchDist(){const a=[...ptr.values()];return Math.hypot(a[0].sx-a[1].sx,a[0].sy-a[1].sy)}
app.addEventListener('pointerdown',e=>{
  if(!running||e.target.closest('button,.ov'))return;e.preventDefault();
  const[x,y]=pos(e);lastTouch=T;uno.peekTo=0;sec=S.sections[findSec(P.time())];
  const p={x,y,sx:e.clientX,sy:e.clientY,len:0,moved:false,dragon:null,hold:false,ang:null,tm:0};ptr.set(e.pointerId,p);
  if(ptr.size===2)pinch={d0:pinchDist(),z0:zoomTo,on:false};
  try{app.setPointerCapture(e.pointerId)}catch(_){}
  if(tipTap(x,y)){}else if(hitUno(x,y)&&!cutNow())poke(x,y);else doTap(x,y);
  if(sec.id==='bridge')p.hold=true;else p.tm=setTimeout(()=>{if(!p.moved)p.hold=true},240);
});
app.addEventListener('pointermove',e=>{
  const p=ptr.get(e.pointerId);if(!p)return;p.sx=e.clientX;p.sy=e.clientY;
  if(pinch&&ptr.size===2){const d1=pinchDist();if(!pinch.on&&Math.abs(d1-pinch.d0)>26){pinch.on=true;st.pinch++;ptr.forEach(q=>{clearTimeout(q.tm);q.hold=false;q.moved=true;if(q.dragon){q.dragon.free=true;q.dragon=null}})}
    if(pinch.on){zoomTo=clamp(pinch.z0*d1/pinch.d0,.5,2.4);lastTouch=T;return}}
  const[x,y]=pos(e),dx=x-p.x,dy=y-p.y,d=Math.hypot(dx,dy);if(d<1)return;
  lastTouch=T;p.len+=d;if(p.len>14&&!p.hold)p.moved=true;
  if(p.moved||sec.id==='bridge'){
    if(sec.drag&&!p.dragon&&p.len>38)p.dragon=newDragon(x,y);
    if(p.dragon){p.dragon.tx=x;p.dragon.ty=y;p.dragon.ang=Math.atan2(dy,dx)}
    else if(sec.id==='bridge'){if(Math.random()<.4)light(x,y)}
    else if(!sec.drag&&Math.random()<.6)part({ty:'i',x,y,vx:rnd(-.6,.6),vy:rnd(-.6,.6),g:.02,life:rnd(.4,.9),z:rnd(3,8),col:sec.id==='pre'||sec.id==='gap'?YEL:INK});
    if(strA>.5)strs.forEach(s=>{const sx=W*(s.i+1)/7;if((p.x-sx)*(x-sx)<0)pluck(s)});
    if(bellA>.5)bells.forEach(b=>{const[bx,by]=bellPos(b);if(Math.hypot(bx-x,by-y)<W*.075)ringBell(b)});
    if(moonA>.5){const[mx,my]=moonPos(),a=Math.atan2(y-my,x-mx);if(p.ang!==null&&Math.hypot(x-mx,y-my)>W*.06){let da=a-p.ang;if(da>Math.PI)da-=TAU;if(da<-Math.PI)da+=TAU;spinVel+=da*.4;st.spin+=Math.abs(da)}p.ang=a}
    if(hitUno(x,y)&&Math.random()<.12)hearts(x,y,1);
  }
  p.x=x;p.y=y;
});
function up(e){const p=ptr.get(e.pointerId);if(!p)return;clearTimeout(p.tm);if(p.dragon){p.dragon.free=true}ptr.delete(e.pointerId);if(ptr.size<2)pinch=null}
app.addEventListener('pointerup',up);app.addEventListener('pointercancel',up);
app.addEventListener('contextmenu',e=>{if(e.target.id!=='card')e.preventDefault()}); // おわりの絵だけは長押しで保存できるように

/* ---------- 曲に合わせて自動で起きること（触らなくてもMVになる） ---------- */
const RX=()=>rnd(.14,.86)*W,RY=()=>rnd(.2,.62)*H;
const EV=[
  [3.0,()=>{uno.peekTo=1}],[8.2,()=>{uno.peekTo=0}],
  [8.42,()=>{inkSplash(W/2,H*.42,40);ring(W/2,H*.42,PINK,W);ripple(W/2,H*.42);hint('さわると　鳴るよ')}],
  [24.6,()=>hint('タップで　世界を創る')],
  [27.04,()=>addStamp('cloud',W*.25,H*.2,{z:.12,r:0})],[27.7,()=>addStamp('cloud',W*.7,H*.27,{z:.1,r:0})],[28.4,()=>addStamp('cloud',W*.45,H*.13,{z:.09,r:0})],
  [29.6,()=>addStamp('mount',W*.2,H*.62,{z:.16,r:0,col:PUR})],[30.3,()=>addStamp('torii',W*.82,H*.6,{z:.11,r:0})],[30.95,()=>addStamp('pine',W*.1,H*.75,{z:.1,r:0})],[31.6,()=>addStamp('star',W*.8,H*.14,{z:.07})],
  [37.3,()=>{uno.over=2;uno.overT=T+2.4;const q=lastPt;for(let i=0;i<26;i++){const a=rnd(TAU),r=rnd(W*.3,W*.6);part({ty:'s',x:q[0]+Math.cos(a)*r,y:q[1]+Math.sin(a)*r,px:0,py:0,vx:-Math.cos(a)*r/38,vy:-Math.sin(a)*r/38,g:0,life:.65,z:3.5,col:YEL})}ring(q[0],q[1],YEL)}],
  [45.3,()=>hint('タップで　数える')],
  ...[45.16,45.82,46.48,47.14,50.44,51.1,51.76,52.42].map((t,i)=>[t,()=>{floatText(KAN[i],W*(.22+.56*((i%4)/3)),H*(.34+(i%2)*.1),W*.3,i<4?YEL:CYAN);ring(W*(.22+.56*((i%4)/3)),H*.4,YEL)}]),
  [55.5,()=>{for(let i=0;i<8;i++)addStamp('ofuda',RX(),RY(),{n:7,z:.085});ring(W/2,H*.45,YEL,W)}],
  [61.14,()=>{for(let i=0;i<10;i++){const a=i/10*TAU;setTimeout(()=>running&&flower(W*.5+Math.cos(a)*W*.36,H*.4+Math.sin(a)*W*.36),i*45)}ring(W/2,H*.4,'#fff',W);
     if(prevMade.length){prevMade.forEach(s=>{drawStamp(wctx,s,1,.55)});made=prevMade.filter(s=>s.k==='f').slice(0,400).concat(made);toast('前の世界が　残ってる')}
     hint('タップ＝花　　なぞる＝龍',4200)}],
  ...[66.75,67.3,67.85,68.4].map(t=>[t,()=>{const cu=cutNow(),p=cu&&cu[2].tip?cu[2].tip:[RX(),RY()];ring(p[0],p[1],YEL,W*.22);flower(p[0]+rnd(-.2,.2)*W,p[1]+rnd(-.2,.2)*W)}]),
  [66.5,()=>hint('指先に　ちょん',2200)],
  [69.04,()=>{newDragon(-W*.1,H*.66,{free:true,ang:-.5,life:3.4})}],
  ...[73.6,74.25,74.9,75.55,76.2].map((t,i)=>[t,()=>addStamp(TOYS[i%3],RX(),RY(),{z:.1,col:pick(POP)})]),
  [79.6,()=>ring(W/2,H/2,PINK,W)],
  [83.0,()=>hint('なぞって　弦を鳴らす')],
  ...[92.68,93.34,94.0,94.6].map(t=>[t,()=>{const x=RX(),y=RY();crack(x,y);ring(x,y,'#fff',W*.36);ripple(x,y);shake=8}]),
  [92.9,()=>hint('叩け！',1800)],[95.4,()=>{spinVel+=.22;hint('月を　ぐるぐる回せ！',2200)}],
  ...[97.88,98.5,99.2,99.8].map(t=>[t,()=>bells.forEach(b=>{b.v+=rnd(-.3,.3)})]),[98.0,()=>hint('鈴を　なぞって鳴らせ！',2200)],
  [100.32,()=>{petals(W/2,H*.4,40,9);ring(W/2,H*.4,YEL,W)}],
  [115.0,()=>hint('長押しで　そばにいる',4500)],
  [129.24,()=>{for(let i=0;i<24;i++)light(RX(),rnd(.3,.9)*H)}],
  [140.4,()=>{[.25,.5,.75].forEach((x,i)=>setTimeout(()=>firework(W*x,H*rnd(.2,.36),1.2),i*130));hint('タップで　花火！')}],
  [158.78,()=>{[.2,.4,.6,.8].forEach((x,i)=>setTimeout(()=>firework(W*x,H*rnd(.16,.4),1.3),i*110))}],
  [171.1,()=>{parts.length=0;rings.length=0;cracks.length=0;dragons.length=0;uno.peekTo=1}],
  [172.75,()=>{uno.peekTo=0}],
  [172.8,()=>{rebake();[.2,.5,.8,.35,.65].forEach((x,i)=>setTimeout(()=>firework(W*x,H*rnd(.15,.45),1.4),i*90));petals(W/2,H*.4,50,11);ring(W/2,H/2,'#fff',W*1.2)}],
  [184.5,()=>showEnd()]
].sort((a,b)=>a[0]-b[0]);
let evI=0,lastPt=[0,0],wantSnap=false,autoBeat=-1;

/* ---------- 毎フレーム ---------- */
function findSec(t){let i=0;while(i+1<S.sections.length&&S.sections[i+1].t<=t)i++;return i}
const mix3=(a,b,k)=>{a[0]+=(b[0]-a[0])*k;a[1]+=(b[1]-a[1])*k;a[2]+=(b[2]-a[2])*k};
const SC={};S.sections.forEach(s=>SC[s.id]={A:hex(s.A),B:hex(s.B),C:hex(s.C)});
const RED={A:hex('#ff2440'),B:hex('#ff8a3c'),C:hex('#ffd0d8')};
let lastNow=performance.now();
function frame(now){
  requestAnimationFrame(frame);
  const dt=Math.min(.05,(now-lastNow)/1000);lastNow=now;const k=dt*60;T+=dt;
  if(running){songT=P.time();beats=P.beats(songT)}
  const t=songT;
  // 場面
  const si=findSec(t);if(si!==secI||sec!==S.sections[si]){secI=si;sec=S.sections[si];uno.sq=-.1;if(running&&['chorus','final','encore'].includes(sec.id))uno.vy=-11*(H/800)}
  const lv=running?P.level():{low:0,all:0};
  const half=sec.id==='bridge'?4:2,bph=(((beats/half)%1)+1)%1;pulse=Math.exp(-bph*5)*clamp(lv.all*2.4)*(sec.id==='bridge'?.4:1);if(t<8.4||sec.id==='wipe')pulse*=.3;
  // 自動の出来事・歌詞
  if(running){while(evI<EV.length&&EV[evI][0]<=t){EV[evI][1]();evI++}updLyrics(t)}
  // 見た目を場面へ寄せる
  const red=t>145.52&&t<151.04,pal=red?RED:SC[sec.id],kk=clamp((sec.id==='wipe'||sec.id==='encore'||sec.id==='chorus'||sec.id==='final'?.16:.06)*k);
  mix3(V.A,pal.A,kk);mix3(V.B,pal.B,kk);mix3(V.C,pal.C,kk);V.pat=sec.pat;
  // ブリッジ：触れている間だけ明るくなる
  let holding=false;holdPt=null;ptr.forEach(p=>{if(p.hold){holding=true;holdPt=p}});
  const hTo=holding?1:0;holdA+=(hTo-holdA)*clamp(.14*k);
  // ズーム：指を離すとゆっくり元へ。引くと音が遠のき、寄るとウノがびっくりする
  if(!pinch||!pinch.on)zoomTo+=(1-zoomTo)*clamp(.035*k);if(sec.id==='wipe')zoomTo=1;
  zoom+=(zoomTo-zoom)*clamp(.3*k);if(Math.abs(zoom-(frame.z||1))>.002){frame.z=zoom;zoomEl.style.transform=Math.abs(zoom-1)<.004?'':`scale(${zoom.toFixed(3)})`}
  if(zoom>1.7&&!near&&V.uno>.3){near=true;toast('ちかいっ！');uno.over=3;uno.overT=T+1.4;uno.vy=-7*(H/800);hearts(W/2,H*.5,6)}else if(zoom<1.25)near=false;
  const far=clamp((1-zoom)/.5),hEff=Math.max(holdA,far*.75);
  if(running&&Math.abs(hEff-(frame.h||0))>.004){frame.h=hEff;P.setHold(hEff,holdA>far*.75&&holdPt?clamp(holdPt.y/H*.9+.1):.45)}
  const bridge=sec.id==='bridge';if(bridge&&holding){st.together+=dt;if(Math.random()<.25*k)light(holdPt.x+rnd(-50,50),holdPt.y+rnd(-50,50))}
  const lateBridge=bridge&&t>129.2?.35:0;
  V.ink+=(sec.ink-V.ink)*kk;V.amt+=(sec.amt-V.amt)*kk;
  V.dark+=((bridge?sec.dark-holdA*.35-lateBridge:sec.dark+holdA*.4)-V.dark)*clamp(.08*k);
  V.uno+=(sec.uno-V.uno)*clamp(.12*k);V.star+=(((pal.A[0]+pal.A[1]+pal.A[2])<1?1:0)-V.star)*kk;
  V.worldA+=((sec.id==='wipe'?0:bridge?.3+holdA*.3+lateBridge:1)-V.worldA)*clamp((sec.id==='wipe'?.2:.08)*k);
  // 月・鈴・弦が出る時間帯
  const inR=(a,b)=>t>=a&&t<b;
  moonA+=(((inR(95.28,171.1)||t>=172.8)?1:0)-moonA)*clamp(.1*k);
  bellA+=(((inR(97.88,113.9)||inR(140.4,171.1)||t>=172.8)?1:0)-bellA)*clamp(.1*k);
  strA+=((inR(82.7,92.6)?1:0)-strA)*clamp(.12*k);
  const flip=!reduce&&(inR(76.8,82.6)||inR(148.32,156.2));if(flip!==flipOn){flipOn=flip;world.classList.toggle('flip',flip)}
  // 月の回転 → 空の色と音
  moonAng+=spinVel*k;spinVel*=Math.pow(.955,k);if(running)P.setSweep(clamp(Math.abs(spinVel)*3.2));
  if(!st.eclipse&&st.spin>TAU*8){st.eclipse=true;toast('日蝕')}
  hueAdd=t>=172.8&&t<184.4?(t-172.8)*.9:hueAdd*Math.pow(.9,k);
  // ほうっておくと覗いてくる
  if(running&&T-lastTouch>10&&!bridge&&t>12&&t<165&&uno.peekTo===0&&T-uno.idle>16&&!cutNow()){uno.peekTo=.75;uno.idle=T;hint('ねえ、さわって？',2600);setTimeout(()=>{if(uno.peekTo===.75)uno.peekTo=0},3200)}
  // ラスサビ以降は拍に合わせて勝手にも花火が上がる
  const hb=Math.floor(beats/4);if(running&&hb!==autoBeat){autoBeat=hb;
    if(sec.id==='final'||sec.id==='coda')firework(RX(),rnd(.12,.42)*H,.9);
    if(sec.id==='encore'){firework(RX(),rnd(.12,.5)*H,1.2);flower(RX(),RY())}
    if((sec.id==='chorus'||sec.id==='free')&&hb%2===0)for(let i=0;i<5;i++)part({ty:'p',x:rnd(W),y:-10,vx:rnd(-1,1),vy:rnd(2,4),g:.02,life:rnd(2,3.4),z:rnd(6,11),col:pick(PETAL),vr:rnd(-.2,.2)});
    if(strA>.5)pluckSilent(pick(strs));
  }
  if(running&&t>145.52&&t<171&&Math.random()<.5*k)part({ty:'n',x:rnd(W),y:-8,vx:rnd(-.6,.6),vy:rnd(1.5,3.5),g:0,life:rnd(3,5),z:rnd(3,7),col:pick(['#2a6bff','#35d6ff','#7fb0ff'])});
  // 数え上げ
  if(t>53&&t<56.75){countEl.style.opacity=1;countEl.textContent=t<55.45?Math.floor(8*Math.pow(1e6,(t-53)/2.45)).toLocaleString('ja-JP'):'八百万！'}else if(countEl.style.opacity!=='0')countEl.style.opacity=0;
  $('bar').style.transform=`scaleX(${clamp(t/184.4)})`;

  renderBG();draw(dt,k,t);
  if(wantSnap){wantSnap=false;snapshot()}
}
function pluckSilent(s){s.amp=.6}

function draw(dt,k,t){
  ctx.setTransform(DPR,0,0,DPR,0,0);ctx.clearRect(0,0,W,H);
  if(shake>.3&&!reduce){ctx.translate(rnd(-shake,shake),rnd(-shake,shake));shake*=Math.pow(.82,k)}else shake=0;
  // 月
  if(moonA>.01){const[mx,my,mr]=moonPos();ctx.save();ctx.globalAlpha=moonA*(sec.id==='bridge'?.75:1);ctx.translate(mx,my);ctx.scale(1+pulse*.035,1+pulse*.035);
    if(st.eclipse){ctx.strokeStyle='#fff';ctx.lineWidth=mr*.12;ctx.beginPath();ctx.arc(0,0,mr*1.08,0,TAU);ctx.stroke();ctx.strokeStyle=YEL;ctx.lineWidth=mr*.05;ctx.beginPath();ctx.arc(0,0,mr*1.22+Math.sin(T*3)*mr*.03,0,TAU);ctx.stroke()}
    ctx.rotate(moonAng);ctx.fillStyle=INK;ctx.beginPath();ctx.arc(0,0,mr+W*.012,0,TAU);ctx.fill();ctx.fillStyle=st.eclipse?'#0d0820':YEL;ctx.beginPath();ctx.arc(0,0,mr,0,TAU);ctx.fill();
    ctx.fillStyle=st.eclipse?'#2a1458':'#ffc61f';[[.35,-.3,.22],[-.4,.1,.3],[.15,.5,.16],[-.1,-.6,.12]].forEach(c=>{ctx.beginPath();ctx.arc(c[0]*mr,c[1]*mr,c[2]*mr,0,TAU);ctx.fill()});
    ctx.fillStyle=st.eclipse?YEL:'#fff';for(let i=0;i<12;i++){const a=i/12*TAU;ctx.beginPath();ctx.arc(Math.cos(a)*mr*.86,Math.sin(a)*mr*.86,mr*(i%3?.025:.05),0,TAU);ctx.fill()}
    ctx.restore()}
  // 残るもの
  if(V.worldA>.01&&wc.width>0){ctx.globalAlpha=V.worldA;ctx.drawImage(wc,0,0,W,H);ctx.globalAlpha=1}
  for(let i=blooms.length-1;i>=0;i--){const b=blooms[i],u=(T-b.t0)/.38;if(u>=1){bake(b.s);blooms.splice(i,1)}else{const e=1+2.2*Math.pow(u-1,3)+1.2*Math.pow(u-1,2);drawStamp(ctx,b.s,Math.max(.05,e),V.worldA)}}
  // 弦
  if(strA>.01){ctx.save();ctx.globalAlpha=strA;strs.forEach(s=>{const x=W*(s.i+1)/7;s.amp*=Math.pow(.93,k);ctx.beginPath();for(let y=0;y<=H;y+=H/24){const o=Math.sin(y/H*Math.PI)*Math.sin(T*70+s.i)*s.amp*W*.035;y?ctx.lineTo(x+o,y):ctx.moveTo(x+o,y)}
    ctx.strokeStyle=INK;ctx.lineWidth=6;ctx.stroke();ctx.strokeStyle=s.amp>.1?YEL:'#fff';ctx.lineWidth=2.5;ctx.stroke()});ctx.restore()}
  // 鈴
  if(bellA>.01){ctx.save();ctx.globalAlpha=bellA;const y0=H*.058-(1-bellA)*H*.15;ctx.translate(0,-(1-bellA)*H*.15);
    ctx.strokeStyle=INK;ctx.lineWidth=9;ctx.beginPath();ctx.moveTo(-10,H*.058);ctx.quadraticCurveTo(W/2,H*.075,W+10,H*.058);ctx.stroke();ctx.strokeStyle='#ff3b4e';ctx.lineWidth=4.5;ctx.setLineDash([10,7]);ctx.stroke();ctx.setLineDash([]);
    bells.forEach(b=>{b.v+=(-b.a*.09-b.v*.035)*k;b.a+=b.v*k;const[x,y,ax,ay]=bellPos(b),r=W*.042;ctx.strokeStyle=INK;ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(ax,ay+H*.008);ctx.lineTo(x,y);ctx.stroke();
      ctx.save();ctx.translate(x,y);ctx.rotate(-b.a);ctx.fillStyle=INK;ctx.beginPath();ctx.arc(0,0,r+3,0,TAU);ctx.fill();ctx.fillStyle=T-b.cool<.15?'#fff':YEL;ctx.beginPath();ctx.arc(0,0,r,0,TAU);ctx.fill();
      ctx.strokeStyle=INK;ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-r*.6,r*.25);ctx.lineTo(r*.6,r*.25);ctx.stroke();ctx.fillStyle=INK;ctx.beginPath();ctx.arc(0,r*.25,r*.14,0,TAU);ctx.fill();ctx.restore()});
    ctx.restore()}
  // ウノ
  drawUno(dt,k,t);
  // 龍
  for(let i=dragons.length-1;i>=0;i--){const d=dragons[i],h0=d.pts[0],sp=W*.021*d.sc;
    if(d.free){d.ang+=Math.sin(T*2.6+d.seed)*.06*k;h0.x+=Math.cos(d.ang)*sp*.9*k;h0.y+=Math.sin(d.ang)*sp*.9*k;d.life-=dt;if(d.life<-.6){dragons.splice(i,1);continue}}
    else{h0.x+=(d.tx-h0.x)*clamp(.4*k);h0.y+=(d.ty-h0.y)*clamp(.4*k)}
    const seg=W*.02*d.sc;for(let j=1;j<d.pts.length;j++){const a=d.pts[j-1],b=d.pts[j],dx=b.x-a.x,dy=b.y-a.y,l=Math.hypot(dx,dy)||1;if(l>seg){b.x=a.x+dx/l*seg;b.y=a.y+dy/l*seg}}
    if(Math.random()<.3*k)sparks(h0.x,h0.y,1,d.c2,2);
    drawDragon(d)}
  // 粒
  ctx.lineCap='round';
  for(let i=parts.length-1;i>=0;i--){const p=parts[i];p.life-=dt;if(p.life<=0){parts.splice(i,1);continue}
    const slow=holdA>.5&&sec.id!=='bridge'?.35:1,kk=k*slow;p.px=p.x;p.py=p.y;p.vy+=p.g*kk;if(p.drag){p.vx*=Math.pow(p.drag,kk);p.vy*=Math.pow(p.drag,kk)}p.x+=p.vx*kk;p.y+=p.vy*kk;p.r+=(p.vr||0)*kk;
    const a=clamp(p.life/p.max*2.2);ctx.globalAlpha=a;
    if(p.ty==='p'){ctx.save();ctx.translate(p.x+Math.sin(T*2+p.max*9)*6,p.y);ctx.rotate(p.r);ctx.fillStyle=p.col;ctx.beginPath();ctx.ellipse(0,0,p.z,p.z*.55*Math.abs(Math.cos(p.r*1.7))+1,0,0,TAU);ctx.fill();ctx.restore()}
    else if(p.ty==='s'){ctx.strokeStyle=p.col;ctx.lineWidth=p.z;ctx.beginPath();ctx.moveTo(p.px,p.py);ctx.lineTo(p.x+.01,p.y);ctx.stroke()}
    else if(p.ty==='h'){const z=p.z;ctx.fillStyle=p.col;ctx.beginPath();ctx.moveTo(p.x,p.y+z*.6);ctx.bezierCurveTo(p.x-z*1.2,p.y-z*.2,p.x-z*.5,p.y-z,p.x,p.y-z*.35);ctx.bezierCurveTo(p.x+z*.5,p.y-z,p.x+z*1.2,p.y-z*.2,p.x,p.y+z*.6);ctx.fill();ctx.strokeStyle=INK;ctx.lineWidth=1.5;ctx.stroke()}
    else if(p.ty==='l'){const f=.6+.4*Math.sin(T*5+p.max*20);ctx.globalAlpha=a*.35*f;ctx.fillStyle=p.col;ctx.beginPath();ctx.arc(p.x,p.y,p.z*2.2,0,TAU);ctx.fill();ctx.globalAlpha=a*f;ctx.fillStyle='#fffbe0';ctx.beginPath();ctx.arc(p.x,p.y,p.z*.5,0,TAU);ctx.fill()}
    else{ctx.fillStyle=p.col;ctx.beginPath();ctx.arc(p.x,p.y,p.z,0,TAU);ctx.fill()}}
  ctx.globalAlpha=1;
  // 波紋の輪・ひび
  for(let i=rings.length-1;i>=0;i--){const r=rings[i],u=(T-r.t0)/.45;if(u>=1){rings.splice(i,1);continue}const e=1-Math.pow(1-u,3);ctx.globalAlpha=1-u;ctx.strokeStyle=INK;ctx.lineWidth=(1-u)*9+1;ctx.beginPath();ctx.arc(r.x,r.y,e*r.max,0,TAU);ctx.stroke();ctx.strokeStyle=r.col;ctx.lineWidth=(1-u)*5.5;ctx.stroke()}
  for(let i=cracks.length-1;i>=0;i--){const c=cracks[i],u=(T-c.t0)/.7;if(u>=1){cracks.splice(i,1);continue}ctx.globalAlpha=1-u*u;const n=Math.min(1,u*6);
    [[INK,6],['#fff',2.4]].forEach(([col,lw])=>{ctx.strokeStyle=col;ctx.lineWidth=lw;ctx.lineJoin='miter';c.ls.forEach(l=>{ctx.beginPath();const m=Math.max(2,Math.ceil(l.length*n));for(let j=0;j<m;j++)j?ctx.lineTo(l[j][0],l[j][1]):ctx.moveTo(l[j][0],l[j][1]);ctx.stroke()})})}
  ctx.globalAlpha=1;
  // 浮かぶ文字（数え歌）
  ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineJoin='round';
  for(let i=floats.length-1;i>=0;i--){const f=floats[i],u=(T-f.t0)/1.1;if(u>=1){floats.splice(i,1);continue}const sc=u<.15?.4+u/.15*.75:1.15-Math.min(1,(u-.15)*3)*.15;
    ctx.save();ctx.globalAlpha=u>.7?(1-u)/.3:1;ctx.translate(f.x,f.y-u*H*.03);ctx.rotate(f.r);ctx.scale(sc,sc);ctx.font=`${f.size}px "Dela Gothic One",sans-serif`;ctx.strokeStyle=INK;ctx.lineWidth=f.size*.16;ctx.strokeText(f.txt,0,0);ctx.fillStyle=f.col;ctx.fillText(f.txt,0,0);ctx.restore()}
  // アップの割り込み（歌詞の決めどころ）
  const cu=cutNow();if(cu){const[im,e,g]=cu;ctx.save();
    const yT=g.yB-g.h*.6,s=W*.07,ey=Math.min(1,e*1.6);
    ctx.beginPath();ctx.moveTo(-9,g.yB+s);ctx.lineTo(W+9,g.yB-s);ctx.lineTo(W+9,g.yB-s-(g.yB-yT)*ey);ctx.lineTo(-9,g.yB+s-(g.yB-yT)*ey);ctx.closePath();
    ctx.fillStyle=YEL;ctx.fill();ctx.strokeStyle=INK;ctx.lineWidth=7;ctx.stroke();
    ctx.save();ctx.clip();ctx.strokeStyle=PINK;ctx.lineWidth=W*.05;for(let i=-4;i<12;i++){const x=i*W*.14+((T*40)%(W*.14));ctx.beginPath();ctx.moveTo(x,g.yB+s+9);ctx.lineTo(x+W*.3,yT-s-9);ctx.stroke()}ctx.restore();
    ctx.beginPath();ctx.moveTo(-9,-9);ctx.lineTo(W+9,-9);ctx.lineTo(W+9,g.yB-s);ctx.lineTo(-9,g.yB+s);ctx.closePath();ctx.clip();
    const sil=IMG.csil[cu[3]];if(sil)ctx.drawImage(sil,g.x+g.h*.025,g.y+g.h*.016,g.w,g.h);
    ctx.drawImage(im,g.x,g.y,g.w,g.h);ctx.restore();
    ctx.strokeStyle=INK;ctx.lineWidth=7;ctx.beginPath();ctx.moveTo(-9,g.yB+s);ctx.lineTo(W+9,g.yB-s);ctx.stroke()}
  // 長押しの光
  if(holdA>.02&&holdPt){const g=ctx.createRadialGradient(holdPt.x,holdPt.y,0,holdPt.x,holdPt.y,W*.45);g.addColorStop(0,`rgba(255,246,200,${.55*holdA})`);g.addColorStop(.4,`rgba(255,160,220,${.2*holdA})`);g.addColorStop(1,'rgba(255,160,220,0)');ctx.fillStyle=g;ctx.fillRect(0,0,W,H)}
  // 覗きこむ顔
  uno.peek+=(uno.peekTo-uno.peek)*clamp(.09*k);
  if(uno.peek>.01){const big=uno.peekTo===1||(uno.peek>.76),wipe=sec.id==='wipe'||songT>165,im=(wipe?IMG.c[3]:IMG.c[2])||IMG.f[1];if(im){const w=Math.min(W*(big?.92:.56),H*.5),h=w*im.height/im.width;ctx.save();
    ctx.translate(big||songT<10||wipe?W*.5:W*.3,H+h*.5-uno.peek*h*(big?1:1.2)+Math.sin(T*2)*h*.012);
    ctx.rotate(Math.sin(T*1.6)*.02);ctx.drawImage(im,-w/2,-h/2,w,h);ctx.restore()}}
}
function drawUno(dt,k,t){
  if(V.uno<.03)return;
  // どの立ち絵か
  let want=sec.pose;const cyc=['chorus','free','final','encore','coda'].includes(sec.id);if(cyc)want=[0,2,6,1][Math.floor(beats/16)&3];
  if(['chorus','final','encore'].includes(sec.id)&&t-sec.t<2.6)want=6;   // サビの頭は跳ぶ
  if(sec.id==='bridge')want=t>129.2?5:4;                                  // 膝を抱える →「だから君を呼んだのよ」で手を差し伸べる
  if(t>158.78&&t<162.4)want=5;                                            // 君と私で創りましょう
  if(T<uno.overT&&sec.id!=='bridge')want=uno.over;
  if(want!==uno.pose){uno.pose=want;uno.sq=-.12}
  const im=IMG.b[uno.pose];if(!im)return;
  uno.vy+=.7*k*(H/800);uno.jump=Math.min(0,uno.jump+uno.vy*k);if(uno.jump===0&&uno.vy>0){if(uno.vy>3)uno.sq=.1;uno.vy=0}
  uno.sq*=Math.pow(.84,k);
  const h=unoH(),w=h*im.width/im.height,sq=uno.sq+(reduce?0:pulse*.022),x=W*.5,y=H*.985+uno.jump;
  ctx.save();ctx.translate(x,y);ctx.rotate(reduce?0:Math.sin(beats*Math.PI/4)*.022);ctx.scale(1+sq,1-sq);
  if(sec.id==='bridge')ctx.globalAlpha=t>129.2?1:.6+holdA*.4;
  const sil=IMG.sil[uno.pose];if(sil)ctx.drawImage(sil,-w/2+h*.022,-h+h*.014,w,h);
  ctx.drawImage(im,-w/2,-h,w,h);ctx.restore();ctx.globalAlpha=1;
}
function drawDragon(d){
  const n=d.pts.length,R=W*.04*d.sc,al=d.life<0?clamp(1+d.life/.6):1;ctx.globalAlpha=al;
  ctx.fillStyle=INK;for(let i=n-1;i>=0;i--){const p=d.pts[i];ctx.beginPath();ctx.arc(p.x,p.y,R*(1-.78*i/n)+W*.008,0,TAU);ctx.fill()}
  for(let i=n-1;i>=0;i--){const p=d.pts[i];ctx.fillStyle=i%4<2?d.c1:d.c2;ctx.beginPath();ctx.arc(p.x,p.y,R*(1-.78*i/n),0,TAU);ctx.fill()}
  const a=d.pts[0],b=d.pts[2],ang=Math.atan2(a.y-b.y,a.x-b.x)||d.ang;
  const arc=(x,y,r,c)=>{ctx.fillStyle=c;ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.fill()};
  ctx.save();ctx.translate(a.x,a.y);ctx.rotate(ang);ctx.lineCap='round';
  [[INK,R*.5],[YEL,R*.24]].forEach(([c,lw])=>{ctx.strokeStyle=c;ctx.lineWidth=lw;ctx.beginPath();ctx.moveTo(-R*.2,-R*.7);ctx.lineTo(-R*1.35,-R*1.5);ctx.moveTo(-R*.2,R*.7);ctx.lineTo(-R*1.35,R*1.5);ctx.stroke()});
  arc(0,0,R*1.36,INK);arc(0,0,R*1.2,d.c1);arc(R*.95,0,R*.86,INK);arc(R*.95,0,R*.7,'#fff');
  [-1,1].forEach(s=>{arc(R*.05,s*R*.62,R*.42,INK);arc(R*.05,s*R*.62,R*.34,'#fff');arc(R*.17,s*R*.62,R*.17,INK);arc(R*1.25,s*R*.25,R*.09,INK)});
  ctx.strokeStyle=INK;ctx.lineWidth=R*.15;const wv=Math.sin(T*7+d.seed)*R*.4;[-1,1].forEach(s=>{ctx.beginPath();ctx.moveTo(R*1.4,s*R*.45);ctx.quadraticCurveTo(R*2.3,s*R*1.3,R*.9+wv,s*R*2.1);ctx.stroke()});
  ctx.restore();ctx.globalAlpha=1;
}

/* ---------- おわりの一枚 ---------- */
let snap=null,cardBlob=null;
function snapshot(){snap=document.createElement('canvas');snap.width=cv.width;snap.height=cv.height;const c=snap.getContext('2d');renderBG();c.drawImage(glc,0,0,snap.width,snap.height);c.drawImage(cv,0,0)} // 背景を描いた直後に写す（WebGLは描いた直後しか写せない）
const TITLES=['百花繚乱の神','八龍召喚の神','天体掌握の神','天地破壊の神','神様専属の遊び相手','神様の理解者','静寂の観測者','八百万の創造神','神様の共犯者'];
function rank(){
  if(st.touches===0&&st.pinch===0)return'静寂の観測者';
  // 隠し要素を2つ以上（黄金の龍・日蝕・百花繚乱・ウノを怒らせる）
  if([st.gold,st.eclipse,st.hundred,st.angry].filter(Boolean).length>=2)return'神様の共犯者';
  // ほぼ全種類の遊びを試した
  const kinds=[st.flowers>0,st.dragons>0,st.spin>TAU,st.hits>0,st.bells>0,st.strings>0,st.together>1,st.pokes>0,st.pinch>0].filter(Boolean).length;
  if(kinds>=8)return'八百万の創造神';
  const a=[['百花繚乱の神',st.flowers/40],['八龍召喚の神',st.dragons/8],['天体掌握の神',st.spin/TAU/6],['天地破壊の神',st.hits/60],['神様専属の遊び相手',st.pokes/12],['神様の理解者',st.together/12]].sort((x,y)=>y[1]-x[1]);
  return a[0][0];
}
function saveTitle(t){let got=[];try{got=JSON.parse(localStorage.getItem('kamiasobi.titles')||'[]')}catch(e){}if(!got.includes(t)){got.push(t);try{localStorage.setItem('kamiasobi.titles',JSON.stringify(got))}catch(e){}}return got.filter(x=>TITLES.includes(x)).length}
function showEnd(){
  ended=true;snapshot();const turns=Math.floor(st.spin/TAU);
  const ttl=rank(),nGot=saveTitle(ttl);$('rank').textContent=(st.lap>1?KAN[(st.lap-1)%10]+'周目　':'')+'称号：'+ttl;$('titles').textContent=`集めた称号　${nGot} / ${TITLES.length}`;
  $('stats').innerHTML=st.touches===0&&st.pinch===0?'一度もさわらなかったね。<br>神様、ちょっと拗ねてます。':`花 ${st.flowers}輪　／　龍 ${st.dragons}匹　／　月 ${turns}回転<br>叩いた数 ${st.hits}　／　そばにいた ${st.together.toFixed(1)}秒`;
  const c=document.createElement('canvas');c.width=1080;c.height=1920;const x=c.getContext('2d');
  if(snap){const s=Math.max(1080/snap.width,1920/snap.height),w=snap.width*s,h=snap.height*s;x.drawImage(snap,(1080-w)/2,(1920-h)/2,w,h)}
  const g=x.createLinearGradient(0,0,0,430);g.addColorStop(0,'rgba(28,18,56,.85)');g.addColorStop(1,'rgba(28,18,56,0)');x.fillStyle=g;x.fillRect(0,0,1080,430);
  x.textAlign='center';x.lineJoin='round';x.font='92px "Dela Gothic One",sans-serif';x.strokeStyle=INK;x.lineWidth=18;x.strokeText(S.title,540,150);x.fillStyle='#fff';x.fillText(S.title,540,150);
  x.font='800 44px "Kaisei Tokumin",serif';x.fillStyle=YEL;x.fillText('称号：'+ttl,540,235);
  x.font='800 34px "Kaisei Tokumin",serif';x.fillStyle='#fff';x.fillText(`花${st.flowers}　龍${st.dragons}　月${turns}回転　${S.credit}`,540,295);
  $('card').src=c.toDataURL('image/jpeg',.9);c.toBlob(b=>cardBlob=b,'image/jpeg',.9);
  $('end').classList.add('on');
}
// 保存：スマホは共有シート（「画像を保存」で写真アプリへ）。使えない環境ではファイルとして保存し、長押し保存も案内する
$('save').onclick=async()=>{if(!cardBlob)return;const touch=matchMedia('(pointer:coarse)').matches;
  if(touch){try{const f=new File([cardBlob],'kamiasobi.jpg',{type:'image/jpeg'});if(navigator.canShare&&navigator.canShare({files:[f]})){await navigator.share({files:[f]});return}}catch(e){if(e&&e.name==='AbortError')return}
    $('savehow').textContent='絵を長押し →「写真に保存」で保存できます';$('savehow').classList.add('on');return}
  const a=document.createElement('a');a.href=URL.createObjectURL(cardBlob);a.download='kamiasobi.jpg';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),4000)};
// シェア文：曲名・称号・お誘い・アドレス。アドレスも文の中に入れる（アプリによっては文かアドレスの片方しか残らないため）
function shareText(){const url=location.href.split('?')[0].split('#')[0];
  return `触れるMV「${S.title}」（${S.credit}）で遊んだら、称号【${rank()}】をもらいました！\nみんなも指先で世界を創ってみて\n${url}\n${S.tags||''}`.trim()}
$('share').onclick=async()=>{const text=shareText();
  try{const f=cardBlob&&new File([cardBlob],'kamiasobi.jpg',{type:'image/jpeg'});if(f&&navigator.canShare&&navigator.canShare({files:[f]}))await navigator.share({text,files:[f]});else if(navigator.share)await navigator.share({text});else{await navigator.clipboard.writeText(text);toast('コピーした')}}catch(e){}};
$('again').onclick=()=>{$('end').classList.remove('on');st.lap++;begin(0)};

/* ---------- はじまり・一時停止・大きさ ---------- */
function resize(){
  W=app.clientWidth||1;H=app.clientHeight||1;DPR=Math.min(window.devicePixelRatio||1,2);
  cv.width=wc.width=Math.round(W*DPR);cv.height=wc.height=Math.round(H*DPR);const b=Math.min(DPR,1.5);glc.width=Math.round(W*b);glc.height=Math.round(H*b);
  rebake();lastPt=[W/2,H*.4];
}
new ResizeObserver(resize).observe(app);resize();
function begin(offset){
  prevMade=st.lap>1?made.slice():[];made=[];wctx.setTransform(DPR,0,0,DPR,0,0);wctx.clearRect(0,0,W,H);
  Object.assign(st,{flowers:0,dragons:0,spin:0,hits:0,touches:0,together:0,count:4,create:0,eclipse:false,pokes:0,bells:0,strings:0,pinch:0,gold:false,hundred:false,angry:false});zoom=zoomTo=1;
  parts.length=rings.length=cracks.length=dragons.length=floats.length=blooms.length=0;lyLive.forEach(l=>l.d.remove());lyLive.length=0;
  lyI=0;lySide=0;evI=0;while(evI<EV.length&&EV[evI][0]<offset-.05)evI++;while(lyI<S.lyrics.length&&S.lyrics[lyI][1]<offset)lyI++;
  moonAng=spinVel=0;moonA=bellA=strA=0;V.uno=0;uno.peekTo=0;ended=false;lastTouch=T;uno.idle=T;autoBeat=-1;
  P.start(offset);running=true;
}
const go=$('go');
Promise.all([loadImages(),P.load(p=>{go.textContent='読み込み中… '+Math.round(p*100)+'%'})]).then(()=>{go.disabled=false;go.textContent='あそぶ'}).catch(e=>{go.textContent='読み込めませんでした';console.error(e)});
go.onclick=async()=>{await P.unlock();$('start').remove();const q=+new URLSearchParams(location.search).get('t')||0;begin(q)};
const mute=$('mute');mute.onclick=()=>{const m=!P.muted;P.setMuted(m);mute.setAttribute('aria-pressed',m);mute.textContent=m?'音を出す':'音を消す'};
document.addEventListener('visibilitychange',()=>{if(!running||ended)return;if(document.hidden){P.pause();$('pause').style.display='flex'}});
$('pause').addEventListener('click',async()=>{await P.resume();$('pause').style.display='none';lastNow=performance.now()});
app.addEventListener('pointerdown',e=>{const[x,y]=pos(e);lastPt=[x,y]},true);
requestAnimationFrame(frame);
window.__mv={P,st,V,shareText,seek:t=>{$('end').classList.remove('on');begin(t)},get t(){return songT}}; // 確認用
})();
