/**
 * ZENMIX 3D Visualizer — VertexWizard 💎
 * Mandala icosaédrica reactiva a audio binaural con Three.js
 * 
 * Frecuencias:
 *   delta  (0.5–4 Hz)   → azul profundo
 *   theta  (4–8 Hz)     → púrpura
 *   alpha  (8–14 Hz)    → dorado
 *   gamma  (30–100 Hz)  → blanco brillante
 */

(function () {
  'use strict';

  // ─── Paletas de color por frecuencia ───────────────────────────────
  const PALETTES = {
    delta: {
      primary: 0x1a3a5c,
      wireframe: 0x3a7bd5,
      points: 0x5b9ef5,
      particles: [0x2a5a9c, 0x1e90ff, 0x00bfff],
      ambient: 0x0a1a3c,
      light: 0x4488cc,
      bg: 0x020812
    },
    theta: {
      primary: 0x2d1b4e,
      wireframe: 0x9b59b6,
      points: 0xc39bdb,
      particles: [0x6c3483, 0xa569bd, 0xd7bde2],
      ambient: 0x140a26,
      light: 0x8e44ad,
      bg: 0x080412
    },
    alpha: {
      primary: 0x3d2e00,
      wireframe: 0xf1c40f,
      points: 0xf9e076,
      particles: [0xd4ac0d, 0xf5b041, 0xffd700],
      ambient: 0x1a1200,
      light: 0xd4a017,
      bg: 0x0a0800
    },
    gamma: {
      primary: 0x2c2c2c,
      wireframe: 0xf0f0f0,
      points: 0xffffff,
      particles: [0xcccccc, 0xe8e8e8, 0xffffff],
      ambient: 0x181818,
      light: 0xe0e0e0,
      bg: 0x080808
    }
  };

  // ─── Estado ─────────────────────────────────────────────────────────
  let currentPalette = PALETTES.alpha;
  let targetPalette = PALETTES.alpha;
  let paletteTransition = 1.0; // 0 = old, 1 = new
  const PALETTE_TRANSITION_SPEED = 0.02;

  let audioCtx = null;
  let analyser = null;
  let frequencyData = null;
  let audioSource = null;
  let audioInitialized = false;

  // ─── Three.js core ─────────────────────────────────────────────────
  let scene, camera, renderer;
  let mandalaGroup, wireframeIco, pointsIco, innerGlow;
  let particleSystems = [];
  let pointLight, ambientLight;
  let clock;

  // ─── Animation params ──────────────────────────────────────────────
  let baseRotationSpeed = 0.003;
  let currentRotationSpeed = 0.003;
  let targetRotationSpeed = 0.003;

  // ─── DOM ref ───────────────────────────────────────────────────────
  let container = null;

  // ─── Lerp helpers ──────────────────────────────────────────────────
  function lerp(a, b, t) { return a + (b - a) * t; }
  function lerpColor(a, b, t) {
    const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
    const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
    const rr = Math.round(lerp(ar, br, t));
    const rg = Math.round(lerp(ag, bg, t));
    const rb = Math.round(lerp(ab, bb, t));
    return (rr << 16) | (rg << 8) | rb;
  }

  // ─── INIT ──────────────────────────────────────────────────────────
  function init(containerElement) {
    container = containerElement || document.getElementById('zenmix-visualizer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'zenmix-visualizer';
      container.style.cssText = 'position:fixed;inset:0;z-index:0;';
      document.body.prepend(container);
    }

    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(PALETTES.alpha.bg);
    scene.fog = new THREE.FogExp2(PALETTES.alpha.bg, 0.00015);

    // Camera
    camera = new THREE.PerspectiveCamera(
      55,
      container.clientWidth / container.clientHeight,
      0.1,
      100
    );
    camera.position.set(0, 0.8, 7);
    camera.lookAt(0, 0, 0);

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);

    // Clock
    clock = new THREE.Clock();

    // ── Lighting ───────────────────────────────────────────────────
    ambientLight = new THREE.AmbientLight(PALETTES.alpha.ambient, 1.8);
    scene.add(ambientLight);

    pointLight = new THREE.PointLight(PALETTES.alpha.light, 3.5, 12, 1.5);
    pointLight.position.set(0, 0, 0);
    pointLight.castShadow = true;
    pointLight.shadow.mapSize.set(512, 512);
    pointLight.shadow.camera.near = 0.5;
    pointLight.shadow.camera.far = 30;
    scene.add(pointLight);

    // Secondary rim light
    const rimLight = new THREE.PointLight(PALETTES.alpha.wireframe, 1.5, 8, 2);
    rimLight.position.set(3, 2, -3);
    scene.add(rimLight);

    // ── Mandala Group ──────────────────────────────────────────────
    mandalaGroup = new THREE.Group();
    scene.add(mandalaGroup);

    // ── Icosahedron Geometry ──────────────────────────────────────
    const icoGeom = new THREE.IcosahedronGeometry(1.6, 3);

    // Wireframe
    const wireframeMat = new THREE.MeshBasicMaterial({
      color: PALETTES.alpha.wireframe,
      wireframe: true,
      transparent: true,
      opacity: 0.55,
      depthWrite: false
    });
    wireframeIco = new THREE.Mesh(icoGeom, wireframeMat);
    mandalaGroup.add(wireframeIco);

    // Solid inner core (subtle)
    const innerGeom = new THREE.IcosahedronGeometry(1.0, 2);
    const innerMat = new THREE.MeshStandardMaterial({
      color: PALETTES.alpha.primary,
      roughness: 0.6,
      metalness: 0.2,
      transparent: true,
      opacity: 0.35,
      depthWrite: false
    });
    innerGlow = new THREE.Mesh(innerGeom, innerMat);
    mandalaGroup.add(innerGlow);

    // Vertex points (brillantes)
    const pointsGeom = new THREE.IcosahedronGeometry(1.64, 3);
    const pointsMat = new THREE.PointsMaterial({
      color: PALETTES.alpha.points,
      size: 0.06,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      opacity: 0.9
    });
    pointsIco = new THREE.Points(pointsGeom, pointsMat);
    mandalaGroup.add(pointsIco);

    // ── Orbiting Particles ────────────────────────────────────────
    createOrbitingParticles(3);

    // ── Outer Ring ────────────────────────────────────────────────
    createOuterRing();

    // ── Events ────────────────────────────────────────────────────
    window.addEventListener('resize', onResize);
    window.addEventListener('zenmix:frequency', onFrequencyChange);
    window.addEventListener('zenmix:audioStream', onAudioStream);

    // ── Start Loop ────────────────────────────────────────────────
    animate();

    console.log('💎 ZENMIX Visualizer initialized — VertexWizard ready');
  }

  // ─── Orbiting Particles ────────────────────────────────────────────
  function createOrbitingParticles(count) {
    particleSystems.forEach(sys => scene.remove(sys));
    particleSystems = [];

    for (let i = 0; i < count; i++) {
      const particleCount = 200 + i * 60;
      const geom = new THREE.BufferGeometry();
      const positions = new Float32Array(particleCount * 3);
      const colors = new Float32Array(particleCount * 3);
      const sizes = new Float32Array(particleCount);

      const radius = 2.2 + i * 0.6;
      const tilt = (i - 1) * 0.5;

      for (let j = 0; j < particleCount; j++) {
        // Spherical distribution with variable radius
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const r = radius + (Math.random() - 0.5) * 0.6;

        positions[j * 3] = r * Math.sin(phi) * Math.cos(theta);
        positions[j * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * Math.cos(tilt);
        positions[j * 3 + 2] = r * Math.cos(phi);

        // Random color from palette
        const colorIdx = Math.floor(Math.random() * PALETTES.alpha.particles.length);
        const c = new THREE.Color(PALETTES.alpha.particles[colorIdx]);
        colors[j * 3] = c.r;
        colors[j * 3 + 1] = c.g;
        colors[j * 3 + 2] = c.b;

        sizes[j] = Math.random() * 3.5 + 1.0;
      }

      geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      geom.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

      // Use a circular sprite texture
      const canvas = document.createElement('canvas');
      canvas.width = 32;
      canvas.height = 32;
      const ctx = canvas.getContext('2d');
      const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
      gradient.addColorStop(0, 'rgba(255,255,255,1)');
      gradient.addColorStop(0.2, 'rgba(255,255,255,0.8)');
      gradient.addColorStop(0.5, 'rgba(255,255,255,0.3)');
      gradient.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 32, 32);
      const spriteTexture = new THREE.CanvasTexture(canvas);

      const mat = new THREE.PointsMaterial({
        size: 0.08,
        map: spriteTexture,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
        opacity: 0.7,
        vertexColors: true,
        sizeAttenuation: true
      });

      const points = new THREE.Points(geom, mat);
      points.userData = {
        baseRadius: radius,
        tilt: tilt,
        speed: 0.15 + i * 0.08 + Math.random() * 0.1,
        offset: Math.random() * Math.PI * 2
      };
      scene.add(points);
      particleSystems.push(points);
    }
  }

  // ─── Outer Ring ────────────────────────────────────────────────────
  function createOuterRing() {
    const ringGeom = new THREE.TorusGeometry(2.8, 0.02, 16, 180);
    const ringMat = new THREE.MeshBasicMaterial({
      color: PALETTES.alpha.wireframe,
      transparent: true,
      opacity: 0.4,
      depthWrite: false
    });
    const ring = new THREE.Mesh(ringGeom, ringMat);
    ring.rotation.x = Math.PI / 2.3;
    ring.userData.isRing = true;
    scene.add(ring);

    // Second ring
    const ring2Geom = new THREE.TorusGeometry(3.0, 0.015, 16, 200);
    const ring2Mat = new THREE.MeshBasicMaterial({
      color: PALETTES.alpha.points,
      transparent: true,
      opacity: 0.3,
      depthWrite: false
    });
    const ring2 = new THREE.Mesh(ring2Geom, ring2Mat);
    ring2.rotation.x = -Math.PI / 3;
    ring2.rotation.y = Math.PI / 4;
    ring2.userData.isRing = true;
    scene.add(ring2);
  }

  // ─── Animation Loop ────────────────────────────────────────────────
  function animate() {
    requestAnimationFrame(animate);

    const dt = Math.min(clock.getDelta(), 0.1);
    const elapsed = clock.elapsedTime;

    // ── Palette Transition ───────────────────────────────────────
    if (paletteTransition < 1.0) {
      paletteTransition = Math.min(1.0, paletteTransition + PALETTE_TRANSITION_SPEED);
      applyPaletteBlend(currentPalette, targetPalette, paletteTransition);
    }

    // ── Audio Reactivity ─────────────────────────────────────────
    let audioEnergy = 0;
    let lowFreqEnergy = 0;
    let midFreqEnergy = 0;
    let highFreqEnergy = 0;

    if (analyser && frequencyData) {
      analyser.getByteFrequencyData(frequencyData);

      // Low: 0–200 Hz (bins 0–10 aprox for 2048 FFT)
      for (let i = 0; i < 10; i++) lowFreqEnergy += frequencyData[i] / 255;
      lowFreqEnergy /= 10;

      // Mid: 200–2000 Hz
      for (let i = 10; i < 100; i++) midFreqEnergy += frequencyData[i] / 255;
      midFreqEnergy /= 90;

      // High: 2000 Hz+
      for (let i = 100; i < frequencyData.length; i++) highFreqEnergy += frequencyData[i] / 255;
      highFreqEnergy /= (frequencyData.length - 100);

      audioEnergy = (lowFreqEnergy * 0.5 + midFreqEnergy * 0.3 + highFreqEnergy * 0.2);
    }

    // ── Rotation (audio-reactive) ────────────────────────────────
    const audioBoost = 1.0 + audioEnergy * 1.8;
    const targetSpeed = baseRotationSpeed * audioBoost;
    currentRotationSpeed = lerp(currentRotationSpeed, targetSpeed, 0.05);

    mandalaGroup.rotation.y += currentRotationSpeed;
    mandalaGroup.rotation.x += currentRotationSpeed * 0.4;
    mandalaGroup.rotation.z += currentRotationSpeed * 0.15;

    // ── Audio-reactive scale ─────────────────────────────────────
    const scaleTarget = 1.0 + lowFreqEnergy * 0.15;
    mandalaGroup.scale.lerp(
      new THREE.Vector3(scaleTarget, scaleTarget, scaleTarget),
      0.08
    );

    // ── Wireframe opacity pulse ──────────────────────────────────
    if (wireframeIco && wireframeIco.material) {
      const targetOpacity = 0.45 + midFreqEnergy * 0.35;
      wireframeIco.material.opacity = lerp(
        wireframeIco.material.opacity,
        targetOpacity,
        0.1
      );
    }

    // ── Points size pulse ────────────────────────────────────────
    if (pointsIco && pointsIco.material) {
      const targetSize = 0.05 + highFreqEnergy * 0.06;
      pointsIco.material.size = lerp(pointsIco.material.size, targetSize, 0.1);
    }

    // ── Point light intensity ────────────────────────────────────
    if (pointLight) {
      const targetIntensity = 3.0 + lowFreqEnergy * 3.0;
      pointLight.intensity = lerp(pointLight.intensity, targetIntensity, 0.08);
    }

    // ── Orbiting particles ───────────────────────────────────────
    particleSystems.forEach((sys, idx) => {
      if (!sys.userData) return;
      const { baseRadius, tilt, speed, offset } = sys.userData;
      const angle = elapsed * speed + offset;

      // Orbit around mandala
      const r = baseRadius + audioEnergy * 0.3;
      sys.position.x = Math.cos(angle) * r;
      sys.position.y = Math.sin(angle * 0.7) * r * 0.5;
      sys.position.z = Math.sin(angle) * r;

      // Subtle rotation
      sys.rotation.y += speed * 0.3 * dt;
      sys.rotation.x += speed * 0.15 * dt;

      // Opacity pulse
      sys.material.opacity = 0.5 + audioEnergy * 0.4;
    });

    // ── Animate rings ────────────────────────────────────────────
    scene.children.forEach(child => {
      if (child.userData && child.userData.isRing) {
        child.rotation.z += currentRotationSpeed * 0.6;
        child.rotation.y += currentRotationSpeed * 0.25;
      }
    });

    // ── Camera subtle orbit ──────────────────────────────────────
    const camAngle = elapsed * 0.12;
    const camRadius = 7.0 + Math.sin(elapsed * 0.3) * 0.5;
    const camY = 0.8 + Math.sin(elapsed * 0.25) * 0.6;
    camera.position.x = Math.sin(camAngle) * camRadius;
    camera.position.y = camY;
    camera.position.z = Math.cos(camAngle) * camRadius;
    camera.lookAt(0, 0, 0);

    // ── Inner glow pulse ─────────────────────────────────────────
    if (innerGlow) {
      innerGlow.rotation.y += currentRotationSpeed * 0.5;
      innerGlow.rotation.x += currentRotationSpeed * 0.2;
      const innerScale = 1.0 + highFreqEnergy * 0.08;
      innerGlow.scale.lerp(
        new THREE.Vector3(innerScale, innerScale, innerScale),
        0.05
      );
    }

    // ── Render ───────────────────────────────────────────────────
    renderer.render(scene, camera);
  }

  // ─── Palette Blending ──────────────────────────────────────────────
  function applyPaletteBlend(from, to, t) {
    if (t >= 1.0) {
      currentPalette = to;
      paletteTransition = 1.0;
      t = 1.0;
    }

    // Scene background
    const bgColor = new THREE.Color(lerpColor(from.bg, to.bg, t));
    scene.background = bgColor;
    if (scene.fog) {
      scene.fog.color = bgColor;
    }

    // Wireframe
    if (wireframeIco && wireframeIco.material) {
      wireframeIco.material.color.set(lerpColor(from.wireframe, to.wireframe, t));
    }

    // Points
    if (pointsIco && pointsIco.material) {
      pointsIco.material.color.set(lerpColor(from.points, to.points, t));
    }

    // Inner glow
    if (innerGlow && innerGlow.material) {
      innerGlow.material.color.set(lerpColor(from.primary, to.primary, t));
    }

    // Lights
    if (ambientLight) {
      ambientLight.color.set(lerpColor(from.ambient, to.ambient, t));
    }
    if (pointLight) {
      pointLight.color.set(lerpColor(from.light, to.light, t));
    }

    // Particles
    const blendedParticles = to.particles.map((toCol, i) => {
      const fromCol = from.particles[i % from.particles.length];
      return lerpColor(fromCol, toCol, t);
    });
    particleSystems.forEach(sys => {
      if (sys.geometry && sys.geometry.attributes.color) {
        const colors = sys.geometry.attributes.color.array;
        for (let i = 0; i < colors.length; i += 3) {
          const idx = Math.floor(Math.random() * blendedParticles.length);
          const c = new THREE.Color(blendedParticles[idx]);
          colors[i] = c.r;
          colors[i + 1] = c.g;
          colors[i + 2] = c.b;
        }
        sys.geometry.attributes.color.needsUpdate = true;
      }
    });

    // Rings
    scene.children.forEach(child => {
      if (child.userData && child.userData.isRing && child.material) {
        child.material.color.set(lerpColor(from.wireframe, to.wireframe, t));
      }
    });
  }

  // ─── Frequency Change Handler ──────────────────────────────────────
  function onFrequencyChange(e) {
    const freq = e.detail && e.detail.frequency ? e.detail.frequency.toLowerCase() : 'alpha';
    let palette;

    switch (freq) {
      case 'delta':  palette = PALETTES.delta;  break;
      case 'theta':  palette = PALETTES.theta;  break;
      case 'alpha':  palette = PALETTES.alpha;  break;
      case 'gamma':  palette = PALETTES.gamma;  break;
      default:       palette = PALETTES.alpha;  break;
    }

    if (targetPalette !== palette) {
      currentPalette = targetPalette;
      targetPalette = palette;
      paletteTransition = 0.0;

      // Adjust rotation speed per frequency
      switch (freq) {
        case 'delta':  baseRotationSpeed = 0.0015; break;
        case 'theta':  baseRotationSpeed = 0.0025; break;
        case 'alpha':  baseRotationSpeed = 0.0030; break;
        case 'gamma':  baseRotationSpeed = 0.0050; break;
        default:       baseRotationSpeed = 0.0030; break;
      }
    }
  }

  // ─── Audio Stream Handler ──────────────────────────────────────────
  function onAudioStream(e) {
    const stream = e.detail && e.detail.stream;
    if (!stream || audioInitialized) return;

    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.8;
      frequencyData = new Uint8Array(analyser.frequencyBinCount);

      audioSource = audioCtx.createMediaStreamSource(stream);
      audioSource.connect(analyser);
      // Don't connect to destination to avoid feedback

      audioInitialized = true;
      console.log('🎵 ZENMIX Audio analyzer connected');
    } catch (err) {
      console.warn('⚠️ ZENMIX Audio init failed:', err);
    }
  }

  // ─── Public API: connect audio directly ────────────────────────────
  function connectAudio(streamOrElement) {
    if (audioInitialized) return;

    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.8;
      frequencyData = new Uint8Array(analyser.frequencyBinCount);

      if (streamOrElement instanceof MediaStream) {
        audioSource = audioCtx.createMediaStreamSource(streamOrElement);
      } else if (streamOrElement instanceof HTMLMediaElement) {
        audioSource = audioCtx.createMediaElementSource(streamOrElement);
        // Media element sources must connect to destination
        audioSource.connect(audioCtx.destination);
      }

      audioSource.connect(analyser);
      audioInitialized = true;
      console.log('🎵 ZENMIX Audio connected directly');
    } catch (err) {
      console.warn('⚠️ ZENMIX Audio connect failed:', err);
    }
  }

  // ─── Public API: set frequency ─────────────────────────────────────
  function setFrequency(freq) {
    onFrequencyChange({ detail: { frequency: freq } });
  }

  // ─── Resize Handler ────────────────────────────────────────────────
  function onResize() {
    if (!container || !camera || !renderer) return;
    const w = container.clientWidth;
    const h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }

  // ─── Public resize ─────────────────────────────────────────────────
  function resize() {
    onResize();
  }

  // ─── Dispose / Cleanup ─────────────────────────────────────────────
  function dispose() {
    window.removeEventListener('resize', onResize);
    window.removeEventListener('zenmix:frequency', onFrequencyChange);
    window.removeEventListener('zenmix:audioStream', onAudioStream);

    if (audioCtx && audioCtx.state !== 'closed') {
      audioCtx.close().catch(() => {});
    }
    audioInitialized = false;

    if (renderer) {
      renderer.dispose();
      if (container && renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    }

    // Dispose geometries and materials
    scene.traverse(obj => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) {
          obj.material.forEach(m => {
            if (m.map) m.map.dispose();
            m.dispose();
          });
        } else {
          if (obj.material.map) obj.material.map.dispose();
          obj.material.dispose();
        }
      }
    });

    console.log('💎 ZENMIX Visualizer disposed');
  }

  // ─── Export ────────────────────────────────────────────────────────
  const ZENMIX = {
    init,
    connectAudio,
    setFrequency,
    resize,
    dispose,
    get isInitialized() { return !!scene; },
    get currentPalette() { return targetPalette; }
  };

  // Attach to window
  window.ZENMIX = ZENMIX;

  // Auto-init if script is loaded with data-auto-init attribute
  if (document.currentScript && document.currentScript.dataset.autoInit !== undefined) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => ZENMIX.init());
    } else {
      ZENMIX.init();
    }
  }

  console.log('💎 VertexWizard — ZENMIX 3D Visualizer loaded');
  console.log('   Usage: ZENMIX.init(container?) | ZENMIX.setFrequency("alpha") | ZENMIX.connectAudio(stream)');
})();
