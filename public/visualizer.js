// ZENMIX — Visualizer module for Three.js integration
// Dependencies: THREE (loaded via CDN)
window.ZENMIX = (() => {
  let scene, camera, renderer, mesh, particles = [], analyser, dataArray;
  let container, animId, activeFreq = 'alpha', disposed = false;
  let rotSpeed = 0.005, scaleTarget = 1;

  const palettes = {
    delta: { main: 0x1e3a5f, glow: 0x3b5998, accent: 0x5b7fc0, speed: 0.002 },
    theta: { main: 0x4a1d6b, glow: 0x7b3fa3, accent: 0xa855f7, speed: 0.004 },
    alpha: { main: 0x8b6914, glow: 0xc4a035, accent: 0xf5d060, speed: 0.005 },
    sigma: { main: 0x1d5b3a, glow: 0x3a8b5c, accent: 0x5de890, speed: 0.006 },
    gamma: { main: 0x5c5c5c, glow: 0xaaaaaa, accent: 0xf0f0f0, speed: 0.008 },
    beta: { main: 0x5c1a1a, glow: 0xcc3333, accent: 0xff5555, speed: 0.006 }
  };

  function init(container) {
    if (disposed || scene) return;
    container = container || document.getElementById('zenViz') || document.body;

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.z = 5;

    renderer = new THREE.WebGLRenderer({ canvas: container, alpha: true, antialias: false });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Main mandala - icosahedron
    let geo = new THREE.IcosahedronGeometry(1.2, 3);
    let mat = new THREE.MeshBasicMaterial({
      color: palettes[activeFreq].main,
      wireframe: true,
      transparent: true,
      opacity: 0.25
    });
    mesh = new THREE.Mesh(geo, mat);
    scene.add(mesh);

    // Inner glow sphere
    let glowGeo = new THREE.IcosahedronGeometry(0.5, 2);
    let glowMat = new THREE.MeshBasicMaterial({
      color: palettes[activeFreq].glow,
      transparent: true,
      opacity: 0.12
    });
    let innerGlow = new THREE.Mesh(glowGeo, glowMat);
    mesh.add(innerGlow);

    // Vertex points
    let positions = mesh.geometry.attributes.position.array;
    for (let i = 0; i < positions.length; i += 3) {
      if (Math.random() > 0.2) continue;
      let ptGeo = new THREE.SphereGeometry(0.015, 4, 4);
      let ptMat = new THREE.MeshBasicMaterial({ color: palettes[activeFreq].accent, transparent: true, opacity: 0.7 });
      let pt = new THREE.Mesh(ptGeo, ptMat);
      pt.position.set(positions[i], positions[i + 1], positions[i + 2]);
      mesh.add(pt);
    }

    // Starfield
    let starsGeo = new THREE.BufferGeometry();
    let starCount = 300;
    let starVerts = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i += 3) {
      starVerts[i] = (Math.random() - 0.5) * 10;
      starVerts[i + 1] = (Math.random() - 0.5) * 10;
      starVerts[i + 2] = (Math.random() - 0.5) * 10;
    }
    starsGeo.setAttribute('position', new THREE.BufferAttribute(starVerts, 3));
    let starsMat = new THREE.PointsMaterial({ color: 0xaabbdd, size: 0.02, transparent: true, opacity: 0.5 });
    let stars = new THREE.Points(starsGeo, starsMat);
    scene.add(stars);

    // Orbit particles
    for (let j = 0; j < 3; j++) {
      let pCount = 60;
      let pGeo = new THREE.BufferGeometry();
      let pVerts = new Float32Array(pCount * 3);
      for (let i = 0; i < pCount; i++) {
        let angle = (i / pCount) * Math.PI * 2;
        let r = 1.6 + j * 0.4 + Math.random() * 0.1;
        pVerts[i * 3] = Math.cos(angle) * r;
        pVerts[i * 3 + 1] = Math.sin(angle) * r * (0.3 + j * 0.2);
        pVerts[i * 3 + 2] = Math.sin(angle) * r * (0.5 + j * 0.1);
      }
      pGeo.setAttribute('position', new THREE.BufferAttribute(pVerts, 3));
      let pMat = new THREE.PointsMaterial({
        color: palettes[activeFreq].accent,
        size: 0.03,
        transparent: true,
        opacity: 0.6 - j * 0.15,
        blending: THREE.AdditiveBlending
      });
      let pSys = new THREE.Points(pGeo, pMat);
      pSys.userData = { speed: 0.3 + j * 0.15, radius: 1.6 + j * 0.4 };
      scene.add(pSys);
      particles.push(pSys);
    }

    window.addEventListener('resize', resize);
    animate();
  }

  function setFrequency(freq) {
    if (!palettes[freq]) return;
    activeFreq = freq;
    rotSpeed = palettes[freq].speed;
    if (mesh) {
      mesh.material.color.set(palettes[freq].main);
      mesh.children.forEach((c, i) => {
        if (i === 0 && c.material) c.material.color.set(palettes[freq].glow);
      });
    }
    particles.forEach((p, i) => {
      if (p.material) p.material.color.set(palettes[freq].accent);
    });
  }

  function connectAudio(streamOrElement) {
    let ctx = new (window.AudioContext || window.webkitAudioContext)();
    let src;
    if (streamOrElement instanceof MediaStream) src = ctx.createMediaStreamSource(streamOrElement);
    else if (streamOrElement instanceof HTMLMediaElement || streamOrElement instanceof HTMLAudioElement) src = ctx.createMediaElementSource(streamOrElement);
    else return;

    analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    dataArray = new Uint8Array(analyser.frequencyBinCount);
    src.connect(analyser);
  }

  function animate() {
    if (disposed) return;
    animId = requestAnimationFrame(animate);

    // Audio reactivity
    if (analyser && dataArray) {
      analyser.getByteFrequencyData(dataArray);
      let low = dataArray.slice(0, 30).reduce((a, b) => a + b, 0) / 30 / 255;
      let mid = dataArray.slice(30, 120).reduce((a, b) => a + b, 0) / 90 / 255;
      let high = dataArray.slice(120).reduce((a, b) => a + b, 0) / 900 / 255;

      if (mesh) {
        scaleTarget = 1 + low * 0.15 + mid * 0.1;
        mesh.material.opacity = 0.2 + mid * 0.3;
      }
      rotSpeed = palettes[activeFreq].speed * (1 + low * 2 + mid * 0.5);
    }

    // Smooth scale
    if (mesh) {
      mesh.scale.lerp(
        new THREE.Vector3(scaleTarget, scaleTarget, scaleTarget),
        0.05
      );
      mesh.rotation.x += rotSpeed * 0.7;
      mesh.rotation.y += rotSpeed;
      mesh.rotation.z += rotSpeed * 0.3;
    }

    // Orbit particles
    let t = performance.now() * 0.001;
    particles.forEach(p => {
      p.rotation.y += p.userData.speed * 0.01;
      p.rotation.x += p.userData.speed * 0.005;
    });

    // Camera orbit
    camera.position.x = Math.sin(t * 0.15) * 0.5;
    camera.position.y = Math.cos(t * 0.15) * 0.25;
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
  }

  function resize() {
    if (!camera || !renderer) return;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  function dispose() {
    disposed = true;
    if (animId) cancelAnimationFrame(animId);
    if (renderer) { renderer.dispose(); renderer = null; }
    if (scene) { scene.clear(); scene = null; }
    mesh = null; particles = []; camera = null;
  }

  return { init, setFrequency, connectAudio, resize, dispose };
})();