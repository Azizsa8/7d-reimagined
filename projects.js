/* Free recovery route: published photography, with a small scroll-driven push-in.
   No generated architecture. Replace media only when authored cinematics are approved. */
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let flight;
export function initFlight(){
  if(flight)return;
  const stage=document.querySelector('#flightStage'),projects=window.PROJECTS;
  const images=projects.map(p=>{const img=document.createElement('img');img.className='project-image';img.dataset.id=p.id;img.alt=p[window.LANG||'en'].t;img.decoding='async';img.dataset.src=p.image;stage.append(img);return img;});
  flight={stage,images,active:-1,near:false};window.flight=flight;
  const observer=new IntersectionObserver(entries=>{flight.near=entries.some(e=>e.isIntersecting);if(flight.near)updateFlight(flight.progress||0);},{rootMargin:'500px'});observer.observe(document.querySelector('#flight'));
  updateFlight(0);
}
export function updateFlight(p){
  if(!flight)return;flight.progress=p;
  const n=flight.images.length,index=Math.max(0,Math.min(n-1,Math.round(p*(n-1))));
  const lang=window.LANG||'en';
  flight.images.forEach((img,i)=>{
    if(flight.near&&Math.abs(i-index)<=1&&!img.getAttribute('src')){img.src=img.dataset.src;}
    img.classList.toggle('on',i===index);img.alt=window.PROJECTS[i][lang].t;
    img.style.transform=reduced.matches?'none':`scale(${1.015+Math.max(0,Math.min(1,p*(n-1)-index+.5))*.035})`;
  });
  document.querySelectorAll('.scene-card').forEach((card,i)=>{const on=i===index;card.classList.toggle('on',on);card.inert=!on;card.setAttribute('aria-hidden',String(!on));});
  document.querySelectorAll('[data-project-go]').forEach((button,i)=>{button.setAttribute('aria-pressed',String(i===index));button.setAttribute('aria-label',String(i+1).padStart(2,'0')+' — '+window.PROJECTS[i][lang].t);});
  document.querySelector('#hudIdx').textContent=String(index+1).padStart(2,'0');flight.active=index;
}
Object.assign(window,{initFlight,updateFlight});initFlight();
