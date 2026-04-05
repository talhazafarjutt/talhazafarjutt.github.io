/* ── CURSOR FIX — style.css sets cursor:none globally ── */
document.body.style.cursor='auto';

/* ── THEME ── */
const themeBtn=document.getElementById('themeBtn');
(function(){document.documentElement.setAttribute('data-theme',localStorage.getItem('theme')||'dark')})();
themeBtn&&themeBtn.addEventListener('click',()=>{const t=document.documentElement.getAttribute('data-theme')==='dark'?'light':'dark';document.documentElement.setAttribute('data-theme',t);localStorage.setItem('theme',t)});

/* ── PROGRESS BAR ── */
const prog=document.getElementById('prog');
if(prog)window.addEventListener('scroll',()=>{prog.style.width=(scrollY/(document.documentElement.scrollHeight-innerHeight)*100)+'%'},{passive:true});

/* ── NAV SCROLL ── */
window.addEventListener('scroll',()=>document.getElementById('nav').classList.toggle('s',scrollY>50),{passive:true});

/* ── SCROLL REVEAL ── */
const obs=new IntersectionObserver(entries=>{entries.forEach(e=>{if(!e.isIntersecting)return;e.target.classList.add('on');obs.unobserve(e.target)})},{threshold:.1,rootMargin:'0px 0px -30px 0px'});
document.querySelectorAll('.ri,.rl,.rr,.rz').forEach(el=>obs.observe(el));
