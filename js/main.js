/* ── PROGRESS ── */
const prog=document.getElementById('prog');
window.addEventListener('scroll',()=>{prog.style.width=(scrollY/(document.documentElement.scrollHeight-innerHeight)*100)+'%'},{passive:true});

/* ── THEME TOGGLE ── */
const themeBtn=document.getElementById('themeBtn');
(function(){document.documentElement.setAttribute('data-theme',localStorage.getItem('theme')||'dark')})();
themeBtn.addEventListener('click',()=>{const t=document.documentElement.getAttribute('data-theme')==='dark'?'light':'dark';document.documentElement.setAttribute('data-theme',t);localStorage.setItem('theme',t)});
function tc(){return document.documentElement.getAttribute('data-theme')==='light'?'3,105,161':'0,229,255'}

/* ── SPOTLIGHT ── */
const sl=document.getElementById('sl');
document.addEventListener('mousemove',e=>{sl.style.background=`radial-gradient(500px at ${e.clientX}px ${e.clientY}px,rgba(${tc()},.04),transparent 50%)`},{passive:true});

/* ── CURSOR ── */
const cd=document.getElementById('cd'),cr=document.getElementById('cr');
let mx=0,my=0,rx=0,ry=0;
document.addEventListener('mousemove',e=>{mx=e.clientX;my=e.clientY;cd.style.left=mx+'px';cd.style.top=my+'px'},{passive:true});
(function loop(){rx+=(mx-rx)*.1;ry+=(my-ry)*.1;cr.style.left=rx+'px';cr.style.top=ry+'px';requestAnimationFrame(loop)})();
document.querySelectorAll('a,button,.hex,.proj-card,.c-link,.about-link,.btn').forEach(el=>{
  el.addEventListener('mouseenter',()=>document.body.classList.add('ch'));
  el.addEventListener('mouseleave',()=>document.body.classList.remove('ch'));
});
document.addEventListener('mousedown',()=>document.body.classList.add('cc'));
document.addEventListener('mouseup',()=>document.body.classList.remove('cc'));

/* ── BURST ── */
document.addEventListener('click',e=>{
  ['#00e5ff','#a855f7','#22c55e','#f59e0b'].forEach((col,i)=>{
    for(let k=0;k<3;k++){
      const p=document.createElement('div');p.className='bp';
      const ang=(i*3+k)/12*Math.PI*2,d=35+Math.random()*55;
      p.style.cssText=`left:${e.clientX}px;top:${e.clientY}px;background:${col};box-shadow:0 0 6px ${col};--tx:${Math.cos(ang)*d}px;--ty:${Math.sin(ang)*d}px`;
      document.body.appendChild(p);setTimeout(()=>p.remove(),650);
    }
  });
});

/* ── CANVAS NEURAL NET ── */
(function(){
  const c=document.getElementById('cvs'),ctx=c.getContext('2d');
  const N=window.innerWidth<700?30:65,DIST=140,REP=90;
  let W,H,pts,raf,mx=-999,my=-999;
  document.addEventListener('mousemove',e=>{mx=e.clientX;my=e.clientY-c.getBoundingClientRect().top},{passive:true});
  function resize(){W=c.width=c.offsetWidth;H=c.height=c.offsetHeight}
  function mk(){return{x:Math.random()*W,y:Math.random()*H,ox:0,oy:0,vx:(Math.random()-.5)*.4,vy:(Math.random()-.5)*.4,r:Math.random()*1.5+.7}}
  function frame(){
    ctx.clearRect(0,0,W,H);
    pts.forEach(p=>{
      const dx=p.x-mx,dy=p.y-my,d=Math.sqrt(dx*dx+dy*dy);
      if(d<REP){const f=(REP-d)/REP*1.8;p.ox+=(dx/d)*f;p.oy+=(dy/d)*f}
      p.ox*=.92;p.oy*=.92;p.x+=p.vx+p.ox*.3;p.y+=p.vy+p.oy*.3;
      if(p.x<0||p.x>W)p.vx*=-1;if(p.y<0||p.y>H)p.vy*=-1;
    });
    for(let i=0;i<pts.length;i++){
      for(let j=i+1;j<pts.length;j++){
        const dx=pts[i].x-pts[j].x,dy=pts[i].y-pts[j].y,d=Math.sqrt(dx*dx+dy*dy);
        if(d<DIST){ctx.beginPath();ctx.moveTo(pts[i].x,pts[i].y);ctx.lineTo(pts[j].x,pts[j].y);ctx.strokeStyle=`rgba(${tc()},${(1-d/DIST)*.1})`;ctx.lineWidth=.5;ctx.stroke()}
      }
      ctx.beginPath();ctx.arc(pts[i].x,pts[i].y,pts[i].r,0,Math.PI*2);ctx.fillStyle=`rgba(${tc()},.5)`;ctx.fill();
    }
    raf=requestAnimationFrame(frame);
  }
  resize();pts=Array.from({length:N},mk);frame();
  window.addEventListener('resize',()=>{cancelAnimationFrame(raf);resize();frame()},{passive:true});
})();

/* ── SPARKLINE ── */
(function(){
  const c=document.getElementById('spark');if(!c)return;
  c.width=c.offsetWidth||320;c.height=48;
  const ctx=c.getContext('2d'),pts=[];
  for(let i=0;i<40;i++)pts.push(20+Math.random()*28);
  let t=0;
  function draw(){
    c.width=c.offsetWidth;
    const W=c.width,H=48;ctx.clearRect(0,0,W,H);
    pts.push(20+Math.random()*28);if(pts.length>50)pts.shift();
    const max=Math.max(...pts),min=Math.min(...pts);
    ctx.beginPath();
    pts.forEach((v,i)=>{const x=i/(pts.length-1)*W,y=H-(v-min)/(max-min+1)*(H-6)-3;i===0?ctx.moveTo(x,y):ctx.lineTo(x,y)});
    ctx.strokeStyle=`rgba(${tc()},.7)`;ctx.lineWidth=1.5;ctx.stroke();
    const grad=ctx.createLinearGradient(0,0,0,H);
    grad.addColorStop(0,`rgba(${tc()},.15)`);grad.addColorStop(1,`rgba(${tc()},0)`);
    ctx.lineTo(W,H);ctx.lineTo(0,H);ctx.closePath();ctx.fillStyle=grad;ctx.fill();
    t++;setTimeout(()=>requestAnimationFrame(draw),120);
  }
  draw();
})();

/* ── TYPEWRITER ── */
(function(){
  const roles=['Senior Backend Engineer','DevOps & Infrastructure Engineer','AI/MLOps Platform Builder','Microservices Architect'];
  const el=document.getElementById('tw');let ri=0,ci=0,del=false;
  function tick(){
    const cur=roles[ri];
    if(del){el.textContent=cur.slice(0,--ci);if(ci===0){del=false;ri=(ri+1)%roles.length;setTimeout(tick,350);return}setTimeout(tick,38)}
    else{el.textContent=cur.slice(0,++ci);if(ci===cur.length){del=true;setTimeout(tick,2200);return}setTimeout(tick,75)}
  }
  setTimeout(tick,1800);
})();

/* ── METRICS LIVE REQUEST COUNTER ── */
setInterval(()=>{
  const el=document.querySelector('.mp-val.cc');
  if(el&&el.textContent.includes(',')){const v=Math.floor(9800+Math.random()*400);el.textContent=v.toLocaleString()+'+'}
},2000);

/* ── INTERSECTION OBSERVER ── */
const CHARS='!<>-_\\/[]{}=+*^?#01ABCDabcd';
function scramble(el){
  const orig=el.innerHTML,plain=el.innerText;let f=0,tot=22;
  function run(){
    if(f>=tot){el.innerHTML=orig;return}
    el.innerText=plain.split('').map((ch,i)=>{if(ch===' ')return ' ';if(i<f/tot*plain.length)return ch;return CHARS[Math.floor(Math.random()*CHARS.length)]}).join('');
    f++;requestAnimationFrame(run);
  }
  run();
}
function counter(el){
  const to=parseInt(el.dataset.count),suf=el.dataset.suf||'+',dur=1300,s=performance.now();
  function step(n){const p=Math.min((n-s)/dur,1),e=1-Math.pow(1-p,3);el.textContent=Math.round(e*to)+(p>=1?suf:'');if(p<1)requestAnimationFrame(step)}
  requestAnimationFrame(step);
}

const obs=new IntersectionObserver(entries=>{
  entries.forEach(e=>{
    if(!e.isIntersecting)return;
    const el=e.target;el.classList.add('on');
    if(el.dataset.count)counter(el);
    if(el.classList.contains('sc'))scramble(el);
    obs.unobserve(el);
  });
},{threshold:.1,rootMargin:'0px 0px -30px 0px'});
document.querySelectorAll('.ri,.rl,.rr,.rz,[data-count]').forEach(el=>obs.observe(el));

/* hexagon staggered reveal */
const hexObs=new IntersectionObserver(entries=>{
  entries.forEach(e=>{
    if(!e.isIntersecting)return;
    e.target.querySelectorAll('.hex').forEach((h,i)=>setTimeout(()=>h.classList.add('on'),i*40));
    hexObs.unobserve(e.target);
  });
},{threshold:.1});
const hc=document.getElementById('hc');if(hc)hexObs.observe(hc);

/* ── MAGNETIC BUTTONS ── */
document.querySelectorAll('.mag').forEach(w=>{
  w.addEventListener('mousemove',e=>{const r=w.getBoundingClientRect(),x=(e.clientX-r.left-r.width/2)*.28,y=(e.clientY-r.top-r.height/2)*.28;w.style.transform=`translate(${x}px,${y}px)`});
  w.addEventListener('mouseleave',()=>w.style.transform='');
});

/* ── BLOG TOGGLE ── */
document.querySelectorAll('.bc-toggle').forEach(btn=>{
  btn.addEventListener('click',()=>{
    const full=btn.closest('.blog-card').querySelector('.bc-full');
    const open=full.classList.toggle('open');
    btn.textContent=open?'Close Article ↑':'Read Article →';
    btn.classList.toggle('open',open);
    if(open)full.scrollIntoView({behavior:'smooth',block:'nearest'});
  });
});

/* ── CALENDLY ── */
const calBtn=document.getElementById('calBtn');
if(calBtn)calBtn.addEventListener('click',()=>Calendly.initPopupWidget({url:'https://calendly.com/talha-zafar-j/30min'}));

/* ── NAV ── */
window.addEventListener('scroll',()=>document.getElementById('nav').classList.toggle('s',scrollY>50),{passive:true});
const ham=document.getElementById('ham'),nl=document.getElementById('nl');
ham.addEventListener('click',()=>nl.classList.toggle('open'));
nl.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>nl.classList.remove('open')));
