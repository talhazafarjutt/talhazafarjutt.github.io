/* ── 3D PROJECT NEURAL GRAPH ── */
(function(){
  if(typeof THREE==='undefined')return;
  const canvas=document.getElementById('proj-graph');
  if(!canvas)return;

  const wrap=canvas.parentElement;
  let W=wrap.offsetWidth,H=wrap.offsetHeight||500;

  const scene=new THREE.Scene();
  const camera=new THREE.PerspectiveCamera(50,W/H,.1,400);
  camera.position.set(0,2,72);
  camera.lookAt(0,2,0);

  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});
  renderer.setSize(W,H);
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  renderer.setClearColor(0,0);

  /* ── project data ── */
  const PROJ=[
    {id:0,name:'LLM Inference Platform',short:'Codsy',
     desc:'Production multi-GPU LLM cluster: 4× Tesla V100, FastAPI load-balancer, nginx API gateway, vLLM engine — serving active developer teams.',
     cmd:'docker run codsy/llm',status:'● running',
     tech:['vLLM','FastAPI','nginx','K3s','V100','Python SDK'],
     color:0x00e5ff,pos:[-22,8,0]},
    {id:1,name:'Zero-Trust Secrets Pipeline',short:'Vault',
     desc:'HashiCorp Vault in LXD: AppRole auth, dynamic credential rotation for SSH & CI/CD — GDPR data residency compliant on bare metal.',
     cmd:'vault status --policy',status:'● sealed',
     tech:['HashiCorp Vault','LXD','AppRole','GitHub Actions','GDPR'],
     color:0xa855f7,pos:[22,-6,-4]},
    {id:2,name:'AI Agent Microservices',short:'Platform',
     desc:'6 gRPC-connected services with Redis queuing, ECDH + ABE multi-tenant isolation — sub-100ms P95, 10k+ daily requests.',
     cmd:'kubectl get pods -n ai',status:'6/6 running',
     tech:['FastAPI','gRPC','Redis','ECDH','ABE','PostgreSQL'],
     color:0x22c55e,pos:[0,18,-3]}
  ];

  /* ── node builder ── */
  function mkNode(p){
    const grp=new THREE.Group();
    grp.position.set(p.pos[0],p.pos[1],p.pos[2]);
    const core=new THREE.Mesh(
      new THREE.SphereGeometry(2.6,24,24),
      new THREE.MeshBasicMaterial({color:p.color,transparent:true,opacity:.9})
    );
    const inner=new THREE.Mesh(
      new THREE.SphereGeometry(1.2,12,12),
      new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.3})
    );
    const glow=new THREE.Mesh(
      new THREE.SphereGeometry(5.2,12,12),
      new THREE.MeshBasicMaterial({color:p.color,transparent:true,opacity:.055})
    );
    const ring=new THREE.Mesh(
      new THREE.RingGeometry(3.4,4.0,48),
      new THREE.MeshBasicMaterial({color:p.color,transparent:true,opacity:.22,side:THREE.DoubleSide})
    );
    ring.rotation.x=.9+Math.random()*.4;ring.rotation.z=Math.random()*Math.PI;
    const ring2=new THREE.Mesh(
      new THREE.RingGeometry(4.8,5.0,48),
      new THREE.MeshBasicMaterial({color:p.color,transparent:true,opacity:.09,side:THREE.DoubleSide})
    );
    ring2.rotation.x=.4;ring2.rotation.y=Math.random()*Math.PI;
    grp.add(core,inner,glow,ring,ring2);
    grp.userData={p,core,inner,glow,ring,ring2,baseY:p.pos[1],phase:Math.random()*Math.PI*2};
    scene.add(grp);
    return grp;
  }
  const nodes=PROJ.map(mkNode);

  /* ── satellite tech particles ── */
  const sats=[];
  PROJ.forEach((p,pi)=>{
    p.tech.forEach((label,ti)=>{
      const ang=(ti/p.tech.length)*Math.PI*2+pi*1.1;
      const r=8+ti*.9;
      const m=new THREE.Mesh(
        new THREE.SphereGeometry(.18,6,6),
        new THREE.MeshBasicMaterial({color:p.color,transparent:true,opacity:.5})
      );
      m.position.set(p.pos[0]+Math.cos(ang)*r*.55,p.pos[1]+Math.sin(ang)*r*.55,p.pos[2]+(Math.random()-.5)*3);
      m.userData={pi,ang,r,spd:.005+ti*.0015,label};
      scene.add(m);sats.push(m);
    });
  });

  /* ── curved edges ── */
  const EDGES=[[0,1],[1,2],[0,2]];
  const edgeMats=[];
  EDGES.forEach(([a,b])=>{
    const pa=new THREE.Vector3(...PROJ[a].pos),pb=new THREE.Vector3(...PROJ[b].pos);
    const mid=new THREE.Vector3().lerpVectors(pa,pb,.5).add(new THREE.Vector3(0,3,-2));
    const curve=new THREE.QuadraticBezierCurve3(pa,mid,pb);
    const geo=new THREE.BufferGeometry().setFromPoints(curve.getPoints(28));
    const mixCol=new THREE.Color(PROJ[a].color).lerp(new THREE.Color(PROJ[b].color),.5);
    const mat=new THREE.LineBasicMaterial({color:mixCol,transparent:true,opacity:.2});
    scene.add(new THREE.Line(geo,mat));
    edgeMats.push({mat,a,b});
  });

  /* ── signal pulses ── */
  const pulses=[];
  EDGES.forEach(([a,b])=>{
    const pa=new THREE.Vector3(...PROJ[a].pos),pb=new THREE.Vector3(...PROJ[b].pos);
    const mid=new THREE.Vector3().lerpVectors(pa,pb,.5).add(new THREE.Vector3(0,3,-2));
    const curve=new THREE.QuadraticBezierCurve3(pa,mid,pb);
    const m=new THREE.Mesh(
      new THREE.SphereGeometry(.12,5,5),
      new THREE.MeshBasicMaterial({color:PROJ[a].color,transparent:true,opacity:0})
    );
    scene.add(m);
    pulses.push({m,curve,t:Math.random(),spd:.0045+Math.random()*.005});
  });

  /* ── bg particles ── */
  const BGN=80;
  const bgGeo=new THREE.BufferGeometry();
  const bgPos=new Float32Array(BGN*3);
  for(let i=0;i<BGN;i++){bgPos[i*3]=(Math.random()-.5)*130;bgPos[i*3+1]=(Math.random()-.5)*80;bgPos[i*3+2]=(Math.random()-.5)*50-15}
  bgGeo.setAttribute('position',new THREE.BufferAttribute(bgPos,3));
  const bgPts=new THREE.Points(bgGeo,new THREE.PointsMaterial({color:0x00e5ff,size:.4,transparent:true,opacity:.12,sizeAttenuation:true}));
  scene.add(bgPts);

  /* ── interaction ── */
  const ray=new THREE.Raycaster();
  const mouse=new THREE.Vector2(9999,9999);
  let hovNode=null,camT={x:0,y:0},camC={x:0,y:0};

  canvas.addEventListener('mousemove',e=>{
    const r=canvas.getBoundingClientRect();
    mouse.x=((e.clientX-r.left)/r.width)*2-1;
    mouse.y=-((e.clientY-r.top)/r.height)*2+1;
    camT.x=(e.clientX-r.left)/r.width-.5;
    camT.y=(e.clientY-r.top)/r.height-.5;
  },{passive:true});
  canvas.addEventListener('mouseleave',()=>{mouse.set(9999,9999);camT={x:0,y:0};setHov(null);},{passive:true});

  const panel=document.getElementById('node-panel');
  const bgMorph=document.getElementById('graphBgMorph');
  const labelsEl=document.getElementById('node-labels');

  function setHov(node){
    if(node===hovNode)return;
    hovNode=node;
    if(node){
      const p=node.userData.p;
      const hx=new THREE.Color(p.color).getHexString();
      panel.innerHTML=
        '<div class="np-bar"><span class="np-cmd">'+p.cmd+'</span><span class="np-status">'+p.status+'</span></div>'+
        '<div class="np-content"><h3 class="np-title">'+p.name+'</h3><p class="np-desc">'+p.desc+'</p>'+
        '<div class="np-tech">'+p.tech.map(function(t){return'<span class="pt-badge">'+t+'</span>'}).join('')+'</div></div>';
      panel.style.opacity='1';
      panel.style.transform='translateX(-50%) translateY(0)';
      panel.style.borderColor='#'+hx+'44';
      panel.style.boxShadow='0 0 80px #'+hx+'18,0 24px 64px rgba(0,0,0,.6)';
      const rgb=new THREE.Color(p.color);
      if(bgMorph)bgMorph.style.background='radial-gradient(ellipse 55% 65% at 50% 40%,rgba('+(rgb.r*255|0)+','+(rgb.g*255|0)+','+(rgb.b*255|0)+',.08),transparent 70%)';
      canvas.style.cursor='pointer';
      edgeMats.forEach(function(e){e.mat.opacity=(e.a===p.id||e.b===p.id)?.5:.05});
    } else {
      panel.style.opacity='0';
      panel.style.transform='translateX(-50%) translateY(14px)';
      if(bgMorph)bgMorph.style.background='radial-gradient(ellipse 55% 65% at 50% 40%,rgba(0,229,255,.03),transparent 70%)';
      canvas.style.cursor='default';
      edgeMats.forEach(function(e){e.mat.opacity=.2});
    }
  }

  /* ── animation loop ── */
  var tk=0;
  (function loop(){
    requestAnimationFrame(loop);
    tk+=.01;

    camC.x+=(camT.x*.25-camC.x)*.04;
    camC.y+=(camT.y*.14-camC.y)*.04;
    camera.position.set(camC.x*18,-camC.y*8+2,72);
    camera.lookAt(0,4,0);

    ray.setFromCamera(mouse,camera);
    var cores=nodes.map(function(n){return n.userData.core});
    var hit=ray.intersectObjects(cores);
    setHov(hit.length?nodes[cores.indexOf(hit[0].object)]:null);

    nodes.forEach(function(n,i){
      var h=n===hovNode,ts=h?1.35:1,s=n.scale.x+(ts-n.scale.x)*.1;
      n.scale.setScalar(s);
      n.position.y=n.userData.baseY+Math.sin(tk*.65+n.userData.phase)*.7;
      n.userData.ring.rotation.z+=.008;
      n.userData.ring2.rotation.x+=.004;
      n.userData.ring2.rotation.y+=.003;
      n.userData.glow.material.opacity=(.055+.03*Math.sin(tk*1.6+i*1.2))*(h?2.4:1);
      n.userData.inner.material.opacity=(.3+.12*Math.sin(tk*2.1+i))*(h?1.6:1);
    });

    sats.forEach(function(s){
      s.userData.ang+=s.userData.spd;
      var p=PROJ[s.userData.pi];
      var dy=nodes[s.userData.pi].position.y-p.pos[1];
      s.position.x=p.pos[0]+Math.cos(s.userData.ang)*s.userData.r*.52;
      s.position.y=p.pos[1]+dy+Math.sin(s.userData.ang)*s.userData.r*.52;
      s.material.opacity=(hovNode&&hovNode.userData.p.id===s.userData.pi)?.85:.32;
    });

    pulses.forEach(function(p){
      p.t+=p.spd;if(p.t>1)p.t-=1;
      p.m.position.copy(p.curve.getPoint(p.t));
      var f=p.t<.5?p.t*2:(1-p.t)*2;
      p.m.material.opacity=f*.7;
    });

    if(labelsEl){
      labelsEl.innerHTML='';
      nodes.forEach(function(n,i){
        var v=n.position.clone().project(camera);
        var x=(v.x+1)/2*W,y=(-v.y+1)/2*H+60;
        if(v.z<1){
          var col=new THREE.Color(PROJ[i].color).getHexString();
          labelsEl.innerHTML+='<span class="node-label" style="left:'+x+'px;top:'+y+'px;opacity:'+(n===hovNode?0:.78)+';color:#'+col+'">'+PROJ[i].short+'</span>';
        }
      });
    }

    bgPts.rotation.y+=.0002;
    renderer.render(scene,camera);
  })();

  if(panel){
    panel.style.opacity='0';panel.style.pointerEvents='none';
    panel.style.transform='translateX(-50%) translateY(14px)';
    panel.style.transition='opacity .4s cubic-bezier(.16,1,.3,1),transform .4s cubic-bezier(.16,1,.3,1),border-color .4s,box-shadow .4s';
  }

  window.addEventListener('resize',function(){
    W=wrap.offsetWidth;
    renderer.setSize(W,H);
    camera.aspect=W/H;
    camera.updateProjectionMatrix();
  },{passive:true});
})();
