// ╔══════════════════════════════════════════════════════════╗
// ║  MANDALA3D — Zen Hypnotic 3D Visualizer               ║
// ║  VertexWizard 💎 — Three.js Sacred Geometry           ║
// ║  Audio-reactive + Manual Orbit + State Palettes       ║
// ╚══════════════════════════════════════════════════════════╝
// Dependencies: THREE (global, via CDN r128+)

window.MANDALA3D = (() => {
  // ─── STATE ───────────────────────────────────────────
  let scene, camera, renderer, container, canvas;
  let animId = null, disposed = false;
  let clock = new THREE.Clock();
  
  // Core objects
  let torusKnot, torusSolid, auraSpheres = [], orbitParticles = [];
  let lightRings = [], sacredGeo, starField;
  
  // Audio
  let analyser = null, dataArray = null, hasAudio = false;
  let audioSmooth = { low: 0, mid: 0, high: 0 };
  
  // Interaction
  let isDragging = false, prevMouse = { x: 0, y: 0 };
  let targetRot = { x: 0, y: 0 }, autoRot = { x: 0, y: 0.3 };
  let touchTimeout = null, autoRotate = true;
  let baseOpacity = 0.4;
  
  // State / palette
  let currentState = 'meditation';
  let paletteTarget = null, paletteCurrent = null;
  let transitionProgress = 1; // 1 = done

  // ─── PALETTES ────────────────────────────────────────
  const PALETTES = {
    relaxation: {
      bg:      new THREE.Color('#0d0221'),
      primary: new THREE.Color('#9b59b6'),
      secondary: new THREE.Color('#d4a574'),
      accent:  new THREE.Color('#f0c27a'),
      wire:    new THREE.Color('#7d3c98'),
      aura:    new THREE.Color('#6c3483'),
      particles: new THREE.Color('#e8c56d'),
      name: 'Relajación'
    },
    meditation: {
      bg:      new THREE.Color('#0a0a2e'),
      primary: new THREE.Color('#4b6cb7'),
      secondary: new THREE.Color('#e8e8ff'),
      accent:  new THREE.Color('#ffffff'),
      wire:    new THREE.Color('#3b5998'),
      aura:    new THREE.Color('#1a3a6e'),
      particles: new THREE.Color('#aaccff'),
      name: 'Meditación'
    },
    concentration: {
      bg:      new THREE.Color('#050510'),
      primary: new THREE.Color('#ffffff'),
      secondary: new THREE.Color('#00e5ff'),
      accent:  new THREE.Color('#00bcd4'),
      wire:    new THREE.Color('#e0e0e0'),
      aura:    new THREE.Color('#0097a7'),
      particles: new THREE.Color('#00ffff'),
      name: 'Concentración'
    },
    sleep: {
      bg:      new THREE.Color('#020618'),
      primary: new THREE.Color('#1a237e'),
      secondary: new THREE.Color('#4a148c'),
      accent:  new THREE.Color('#7b1fa2'),
      wire:    new THREE.Color('#283593'),
      aura:    new THREE.Color('#0d1b5e'),
      particles: new THREE.Color('#9fa8da'),
      name: 'Sueño'
    }
  };

  // ─── INIT ────────────────────────────────────────────
  function init(el) {
    if (disposed || scene) return;
    container = el || document.getElementById('zenViz') || document.body;
    
    // Canvas
    canvas = container;
    if (container.tagName !== 'CANVAS') {
      canvas = document.createElement('canvas');
      canvas.id = 'mandala3d-canvas';
      canvas.style.cssText = 'position:fixed;inset:0;z-index:0;pointer-events:auto;';
      container.appendChild(canvas);
    }
    
    // Scene
    scene = new THREE.Scene();
    
    // Camera
    camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 0.3, 7);
    camera.lookAt(0, 0, 0);
    
    // Renderer
    renderer = new THREE.WebGLRenderer({ 
      canvas: canvas, 
      alpha: true, 
      antialias: true,
      powerPreference: 'high-performance'
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, baseOpacity); // Transparent base
    
    // Init palette
    setPalette(currentState, true);
    
    // Build geometry
    buildSacredGeometry();
    buildTorusKnot();
    buildAuraSpheres();
    buildOrbitParticles();
    buildLightRings();
    buildStarField();
    
    // Events
    canvas.addEventListener('pointerdown', onPointerDown, { passive: false });
    canvas.addEventListener('pointermove', onPointerMove, { passive: false });
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointerleave', onPointerUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('resize', onResize);
    
    // Start
    animate();
    console.log('💎 Mandala3D initialized — state:', currentState);
  }

  // ─── GEOMETRY BUILDERS ───────────────────────────────

  // 🌸 Sacred Geometry: Flower of Life / Merkaba style
  function buildSacredGeometry() {
    const group = new THREE.Group();
    const p = paletteCurrent;
    
    // Merkaba - two interlocking tetrahedrons
    const tetraGeo = new THREE.TetrahedronGeometry(1.0, 0);
    const tetraMat = new THREE.MeshBasicMaterial({
      color: p.accent,
      wireframe: true,
      transparent: true,
      opacity: 0.15
    });
    
    const tetraTop = new THREE.Mesh(tetraGeo, tetraMat);
    tetraTop.position.y = 0.25;
    tetraTop.scale.set(1, 1.4, 1);
    group.add(tetraTop);
    
    const tetraBottom = new THREE.Mesh(tetraGeo, tetraMat.clone());
    tetraBottom.position.y = -0.25;
    tetraBottom.rotation.x = Math.PI;
    tetraBottom.scale.set(1, 1.4, 1);
    group.add(tetraBottom);
    
    // Flower of Life pattern - intersecting rings
    const ringCount = 7;
    const radius = 1.7;
    for (let i = 0; i < ringCount; i++) {
      const angle = (i / ringCount) * Math.PI * 2;
      const ringGeo = new THREE.TorusGeometry(0.52, 0.008, 8, 64);
      const ringMat = new THREE.MeshBasicMaterial({
        color: p.accent,
        transparent: true,
        opacity: 0.2,
        blending: THREE.AdditiveBlending
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.x = Math.cos(angle) * radius * 0.3;
      ring.position.z = Math.sin(angle) * radius * 0.3;
      group.add(ring);
    }
    
    // Outer petal loops
    for (let j = 0; j < 6; j++) {
      const a = (j / 6) * Math.PI * 2;
      const petalGeo = new THREE.TorusGeometry(0.3, 0.005, 6, 24);
      const petalMat = new THREE.MeshBasicMaterial({
        color: p.accent,
        transparent: true,
        opacity: 0.12,
        blending: THREE.AdditiveBlending
      });
      const petal = new THREE.Mesh(petalGeo, petalMat);
      petal.position.set(
        Math.cos(a) * radius * 0.55,
        Math.sin(a * 2) * 0.4,
        Math.sin(a) * radius * 0.55
      );
      petal.rotation.x = Math.PI / 3;
      petal.rotation.y = a;
      group.add(petal);
    }
    
    scene.add(group);
    sacredGeo = group;
  }

  // 🌀 Torus Knot - Main hypnotic center
  function buildTorusKnot() {
    const group = new THREE.Group();
    const p = paletteCurrent;
    
    // Wireframe torus knot
    const tkGeo = new THREE.TorusKnotGeometry(1.1, 0.28, 128, 16, 2, 3);
    const wireMat = new THREE.MeshBasicMaterial({
      color: p.wire,
      wireframe: true,
      transparent: true,
      opacity: 0.35
    });
    torusKnot = new THREE.Mesh(tkGeo, wireMat);
    group.add(torusKnot);
    
    // Solid blend with lower opacity
    const solidMat = new THREE.MeshBasicMaterial({
      color: p.primary,
      transparent: true,
      opacity: 0.12,
      blending: THREE.AdditiveBlending
    });
    torusSolid = new THREE.Mesh(tkGeo.clone(), solidMat);
    group.add(torusSolid);
    
    // Inner vertex glow dots on the torus
    const verts = tkGeo.attributes.position.array;
    const dotGeo = new THREE.SphereGeometry(0.02, 4, 4);
    const dotMat = new THREE.MeshBasicMaterial({
      color: p.accent,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending
    });
    
    for (let i = 0; i < verts.length; i += 3) {
      if (Math.random() > 0.08) continue;
      const dot = new THREE.Mesh(dotGeo, dotMat);
      dot.position.set(verts[i], verts[i+1], verts[i+2]);
      group.add(dot);
    }
    
    scene.add(group);
    torusKnot = group; // reassign to group for rotation
    torusKnot.userData = { baseScale: 1, scaleTarget: 1 };
  }

  // 🔮 Aura Spheres - Concentric layers
  function buildAuraSpheres() {
    const p = paletteCurrent;
    const sphereConfigs = [
      { r: 0.55, op: 0.06, detail: 32 },
      { r: 0.85, op: 0.04, detail: 32 },
      { r: 1.35, op: 0.03, detail: 48 },
      { r: 2.1, op: 0.02, detail: 48 },
      { r: 3.2, op: 0.012, detail: 64 }
    ];
    
    sphereConfigs.forEach((cfg, i) => {
      const geo = new THREE.SphereGeometry(cfg.r, cfg.detail, cfg.detail);
      const mat = new THREE.MeshBasicMaterial({
        color: p.aura,
        transparent: true,
        opacity: cfg.op,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const sphere = new THREE.Mesh(geo, mat);
      sphere.renderOrder = 999;
      sphere.userData = { baseOpacity: cfg.op, index: i };
      scene.add(sphere);
      auraSpheres.push(sphere);
    });
  }

  // ✨ Fibonacci Spiral Orbit Particles (Golden Ratio)
  function buildOrbitParticles() {
    const p = paletteCurrent;
    const phi = (1 + Math.sqrt(5)) / 2; // Golden ratio
    const totalParticles = 400;
    
    const positions = new Float32Array(totalParticles * 3);
    const colors = new Float32Array(totalParticles * 3);
    const sizes = new Float32Array(totalParticles);
    
    for (let i = 0; i < totalParticles; i++) {
      const t = i / totalParticles;
      const theta = t * Math.PI * 8; // 4 turns
      const radius = 0.8 + t * 3.5 * phi;
      const y = (t - 0.5) * 4;
      
      positions[i * 3] = Math.cos(theta) * radius;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = Math.sin(theta) * radius;
      
      // Color gradient along spiral
      const c = p.primary.clone().lerp(p.accent, t);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
      
      sizes[i] = 0.01 + Math.random() * 0.03 * (1 - t * 0.7);
    }
    
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    
    const mat = new THREE.PointsMaterial({
      size: 0.04,
      vertexColors: true,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    
    const particles = new THREE.Points(geo, mat);
    particles.userData = { phi, totalParticles };
    scene.add(particles);
    orbitParticles = particles;
  }

  // 💫 Light Rings - Rotating on different axes
  function buildLightRings() {
    const p = paletteCurrent;
    const ringDefs = [
      { r: 1.5, tube: 0.015, axis: 'x', speed: 0.4, op: 0.35, tilt: 0.3 },
      { r: 2.0, tube: 0.012, axis: 'y', speed: 0.25, op: 0.3, tilt: 0.6 },
      { r: 2.5, tube: 0.01, axis: 'z', speed: -0.35, op: 0.25, tilt: 0.15 },
      { r: 1.8, tube: 0.018, axis: 'x', speed: -0.3, op: 0.4, tilt: 0.8 },
      { r: 3.0, tube: 0.008, axis: 'y', speed: 0.15, op: 0.18, tilt: 0.45 }
    ];
    
    ringDefs.forEach(def => {
      const geo = new THREE.TorusGeometry(def.r, def.tube, 16, 100);
      const mat = new THREE.MeshBasicMaterial({
        color: p.accent,
        transparent: true,
        opacity: def.op,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const ring = new THREE.Mesh(geo, mat);
      ring.userData = {
        axis: def.axis,
        speed: def.speed,
        tilt: def.tilt,
        baseOp: def.op
      };
      
      // Random initial rotation
      ring.rotation.x = Math.random() * Math.PI * 2;
      ring.rotation.y = Math.random() * Math.PI * 2;
      ring.rotation.z = Math.random() * Math.PI * 2;
      
      scene.add(ring);
      lightRings.push(ring);
    });
  }

  // 🌌 Star Field background
  function buildStarField() {
    const starCount = 600;
    const positions = new Float32Array(starCount * 3);
    
    for (let i = 0; i < starCount * 3; i += 3) {
      // Distribute in a sphere shell
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 6 + Math.random() * 8;
      positions[i] = Math.sin(phi) * Math.cos(theta) * r;
      positions[i + 1] = Math.sin(phi) * Math.sin(theta) * r;
      positions[i + 2] = Math.cos(phi) * r;
    }
    
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    const mat = new THREE.PointsMaterial({
      color: 0x8888cc,
      size: 0.03,
      transparent: true,
      opacity: 0.4,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    
    starField = new THREE.Points(geo, mat);
    scene.add(starField);
  }

  // ─── PALETTE TRANSITIONS ─────────────────────────────
  function setPalette(state, instant = false) {
    const next = PALETTES[state];
    if (!next) return;
    
    currentState = state;
    paletteTarget = {
      bg: next.bg.clone(),
      primary: next.primary.clone(),
      secondary: next.secondary.clone(),
      accent: next.accent.clone(),
      wire: next.wire.clone(),
      aura: next.aura.clone(),
      particles: next.particles.clone()
    };
    
    if (instant || !paletteCurrent) {
      paletteCurrent = { ...paletteTarget, bg: paletteTarget.bg.clone(), primary: paletteTarget.primary.clone(), secondary: paletteTarget.secondary.clone(), accent: paletteTarget.accent.clone(), wire: paletteTarget.wire.clone(), aura: paletteTarget.aura.clone(), particles: paletteTarget.particles.clone() };
      transitionProgress = 1;
      applyPaletteInstant();
    } else {
      transitionProgress = 0;
    }
  }

  function lerpColor(target, current, t) {
    current.r += (target.r - current.r) * t;
    current.g += (target.g - current.g) * t;
    current.b += (target.b - current.b) * t;
  }

  function updatePaletteTransition(dt) {
    if (transitionProgress >= 1 || !paletteTarget) return;
    
    const speed = 1.5; // transition speed
    transitionProgress = Math.min(1, transitionProgress + dt * speed);
    const t = 0.05; // per-frame lerp factor (smooth)
    
    lerpColor(paletteTarget.primary, paletteCurrent.primary, t);
    lerpColor(paletteTarget.accent, paletteCurrent.accent, t);
    lerpColor(paletteTarget.wire, paletteCurrent.wire, t);
    lerpColor(paletteTarget.aura, paletteCurrent.aura, t);
    lerpColor(paletteTarget.particles, paletteCurrent.particles, t);
    lerpColor(paletteTarget.secondary, paletteCurrent.secondary, t);
    
    applyPaletteTransition();
  }

  function applyPaletteInstant() {
    const p = paletteCurrent;
    
    // Torus knot
    if (torusKnot) {
      torusKnot.children.forEach(child => {
        if (!child.material) return;
        if (child.material.wireframe) {
          child.material.color.copy(p.wire);
        } else if (child.material.blending === THREE.AdditiveBlending) {
          child.material.color.copy(p.primary);
        } else {
          child.material.color.copy(p.accent);
        }
      });
    }
    
    // Aura spheres
    auraSpheres.forEach(s => {
      if (s.material) s.material.color.copy(p.aura);
    });
    
    // Orbit particles
    if (orbitParticles) {
      updateParticleColors();
    }
    
    // Light rings
    lightRings.forEach(r => {
      if (r.material) r.material.color.copy(p.accent);
    });
    
    // Sacred geometry
    if (sacredGeo) {
      sacredGeo.children.forEach(c => {
        if (c.material) c.material.color.copy(p.accent);
      });
    }
  }

  function applyPaletteTransition() {
    // Continuous update happens in animate loop via the shared colors
    applyPaletteInstant();
  }

  function updateParticleColors() {
    if (!orbitParticles || !paletteCurrent) return;
    const colors = orbitParticles.geometry.attributes.color.array;
    const total = colors.length / 3;
    const p = paletteCurrent;
    
    for (let i = 0; i < total; i++) {
      const t = i / total;
      const c = p.primary.clone().lerp(p.accent, t);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    orbitParticles.geometry.attributes.color.needsUpdate = true;
  }

  // ─── AUDIO ───────────────────────────────────────────
  function connectAudio(source) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    
    const ctx = new AudioCtx();
    let src;
    
    if (source instanceof MediaStream) {
      src = ctx.createMediaStreamSource(source);
    } else if (source instanceof HTMLMediaElement || source instanceof HTMLAudioElement) {
      src = ctx.createMediaElementSource(source);
    } else {
      return;
    }
    
    analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.7;
    dataArray = new Uint8Array(analyser.frequencyBinCount);
    src.connect(analyser);
    hasAudio = true;
    
    console.log('🔊 Mandala3D audio connected');
  }

  function disconnectAudio() {
    hasAudio = false;
    analyser = null;
    dataArray = null;
  }

  // ─── INTERACTION ─────────────────────────────────────
  function onPointerDown(e) {
    e.preventDefault();
    isDragging = true;
    prevMouse.x = e.clientX;
    prevMouse.y = e.clientY;
    autoRotate = false;
    clearTimeout(touchTimeout);
  }

  function onPointerMove(e) {
    if (!isDragging) return;
    e.preventDefault();
    
    const dx = e.clientX - prevMouse.x;
    const dy = e.clientY - prevMouse.y;
    
    targetRot.y += dx * 0.005;
    targetRot.x += dy * 0.005;
    
    // Clamp vertical rotation
    targetRot.x = Math.max(-Math.PI / 2.5, Math.min(Math.PI / 2.5, targetRot.x));
    
    prevMouse.x = e.clientX;
    prevMouse.y = e.clientY;
  }

  function onPointerUp() {
    isDragging = false;
    // Resume auto-rotate after 2s of inactivity
    touchTimeout = setTimeout(() => {
      autoRotate = true;
    }, 2000);
  }

  function onWheel(e) {
    e.preventDefault();
    camera.position.z += e.deltaY * 0.01;
    camera.position.z = Math.max(3, Math.min(12, camera.position.z));
  }

  function onResize() {
    if (!camera || !renderer) return;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  // ─── ANIMATION LOOP ──────────────────────────────────
  function animate() {
    if (disposed) return;
    animId = requestAnimationFrame(animate);
    
    const dt = Math.min(clock.getDelta(), 0.1); // cap delta
    const t = performance.now() * 0.001;
    
    // ── Audio analysis ──────────────────────────
    if (analyser && dataArray) {
      analyser.getByteFrequencyData(dataArray);
      
      // Frequency bands (approximate for 1024 bins at 44100Hz)
      const lowSum  = dataArray.slice(0, 20).reduce((a, b) => a + b, 0) / 20 / 255;
      const midSum  = dataArray.slice(20, 120).reduce((a, b) => a + b, 0) / 100 / 255;
      const highSum = dataArray.slice(120, 500).reduce((a, b) => a + b, 0) / 380 / 255;
      
      // Smooth
      audioSmooth.low  += (lowSum  - audioSmooth.low)  * 0.15;
      audioSmooth.mid  += (midSum  - audioSmooth.mid)  * 0.15;
      audioSmooth.high += (highSum - audioSmooth.high) * 0.15;
    } else {
      // Idle decay
      audioSmooth.low  *= 0.98;
      audioSmooth.mid  *= 0.98;
      audioSmooth.high *= 0.98;
    }
    
    // Adjust base opacity based on audio presence
    const audioIntensity = (audioSmooth.low + audioSmooth.mid + audioSmooth.high) / 3;
    const targetAlpha = baseOpacity + audioIntensity * 0.4;
    renderer.setClearColor(0x000000, targetAlpha);
    
    // ── Torus Knot: bass modulates scale ─────────
    if (torusKnot) {
      const bassScale = 1 + audioSmooth.low * 0.20 + audioSmooth.mid * 0.08;
      torusKnot.userData.scaleTarget += (bassScale - torusKnot.userData.scaleTarget) * 0.06;
      torusKnot.scale.setScalar(torusKnot.userData.scaleTarget);
      
      // Rotation speed modulated by mids
      const rotSpeed = (1 + audioSmooth.mid * 3) * 0.5;
      torusKnot.rotation.x += dt * rotSpeed * 0.7;
      torusKnot.rotation.y += dt * rotSpeed;
      torusKnot.rotation.z += dt * rotSpeed * 0.3;
      
      // Wireframe opacity modulation
      torusKnot.children.forEach(child => {
        if (child.material?.wireframe) {
          const wireOp = 0.25 + audioSmooth.high * 0.35 + audioSmooth.mid * 0.15;
          child.material.opacity = wireOp;
        }
        if (child.material && !child.material.wireframe && child.material.blending === THREE.AdditiveBlending) {
          child.material.opacity = 0.08 + audioSmooth.mid * 0.15;
        }
      });
    }
    
    // ── Aura Spheres: pulse with audio ───────────
    auraSpheres.forEach((s, i) => {
      const pulse = 1 + audioSmooth.low * 0.06 * (i + 1) + Math.sin(t * 0.5 + i) * 0.03;
      s.scale.setScalar(pulse);
      if (s.material) {
        s.material.opacity = s.userData.baseOpacity + audioSmooth.mid * 0.04 * (i + 1);
      }
    });
    
    // ── Orbit Particles: rotate whole system ─────
    if (orbitParticles) {
      orbitParticles.rotation.y += dt * 0.12 * (1 + audioSmooth.low * 2);
      orbitParticles.rotation.x += dt * 0.04 * (1 + audioSmooth.mid);
      // High frequencies trigger extra rotation bursts
      orbitParticles.rotation.z += dt * 0.03 * (1 + audioSmooth.high * 3);
      
      // Particle size modulation
      if (orbitParticles.material.size !== undefined) {
        orbitParticles.material.size = 0.035 + audioSmooth.high * 0.03;
      }
    }
    
    // ── Light Rings: rotate on unique axes ───────
    lightRings.forEach(ring => {
      const ud = ring.userData;
      const speed = ud.speed * dt * (1 + audioSmooth.mid * 2);
      
      if (ud.axis === 'x') ring.rotation.x += speed;
      else if (ud.axis === 'y') ring.rotation.y += speed;
      else ring.rotation.z += speed;
      
      // Subtle wobble
      ring.rotation.x += Math.sin(t * 0.8 + ud.tilt) * dt * 0.1;
      ring.rotation.z += Math.cos(t * 0.6 + ud.tilt) * dt * 0.08;
      
      // Opacity modulation
      if (ring.material) {
        ring.material.opacity = ud.baseOp + audioSmooth.high * 0.2;
      }
    });
    
    // ── Sacred Geometry ──────────────────────────
    if (sacredGeo) {
      sacredGeo.rotation.y += dt * 0.15 * (1 + audioSmooth.mid);
      sacredGeo.rotation.x += dt * 0.08;
      sacredGeo.children.forEach(c => {
        if (c.material) {
          c.material.opacity = 0.1 + audioSmooth.mid * 0.2;
        }
      });
    }
    
    // ── Star Field ───────────────────────────────
    if (starField) {
      starField.rotation.y += dt * 0.02;
      starField.rotation.x += dt * 0.005;
    }
    
    // ── Camera: Auto-rotate or manual ────────────
    if (autoRotate) {
      targetRot.y += dt * 0.25;
      targetRot.x += Math.sin(t * 0.3) * dt * 0.08;
    }
    
    // Smooth camera orbit
    const currentRot = { x: 0, y: 0 };
    currentRot.x += (targetRot.x - currentRot.x) * 0.03;
    currentRot.y += (targetRot.y - currentRot.y) * 0.03;
    
    camera.position.x = Math.sin(currentRot.y) * 6;
    camera.position.z = Math.cos(currentRot.y) * 6;
    camera.position.y = Math.sin(currentRot.x) * 3.5;
    camera.lookAt(0, 0, 0);
    
    // ── Palette transition ───────────────────────
    updatePaletteTransition(dt);
    
    // Render
    renderer.render(scene, camera);
  }

  // ─── PUBLIC API ──────────────────────────────────────
  function setState(state) {
    if (PALETTES[state]) {
      setPalette(state);
    }
  }

  function getStates() {
    return Object.keys(PALETTES).map(k => ({ 
      id: k, 
      name: PALETTES[k].name 
    }));
  }

  function getCurrentState() {
    return { id: currentState, name: PALETTES[currentState].name };
  }

  function setOpacity(v) {
    baseOpacity = Math.max(0, Math.min(1, v));
  }

  function dispose() {
    disposed = true;
    if (animId) cancelAnimationFrame(animId);
    
    // Cleanup
    window.removeEventListener('resize', onResize);
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerup', onPointerUp);
    canvas.removeEventListener('pointerleave', onPointerUp);
    canvas.removeEventListener('wheel', onWheel);
    
    if (renderer) {
      renderer.dispose();
      renderer = null;
    }
    
    if (scene) {
      // Dispose all geometries and materials
      scene.traverse(obj => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) {
            obj.material.forEach(m => m.dispose());
          } else {
            obj.material.dispose();
          }
        }
      });
      scene.clear();
      scene = null;
    }
    
    torusKnot = null;
    torusSolid = null;
    auraSpheres = [];
    orbitParticles = null;
    lightRings = [];
    sacredGeo = null;
    starField = null;
    camera = null;
    analyser = null;
    dataArray = null;
    
    console.log('💎 Mandala3D disposed');
  }

  // ─── EXPORT ──────────────────────────────────────────
  return {
    init,
    connectAudio,
    disconnectAudio,
    setState,
    getStates,
    getCurrentState,
    setOpacity,
    dispose
  };
})();

console.log('💎 Mandala3D ready — VertexWizard signature');
