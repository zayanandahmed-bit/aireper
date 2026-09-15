// ---------- shared: batch a high-frequency handler to one call per frame ----------
// mousemove/scroll can fire far more than 60 times a second. Writing to
// style/layout straight from the raw event — like every handler below
// used to — forces the browser to redo work faster than it can actually
// paint, which is what reads as "not smooth" even though each individual
// change is small. Collapsing to one call per animation frame fixes that
// without changing what anything looks like.
function rafThrottle(fn) {
  var scheduled = false, lastArgs;
  return function () {
    lastArgs = arguments;
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(function () {
      scheduled = false;
      fn.apply(null, lastArgs);
    });
  };
}

// ---------- Three.js interactive AI-network background ----------
const canvas = document.getElementById('bg-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 0, 9);

// Node network (agents connected by data links)
const NODE_COUNT = 90;
const RADIUS = 5.2;
const nodePositions = [];
const nodesGeom = new THREE.BufferGeometry();
const posArray = new Float32Array(NODE_COUNT * 3);

for (let i = 0; i < NODE_COUNT; i++) {
  // distribute on a sphere-ish cloud
  const phi = Math.acos(-1 + (2 * i) / NODE_COUNT);
  const theta = Math.sqrt(NODE_COUNT * Math.PI) * phi;
  const r = RADIUS * (0.6 + Math.random() * 0.4);
  const x = r * Math.cos(theta) * Math.sin(phi);
  const y = r * Math.sin(theta) * Math.sin(phi);
  const z = r * Math.cos(phi);
  posArray[i * 3] = x;
  posArray[i * 3 + 1] = y;
  posArray[i * 3 + 2] = z;
  nodePositions.push(new THREE.Vector3(x, y, z));
}
nodesGeom.setAttribute('position', new THREE.BufferAttribute(posArray, 3));

const nodeMaterial = new THREE.PointsMaterial({
  color: 0x6c3cff,
  size: 0.065,
  transparent: true,
  opacity: 0.9,
  sizeAttenuation: true,
});
const nodePoints = new THREE.Points(nodesGeom, nodeMaterial);
scene.add(nodePoints);

// connections between nearby nodes
const linePositions = [];
const LINK_DIST = 1.9;
for (let i = 0; i < nodePositions.length; i++) {
  for (let j = i + 1; j < nodePositions.length; j++) {
    if (nodePositions[i].distanceTo(nodePositions[j]) < LINK_DIST) {
      linePositions.push(nodePositions[i].x, nodePositions[i].y, nodePositions[i].z);
      linePositions.push(nodePositions[j].x, nodePositions[j].y, nodePositions[j].z);
    }
  }
}
const lineGeom = new THREE.BufferGeometry();
lineGeom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(linePositions), 3));
const lineMaterial = new THREE.LineBasicMaterial({ color: 0xb9a6ff, transparent: true, opacity: 0.45 });
const lineSegments = new THREE.LineSegments(lineGeom, lineMaterial);
scene.add(lineSegments);

// ambient floating particles (depth dust)
const DUST_COUNT = 300;
const dustGeom = new THREE.BufferGeometry();
const dustPos = new Float32Array(DUST_COUNT * 3);
for (let i = 0; i < DUST_COUNT * 3; i++) dustPos[i] = (Math.random() - 0.5) * 30;
dustGeom.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
const dustMaterial = new THREE.PointsMaterial({ color: 0xff3d8a, size: 0.025, transparent: true, opacity: 0.45 });
const dust = new THREE.Points(dustGeom, dustMaterial);
scene.add(dust);

const group = new THREE.Group();
group.add(nodePoints, lineSegments);
scene.add(group);

// ---------- interaction: mouse parallax + drag rotate ----------
let targetRotX = 0, targetRotY = 0;
let currentRotX = 0, currentRotY = 0;
let isDragging = false;
let prevPointer = { x: 0, y: 0 };
let dragVelocity = { x: 0, y: 0 };

function pointerToTarget(x, y) {
  const nx = (x / window.innerWidth) * 2 - 1;
  const ny = (y / window.innerHeight) * 2 - 1;
  targetRotY = nx * 0.5;
  targetRotX = ny * 0.3;
}

window.addEventListener('mousemove', (e) => {
  if (!isDragging) pointerToTarget(e.clientX, e.clientY);
});

window.addEventListener('pointerdown', (e) => {
  isDragging = true;
  prevPointer = { x: e.clientX, y: e.clientY };
});
window.addEventListener('pointerup', () => { isDragging = false; });
window.addEventListener('pointerleave', () => { isDragging = false; });
window.addEventListener('pointermove', (e) => {
  if (isDragging) {
    const dx = e.clientX - prevPointer.x;
    const dy = e.clientY - prevPointer.y;
    dragVelocity.x = dx * 0.003;
    dragVelocity.y = dy * 0.003;
    targetRotY += dragVelocity.x;
    targetRotX += dragVelocity.y;
    prevPointer = { x: e.clientX, y: e.clientY };
  }
});

// touch support
window.addEventListener('touchstart', (e) => {
  isDragging = true;
  prevPointer = { x: e.touches[0].clientX, y: e.touches[0].clientY };
}, { passive: true });
window.addEventListener('touchmove', (e) => {
  const dx = e.touches[0].clientX - prevPointer.x;
  const dy = e.touches[0].clientY - prevPointer.y;
  targetRotY += dx * 0.003;
  targetRotX += dy * 0.003;
  prevPointer = { x: e.touches[0].clientX, y: e.touches[0].clientY };
}, { passive: true });
window.addEventListener('touchend', () => { isDragging = false; });

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------- scroll-driven camera dolly ----------
let scrollY = 0;
window.addEventListener('scroll', () => { scrollY = window.scrollY; });

const clock = new THREE.Clock();

// A backgrounded tab has no business spending GPU/CPU time drawing a
// scene nobody can see — competes with whatever the user switched to.
let animating = true;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { animating = false; return; }
  if (!animating) { animating = true; animate(); }
});

function animate() {
  if (!animating) return;
  requestAnimationFrame(animate);
  const t = clock.getElapsedTime();

  currentRotX += (targetRotX - currentRotX) * 0.05;
  currentRotY += (targetRotY - currentRotY) * 0.05;

  group.rotation.x = currentRotX + Math.sin(t * 0.05) * 0.05;
  group.rotation.y = currentRotY + t * 0.065;
  // A slow overall breathing scale reads as depth (things nearer the
  // camera, then receding) even when nothing else about the scene changes.
  const breathe = 1 + Math.sin(t * 0.35) * 0.035;
  group.scale.setScalar(breathe);

  dust.rotation.y = t * 0.016;
  dust.rotation.x = t * 0.008;

  // subtle pulsing node size
  nodeMaterial.size = 0.065 + Math.sin(t * 2) * 0.008;

  // scroll parallax on camera
  camera.position.z = 9 + Math.min(scrollY * 0.0025, 3);
  camera.position.y = -Math.min(scrollY * 0.0008, 1.2);

  renderer.render(scene, camera);
}
animate();

// ---------- hero parallax depth ----------
// The WebGL network already tilts with the mouse; the hero text didn't
// move at all, which made it feel pasted on top of a 3D scene rather
// than part of it. A few degrees of counter-tilt on the text (opposite
// direction from the background) sells the depth without being gimmicky.
const heroContent = document.querySelector('.hero-content');
if (heroContent) {
  heroContent.style.transition = 'transform 0.3s ease-out';
  heroContent.style.transformStyle = 'preserve-3d';
  window.addEventListener('mousemove', rafThrottle((e) => {
    const nx = (e.clientX / window.innerWidth) - 0.5;
    const ny = (e.clientY / window.innerHeight) - 0.5;
    heroContent.style.transform = `perspective(1200px) rotateY(${nx * 4}deg) rotateX(${ny * -4}deg) translateZ(0)`;
  }));
}

// ---------- 3D tilt + lift on cards ----------
// translateZ alone barely reads as movement on a flat page — scaling the
// card up a touch and pairing it with the CSS hover glow is what actually
// makes hovering feel like something happened. Applied to every card-like
// block site-wide, not just the ones already marked data-tilt, so the
// effect reads as one consistent system rather than something only a few
// sections happen to have.
document.querySelectorAll('[data-tilt], .review-card, .detail-row, .info-tile').forEach((card) => {
  card.style.transition = 'transform 0.35s cubic-bezier(.2,.8,.2,1)';
  card.addEventListener('mouseenter', () => { card.style.transition = 'transform 0.15s ease-out'; });
  card.addEventListener('mousemove', rafThrottle((e) => {
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const rotY = ((x / rect.width) - 0.5) * 10;
    const rotX = ((y / rect.height) - 0.5) * -10;
    card.style.transform = `perspective(700px) rotateX(${rotX}deg) rotateY(${rotY}deg) translateY(-8px) scale(1.03)`;
  }));
  card.addEventListener('mouseleave', () => {
    card.style.transition = 'transform 0.35s cubic-bezier(.2,.8,.2,1)';
    card.style.transform = 'perspective(700px) rotateX(0) rotateY(0) translateY(0) scale(1)';
  });
});

// ---------- mobile nav toggle ----------
const navToggle = document.getElementById('navToggle');
const navLinks = document.querySelector('.nav-links');
if (navToggle) {
  // The open/closed look now lives entirely in CSS (.nav-links / .nav-
  // links.open), so it can transition smoothly — this just flips the class.
  navToggle.addEventListener('click', () => navLinks.classList.toggle('open'));
  navLinks.querySelectorAll('a').forEach((a) =>
    a.addEventListener('click', () => navLinks.classList.remove('open'))
  );
}

// ---------- vertical timeline: step activation + line fill ----------
// Separate from the generic reveal system below — a timeline step needs
// its own "in-view" state (dot lights up, desc/title slide in from
// opposite sides) rather than a single opacity/transform pair, and the
// connecting line needs to visually fill in as you scroll past it.
const timeline = document.querySelector('.timeline');
if (timeline) {
  const tlSteps = timeline.querySelectorAll('.timeline-step');
  // threshold: 0.4 meant "40% of the step's own area is on screen" — for a
  // step this tall, that happens while it's still well below center, so
  // the words arrived before you'd actually scrolled to them. Shrinking
  // the observer's root to a thin band around the vertical middle of the
  // screen (via rootMargin) means it only fires once the step is
  // genuinely there to be read, not just entering from below.
  const tlObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        tlObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0, rootMargin: '-45% 0px -45% 0px' });
  tlSteps.forEach((step) => tlObserver.observe(step));

  const timelineProgress = document.getElementById('timelineProgress');
  function updateTimelineProgress() {
    const rect = timeline.getBoundingClientRect();
    const viewportMid = window.innerHeight * 0.55;
    const pct = (viewportMid - rect.top) / rect.height;
    timelineProgress.style.height = Math.max(0, Math.min(1, pct)) * 100 + '%';
  }
  window.addEventListener('scroll', rafThrottle(updateTimelineProgress), { passive: true });
  window.addEventListener('resize', updateTimelineProgress);
  window.addEventListener('load', updateTimelineProgress);
  updateTimelineProgress();
}

// ---------- scroll-reveal for sections ----------
// Entrance has real depth (rotateX + translateY, not just a fade) so
// content settles into place instead of just appearing.
const revealEls = document.querySelectorAll('.card, .step, .section-head, .review-card, .detail-row, .info-tile, .faq-item');
revealEls.forEach((el) => {
  el.style.opacity = 0;
  el.style.transform = 'perspective(900px) rotateX(-8deg) translateY(28px)';
  el.style.transition = 'opacity 0.8s cubic-bezier(.16,1,.3,1), transform 0.8s cubic-bezier(.16,1,.3,1)';
});

function reveal(el) {
  el.style.opacity = 1;
  el.style.transform = 'perspective(900px) rotateX(0) translateY(0)';
  // The 0.8s entrance transition would otherwise sit on the element
  // forever as an inline style, making every hover after it feels
  // sluggish (it fights the much snappier hover transition set below).
  // Once the entrance finishes, hand control back to that.
  el.addEventListener('transitionend', function clearInline(ev) {
    if (ev.propertyName !== 'transform') return;
    el.style.transition = '';
    el.removeEventListener('transitionend', clearInline);
  });
}

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      reveal(entry.target);
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.05, rootMargin: '0px 0px 80px 0px' });

revealEls.forEach((el) => observer.observe(el));

// fallback: reveal anything already visible on load, in case the observer's
// first check ran before layout had settled. This used to also run on
// every single scroll event — scanning and measuring every reveal target
// on the page dozens of times a second — which was the actual cause of
// the site feeling un-smooth: real work, just done far more often than it
// needed to be. The IntersectionObserver above already re-checks visibility
// natively and efficiently as you scroll, so scroll doesn't need to do it
// again here.
function revealVisible() {
  revealEls.forEach((el) => {
    if (el.style.opacity !== '1' && el.getBoundingClientRect().top < window.innerHeight + 100) reveal(el);
  });
}
window.addEventListener('load', revealVisible);
