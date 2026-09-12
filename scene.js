/* 7D International — project scenes.
   three.js r165 as an ES module, with a real post-processing chain (bloom + SMAA),
   PMREM dusk environment, soft shadows and filmic tone mapping.
   Geometry is built from 7D's own published photography and renders of each project. */

import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {SMAAPass} from 'three/addons/postprocessing/SMAAPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';

const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const isTouch = matchMedia('(hover:none)').matches;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
let seed=20260912; const rnd=()=>{seed=(seed*16807)%2147483647;return (seed-1)/2147483646;};

/* ---------- palette: Riyadh at dusk ---------- */
const C={
  night:0x0A0C10, dusk:0x1B2430, horizon:0xE9B27A, glowSky:0x6E4A3A,
  sand:0xC8AA7C, sandLit:0xE3CDA4, stone:0xD8CDB8, stoneDark:0x8C8271,
  water:0x0C1A22, steel:0xD9DCDA, brass:0xE0A94A, teal:0x2FA98B,
  lamp:0xFFC98A, lampCool:0xE6F0FF, leaf:0x2E6B45,
  jet:[0xFF4FA3,0x4FE3C1,0xFFC24A,0x7FA6FF,0xFF7A4F,0xC07BFF]
};

/* ---------- shared factories ---------- */
let R=null;                                        // active renderer, for anisotropy
const MAT={
  stone:(c=C.stone,rough=.82)=>new THREE.MeshStandardMaterial({color:c,roughness:rough,metalness:.04,envMapIntensity:.8}),
  sand:(c=C.sand)=>new THREE.MeshStandardMaterial({color:c,roughness:.95,metalness:0,envMapIntensity:.5}),
  metal:(c=C.steel,rough=.24)=>new THREE.MeshStandardMaterial({color:c,roughness:rough,metalness:.95,envMapIntensity:1.5}),
  paint:(c=0xF4F6F4)=>new THREE.MeshStandardMaterial({color:c,roughness:.42,metalness:.06,envMapIntensity:1}),
  glass:(c=0x9FC4D8,op=.42)=>new THREE.MeshPhysicalMaterial({color:c,roughness:.06,metalness:.1,transmission:.9,ior:1.5,thickness:.6,clearcoat:1,clearcoatRoughness:.04,transparent:true,opacity:op,envMapIntensity:2.4,side:THREE.DoubleSide}),
  curtain:(c=0x2A3A44)=>new THREE.MeshPhysicalMaterial({color:c,roughness:.08,metalness:.5,clearcoat:1,clearcoatRoughness:.04,envMapIntensity:2.6}),
  water:()=>new THREE.MeshStandardMaterial({color:0x0A1418,roughness:.72,metalness:0,envMapIntensity:.12}),
  emis:(c,i=2)=>new THREE.MeshStandardMaterial({color:c,emissive:c,emissiveIntensity:i*.42,roughness:.5}),
  foliage:(c=C.leaf)=>new THREE.MeshStandardMaterial({color:c,roughness:.96,metalness:0,envMapIntensity:.4})
};
const mesh=(geo,mat,x=0,y=0,z=0,cast=true,recv=true)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=cast;m.receiveShadow=recv;return m;};
const edges=(geo,color=0xFFFFFF,op=.35)=>new THREE.LineSegments(new THREE.EdgesGeometry(geo,18),new THREE.LineBasicMaterial({color,transparent:true,opacity:op}));

/* soft radial sprite used for lamps, beacons and haze */
const sprTex=(()=>{const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d');
  const g=x.createRadialGradient(64,64,0,64,64,64);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.2,'rgba(255,255,255,.55)');g.addColorStop(.55,'rgba(255,255,255,.12)');g.addColorStop(1,'rgba(255,255,255,0)');
  x.fillStyle=g;x.fillRect(0,0,128,128);return new THREE.CanvasTexture(c);})();
const halo=(color,size=2,op=.9)=>{op*=.55;return (()=>{const s=new THREE.Sprite(new THREE.SpriteMaterial({map:sprTex,color,transparent:true,opacity:op,blending:THREE.AdditiveBlending,depthWrite:false}));s.scale.set(size,size,1);return s;})();};
const lamp=(g,x,y,z,color=C.lamp,size=.9,op=.8)=>{const s=halo(color,size,op);s.position.set(x,y,z);g.add(s);return s;};

/* date palm: layered fronds, tapered ringed trunk */
function palm(x,z,h=1.4,s=1,rot=0){
  const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=rot;
  const trunk=mesh(new THREE.CylinderGeometry(.035*s,.075*s,h,9),new THREE.MeshStandardMaterial({color:0x5C4B37,roughness:.98}),0,h/2,0);g.add(trunk);
  for(let i=0;i<5;i++)g.add(mesh(new THREE.TorusGeometry(.05*s,.012*s,5,10),new THREE.MeshStandardMaterial({color:0x6B5740,roughness:.98}),0,h*(.25+i*.15),0,false,false).rotateX(Math.PI/2));
  const crown=new THREE.Group();crown.position.y=h;g.add(crown);
  for(let i=0;i<11;i++){const a=i/11*Math.PI*2+rnd()*.3;const droop=.55+rnd()*.5;
    const pts=[];for(let k=0;k<=6;k++){const t=k/6;pts.push(new THREE.Vector3(Math.cos(a)*t*.62*s,Math.sin(t*1.5)*.16*s-t*t*droop*.42*s,Math.sin(a)*t*.62*s));}
    const frond=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),8,.035*s,4,false),MAT.foliage(i%2?C.leaf:0x3A7D52));frond.castShadow=true;crown.add(frond);}
  crown.add(mesh(new THREE.SphereGeometry(.07*s,8,8),MAT.foliage(0x4A8A5C),0,.02,0,false,false));
  return g;
}
/* Saudi flag on a pole, cloth ripples in the animation loop */
function flag(g,x,z,h=2.2,w=.8,anims){
  const grp=new THREE.Group();grp.position.set(x,0,z);
  grp.add(mesh(new THREE.CylinderGeometry(.02,.03,h,10),MAT.metal(0xF0F2F0,.3),0,h/2,0));
  const cloth=mesh(new THREE.PlaneGeometry(w,w*.62,16,8),new THREE.MeshStandardMaterial({color:0x1B7A3E,roughness:.85,emissive:0x0C3A1E,emissiveIntensity:.4,side:THREE.DoubleSide}),w/2+.03,h-w*.34,0,true,false);grp.add(cloth);
  grp.add(mesh(new THREE.SphereGeometry(.04,10,10),MAT.metal(C.brass,.2),0,h+.04,0,false,false));
  anims.push(t=>{const p=cloth.geometry.attributes.position;for(let i=0;i<p.count;i++){const u=(p.getX(i)+w/2)/w;p.setZ(i,Math.sin(t*3.4+u*7)*.055*u);}p.needsUpdate=true;p.version++;});
  g.add(grp);return grp;
}

/* ---------- renderer + dusk environment ---------- */
function makeRenderer(stage,{shadows=true}={}){
  const W=stage.clientWidth,H=stage.clientHeight;
  const renderer=new THREE.WebGLRenderer({antialias:false,alpha:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,isTouch?1.5:2));
  renderer.setSize(W,H);
  renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=.82;
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  if(shadows){renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;}
  stage.appendChild(renderer.domElement); R=renderer; return renderer;
}
/* A dusk sky: warm band at the horizon, deep blue overhead, ground bounce.
   Baked through PMREM so glass, brass and steel reflect a real sky. */
function duskEnvironment(renderer,{warm=1}={}){
  const env=new THREE.Scene();
  const c=document.createElement('canvas');c.width=16;c.height=256;const x=c.getContext('2d');
  const g=x.createLinearGradient(0,0,0,256);
  g.addColorStop(0,'#05070C');g.addColorStop(.42,'#16202E');g.addColorStop(.60,'#3C4356');
  g.addColorStop(.70,`rgba(${Math.round(190*warm+30)},${Math.round(126*warm+30)},${Math.round(84*warm+34)},1)`);
  g.addColorStop(.78,'#7A4E38');g.addColorStop(.86,'#241C1C');g.addColorStop(1,'#0A0C10');
  x.fillStyle=g;x.fillRect(0,0,16,256);
  const tex=new THREE.CanvasTexture(c);tex.mapping=THREE.EquirectangularReflectionMapping;tex.colorSpace=THREE.SRGBColorSpace;
  const dome=new THREE.Mesh(new THREE.SphereGeometry(40,24,16),new THREE.MeshBasicMaterial({map:tex,side:THREE.BackSide}));env.add(dome);
  // a low sun card and a cool zenith card give the PMREM something directional to grab
  const card=(w,h,px,py,pz,col,int)=>{const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({color:new THREE.Color(col).multiplyScalar(int)}));m.position.set(px,py,pz);m.lookAt(0,py*.4,0);env.add(m);};
  card(26,7,-4,5,-30,0xFFB870,3.2*warm);
  card(30,12,0,20,10,0x2A4F7A,1.1);
  const pm=new THREE.PMREMGenerator(renderer);pm.compileEquirectangularShader();
  const rt=pm.fromScene(env,.02);pm.dispose();
  return rt.texture;
}
function makeComposer(renderer,scene,cam,stage,{strength=.3,radius=.4,threshold=.9}={}){
  const W=stage.clientWidth,H=stage.clientHeight;
  const composer=new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene,cam));
  const bloom=new UnrealBloomPass(new THREE.Vector2(W,H),strength,radius,threshold);
  composer.addPass(bloom);
  if(!isTouch)composer.addPass(new SMAAPass(W*renderer.getPixelRatio(),H*renderer.getPixelRatio()));
  composer.addPass(new OutputPass());
  return {composer,bloom};
}

/* =====================================================================
   FOOTPRINT GLOBE
   ===================================================================== */
let globe=null;

/* TopoJSON is a delta-encoded, quantised format; this is the whole decoder we need.
   Land outlines ship with the site (data/land-110m.json) so the globe never waits
   on a third party. */
function topoToRings(topo,name){
  const {scale:[sx,sy],translate:[tx,ty]}=topo.transform;
  const arc=i=>{const rev=i<0;const a=topo.arcs[rev?~i:i];let x=0,y=0;const out=[];
    for(const [dx,dy] of a){x+=dx;y+=dy;out.push([x*sx+tx,y*sy+ty]);}
    return rev?out.reverse():out;};
  const ring=idx=>{const pts=[];for(const i of idx){const seg=arc(i);pts.push(...(pts.length?seg.slice(1):seg));}return pts;};
  const rings=[];
  const walk=g=>{
    if(g.type==='GeometryCollection'){g.geometries.forEach(walk);return;}
    if(g.type==='Polygon')g.arcs.forEach(r=>rings.push(ring(r)));
    if(g.type==='MultiPolygon')g.arcs.forEach(poly=>poly.forEach(r=>rings.push(ring(r))));
  };
  walk(topo.objects[name]);
  return rings;
}
/* Paint the land as an equirectangular mask we can sample per-pixel. */
function landMask(rings,W=1024){
  const H=W/2;const c=document.createElement('canvas');c.width=W;c.height=H;
  const x=c.getContext('2d',{willReadFrequently:true});
  x.fillStyle='#000';x.fillRect(0,0,W,H);
  x.fillStyle='#fff';x.beginPath();
  for(const r of rings){r.forEach(([lon,lat],i)=>{const px=(lon+180)/360*W,py=(90-lat)/180*H;i?x.lineTo(px,py):x.moveTo(px,py);});x.closePath();}
  x.fill('nonzero');
  const d=x.getImageData(0,0,W,H).data;
  return {W,H,at:(lon,lat)=>{
    let px=Math.floor((lon+180)/360*W),py=Math.floor((90-lat)/180*H);
    px=(px%W+W)%W;py=Math.max(0,Math.min(H-1,py));
    return d[(py*W+px)*4]>127;}};
}

export function initGlobe(){
  const stage=document.querySelector('#globeStage'); if(!stage)return;
  const HUBS=window.HUBS||[];
  const renderer=makeRenderer(stage,{shadows:false});
  const scene=new THREE.Scene(); scene.environment=duskEnvironment(renderer,{warm:.8});
  const cam=new THREE.PerspectiveCamera(34,stage.clientWidth/stage.clientHeight,.1,100); cam.position.set(0,0,4.6);
  const g=new THREE.Group(); scene.add(g);
  const Rr=1.35;
  const toV=(lat,lon,r=Rr)=>{const p=(90-lat)*Math.PI/180,t=(lon+180)*Math.PI/180;
    return new THREE.Vector3(-r*Math.sin(p)*Math.cos(t),r*Math.cos(p),r*Math.sin(p)*Math.sin(t));};

  /* ocean: a dark polished sphere, so the dusk environment reads as a sheen on water */
  g.add(mesh(new THREE.SphereGeometry(Rr,96,96),new THREE.MeshStandardMaterial({color:0x080D12,roughness:.42,metalness:.55,envMapIntensity:.85}),0,0,0,false,false));

  /* graticule, kept faint: it says "survey", not "sci-fi HUD" */
  {const lines=[];
    for(let lat=-60;lat<=60;lat+=30){const pts=[];for(let a=0;a<=128;a++)pts.push(toV(lat,-180+a/128*360,Rr*1.002));lines.push(pts);}
    for(let lon=-180;lon<180;lon+=30){const pts=[];for(let a=0;a<=64;a++)pts.push(toV(-90+a/64*180,lon,Rr*1.002));lines.push(pts);}
    const geo=[];lines.forEach(p=>{for(let i=0;i<p.length-1;i++)geo.push(p[i],p[i+1]);});
    g.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(geo),new THREE.LineBasicMaterial({color:0xE0A94A,transparent:true,opacity:.07})));}

  /* atmosphere: a fresnel shell, brighter at the limb, as a real rim light would be */
  const atmo=new THREE.Mesh(new THREE.SphereGeometry(Rr*1.13,64,64),new THREE.ShaderMaterial({
    transparent:true,side:THREE.BackSide,depthWrite:false,blending:THREE.AdditiveBlending,
    uniforms:{uCol:{value:new THREE.Color(0x8FA6BE)},uInt:{value:.3}},
    vertexShader:'varying vec3 vN;varying vec3 vP;void main(){vN=normalize(normalMatrix*normal);vec4 mv=modelViewMatrix*vec4(position,1.);vP=mv.xyz;gl_Position=projectionMatrix*mv;}',
    fragmentShader:'uniform vec3 uCol;uniform float uInt;varying vec3 vN;varying vec3 vP;void main(){float f=pow(1.-abs(dot(normalize(vN),normalize(-vP))),2.4);gl_FragColor=vec4(uCol,f*uInt);}'
  }));g.add(atmo);

  /* hubs: a surface disc, a rising beam and a ring that pulses when the hub lights */
  const marks=[];
  HUBS.forEach(h=>{
    const v=toV(h.lat,h.lon,Rr*1.004);const grp=new THREE.Group();grp.visible=false;g.add(grp);
    const disc=mesh(new THREE.CircleGeometry(.028,20),MAT.emis(0xF2C777,2.2),v.x,v.y,v.z,false,false);disc.lookAt(v.clone().multiplyScalar(2));grp.add(disc);
    const ring=mesh(new THREE.RingGeometry(.045,.055,32),new THREE.MeshBasicMaterial({color:0xE0A94A,transparent:true,opacity:.8,side:THREE.DoubleSide}),v.x,v.y,v.z,false,false);
    ring.lookAt(v.clone().multiplyScalar(2));grp.add(ring);
    const beam=mesh(new THREE.CylinderGeometry(.006,.006,.3,6),new THREE.MeshBasicMaterial({color:0xF2C777,transparent:true,opacity:.55,blending:THREE.AdditiveBlending,depthWrite:false}),0,0,0,false,false);
    beam.position.copy(v.clone().multiplyScalar(1.11));beam.lookAt(0,0,0);beam.rotateX(Math.PI/2);grp.add(beam);
    const gl=halo(0xF2C777,.28,.9);gl.position.copy(v);grp.add(gl);
    marks.push({grp,ring,gl,v});});

  /* routes: a drawn great-circle plus a pulse that runs the finished line */
  const arcs=[];const order=[0,1,2,3,4];
  for(let i=0;i<order.length-1;i++){
    const a=toV(HUBS[order[i]].lat,HUBS[order[i]].lon),b=toV(HUBS[order[i+1]].lat,HUBS[order[i+1]].lon);
    const mid=a.clone().add(b).multiplyScalar(.5).normalize().multiplyScalar(Rr*(1.14+a.distanceTo(b)*.12));
    const curve=new THREE.QuadraticBezierCurve3(a,mid,b);const pts=curve.getPoints(128);
    const geo=new THREE.BufferGeometry().setFromPoints(pts);geo.setDrawRange(0,0);
    const line=new THREE.Line(geo,new THREE.LineBasicMaterial({color:0xE0A94A,transparent:true,opacity:.9}));g.add(line);
    const pulse=halo(0xFFE2AC,.16,0);g.add(pulse);
    arcs.push({line,n:pts.length,curve,pulse});}

  g.rotation.y=-.14;
  const {composer}=makeComposer(renderer,scene,cam,stage,{strength:.45,radius:.5,threshold:.78});
  globe={renderer,composer,scene,cam,g,marks,arcs,atmo,stage,lit:-1,t0:performance.now()};
  window.globe=globe;
  addEventListener('resize',()=>{const W=stage.clientWidth,H=stage.clientHeight;renderer.setSize(W,H);composer.setSize(W,H);cam.aspect=W/H;cam.updateProjectionMatrix();});

  /* the land itself, as a dense point cloud sampled off the mask. Loaded after the
     first paint so the section is never blocked on it; the globe stands up without it. */
  fetch('data/land-110m.json').then(r=>r.json()).then(topo=>{
    const mask=landMask(topoToRings(topo,'land'),1024);
    const N=60000,pos=[],col=[];const c1=new THREE.Color(0xE7C98D),c2=new THREE.Color(0x8FA89B);
    const golden=Math.PI*(3-Math.sqrt(5));
    for(let i=0;i<N;i++){
      const y=1-(i/(N-1))*2, r=Math.sqrt(Math.max(0,1-y*y)), th=golden*i;
      const x=Math.cos(th)*r, z=Math.sin(th)*r;
      const lat=Math.asin(y)*180/Math.PI;
      let lon=Math.atan2(z,-x)*180/Math.PI-180; if(lon<-180)lon+=360;
      if(!mask.at(lon,lat))continue;
      const v=new THREE.Vector3(x,y,z).multiplyScalar(Rr*1.006);
      pos.push(v.x,v.y,v.z);
      const c=c1.clone().lerp(c2,Math.random()*.5);col.push(c.r,c.g,c.b);}
    const geo=new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
    geo.setAttribute('color',new THREE.Float32BufferAttribute(col,3));
    const land=new THREE.Points(geo,new THREE.PointsMaterial({size:.016,vertexColors:true,transparent:true,opacity:.95,sizeAttenuation:true}));
    g.add(land);globe.land=land;
    // a coastline drawn over the dots sharpens the read at small sizes
    const seg=[];
    for(const ring of topoToRings(topo,'land')){
      for(let i=0;i<ring.length-1;i++){
        const [lo1,la1]=ring[i],[lo2,la2]=ring[i+1];
        if(Math.abs(lo1-lo2)>90)continue;
        seg.push(toV(la1,lo1,Rr*1.012),toV(la2,lo2,Rr*1.012));}}
    g.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(seg),new THREE.LineBasicMaterial({color:0xF4E3C0,transparent:true,opacity:.28})));
  }).catch(()=>{/* no land data: the ocean sphere, graticule and routes still read */});
}
const counted=new Set();
export function updateGlobe(p){
  if(!globe)return; const {g,marks,arcs,atmo,composer}=globe;
  const t=(performance.now()-globe.t0)/1000;
  g.rotation.y=-.14-p*3.9+(REDUCED?0:t*.01);
  g.rotation.x=.2-p*.34;
  atmo.material.uniforms.uInt.value=.26+Math.sin(t*.7)*.04;
  const seg=clamp(p*1.15,0,1)*(arcs.length+1);
  marks.forEach((m,i)=>{const on=seg>=i;m.grp.visible=on;
    if(on){const k=clamp(seg-i,0,1);m.ring.scale.setScalar(1+Math.sin(t*1.8+i)*.12);m.gl.material.opacity=.5+k*.4;}
    const cl=document.querySelector(`.clock[data-i="${i}"]`);cl&&cl.classList.toggle('lit',on);});
  arcs.forEach((a,i)=>{const k=clamp(seg-(i+1)+1,0,1);
    a.line.geometry.setDrawRange(0,Math.floor(k*a.n));
    if(k>=1){a.pulse.material.opacity=.85;a.pulse.position.copy(a.curve.getPointAt(((t*.22)+i*.17)%1));}
    else a.pulse.material.opacity=0;});
  const cnt=[...document.querySelectorAll('.stat b')];const stage=Math.floor(seg);
  const tick=el=>{const i=cnt.indexOf(el);if(counted.has(i))return;counted.add(i);
    const to=+el.dataset.count,suf=el.dataset.suffix||'';
    if(REDUCED||!window.anime){el.textContent=to+suf;return;}
    const o={v:0};window.anime({targets:o,v:to,round:1,duration:1300,easing:'easeOutExpo',update:()=>el.textContent=o.v+suf});};
  if(stage>=1)tick(cnt[0]);if(stage>=3)tick(cnt[1]);if(stage>=4)tick(cnt[2]);
  const cap=document.querySelector('#globeCap');
  if(cap)cap.textContent = seg>=5 ? (window.LANG==='ar'?'الشبكة مضاءة — خمسة مراكز، على مدار الساعة':'Network lit — five hubs, around the clock') : (window.I?.[window.LANG||'en']?.['fp.cap']||cap.textContent);
  composer.render();
}

/* =====================================================================
   PROJECT FLIGHT — six sites, built from 7D's own imagery
   ===================================================================== */
let flight=null;
export function initFlight(){
  const stage=document.querySelector('#flightStage'); if(!stage)return;
  const renderer=makeRenderer(stage);
  const scene=new THREE.Scene();
  scene.fog=new THREE.FogExp2(C.night,.016);
  scene.environment=duskEnvironment(renderer,{warm:1});
  const cam=new THREE.PerspectiveCamera(40,stage.clientWidth/stage.clientHeight,.1,400);

  /* sky dome: the dusk gradient the whole strip sits under, plus stars high up */
  {const c=document.createElement('canvas');c.width=8;c.height=512;const x=c.getContext('2d');
    const g=x.createLinearGradient(0,0,0,512);
    g.addColorStop(0,'#05070C');g.addColorStop(.40,'#0C1320');g.addColorStop(.60,'#1E2636');
    g.addColorStop(.72,'#4A4054');g.addColorStop(.80,'#8A5B42');g.addColorStop(.87,'#C98A55');
    g.addColorStop(.92,'#5C3B2C');g.addColorStop(1,'#0A0C10');
    x.fillStyle=g;x.fillRect(0,0,8,512);
    const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;
    scene.add(mesh(new THREE.SphereGeometry(260,32,24),new THREE.MeshBasicMaterial({map:tex,side:THREE.BackSide,depthWrite:false,fog:false}),0,0,0,false,false));
    const SN=900,sp=new Float32Array(SN*3);
    for(let i=0;i<SN;i++){const ph=Math.acos(rnd()*.8),th=rnd()*Math.PI*2,r=220;sp[i*3]=r*Math.sin(ph)*Math.cos(th);sp[i*3+1]=r*Math.cos(ph)+20;sp[i*3+2]=r*Math.sin(ph)*Math.sin(th);}
    const sg=new THREE.BufferGeometry();sg.setAttribute('position',new THREE.BufferAttribute(sp,3));
    scene.add(new THREE.Points(sg,new THREE.PointsMaterial({color:0xDDE6F0,size:.9,sizeAttenuation:false,transparent:true,opacity:.55,fog:false})));}

  /* lights: warm low key that travels with the camera, cool sky fill, brass bounce */
  scene.add(new THREE.HemisphereLight(0x9FB4CC,0x1A1710,.5));
  const key=new THREE.DirectionalLight(0xFFD2A0,2.2); key.position.set(6,11,6); key.castShadow=true;
  key.shadow.mapSize.set(2048,2048); key.shadow.bias=-.0006; key.shadow.normalBias=.025; key.shadow.radius=3;
  Object.assign(key.shadow.camera,{near:1,far:70,left:-14,right:14,top:16,bottom:-14});
  scene.add(key,key.target);
  const fill=new THREE.DirectionalLight(0x8FB6E0,1.15); fill.position.set(-9,7,-9); scene.add(fill);
  const rim=new THREE.DirectionalLight(0xBFD8F0,.7); rim.position.set(2,5,-14); scene.add(rim);
  const bounce=new THREE.PointLight(C.horizon,18,30,2); scene.add(bounce);

  /* ground: dark desert plain with a faint survey grid that fades out */
  const ground=mesh(new THREE.PlaneGeometry(700,700),new THREE.MeshStandardMaterial({color:0x0B0E12,roughness:.95,metalness:.05,envMapIntensity:.35}),0,0,0,false,true);
  ground.rotation.x=-Math.PI/2; scene.add(ground);
  {const c=document.createElement('canvas');c.width=c.height=512;const x=c.getContext('2d');
    x.strokeStyle='rgba(224,169,74,.20)';x.lineWidth=1.5;x.strokeRect(.75,.75,510.5,510.5);
    x.strokeStyle='rgba(224,169,74,.06)';x.lineWidth=1;
    for(let i=64;i<512;i+=64){x.beginPath();x.moveTo(0,i+.5);x.lineTo(512,i+.5);x.moveTo(i+.5,0);x.lineTo(i+.5,512);x.stroke();}
    const tex=new THREE.CanvasTexture(c);tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.repeat.set(120,120);tex.anisotropy=R.capabilities.getMaxAnisotropy();
    const grid=mesh(new THREE.PlaneGeometry(700,700),new THREE.MeshBasicMaterial({map:tex,transparent:true,opacity:.5,depthWrite:false}),0,.012,0,false,false);
    grid.rotation.x=-Math.PI/2;scene.add(grid);}

  const anims=[]; const X=[0,44,88,132,176,220];
  const pool=(w,d,r)=>{const s=new THREE.Shape();const hw=w/2-r,hd=d/2-r;
    s.absarc(hw,hd,r,0,Math.PI/2);s.absarc(-hw,hd,r,Math.PI/2,Math.PI);s.absarc(-hw,-hd,r,Math.PI,Math.PI*1.5);s.absarc(hw,-hd,r,Math.PI*1.5,Math.PI*2);return s;};
  const slab=(shape,mat,y,depth=.1)=>{const m=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false}),mat);m.rotation.x=-Math.PI/2;m.position.y=y;m.castShadow=true;m.receiveShadow=true;return m;};
  const railing=(g,cx,cz,w,d,n=40)=>{const m=MAT.metal(0x23282A,.5);
    for(let i=0;i<n;i++){const t=i/n*Math.PI*2;const x=cx+Math.cos(t)*w/2,z=cz+Math.sin(t)*d/2;
      g.add(mesh(new THREE.CylinderGeometry(.012,.012,.42,5),m,x,.21,z,true,false));}
    const rail=mesh(new THREE.TorusGeometry(1,.016,6,80),m,cx,.42,cz,true,false);rail.rotation.x=Math.PI/2;rail.scale.set(w/2,d/2,1);g.add(rail);};

  /* ---------------------------------------------------------------
     01 · KING ABDULLAH PARK FOUNTAIN, AL-MALAZ
     From 7D's photograph: a large oval lake; a dense oval array of
     several hundred RGB-lit nozzles laid out in nested rings with a
     spiral sweep through the middle; tall white geysers behind it;
     a lit park of palms and pergolas; a corniche of railings and
     flower pots in the foreground; the low city beyond.
     --------------------------------------------------------------- */
  {const g=new THREE.Group();g.position.set(X[0],0,0);
    g.add(slab(pool(24,15,5),MAT.stone(0x6E6455,.9),0,.10));                        // park ground
    const basin=slab(pool(19,10.5,4.4),MAT.stone(0x4A4438,.95),.10,.06);g.add(basin);
    const water=mesh(new THREE.CircleGeometry(1,96),MAT.water(),0,.19,0,false,true);
    water.rotation.x=-Math.PI/2;water.scale.set(9.3,5.1,1);g.add(water);
    g.add(mesh(new THREE.TorusGeometry(1,.09,8,120),MAT.stone(0xBFAF92,.85),0,.2,0,true,true).rotateX(Math.PI/2).scale.set(9.4,5.2,1)&&g.children[g.children.length-1]);

    // nozzle field: nested ellipse rings + a spiral, each nozzle a lit head with a jet
    const jets=[];
    const addJet=(x,z,hMax,col,kind)=>{
      const n=Math.max(50,Math.round(hMax*46));const p=new Float32Array(n*3);
      for(let k=0;k<n;k++){const t=k/n;const sp=t*t*.11;p[k*3]=(rnd()-.5)*sp;p[k*3+1]=t*hMax;p[k*3+2]=(rnd()-.5)*sp;}
      const bg=new THREE.BufferGeometry();bg.setAttribute('position',new THREE.BufferAttribute(p,3));
      const pts=new THREE.Points(bg,new THREE.PointsMaterial({color:col,size:kind==='geyser'?.1:.062,transparent:true,opacity:.95,blending:THREE.AdditiveBlending,depthWrite:false,map:sprTex,alphaTest:.02}));
      pts.position.set(x,.2,z);g.add(pts);
      if(kind==='geyser')lamp(g,x,.3,z,col,.6,.3);
      jets.push({pts,hMax,ph:rnd()*Math.PI*2,kind});
    };
    for(let r=0;r<5;r++){const rx=2.0+r*1.35,rz=1.1+r*.72,cnt=26+r*10;
      const col=C.jet[r%C.jet.length];
      for(let i=0;i<cnt;i++){const a=i/cnt*Math.PI*2;addJet(Math.cos(a)*rx,Math.sin(a)*rz,1.5+r*.55,col,'ring');}}
    for(let i=0;i<70;i++){const t=i/70;const a=t*Math.PI*5.2;const rx=.6+t*6.2,rz=.35+t*3.4;
      addJet(Math.cos(a)*rx,Math.sin(a)*rz,1.1+Math.sin(t*Math.PI)*2.4,C.jet[Math.floor(t*6)%C.jet.length],'ring');}
    [[-6.4,.2],[-3.2,-.5],[0,.4],[3.2,-.5],[6.4,.2],[-1.7,1.6],[1.7,1.6]].forEach(([x,z],i)=>addJet(x,z,4.6+(i%3)*1.5,0xF2F8FF,'geyser'));

    // amphitheatre steps on the far bank, pergola colonnade, park lamps, palms
    for(let i=0;i<5;i++)g.add(mesh(new THREE.BoxGeometry(13-i*.5,.22,.7),MAT.stone(0xA8997C,.9),0,.2+i*.22,-6.1-i*.7));
    for(let i=-5;i<=5;i++){g.add(mesh(new THREE.BoxGeometry(.18,1.5,.18),MAT.stone(0x7A5B3A,.85),i*1.5,.85,7.4));
      if(i<5)g.add(mesh(new THREE.BoxGeometry(1.5,.1,.5),MAT.stone(0x7A5B3A,.85),i*1.5+.75,1.62,7.4));
      lamp(g,i*1.5,1.35,7.4,C.lamp,.75,.65);}
    for(let i=-7;i<=7;i++){g.add(palm(i*1.6,-7.8,1.5+rnd()*.5,1,rnd()*6));if(i%2)g.add(palm(i*1.6+.8,8.6,1.4+rnd()*.5,.95,rnd()*6));}
    for(let i=-8;i<=8;i++){g.add(mesh(new THREE.CylinderGeometry(.028,.036,1.25,8),MAT.metal(0x2A2E30,.5),i*1.35,.72,-5.4));
      g.add(mesh(new THREE.SphereGeometry(.075,10,10),MAT.emis(C.lamp,1.5),i*1.35,1.4,-5.4,false,false));lamp(g,i*1.35,1.4,-5.4,C.lamp,.8,.4);}
    // foreground corniche: railing plus flower pots, straight from the photo
    railing(g,0,0,21,12,72);
    for(let i=-10;i<=10;i++){g.add(mesh(new THREE.CylinderGeometry(.1,.075,.2,10),MAT.stone(0x8C4A38,.85),i*1.0,.2,6.55));
      g.add(mesh(new THREE.SphereGeometry(.1,10,8),MAT.foliage(0x3F7F4F),i*1.0,.36,6.55,true,false));}
    // the low city beyond the park
    for(let i=0;i<46;i++){const w=.8+rnd()*2.2,h=.5+Math.pow(rnd(),2)*2.4,d=.8+rnd()*1.8;
      const x=-18+rnd()*36,z=-12-rnd()*16;
      g.add(mesh(new THREE.BoxGeometry(w,h,d),MAT.sand(rnd()<.4?0x6A5F4C:0x4E4639),x,h/2,z));
      if(rnd()<.6)lamp(g,x,h*.6,z+d/2,C.lamp,.5,.3);}
    scene.add(g);
    anims.push(t=>{
      jets.forEach((j,i)=>{const beat=Math.sin(t*1.35+j.ph);const s=j.kind==='geyser'?.55+Math.max(0,beat)*.65:.6+Math.max(0,Math.sin(t*2.1+j.ph))*.45;
        j.pts.scale.y=s+Math.sin(t*9+i)*.02;});
      water.material.roughness=.72+Math.sin(t*2.2)*.03;});}

  /* ---------------------------------------------------------------
     02 · KING ABDULLAH INTERNATIONAL GARDENS
     From 7D's render: two interlocking crescent shells with a
     diamond-quilted ETFE skin, wrapped around a circular masterplan;
     a slender white observation tower with a flared base and a
     ringed disc head rising from the centre; desert plain.
     --------------------------------------------------------------- */
  {const g=new THREE.Group();g.position.set(X[1],0,0);
    g.add(slab(pool(30,30,14),MAT.sand(0x463E2E),0,.1));
    // the circular masterplan: banded rings of planting and paths
    for(let i=0;i<7;i++){const r=2.6+i*1.15;
      const ring=mesh(new THREE.RingGeometry(r,r+(i%2?.34:.62),96),new THREE.MeshStandardMaterial({color:i%2?0x2C5E3C:0x6A6046,roughness:.95,envMapIntensity:.4}),0,.11+i*.001,0,false,true);
      ring.rotation.x=-Math.PI/2;g.add(ring);}
    for(let i=0;i<8;i++){const a=i/8*Math.PI*2;const path=mesh(new THREE.BoxGeometry(9,.02,.3),MAT.stone(0xA79B80,.9),Math.cos(a)*4.8,.13,Math.sin(a)*4.8,false,true);path.rotation.y=-a;g.add(path);}
    // crescent shell: a torus arc, squashed, with a quilted diamond skin and a stone plinth
    const crescent=(rot,dx,dz,Rmaj,tube,arc)=>{
      const c=new THREE.Group();c.position.set(dx,.1,dz);c.rotation.y=rot;
      const plinth=mesh(new THREE.TorusGeometry(Rmaj,tube*1.1,8,96,arc),MAT.stone(0x9C907A,.9),0,0,0);
      plinth.rotation.x=Math.PI/2;plinth.scale.z=.1;c.add(plinth);
      const skin=new THREE.MeshPhysicalMaterial({color:0xFFFFFF,roughness:.24,metalness:0,transmission:.2,ior:1.3,thickness:.3,clearcoat:1,clearcoatRoughness:.12,transparent:true,opacity:.97,envMapIntensity:1.2,emissive:0xBFD8E8,emissiveIntensity:.1,side:THREE.DoubleSide});
      const shell=mesh(new THREE.TorusGeometry(Rmaj,tube,26,140,arc),skin,0,0,0);
      shell.rotation.x=Math.PI/2;shell.scale.z=.5;c.add(shell);
      // quilting: the diamond grid the render is covered in
      const quilt=new THREE.LineSegments(new THREE.WireframeGeometry(new THREE.TorusGeometry(Rmaj,tube*1.006,13,64,arc)),new THREE.LineBasicMaterial({color:0x9FB4BE,transparent:true,opacity:.45}));
      quilt.rotation.x=Math.PI/2;quilt.scale.z=.5;c.add(quilt);
      // interior glow along the arc
      for(let i=0;i<16;i++){const a=arc*(i+.5)/16;lamp(c,Math.cos(a)*Rmaj,tube*.2,Math.sin(a)*Rmaj,0xCFE9DD,1.5,.28);}
      return c;};
    g.add(crescent(0,-1.3,.9,5.4,1.9,Math.PI*1.13));
    g.add(crescent(Math.PI,1.3,-.9,5.4,1.9,Math.PI*1.13));
    // observation tower: flared foot, needle shaft, ringed disc head
    {const t=new THREE.Group();t.position.y=.1;g.add(t);
      const prof=[];for(let i=0;i<=24;i++){const u=i/24;const r=.62*Math.pow(1-u,2.6)+.085;prof.push(new THREE.Vector2(r,u*11.5));}
      const shaft=new THREE.Mesh(new THREE.LatheGeometry(prof,48),MAT.paint(0xF2F6F4));shaft.castShadow=true;t.add(shaft);
      t.add(mesh(new THREE.CylinderGeometry(.62,.62,.16,32),MAT.glass(0xB9DCEA,.5),0,11.55,0,false,false));
      t.add(mesh(new THREE.CylinderGeometry(.78,.66,.42,40),MAT.paint(0xFAFDFB),0,11.85,0));
      t.add(mesh(new THREE.CylinderGeometry(.84,.84,.1,40),MAT.paint(0xFAFDFB),0,12.14,0));
      t.add(mesh(new THREE.CylinderGeometry(.5,.5,.28,28),MAT.emis(0xDFF3EC,1.1),0,12.42,0,false,false));
      const beacon=halo(0xDFF3EC,2.6,.4);beacon.position.set(0,12.2,0);t.add(beacon);
      for(let i=0;i<12;i++){const a=i/12*Math.PI*2;lamp(t,Math.cos(a)*.7,.5,Math.sin(a)*.7,0xCFE9DD,.7,.4);}
      anims.push(tt=>{beacon.material.opacity=.24+Math.sin(tt*1.6)*.08;});}
    // service pavilions, rock outcrops, planting, lookout masts
    [[-8.6,-4.2],[8.2,4.6],[-7.4,5.8]].forEach(([x,z])=>{g.add(mesh(new THREE.BoxGeometry(2.1,.6,1.4),MAT.stone(0xB3A588,.9),x,.4,z));
      g.add(mesh(new THREE.BoxGeometry(2.2,.05,1.5),MAT.curtain(0x22323C),x,.72,z,false,false));lamp(g,x,.8,z,C.lamp,1.1,.45);});
    for(let i=0;i<26;i++){const a=rnd()*Math.PI*2,r=7.5+rnd()*6;
      const rock=mesh(new THREE.DodecahedronGeometry(.22+rnd()*.3,0),MAT.sand(0x7C6E52),Math.cos(a)*r,.2,Math.sin(a)*r);
      rock.rotation.set(rnd()*3,rnd()*3,rnd()*3);g.add(rock);}
    for(let i=0;i<30;i++){const a=rnd()*Math.PI*2,r=3.2+rnd()*7.5;g.add(palm(Math.cos(a)*r,Math.sin(a)*r,.9+rnd()*.6,.8,rnd()*6));}
    lamp(g,0,2,0,C.horizon,12,.06);
    scene.add(g);}

  /* ---------------------------------------------------------------
     03 · RIYADH EYE
     From 7D's render: a close, dramatic observation wheel at night —
     a broad glowing white rim band, a deeply triangulated cable
     lattice to a small hub, and capsules with warm-lit interiors
     hung outside the rim, over the city's light field.
     --------------------------------------------------------------- */
  {const g=new THREE.Group();g.position.set(X[2],0,0);
    g.add(slab(pool(26,20,7),MAT.stone(0x565044,.92),0,.1));
    const RW=8.4,wheel=new THREE.Group();wheel.position.set(0,RW+1.5,0);g.add(wheel);
    const band=MAT.paint(0xF6FAF8);
    [-.55,.55].forEach(z=>{
      const rim=mesh(new THREE.TorusGeometry(RW,.17,14,180),band,0,0,z);wheel.add(rim);
      wheel.add(mesh(new THREE.TorusGeometry(RW,.176,12,180),MAT.emis(0xEAF6FF,.85),0,0,z,false,false));
    });
    wheel.add(mesh(new THREE.TorusGeometry(RW-.62,.05,8,160),MAT.metal(0xC9D2CD,.35),0,0,0));
    // triangulated cable lattice — the render's signature web
    {const pts=[];const NS=48;
      for(let i=0;i<NS;i++){const a=i/NS*Math.PI*2,b=(i+1)/NS*Math.PI*2;
        const ro=new THREE.Vector3(Math.cos(a)*(RW-.2),Math.sin(a)*(RW-.2),0);
        const ro2=new THREE.Vector3(Math.cos(b)*(RW-.2),Math.sin(b)*(RW-.2),0);
        pts.push(ro.clone(),new THREE.Vector3(0,0,-.5),ro.clone(),new THREE.Vector3(0,0,.5));
        pts.push(ro.clone().setZ(-.5),ro2.clone().setZ(.5));
        if(i%2===0)pts.push(ro.clone(),ro2.clone().multiplyScalar(.55));}
      wheel.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:0xE7EEF2,transparent:true,opacity:.62})));}
    wheel.add(mesh(new THREE.CylinderGeometry(.6,.6,1.5,28),MAT.metal(0xD7DEDA,.3),0,0,0).rotateX(Math.PI/2));
    wheel.add(mesh(new THREE.CylinderGeometry(.72,.72,.1,36),MAT.metal(0xE7EEF2,.25),0,0,.8,false,false).rotateX(Math.PI/2));
    // capsules: rounded glazed pods, warm interior, hung on short arms outside the rim
    const cabs=[];
    for(let i=0;i<44;i++){const a=i/44*Math.PI*2;
      const cab=new THREE.Group();cab.position.set(Math.cos(a)*(RW+.62),Math.sin(a)*(RW+.62),0);
      cab.add(mesh(new THREE.CylinderGeometry(.24,.24,.62,18,1,false),MAT.glass(0xCFE6F2,.34),0,-.3,0,true,false).rotateZ(Math.PI/2));
      cab.add(mesh(new THREE.BoxGeometry(.66,.07,.5),MAT.paint(0xFBFDFC),0,.02,0,true,false));
      cab.add(mesh(new THREE.BoxGeometry(.6,.05,.44),MAT.paint(0xF2F5F3),0,-.62,0,true,false));
      cab.add(mesh(new THREE.BoxGeometry(.5,.2,.4),MAT.emis(0xFFD9A0,2.1),0,-.3,0,false,false));
      cab.add(mesh(new THREE.CylinderGeometry(.02,.02,.36,6),MAT.metal(0xD7DEDA,.35),0,.2,0,true,false));
      const gl=halo(0xFFD9A0,.7,.34);gl.position.y=-.3;cab.add(gl);
      wheel.add(cab);cabs.push(cab);}
    // A-frame supports and boarding deck
    [-1.1,1.1].forEach(z=>{[-1,1].forEach(s=>{const leg=mesh(new THREE.CylinderGeometry(.13,.26,RW+2.1,14),MAT.paint(0xF2F6F4),s*3.4,(RW+1.5)/2,z);leg.rotation.z=-s*.4;g.add(leg);});
      g.add(mesh(new THREE.BoxGeometry(7.4,.22,.26),MAT.metal(0xC9D2CD,.4),0,.32,z));});
    g.add(mesh(new THREE.BoxGeometry(5.4,.4,2.6),MAT.stone(0xBFB49B,.88),0,.3,1.9));
    g.add(mesh(new THREE.BoxGeometry(5.6,.06,2.8),MAT.stone(0xD8CDB8,.85),0,.52,1.9));
    g.add(mesh(new THREE.BoxGeometry(1.5,.9,1.2),MAT.curtain(0x263640),2.2,.95,2.2));
    railing(g,0,1.9,6.2,3.2,40);
    // the city's light field below and behind, with Kingdom Centre's arch far off
    for(let i=0;i<520;i++){const x=-60+rnd()*120,z=-16-rnd()*70;
      const s=rnd();g.add(mesh(new THREE.BoxGeometry(.05,.05,.05),MAT.emis(s<.75?0xFFC98A:0xFFF0D6,1.3),x,.1+rnd()*.5,z,false,false));}
    for(let i=0;i<70;i++){const w=1+rnd()*3,h=.6+Math.pow(rnd(),2.4)*4,d=1+rnd()*3;
      g.add(mesh(new THREE.BoxGeometry(w,h,d),MAT.sand(0x453E33),-45+rnd()*90,h/2,-18-rnd()*55));}
    {const k=new THREE.Group();k.position.set(-26,0,-46);g.add(k);
      const sh=mesh(new THREE.CylinderGeometry(1.5,2.1,8.6,32),MAT.curtain(0x2E4450),0,4.3,0);sh.scale.z=.45;k.add(sh);
      const s=new THREE.Shape();s.moveTo(-1.5,0);s.lineTo(-.85,0);s.quadraticCurveTo(0,11,.85,0);s.lineTo(1.5,0);s.lineTo(1.2,6.8);s.lineTo(-1.2,6.8);
      const cr=new THREE.Mesh(new THREE.ExtrudeGeometry(s,{depth:1.2,bevelEnabled:false}),MAT.curtain(0x2E4450));cr.position.set(0,8.6,-.6);k.add(cr);
      k.add(edges(cr.geometry,0xEAF6FF,.5).translateY(8.6).translateZ(-.6));
      k.add(mesh(new THREE.BoxGeometry(1.9,.22,1.4),MAT.emis(0xEAF6FF,2),0,15.3,0,false,false));
      lamp(k,0,15.3,0,0xEAF6FF,2.2,.3);}
    lamp(g,0,RW+1.5,1,0xBFD8E8,20,.05);
    scene.add(g);
    anims.push(t=>{wheel.rotation.z=t*.052;cabs.forEach(c=>{c.rotation.z=-wheel.rotation.z;});});}

  /* ---------------------------------------------------------------
     04 · RIYADH 2020 URBAN STUDY
     The capital itself: superblock grid on King Fahd Road with the
     metro viaduct, Kingdom Centre's arch, Al Faisaliah's pyramid and
     gold sphere, the KAFD crystal cluster, the TV tower and the
     water tower, over a sand-coloured plain.
     --------------------------------------------------------------- */
  {const g=new THREE.Group();g.position.set(X[3],0,0);
    g.add(slab(pool(34,26,3),MAT.sand(0x7A6C52),0,.1));
    const road=new THREE.MeshStandardMaterial({color:0x1E2022,roughness:.9});
    for(let i=-3;i<=3;i++)g.add(mesh(new THREE.BoxGeometry(34,.02,.5),road,0,.12,i*3.4,false,true));
    for(let i=-4;i<=4;i++)g.add(mesh(new THREE.BoxGeometry(.5,.02,26),road,i*3.6,.12,0,false,true));
    g.add(mesh(new THREE.BoxGeometry(1.3,.02,26),road,0,.125,0,false,true));                     // King Fahd Road
    for(let i=-12;i<=12;i++){g.add(mesh(new THREE.CylinderGeometry(.07,.09,.9,8),MAT.stone(0xB3A588,.85),0,.55,i*1.05));
      if(i<12)g.add(mesh(new THREE.BoxGeometry(.5,.14,1.05),MAT.stone(0xC6BBA2,.85),0,1.06,i*1.05+.5));    // metro viaduct
      g.add(palm(.95,i*1.05,.8,.6,rnd()*6));g.add(palm(-.95,i*1.05+.5,.8,.6,rnd()*6));}
    for(let i=-3;i<=3;i++)for(let j=-3;j<=3;j++){const cx=i*3.6,cz=j*3.4;
      for(let k=0;k<11;k++){const w=.4+rnd()*.7,d=.4+rnd()*.7,h=.2+Math.pow(rnd(),2.6)*1.5;
        const x=cx+(rnd()-.5)*2.9,z=cz+(rnd()-.5)*2.6;if(Math.abs(x)<1)continue;
        g.add(mesh(new THREE.BoxGeometry(w,h,d),MAT.sand(rnd()<.35?0x8C7D60:0x5E5443),x,.11+h/2,z));
        if(rnd()<.35)lamp(g,x,.11+h*.7,z+d/2,C.lamp,.35,.3);}}
    // Kingdom Centre
    {const k=new THREE.Group();k.position.set(-3.1,.11,4.6);g.add(k);
      const sh=mesh(new THREE.CylinderGeometry(1.1,1.55,6.2,44),MAT.curtain(0x51788C),0,3.1,0);sh.scale.z=.44;k.add(sh);
      k.add(edges(new THREE.CylinderGeometry(1.1,1.55,6.2,44),0xBFE0F0,.16).translateY(3.1));
      for(let i=1;i<13;i++){const band=mesh(new THREE.CylinderGeometry(1.12+ (1.55-1.1)*(1-i/13),1.12+(1.55-1.1)*(1-i/13),.05,44),MAT.emis(0xFFE6BE,.5),0,i*.46,0,false,false);band.scale.z=.44;k.add(band);}
      const s=new THREE.Shape();s.moveTo(-1.1,0);s.lineTo(-.62,0);s.quadraticCurveTo(0,8.4,.62,0);s.lineTo(1.1,0);s.lineTo(.88,4.9);s.lineTo(-.88,4.9);
      const cr=new THREE.Mesh(new THREE.ExtrudeGeometry(s,{depth:.9,bevelEnabled:false}),MAT.curtain(0x51788C));cr.position.set(0,6.2,-.45);cr.castShadow=true;k.add(cr);
      k.add(edges(cr.geometry,0xEAF6FF,.55).translateY(6.2).translateZ(-.45));
      k.add(mesh(new THREE.BoxGeometry(1.4,.16,1.0),MAT.emis(0xEAF6FF,2.2),0,11.0,0,false,false));   // sky bridge
      lamp(k,0,11.0,0,0xEAF6FF,2,.3);
      k.add(mesh(new THREE.BoxGeometry(5.4,.5,2.0),MAT.stone(0xC6BBA2,.88),1.6,.25,1.4));}
    // Al Faisaliah
    {const f=new THREE.Group();f.position.set(3.4,.11,-2.2);g.add(f);
      const py=mesh(new THREE.ConeGeometry(1.25,9.2,4),MAT.curtain(0x567586),0,4.6,0);py.rotation.y=Math.PI/4;f.add(py);
      f.add(edges(new THREE.ConeGeometry(1.25,9.2,4),0xDCEAF2,.5).translateY(4.6).rotateY(Math.PI/4));
      [-1,1].forEach(sx=>[-1,1].forEach(sz=>f.add(mesh(new THREE.CylinderGeometry(.07,.11,8.2,10),MAT.metal(0xD7DEDA,.3),sx*.86,4.1,sz*.86))));
      f.add(mesh(new THREE.SphereGeometry(.42,28,28),new THREE.MeshStandardMaterial({color:0xE8B85C,roughness:.14,metalness:1,emissive:0x7A5620,emissiveIntensity:.85,envMapIntensity:2.4}),0,7.8,0,true,false));
      lamp(f,0,7.8,0,0xFFD48A,2,.4);
      f.add(mesh(new THREE.CylinderGeometry(.02,.05,1.2,8),MAT.metal(),0,9.6,0,false,false));
      f.add(mesh(new THREE.BoxGeometry(4.4,.5,2.4),MAT.stone(0xC6BBA2,.88),-1.4,.25,1.0));}
    // KAFD cluster
    {const K=[[8.6,-6.4,9.8,6],[6.9,-7.2,7.6,5],[10.4,-5.2,5.6,6],[9.4,-7.8,6.4,5],[7.4,-5.0,4.2,6],[11.4,-6.8,4.8,5],[6.0,-6.0,3.4,6],[10.8,-8.2,3.8,5],[8.2,-4.4,3.0,6],[12.0,-5.4,2.6,6]];
      K.forEach(([x,z,h,n],i)=>{const t=mesh(new THREE.CylinderGeometry(.5,.62,h,n),MAT.curtain(0x4A6A78),x,.11+h/2,z);t.rotation.y=rnd()*Math.PI;g.add(t);
        g.add(edges(new THREE.CylinderGeometry(.5,.62,h,n),0xCFE4EE,.34).translateX(x).translateY(.11+h/2).translateZ(z).rotateY(t.rotation.y));
        const cap=mesh(new THREE.ConeGeometry(.52,.9,n),MAT.curtain(0x4A6A78),x,.11+h+.45,z,true,false);cap.rotation.set(.22,t.rotation.y,0);g.add(cap);
        if(i<4){g.add(mesh(new THREE.BoxGeometry(.5,.06,.5),MAT.emis(0xBFE0F0,2.2),x,.11+h+.95,z,false,false));lamp(g,x,.11+h+.95,z,0xBFE0F0,1.8,.4);}});
      g.add(mesh(new THREE.BoxGeometry(2.6,.07,.16),MAT.metal(0xD7DEDA,.4),8.6,3.2,-6.8,false,false));}
    // TV tower and water tower
    g.add(mesh(new THREE.CylinderGeometry(.11,.24,5.6,14),MAT.stone(0xEDE6D6,.7),-9.4,.11+2.8,-4.2));
    g.add(mesh(new THREE.OctahedronGeometry(.5,0),MAT.glass(0xBFE0F0,.55),-9.4,4.9,-4.2,true,false));
    g.add(mesh(new THREE.CylinderGeometry(.02,.045,1.6,6),MAT.metal(),-9.4,6.1,-4.2,false,false));
    g.add(mesh(new THREE.SphereGeometry(.07,8,8),MAT.emis(0xFF6B5A,3.4),-9.4,6.95,-4.2,false,false));
    lamp(g,-9.4,6.95,-4.2,0xFF6B5A,.9,.35);
    g.add(mesh(new THREE.CylinderGeometry(.16,.2,2.1,16),MAT.stone(0xD8CDB8,.8),7.4,.11+1.05,5.4));
    g.add(mesh(new THREE.ConeGeometry(.95,.55,24),MAT.stone(0xD8CDB8,.8),7.4,1.5,5.4));
    lamp(g,0,3,0,C.horizon,16,.05);
    scene.add(g);}

  /* ---------------------------------------------------------------
     05 · DEPARTMENT OF SOCIAL SERVICES · 2016
     7D publishes no photograph of this building, so it is drawn as the
     Riyadh ministry idiom their brief describes: a symmetrical
     limestone block, deep portico, pilaster bays, mashrabiya screens,
     flags on the forecourt axis, walled compound.
     --------------------------------------------------------------- */
  {const g=new THREE.Group();g.position.set(X[4],0,0);
    g.add(slab(pool(26,20,2),MAT.stone(0x585449,.92),0,.1));
    g.add(slab(pool(17,12,1),MAT.stone(0x8E8779,.9),.1,.05));                     // forecourt pavers
    // compound wall with railings and a gatehouse
    const wall=MAT.sand(0xB3A588);
    [[0,-9.4,24,.3],[0,9.4,24,.3]].forEach(([x,z,w,d])=>g.add(mesh(new THREE.BoxGeometry(w,.6,d),wall,x,.4,z)));
    [[-11.8,0,.3,19],[11.8,0,.3,19]].forEach(([x,z,w,d])=>g.add(mesh(new THREE.BoxGeometry(w,.6,d),wall,x,.4,z)));
    for(let i=-22;i<=22;i++)g.add(mesh(new THREE.BoxGeometry(.04,.5,.04),MAT.metal(0x22262A,.5),i*.52,.95,9.4,false,false));
    g.add(mesh(new THREE.BoxGeometry(1.8,1.2,1.4),MAT.sand(0xC8BB9E),7.6,.7,9.4));
    g.add(mesh(new THREE.BoxGeometry(2.2,.14,1.8),MAT.sand(0xB3A588),7.6,1.37,9.4));
    // plinth, main block, projecting entrance bay, parapet, roof plant
    g.add(mesh(new THREE.BoxGeometry(15.4,.5,8.6),MAT.sand(0xB3A588),0,.35,-1.2));
    g.add(mesh(new THREE.BoxGeometry(14.2,.4,7.8),MAT.sand(0xC8BB9E),0,.8,-1.2));
    g.add(mesh(new THREE.BoxGeometry(13.2,5.4,6.6),MAT.sand(0xDCCFAE),0,3.7,-1.5));
    g.add(mesh(new THREE.BoxGeometry(13.4,.34,6.8),MAT.sand(0xB3A588),0,6.55,-1.5));
    g.add(mesh(new THREE.BoxGeometry(4.2,.9,2.6),MAT.metal(0x6E7269,.7),-3.2,7.0,-2.4));
    g.add(mesh(new THREE.BoxGeometry(4.6,6.6,2.4),MAT.sand(0xE4D8B8),0,4.0,1.6));
    g.add(mesh(new THREE.BoxGeometry(4.9,.34,2.7),MAT.sand(0xB3A588),0,7.4,1.6));
    g.add(mesh(new THREE.BoxGeometry(2.6,.7,.12),MAT.emis(C.brass,1.6),0,6.6,2.86,false,false));
    lamp(g,0,6.6,3.1,C.brass,1.5,.3);
    // portico: stone columns, deep canopy, glazed doors, broad stair and ramps
    [-1.7,-.58,.58,1.7].forEach(x=>{g.add(mesh(new THREE.BoxGeometry(.42,4.4,.42),MAT.sand(0xEFE4C4),x,2.4,3.3));
      g.add(mesh(new THREE.BoxGeometry(.56,.18,.56),MAT.sand(0xDCCFAE),x,4.7,3.3));
      lamp(g,x,.5,3.7,C.lamp,1.0,.5);});
    g.add(mesh(new THREE.BoxGeometry(5.0,.4,2.0),MAT.sand(0xE4D8B8),0,4.9,2.6));
    g.add(mesh(new THREE.BoxGeometry(3.6,3.2,.14),MAT.curtain(0x23333A),0,2.0,2.62,false,false));
    for(let i=0;i<5;i++)g.add(mesh(new THREE.BoxGeometry(6.2+i*.5,.18,.5),MAT.sand(0xC8BB9E),0,.75-i*.18,4.4+i*.5));
    // pilaster bays with recessed glazing behind mashrabiya screens
    const screenMat=new THREE.LineBasicMaterial({color:0xEFE4C4,transparent:true,opacity:.5});
    for(const side of [1,-1])for(let i=-5;i<=5;i++){
      if(Math.abs(i)<=1&&side===1)continue;
      const x=i*1.15,z=-1.5+side*3.34;
      g.add(mesh(new THREE.BoxGeometry(.64,4.4,.1),MAT.curtain(0x23333A),x,3.5,z,false,false));
      const sc=new THREE.LineSegments(new THREE.WireframeGeometry(new THREE.PlaneGeometry(.64,4.4,5,26)),screenMat);sc.position.set(x,3.5,z+side*.03);g.add(sc);
      g.add(mesh(new THREE.BoxGeometry(.24,5.4,.28),MAT.sand(0xC8BB9E),x+.58,3.7,z+side*.02));}
    for(let i=-2;i<=2;i++){[-6.66,6.66].forEach(x=>{g.add(mesh(new THREE.BoxGeometry(.1,4.4,.64),MAT.curtain(0x23333A),x,3.5,-1.5+i*1.2,false,false));
      g.add(mesh(new THREE.BoxGeometry(.26,5.4,.24),MAT.sand(0xC8BB9E),x+(x>0?.03:-.03),3.7,-1.5+i*1.2+.58));});}
    flag(g,-2.0,7.2,4.6,1.3,anims);flag(g,0,7.5,5.2,1.5,anims);flag(g,2.0,7.2,4.6,1.3,anims);
    for(let i=-9;i<=9;i++){if(Math.abs(i)<3)continue;g.add(palm(i*1.15,6.4,1.5+rnd()*.4,.95,rnd()*6));}
    [-10.2,-8.6,8.6,10.2].forEach(x=>g.add(palm(x,-1.0,1.6+rnd()*.4,1,rnd()*6)));
    for(let i=-7;i<=7;i++)g.add(mesh(new THREE.BoxGeometry(.46,.22,.9),new THREE.MeshStandardMaterial({color:[0xE6EAE6,0x8C938F,0x22262A][Math.floor(rnd()*3)],roughness:.35,metalness:.65,envMapIntensity:1.4}),i*.8,.32,-7.4));
    lamp(g,0,2,0,C.lamp,12,.055);
    scene.add(g);}

  /* ---------------------------------------------------------------
     06 · MIDDLE EAST HQ · RIYADH · DEC 2025
     No building is published, so it is the KAFD idiom 7D is entering:
     a faceted crystal tower of tilted glass tiers on a glazed
     hexagonal podium, skywalk, sheared crown and a lit 7D mark.
     --------------------------------------------------------------- */
  {const g=new THREE.Group();g.position.set(X[5],0,0);
    g.add(slab(pool(26,20,4),MAT.stone(0x565044,.92),0,.1));
    g.add(mesh(new THREE.BoxGeometry(26,.02,2.2),new THREE.MeshStandardMaterial({color:0x1E2022,roughness:.9}),0,.12,8.2,false,true));
    g.add(mesh(new THREE.CylinderGeometry(5.4,5.6,.5,6),MAT.stone(0xBFB49B,.88),0,.35,0));
    g.add(mesh(new THREE.CylinderGeometry(4.6,4.6,2.1,6),MAT.glass(0xA8D8C6,.4),0,1.65,0,true,false));
    g.add(edges(new THREE.CylinderGeometry(4.6,4.6,2.1,6),0xDCEAE4,.32).translateY(1.65));
    g.add(mesh(new THREE.CylinderGeometry(4.8,4.8,.18,6),MAT.metal(0xD7DEDA,.35),0,2.8,0));
    g.add(mesh(new THREE.BoxGeometry(5.0,.14,2.2),MAT.stone(0xD8CDB8,.85),0,1.5,5.6,true,false));
    [-1.8,1.8].forEach(x=>g.add(mesh(new THREE.CylinderGeometry(.07,.07,1.4,8),MAT.metal(),x,.8,5.6)));
    let y=2.9;const tiers=[[2.9,2.7,2.6],[2.7,2.85,2.5],[2.85,2.55,2.4],[2.55,2.7,2.3],[2.7,2.3,2.2],[2.3,1.9,2.0]];
    const core=mesh(new THREE.CylinderGeometry(1.7,2.0,14.0,6),new THREE.MeshStandardMaterial({color:0x121A1C,roughness:.35,metalness:.75,envMapIntensity:1.4}),0,y+7.0,0);g.add(core);
    tiers.forEach(([rb,rt,h],i)=>{
      const t=mesh(new THREE.CylinderGeometry(rt,rb,h,6),MAT.curtain(0x1F4A44),0,y+h/2,0);t.rotation.y=i*Math.PI/9;g.add(t);
      g.add(edges(new THREE.CylinderGeometry(rt*1.004,rb*1.004,h,6),C.teal,.55).translateY(y+h/2).rotateY(t.rotation.y));
      for(let k=1;k<Math.floor(h/.42);k++){const band=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.CylinderGeometry(rt*1.005,rt*1.005,.001,6)),new THREE.LineBasicMaterial({color:0xCFE4DE,transparent:true,opacity:.14}));
        band.position.y=y+k*.42;band.rotation.y=t.rotation.y;g.add(band);}
      if(i<5){const sl=mesh(new THREE.CylinderGeometry(rt*1.03,rt*1.03,.12,6),MAT.metal(0xDCE4E0,.3),0,y+h,0);sl.rotation.y=t.rotation.y;g.add(sl);}
      y+=h;});
    const crown=mesh(new THREE.CylinderGeometry(.9,1.9,1.6,6),MAT.glass(0xA8D8C6,.42),0,y+.7,0,true,false);crown.rotation.set(.2,Math.PI/9,0);g.add(crown);
    g.add(edges(new THREE.CylinderGeometry(.9,1.9,1.6,6),C.teal,.6).translateY(y+.7).rotateX(.2).rotateY(Math.PI/9));
    const sign=mesh(new THREE.BoxGeometry(2.4,.6,.12),MAT.emis(C.teal,2.4),0,y-1.4,1.96,false,false);g.add(sign);
    const sg=halo(0x8FE8C6,2.6,.34);sg.position.copy(sign.position);g.add(sg);
    const beacon=mesh(new THREE.SphereGeometry(.11,12,12),MAT.emis(0xFFFFFF,3.2),0,y+1.7,0,false,false);g.add(beacon);
    const bh=halo(0xEAF6FF,1.6,.36);bh.position.copy(beacon.position);g.add(bh);
    [[9.2,-5.4,8.6,5],[-8.4,-5.8,6.4,6],[10.6,2.6,5.2,5],[-9.8,3.4,4.4,6]].forEach(([x,z,h,n])=>{
      const t=mesh(new THREE.CylinderGeometry(1.2,1.5,h,n),MAT.curtain(0x4A6A78),x,.11+h/2,z);t.rotation.y=rnd()*Math.PI;g.add(t);
      g.add(edges(new THREE.CylinderGeometry(1.2,1.5,h,n),0xCFE4EE,.3).translateX(x).translateY(.11+h/2).translateZ(z).rotateY(t.rotation.y));
      const cap=mesh(new THREE.ConeGeometry(1.25,1.0,n),MAT.curtain(0x4A6A78),x,.11+h+.5,z,true,false);cap.rotation.set(.2,t.rotation.y,0);g.add(cap);
      lamp(g,x,.11+h+.5,z,0xBFE0F0,2,.3);});
    g.add(mesh(new THREE.BoxGeometry(5.2,.3,.8),MAT.glass(0xA8D8C6,.4),5.6,4.4,-2.6,true,false));
    g.add(mesh(new THREE.BoxGeometry(5.2,.08,.9),MAT.metal(0xDCE4E0,.35),5.6,4.6,-2.6,false,false));
    for(let i=-9;i<=9;i++){g.add(palm(i*1.3,7.0,1.5+rnd()*.4,.95,rnd()*6));if(i%2)lamp(g,i*1.3,.9,6.0,C.lamp,1.0,.45);}
    for(let i=0;i<16;i++){const a=i/16*Math.PI*2;lamp(g,Math.cos(a)*5.9,.5,Math.sin(a)*5.9,C.teal,.8,.4);}
    lamp(g,0,6,0,C.teal,16,.055);
    scene.add(g);
    anims.push(t=>{beacon.material.emissiveIntensity=2.2+Math.sin(t*2.6)*1.4;bh.material.opacity=.26+Math.sin(t*2.6)*.1;sg.material.opacity=.24+Math.sin(t*1.7)*.07;});}

  /* airborne dust catching the low light */
  {const N=900,p=new Float32Array(N*3);
    for(let i=0;i<N;i++){p[i*3]=-20+rnd()*180;p[i*3+1]=.3+rnd()*14;p[i*3+2]=-40+rnd()*80;}
    const bg=new THREE.BufferGeometry();bg.setAttribute('position',new THREE.BufferAttribute(p,3));
    const dust=new THREE.Points(bg,new THREE.PointsMaterial({color:0xE8C79A,size:.07,transparent:true,opacity:.3,blending:THREE.AdditiveBlending,depthWrite:false,map:sprTex}));
    scene.add(dust);anims.push(t=>{dust.position.y=Math.sin(t*.22)*.4;});}

  /* camera: one long approach per site, lifted so the tall scenes fit */
  const EYE=[[-3,7.5,20],[-6,13,30],[-3,12,26],[-4,14,32],[-5,13,34],[-6,19,44]];
  const LOOK=[[0,1.6,0],[0,5.0,0],[0,7.5,0],[0,4.6,0],[0,4.0,0],[0,9.0,0]];
  const wps=[];
  X.forEach((x,i)=>{const[ex,ey,ez]=EYE[i];wps.push(new THREE.Vector3(x+ex,ey,ez));
    if(i<X.length-1){const[nx,ny,nz]=EYE[i+1];wps.push(new THREE.Vector3((x+X[i+1])/2+(ex+nx)/2,Math.max(ey,ny)+3,Math.max(ez,nz)+4));}});
  const curve=new THREE.CatmullRomCurve3(wps,false,'catmullrom',.35);

  const {composer,bloom}=makeComposer(renderer,scene,cam,stage,{strength:.3,radius:.42,threshold:.9});
  flight={renderer,composer,bloom,scene,cam,curve,X,LOOK,anims,stage,key,bounce,t:0,clock:new THREE.Clock()};
  window.flight=flight;
  addEventListener('resize',()=>{const W=stage.clientWidth,H=stage.clientHeight;renderer.setSize(W,H);composer.setSize(W,H);cam.aspect=W/H;cam.updateProjectionMatrix();});
}

export function updateFlight(p){
  if(!flight)return;
  const {cam,curve,X,LOOK,anims,composer,key,bounce}=flight;
  flight.t=REDUCED?p:lerp(flight.t,p,.11);
  cam.position.copy(curve.getPointAt(clamp(flight.t,0,1)));
  const fi=clamp(flight.t,0,1)*(X.length-1),i0=Math.floor(fi),i1=Math.min(X.length-1,i0+1),f=fi-i0;
  const lx=lerp(X[i0],X[i1],f);
  cam.lookAt(new THREE.Vector3(lx+lerp(LOOK[i0][0],LOOK[i1][0],f),lerp(LOOK[i0][1],LOOK[i1][1],f),lerp(LOOK[i0][2],LOOK[i1][2],f)));
  key.position.set(lx+7,12,7); key.target.position.set(lx,0,0); key.target.updateMatrixWorld();
  bounce.position.set(lx,3.2,6);
  const tt=flight.clock.getElapsedTime(); anims.forEach(fn=>fn(tt));
  const n=(window.PROJECTS||[]).length||6;
  const idx=clamp(Math.round(p*(n-1)),0,n-1);
  document.querySelectorAll('.scene-card').forEach(c=>c.classList.toggle('on',+c.dataset.i===idx));
  const hud=document.querySelector('#hudIdx');
  if(hud&&hud.textContent!==String(idx+1).padStart(2,'0')){hud.textContent=String(idx+1).padStart(2,'0');if(navigator.vibrate&&isTouch)navigator.vibrate(5);}
  composer.render();
}

/* hand the scene functions to the page script, then tell it we are ready */
Object.assign(window,{initGlobe,updateGlobe,initFlight,updateFlight});
dispatchEvent(new Event('scene-ready'));
