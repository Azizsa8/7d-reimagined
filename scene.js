/* Real-time geography only. Project photography lives in projects.js. */
import * as THREE from 'three';
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x));
let globe;
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

const radius=1.25;
function point(lat,lon,r=radius){const a=lat*Math.PI/180,b=lon*Math.PI/180;return new THREE.Vector3(r*Math.cos(a)*Math.cos(b),r*Math.sin(a),-r*Math.cos(a)*Math.sin(b));}
export function initGlobe(){
  if(globe)return;
  const stage=document.querySelector('#globeStage');
  const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  stage.append(renderer.domElement);renderer.domElement.setAttribute('aria-hidden','true');
  const scene=new THREE.Scene(),g=new THREE.Group();scene.add(g);
  const cam=new THREE.PerspectiveCamera(36,1,.1,20);cam.position.z=4.7;
  g.add(new THREE.Mesh(new THREE.SphereGeometry(radius,64,48),new THREE.MeshBasicMaterial({color:0x0C1015})));
  const rim=new THREE.Mesh(new THREE.SphereGeometry(radius*1.004,64,48),new THREE.ShaderMaterial({
    transparent:true,depthWrite:false,side:THREE.BackSide,
    vertexShader:'varying vec3 n;varying vec3 v;void main(){n=normalize(normalMatrix*normal);vec4 p=modelViewMatrix*vec4(position,1.);v=normalize(-p.xyz);gl_Position=projectionMatrix*p;}',
    fragmentShader:'varying vec3 n;varying vec3 v;void main(){float f=pow(1.-abs(dot(normalize(n),normalize(v))),3.);gl_FragColor=vec4(.84,.75,.58,f*.28);}'
  }));g.add(rim);
  const hubs=window.HUBS||[],marks=[];
  for(const h of hubs){
    const v=point(h.lat,h.lon,radius*1.008);
    const disc=new THREE.Mesh(new THREE.CircleGeometry(.021,20),new THREE.MeshBasicMaterial({color:0xF4D69A}));
    disc.position.copy(v);disc.lookAt(v.clone().multiplyScalar(2));g.add(disc);
    const ring=new THREE.Mesh(new THREE.RingGeometry(.032,.038,28),new THREE.MeshBasicMaterial({color:0xE0A94A,transparent:true,opacity:.5}));
    ring.position.copy(v);ring.lookAt(v.clone().multiplyScalar(2));g.add(ring);
    const label=document.createElement('span');label.className='hub-label';stage.append(label);
    marks.push({v,disc,ring,label,h});
  }
  // Founding region → Australia → US → Korea → the newest Riyadh hub.
  // Display sequence follows the company history; no dates are inferred for offices.
  const order=[1,4,0,3,2],arcs=[];
  for(let i=0;i<order.length-1;i++){
    const a=marks[order[i]].v.clone().normalize(),b=marks[order[i+1]].v.clone().normalize();
    const angle=Math.acos(clamp(a.dot(b),-1,1));
    const at=t=>a.clone().multiplyScalar(Math.sin((1-t)*angle)).addScaledVector(b,Math.sin(t*angle)).divideScalar(Math.sin(angle)).multiplyScalar(radius+.012+.11*Math.sin(Math.PI*t));
    const pts=Array.from({length:97},(_,n)=>at(n/96));
    const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:0xE0A94A,transparent:true,opacity:.48}));g.add(line);
    const pulse=new THREE.Mesh(new THREE.SphereGeometry(.015,8,6),new THREE.MeshBasicMaterial({color:0xFFF0CD}));g.add(pulse);arcs.push({line,pulse,at});
  }
  globe={renderer,scene,cam,g,marks,arcs,order,stage,ready:false};window.globe=globe;
  const resize=()=>{const w=stage.clientWidth,h=stage.clientHeight;if(!w||!h)return;renderer.setSize(w,h);cam.aspect=w/h;cam.position.z=cam.aspect<1?4.7/cam.aspect:4.7;cam.updateProjectionMatrix();updateGlobe(globe.progress||0);};
  new ResizeObserver(resize).observe(stage);resize();
  fetch('data/land-110m.json').then(r=>{if(!r.ok)throw Error('land');return r.json();}).then(topo=>{
    const mask=landMask(topoToRings(topo,'land'));
    // Icosphere vertices form an almost hexagonal lattice, with 12 necessary pentagonal poles.
    // Deduplicate triangle corners; no Fibonacci spirals, equator line or doubled coastline.
    const grid=new THREE.IcosahedronGeometry(1,48),position=grid.getAttribute('position'),seen=new Set(),land=[];
    for(let i=0;i<position.count;i++){
      const v=new THREE.Vector3().fromBufferAttribute(position,i).normalize();
      const key=[v.x,v.y,v.z].map(x=>Math.round(x*1e5)).join(',');if(seen.has(key))continue;seen.add(key);
      const lat=Math.asin(v.y)*180/Math.PI,lon=Math.atan2(-v.z,v.x)*180/Math.PI;
      if(mask.at(lon,lat))land.push(v.x*radius*1.003,v.y*radius*1.003,v.z*radius*1.003);
    }
    grid.dispose();
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(land,3));
    const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{pixelRatio:{value:renderer.getPixelRatio()}},
      vertexShader:'uniform float pixelRatio;varying float fade;void main(){vec4 p=modelViewMatrix*vec4(position,1.);vec3 n=normalize(normalMatrix*normalize(position));fade=smoothstep(.12,.42,dot(n,normalize(-p.xyz)));gl_PointSize=2.1*pixelRatio;gl_Position=projectionMatrix*p;}',
      fragmentShader:'varying float fade;void main(){float d=length(gl_PointCoord-.5);float a=(1.-smoothstep(.3,.5,d))*fade;if(a<.01)discard;gl_FragColor=vec4(.88,.67,.34,a*.9);}'
    });g.add(new THREE.Points(geo,material));globe.ready=true;updateGlobe(globe.progress||0);
  }).catch(()=>{stage.classList.add('land-unavailable');});
}
export function updateGlobe(p){
  if(!globe)return;
  const {g,renderer,scene,cam,marks,arcs,order,stage}=globe;globe.progress=p;
  const t=reduced.matches?0:performance.now()/1000;
  g.rotation.set(.08,reduced.matches?-.5:-Math.PI/2+p*1.7,0);g.updateMatrixWorld(true);
  const progress=reduced.matches?4:clamp(p*1.2)*4;
  marks.forEach((m,i)=>{
    const on=progress>=order.indexOf(i);m.disc.visible=m.ring.visible=on;
    m.ring.scale.setScalar(reduced.matches?1:1+.1*Math.sin(t*1.6+i));
    const world=m.v.clone().applyMatrix4(g.matrixWorld),facing=world.clone().normalize().dot(cam.position.clone().sub(world).normalize());
    const projected=world.project(cam);m.label.hidden=!on||facing<.3;
    m.label.textContent=window.LANG==='ar'?m.h.ar:m.h.n;
    m.label.style.left=`${(projected.x*.5+.5)*stage.clientWidth}px`;m.label.style.top=`${(-projected.y*.5+.5)*stage.clientHeight}px`;
    document.querySelector(`.clock[data-i="${i}"]`)?.classList.toggle('lit',on);
  });
  arcs.forEach((a,i)=>{const k=clamp(progress-i);a.line.geometry.setDrawRange(0,Math.floor(k*97));a.pulse.visible=k===1&&!reduced.matches;if(a.pulse.visible)a.pulse.position.copy(a.at((t*.13+i*.2)%1));});
  renderer.render(scene,cam);
}
