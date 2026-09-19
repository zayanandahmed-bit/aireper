import { useEffect, useRef } from 'react';
import * as THREE from 'three';

// Interactive AI-network background: a rotating node cloud with data links,
// ambient depth dust, mouse parallax, drag-to-rotate, and a scroll-driven
// camera dolly. Everything it creates is torn down on unmount so a remount
// (React StrictMode in dev, or a future layout change) never leaks a second
// WebGL context or a second animation loop.
export default function Background() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      100
    );
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
    lineGeom.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(linePositions), 3)
    );
    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0xb9a6ff,
      transparent: true,
      opacity: 0.45,
    });
    const lineSegments = new THREE.LineSegments(lineGeom, lineMaterial);

    // ambient floating particles (depth dust)
    const DUST_COUNT = 300;
    const dustGeom = new THREE.BufferGeometry();
    const dustPos = new Float32Array(DUST_COUNT * 3);
    for (let i = 0; i < DUST_COUNT * 3; i++) dustPos[i] = (Math.random() - 0.5) * 30;
    dustGeom.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
    const dustMaterial = new THREE.PointsMaterial({
      color: 0xff3d8a,
      size: 0.025,
      transparent: true,
      opacity: 0.45,
    });
    const dust = new THREE.Points(dustGeom, dustMaterial);
    scene.add(dust);

    const group = new THREE.Group();
    group.add(nodePoints, lineSegments);
    scene.add(group);

    // ---------- interaction: mouse parallax + drag rotate ----------
    let targetRotX = 0;
    let targetRotY = 0;
    let currentRotX = 0;
    let currentRotY = 0;
    let isDragging = false;
    let prevPointer = { x: 0, y: 0 };

    const onMouseMove = (e) => {
      if (isDragging) return;
      const nx = (e.clientX / window.innerWidth) * 2 - 1;
      const ny = (e.clientY / window.innerHeight) * 2 - 1;
      targetRotY = nx * 0.5;
      targetRotX = ny * 0.3;
    };

    const onPointerDown = (e) => {
      isDragging = true;
      prevPointer = { x: e.clientX, y: e.clientY };
    };
    const endDrag = () => {
      isDragging = false;
    };
    const onPointerMove = (e) => {
      if (!isDragging) return;
      targetRotY += (e.clientX - prevPointer.x) * 0.003;
      targetRotX += (e.clientY - prevPointer.y) * 0.003;
      prevPointer = { x: e.clientX, y: e.clientY };
    };

    const onTouchStart = (e) => {
      isDragging = true;
      prevPointer = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    };
    const onTouchMove = (e) => {
      targetRotY += (e.touches[0].clientX - prevPointer.x) * 0.003;
      targetRotX += (e.touches[0].clientY - prevPointer.y) * 0.003;
      prevPointer = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    };

    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    let scrollY = 0;
    const onScroll = () => {
      scrollY = window.scrollY;
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointerleave', endDrag);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', endDrag);
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onScroll, { passive: true });

    const clock = new THREE.Clock();

    // A backgrounded tab has no business spending GPU/CPU time drawing a scene
    // nobody can see: it competes with whatever the user switched to.
    let animating = true;
    let disposed = false;
    let frameId = 0;

    function animate() {
      if (!animating || disposed) return;
      frameId = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();

      currentRotX += (targetRotX - currentRotX) * 0.05;
      currentRotY += (targetRotY - currentRotY) * 0.05;

      group.rotation.x = currentRotX + Math.sin(t * 0.05) * 0.05;
      group.rotation.y = currentRotY + t * 0.065;
      // A slow overall breathing scale reads as depth (things nearer the
      // camera, then receding) even when nothing else about the scene changes.
      group.scale.setScalar(1 + Math.sin(t * 0.35) * 0.035);

      dust.rotation.y = t * 0.016;
      dust.rotation.x = t * 0.008;

      // subtle pulsing node size
      nodeMaterial.size = 0.065 + Math.sin(t * 2) * 0.008;

      // scroll parallax on camera
      camera.position.z = 9 + Math.min(scrollY * 0.0025, 3);
      camera.position.y = -Math.min(scrollY * 0.0008, 1.2);

      renderer.render(scene, camera);
    }

    const onVisibility = () => {
      if (document.hidden) {
        animating = false;
        return;
      }
      if (!animating && !disposed) {
        animating = true;
        animate();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    animate();

    return () => {
      disposed = true;
      animating = false;
      cancelAnimationFrame(frameId);

      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerup', endDrag);
      window.removeEventListener('pointerleave', endDrag);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', endDrag);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('visibilitychange', onVisibility);

      nodesGeom.dispose();
      lineGeom.dispose();
      dustGeom.dispose();
      nodeMaterial.dispose();
      lineMaterial.dispose();
      dustMaterial.dispose();
      renderer.dispose();
    };
  }, []);

  return <canvas id="bg-canvas" ref={canvasRef} />;
}
