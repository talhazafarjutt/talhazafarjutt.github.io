/* ── CENTRAL NERVOUS SYSTEM — Three.js background ── */
(function(){
  if(typeof THREE==='undefined')return;
  const canvas=document.getElementById('neuro');
  if(!canvas)return;

  const scene=new THREE.Scene();
  const camera=new THREE.PerspectiveCamera(55,innerWidth/innerHeight,.1,300);
  camera.position.z=72;

  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});
  renderer.setSize(innerWidth,innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  renderer.setClearColor(0,0);

  const DARK=[0x00e5ff,0x22d3ee,0xa855f7,0xc084fc,0x22c55e,0xf59e0b,0x38bdf8];
  const LITE=[0x0369a1,0x0e7490,0x7c3aed,0x6d28d9,0x15803d,0xb45309,0x0284c7];
  const dark=()=>(document.documentElement.getAttribute('data-theme')||'dark')!=='light';
  const pal=()=>dark()?DARK:LITE;

  /* nodes */
  const N=innerWidth<700?45:90;
  const nodes=[];
  const grp=new THREE.Group();
  scene.add(grp);

  for(let i=0;i<N;i++){
    const col=pal()[Math.floor(Math.random()*pal().length)];
    const r=.1+Math.random()*.22;
    const core=new THREE.Mesh(
      new THREE.SphereGeometry(r,8,8),
      new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:.9})
    );
    const halo=new THREE.Mesh(
      new THREE.SphereGeometry(r*2.8,8,8),
      new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:.08})
    );
    const obj=new THREE.Object3D();
    obj.add(core,halo);
    obj.position.set(
      (Math.random()-.5)*72*(innerWidth/innerHeight)*.85,
      (Math.random()-.5)*55,
      (Math.random()-.5)*36
    );
    const a=Math.random()*Math.PI*2,spd=.012+Math.random()*.02;
    obj.userData={vx:Math.cos(a)*spd,vy:Math.sin(a)*spd,vz:(Math.random()-.5)*.007,
      core,halo,col,ph:Math.random()*Math.PI*2,fr:.5+Math.random()*1.3};
    grp.add(obj);nodes.push(obj);
  }

  /* buffered lines */
  const DIST=innerWidth<700?14:21;
  const MAX=N*10;
  const geo=new THREE.BufferGeometry();
  const pA=new Float32Array(MAX*6),cA=new Float32Array(MAX*6);
  geo.setAttribute('position',new THREE.BufferAttribute(pA,3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('color',new THREE.BufferAttribute(cA,3).setUsage(THREE.DynamicDrawUsage));
  geo.setDrawRange(0,0);
  const lmat=new THREE.LineBasicMaterial({vertexColors:true,transparent:true,opacity:.28});
  scene.add(new THREE.LineSegments(geo,lmat));

  let conns=[];
  function updateLines(){
    conns=[];let s=0;
    const p=geo.attributes.position.array,c=geo.attributes.color.array;
    for(let i=0;i<nodes.length&&s<MAX;i++){
      for(let j=i+1;j<nodes.length&&s<MAX;j++){
        const d=nodes[i].position.distanceTo(nodes[j].position);
        if(d<DIST){
          conns.push({i,j});
          const ci=new THREE.Color(nodes[i].userData.col);
          const cj=new THREE.Color(nodes[j].userData.col);
          const a=(1-d/DIST)*(dark()?.4:.14);
          const b=s*6;
          p[b]=nodes[i].position.x;p[b+1]=nodes[i].position.y;p[b+2]=nodes[i].position.z;
          p[b+3]=nodes[j].position.x;p[b+4]=nodes[j].position.y;p[b+5]=nodes[j].position.z;
          c[b]=ci.r*a;c[b+1]=ci.g*a;c[b+2]=ci.b*a;
          c[b+3]=cj.r*a;c[b+4]=cj.g*a;c[b+5]=cj.b*a;
          s++;
        }
      }
    }
    geo.attributes.position.needsUpdate=true;
    geo.attributes.color.needsUpdate=true;
    geo.setDrawRange(0,s*2);
  }

  /* signal pulses — neural firing */
  const pulses=[];
  for(let i=0;i<10;i++){
    const m=new THREE.Mesh(
      new THREE.SphereGeometry(.09,5,5),
      new THREE.MeshBasicMaterial({transparent:true,opacity:0})
    );
    scene.add(m);
    pulses.push({m,on:false,t:0,a:null,b:null});
  }

  function fire(){
    if(!conns.length)return;
    const p=pulses.find(p=>!p.on);if(!p)return;
    const c=conns[Math.floor(Math.random()*conns.length)];
    p.a=nodes[c.i].position;p.b=nodes[c.j].position;
    p.t=0;p.on=true;
    p.m.material.color.set(nodes[c.i].userData.col);
  }

  /* camera parallax */
  let tRX=0,tRY=0,cRX=0,cRY=0;
  window.addEventListener('mousemove',e=>{
    tRY=(e.clientX/innerWidth-.5)*.16;
    tRX=-(e.clientY/innerHeight-.5)*.1;
  },{passive:true});

  let t=0,fr=0,ptick=0;
  (function tick(){
    requestAnimationFrame(tick);
    t+=.007;fr++;ptick++;

    nodes.forEach(n=>{
      n.position.x+=n.userData.vx;n.position.y+=n.userData.vy;n.position.z+=n.userData.vz;
      const bx=52*(innerWidth/innerHeight)*.85,by=42,bz=19;
      if(Math.abs(n.position.x)>bx)n.userData.vx*=-1;
      if(Math.abs(n.position.y)>by)n.userData.vy*=-1;
      if(Math.abs(n.position.z)>bz)n.userData.vz*=-1;
      const pulse=.6+.4*Math.sin(t*n.userData.fr+n.userData.ph);
      n.userData.core.material.opacity=pulse*(dark()?.92:.5);
      n.userData.halo.material.opacity=pulse*(dark()?.1:.04);
    });

    if(fr%3===0)updateLines();

    if(ptick>30){fire();ptick=0;}
    pulses.forEach(p=>{
      if(!p.on)return;
      p.t+=.03;
      if(p.t>1){p.on=false;p.m.material.opacity=0;return;}
      p.m.position.lerpVectors(p.a,p.b,p.t);
      const f=p.t<.5?p.t*2:(1-p.t)*2;
      p.m.material.opacity=f*(dark()?.95:.5);
    });

    cRX+=(tRX-cRX)*.04;cRY+=(tRY-cRY)*.04;
    grp.rotation.x=cRX;grp.rotation.y=cRY;

    renderer.render(scene,camera);
  })();

  window.addEventListener('resize',()=>{
    camera.aspect=innerWidth/innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth,innerHeight);
  },{passive:true});

  new MutationObserver(()=>{
    lmat.opacity=dark()?.28:.1;
  }).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
})();
