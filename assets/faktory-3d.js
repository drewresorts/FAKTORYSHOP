/* ==========================================================================
   FAKTORY — <faktory-scene> interactive 3D chrome object (Three.js)

   Attributes:
     data-shape        blob | logo | knot | rings | model
     data-model        URL of a .glb file (shape = model)
     data-keep-materials  "true" to keep the GLB's own materials
     data-iridescence  0..1   oil-slick film on the metal
     data-roughness    0..1
     data-tint         hex colour of the metal
     data-spin         idle spin multiplier
     data-particles    "true" | "false"

   Interaction: drag / swipe to spin with inertia, tap to pulse. Device tilt
   (or pointer) rotates the reflected studio-light environment, so reflections
   slide across the object like real chrome under a light.
   ========================================================================== */
import * as THREE from 'three';

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isSmall = () => window.innerWidth < 750;

function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch (e) {
    return false;
  }
}

/* Studio light-box environment: black room with hard white strip lights. This
   is what gives the metal its high-contrast liquid-chrome look. */
function buildEnvironment(renderer, accent) {
  const env = new THREE.Scene();
  env.background = new THREE.Color(0x030303);
  const strip = (w, h, x, y, z, ry = 0, rx = 0, color = 0xffffff, intensity = 6) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide })
    );
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, 0);
    env.add(m);
  };
  // Soft gradient dome so the metal reads as polished silver, not black glass.
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(20, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'varying vec3 vP; void main(){ float h = vP.y; float band = smoothstep(0.35, 0.0, abs(h - 0.05)); vec3 c = mix(vec3(0.015), vec3(0.55), smoothstep(-0.2, 0.9, h)) + band * 0.35; gl_FragColor = vec4(c, 1.0); }'
    })
  );
  env.add(dome);
  // Overhead softbox + side strips + floor bounce.
  strip(10, 2.2, 0, 6, 0, 0, Math.PI / 2, 0xffffff, 4);
  strip(0.6, 12, -6, 0, -2, Math.PI / 2, 0, 0xffffff, 9);
  strip(0.6, 12, 6, 0, 2, -Math.PI / 2, 0, 0xffffff, 9);
  strip(0.25, 12, 3.5, 0, -6, 0, 0, 0xffffff, 12);
  strip(0.25, 12, -3.5, 0, 6, Math.PI, 0, 0xffffff, 12);
  strip(14, 0.3, 0, -1.2, -6, 0, 0, 0xffffff, 3);
  strip(3, 3, 0, -6, 0, 0, -Math.PI / 2, 0x222222, 1);
  if (accent) strip(0.4, 10, -5.5, 0, -5, Math.PI / 4, 0, accent, 3);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const tex = pmrem.fromScene(env, 0.02).texture;
  pmrem.dispose();
  env.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
  return tex;
}

function chromeMaterial(opts) {
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(opts.tint),
    metalness: 1,
    roughness: opts.roughness,
    clearcoat: 1,
    clearcoatRoughness: 0.04,
    iridescence: opts.iridescence,
    iridescenceIOR: 1.7,
    iridescenceThicknessRange: [120, 900],
    envMapIntensity: 1.25
  });
}

/* ==========================================================================
   FAKTORY COMPLETE LOGO — traced gear + F monogram + small gear
   Usage: <faktory-scene data-shape="faktory">
   ========================================================================== */

function faktoryShapeFromPoints(points) {
  const CENTER = 627;
  const UNIT = 100;

  const convert = ([x, y]) => new THREE.Vector2(
    (x - CENTER) / UNIT,
    (CENTER - y) / UNIT
  );

  const shape = new THREE.Shape();
  const first = convert(points[0]);

  shape.moveTo(first.x, first.y);

  for (let i = 1; i < points.length; i++) {
    const p = convert(points[i]);
    shape.lineTo(p.x, p.y);
  }

  shape.closePath();
  return shape;
}

function faktoryExtrude(shape, depth = 0.2) {
  return new THREE.ExtrudeGeometry(shape, {
    depth,
    steps: 1,
    bevelEnabled: true,
    bevelThickness: 0.025,
    bevelSize: 0.018,
    bevelSegments: 3,
    curveSegments: 8
  });
}

function faktoryGeometry(material) {
  const group = new THREE.Group();

  // 1. LARGE LEFT GEAR
  const largeGear = faktoryShapeFromPoints([
    [712,243], [670,283], [642,274], [605,269],
    [586,205], [501,217], [501,282], [467,294],
    [428,315], [377,278], [319,334], [354,388],
    [316,453], [253,445], [237,532], [294,550],
    [294,594], [300,633], [247,663], [276,740],
    [335,726], [352,752], [380,785], [350,844],
    [410,883], [436,759], [409,731], [387,700],
    [369,664], [357,625], [352,593], [352,549],
    [359,510], [372,473], [399,426], [432,389],
    [463,365], [509,342], [549,331], [586,327],
    [628,330], [674,343], [750,342], [775,289]
  ]);

  const gearMesh = new THREE.Mesh(
    faktoryExtrude(largeGear, 0.20),
    material
  );

  gearMesh.position.z = -0.08;
  group.add(gearMesh);

  // 2. MAIN ANGULAR F MONOGRAM
  const fShape = faktoryShapeFromPoints([
    [1015,370], [535,370], [400,1048],
    [544,926], [597,678], [776,678],
    [869,569], [618,569], [637,481],
    [916,481]
  ]);

  const fMesh = new THREE.Mesh(
    faktoryExtrude(fShape, 0.24),
    material
  );

  fMesh.position.z = 0.04;
  group.add(fMesh);

  // 3. SMALL RIGHT GEAR WITH A REAL THROUGH-HOLE
  const smallGear = faktoryShapeFromPoints([
    [931,762], [902,727], [875,741], [844,724],
    [839,691], [798,688], [790,718], [768,723],
    [745,733], [722,712], [691,740], [709,768],
    [695,800], [667,802], [665,811], [643,821],
    [587,830], [564,926], [636,926], [645,863],
    [676,848], [694,853], [706,887], [686,912],
    [714,940], [740,926], [770,942], [773,970],
    [814,974], [823,947], [857,936], [878,956],
    [910,929], [897,904], [915,872], [943,868],
    [946,827], [919,817], [910,785]
  ]);

  // The opening follows a polygonal approximation of the
  // circular hole visible in the supplied reference image.
  const hole = faktoryShapeFromPoints([
    [797,748], [826,749], [853,764], [874,787],
    [886,815], [889,843], [879,870], [862,892],
    [838,908], [811,914], [784,909], [760,895],
    [741,874], [730,848], [730,819], [740,792],
    [758,770], [776,756]
  ]);

  // THREE.Shape hole paths use their own local coordinates.
  const holePath = new THREE.Path();
  const holePoints = [
    [797,748], [826,749], [853,764], [874,787],
    [886,815], [889,843], [879,870], [862,892],
    [838,908], [811,914], [784,909], [760,895],
    [741,874], [730,848], [730,819], [740,792],
    [758,770], [776,756]
  ].map(([x, y]) => new THREE.Vector2(
    (x - 627) / 100,
    (627 - y) / 100
  ));

  holePath.moveTo(holePoints[0].x, holePoints[0].y);

  for (let i = 1; i < holePoints.length; i++) {
    holePath.lineTo(holePoints[i].x, holePoints[i].y);
  }

  holePath.closePath();
  smallGear.holes.push(holePath);

  const smallGearMesh = new THREE.Mesh(
    faktoryExtrude(smallGear, 0.22),
    material
  );

  smallGearMesh.position.z = 0.06;
  group.add(smallGearMesh);

  // Match the approximate dimensions of the other embedded
  // objects in the component, keeping the complete logo visible.
  group.scale.setScalar(0.38);

  return group;
}

/* Bold "F" monogram, extruded with a bevel. */
function logoGeometry() {
  const s = new THREE.Shape();
  s.moveTo(-0.62, -1);
  s.lineTo(-0.62, 1);
  s.lineTo(0.78, 1);
  s.lineTo(0.66, 0.56);
  s.lineTo(-0.12, 0.56);
  s.lineTo(-0.12, 0.2);
  s.lineTo(0.52, 0.2);
  s.lineTo(0.42, -0.22);
  s.lineTo(-0.12, -0.22);
  s.lineTo(-0.12, -1);
  s.lineTo(-0.62, -1);
  const g = new THREE.ExtrudeGeometry(s, {
    depth: 0.42,
    bevelEnabled: true,
    bevelThickness: 0.08,
    bevelSize: 0.06,
    bevelSegments: 8,
    curveSegments: 12
  });
  g.center();
  return g;
}

/* Cheap smooth 3D pseudo-noise from layered sines — plenty for a liquid blob. */
function wobble(x, y, z, t) {
  return (
    Math.sin(x * 1.7 + t * 1.1) * Math.cos(y * 1.3 + t * 0.9) * 0.5 +
    Math.sin(y * 2.3 - t * 1.3 + z * 1.1) * 0.3 +
    Math.cos(z * 2.9 + t * 0.7 + x * 0.6) * 0.2
  );
}

class FaktoryScene extends HTMLElement {
  connectedCallback() {
    if (this._started) return;
    this._started = true;
    if (!webglAvailable()) {
      this.classList.add('is-fallback');
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        this._visible = e.isIntersecting;
        if (e.isIntersecting && !this._ready) this.init();
        if (e.isIntersecting && this._ready) this.start();
      });
    }, { rootMargin: '200px' });
    io.observe(this);
    this._io = io;
  }

  disconnectedCallback() {
    this.stop();
    if (this._io) this._io.disconnect();
    if (this._ro) this._ro.disconnect();
    if (this._onVis) document.removeEventListener('visibilitychange', this._onVis);
    if (this.renderer) {
      this.scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) [].concat(o.material).forEach((m) => m.dispose());
      });
      if (this.scene.environment) this.scene.environment.dispose();
      this.renderer.dispose();
      this.renderer.domElement.remove();
    }
  }

  get opts() {
    const d = this.dataset;
    const num = (v, f) => (v === undefined || v === '' || isNaN(parseFloat(v)) ? f : parseFloat(v));
    return {
      shape: d.shape || 'blob',
      model: d.model || '',
      keepMaterials: d.keepMaterials === 'true',
      iridescence: num(d.iridescence, 0.4),
      roughness: num(d.roughness, 0.06),
      tint: d.tint || '#ffffff',
      spin: num(d.spin, 1),
      particles: d.particles !== 'false'
    };
  }

  init() {
    this._ready = true;
    const opts = (this._opts = this.opts);
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--c-accent').trim() || null;

    const renderer = (this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' }));
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isSmall() ? 1.5 : 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x000000, 0);
    this.appendChild(renderer.domElement);

    const scene = (this.scene = new THREE.Scene());
    scene.environment = buildEnvironment(renderer, accent);

    const camera = (this.camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100));
    camera.position.set(0, 0, 7);

    this.pivot = new THREE.Group();   // tilt / lean / scroll transforms
    this.spinner = new THREE.Group(); // spin + drag rotation
    this.pivot.add(this.spinner);
    scene.add(this.pivot);

    this.material = chromeMaterial(opts);
    this.buildShape(opts);
    if (opts.particles) this.buildParticles();

    // State
    this.rot = { x: 0.25, y: 0 };
    this.vel = { x: 0, y: 0.004 * opts.spin };
    this.pulse = 0;
    this.agitation = 0;
    this.clock = new THREE.Clock();
    this.pointer = { x: 0, y: 0 };

    this.bindInteraction();
    this._ro = new ResizeObserver(() => this.resize());
    this._ro.observe(this);
    this.resize();

    this._onVis = () => (document.hidden ? this.stop() : this._visible && this.start());
    document.addEventListener('visibilitychange', this._onVis);

    this.classList.add('is-ready');
    if (reduceMotion) this.renderOnce();
    else this.start();
  }

  buildShape(opts) {
    let mesh;
    switch (opts.shape) {
      case 'logo':
        mesh = new THREE.Mesh(logoGeometry(), this.material);
        mesh.scale.setScalar(1.05);
        break;
      case 'knot':
        mesh = new THREE.Mesh(new THREE.TorusKnotGeometry(0.78, 0.26, 360, 56, 2, 3), this.material);
        break;
      case 'rings': {
        mesh = new THREE.Group();
        const radii = [1.25, 0.98, 0.72];
        this.rings = radii.map((r, i) => {
          const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.07 + i * 0.015, 48, 220), this.material);
          ring.rotation.x = i * 0.9;
          mesh.add(ring);
          return ring;; 
        };
        const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.38, 0), this.material);
        mesh.add(core);
        this.core = core;
        break;
      }
      case 'model':
        if (opts.model) {
          this.loadModel(opts);
          return;
        }
      // falls through to blob when no model URL is set
      default: {
        const seg = isSmall() ? 96 : 150;
        const geo = new THREE.SphereGeometry(1, seg, seg);
        this.blobBase = geo.attributes.position.array.slice();
        mesh = new THREE.Mesh(geo, this.material);
        this.blob = mesh;
      }
    }
    this.spinner.add(mesh);
    this.mesh = mesh;
  }

  async loadModel(opts) {
    try {
      const { GLTFLoader } = await import('three/addons/gltf-loader');
      const gltf = await new GLTFLoader().loadAsync(opts.model);
      const obj = gltf.scene;
      const box = new THREE.Box3().setFromObject(obj);
      const size = box.getSize(new THREE.Vector3()).length() || 1;
      const center = box.getCenter(new THREE.Vector3());
      obj.position.sub(center);
      const wrap = new THREE.Group();
      wrap.add(obj);
      wrap.scale.setScalar(2.6 / size);
      obj.traverse((o) => {
        if (!o.isMesh) return;
        if (!opts.keepMaterials) o.material = this.material;
        else if (o.material) o.material.envMapIntensity = 1.2;
      });
      this.spinner.add(wrap);
      this.mesh = wrap;
      if (reduceMotion) this.renderOnce();
    } catch (e) {
      console.warn('[faktory-scene] model failed, using blob', e);
      this._opts.shape = 'blob';
      this.buildShape(this._opts);
    }
  }

  buildParticles() {
    const count = isSmall() ? 260 : 520;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 2.2 + Math.random() * 3.2;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
      pos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th) * 0.7;
      pos[i * 3 + 2] = r * Math.cos(ph) - 1.5;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.particles = new THREE.Points(
      geo,
      new THREE.PointsMaterial({ color: 0xffffff, size: 0.018, transparent: true, opacity: 0.55, depthWrite: false, sizeAttenuation: true })
    );
    this.scene.add(this.particles);
  }

  bindInteraction() {
    const el = this;
    let dragging = false, moved = 0, lx = 0, ly = 0, startX = 0, startY = 0, axisLocked = null;

    el.addEventListener('pointerdown', (e) => {
      dragging = true; moved = 0; axisLocked = null;
      lx = startX = e.clientX; ly = startY = e.clientY;
      if (e.pointerType === 'mouse') el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      this.pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      this.pointer.y = ((e.clientY - r.top) / r.height) * 2 - 1;
      if (!dragging) return;
      // On touch, decide once whether this gesture is a spin or a page scroll.
      if (e.pointerType !== 'mouse' && axisLocked === null) {
        const ax = Math.abs(e.clientX - startX), ay = Math.abs(e.clientY - startY);
        if (ax + ay > 6) axisLocked = ax > ay ? 'x' : 'y';
      }
      if (axisLocked === 'y') return;
      const dx = e.clientX - lx, dy = e.clientY - ly;
      lx = e.clientX; ly = e.clientY;
      moved += Math.abs(dx) + Math.abs(dy);
      this.vel.y = dx * 0.0045;
      this.vel.x = e.pointerType === 'mouse' ? dy * 0.0035 : 0;
      this.rot.y += dx * 0.009;
      if (e.pointerType === 'mouse') this.rot.x += dy * 0.006;
      if (reduceMotion) this.renderOnce();
    });
    const end = (e) => {
      if (!dragging) return;
      dragging = false;
      if (moved < 6) this.tap();
      if (e && e.pointerId != null && el.hasPointerCapture && el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('pointerleave', () => { this.pointer.x = 0; this.pointer.y = 0; });
    this._dragging = () => dragging;
  }

  tap() {
    this.pulse = 1;
    this.agitation = 1;
    this.vel.y += 0.08 * (Math.random() > 0.5 ? 1 : -1);
    if (navigator.vibrate) try { navigator.vibrate(12); } catch (e) { /* ignore */ }
    if (reduceMotion) this.renderOnce();
  }

  resize() {
    const w = this.clientWidth || 1, h = this.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // Keep the object a consistent visual size on tall (portrait) screens.
    this.camera.position.z = w / h < 1 ? 7 / Math.max(0.55, w / h) : 7;
    this.camera.updateProjectionMatrix();
    this.pivot.position.y = this.baseY();
    if (reduceMotion || !this._raf) this.renderOnce();
  }

  baseY() {
    const a = this.camera.aspect;
    // Portrait screens: lift the object above the hero headline.
    return a < 0.8 ? 1.25 : a < 1 ? 0.8 : 0.15;
  }

  start() {
    if (this._raf || reduceMotion || !this._ready) return;
    this.clock.getDelta();
    const loop = () => {
      this._raf = requestAnimationFrame(loop);
      this.tick();
    };
    loop();
  }

  stop() {
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = null;
  }

  renderOnce() {
    if (!this.renderer) return;
    this.tick(true);
  }

  tick(still = false) {
    const dt = still ? 0 : Math.min(this.clock.getDelta(), 0.05);
    const t = this.clock.elapsedTime;
    const tilt = window.FaktoryTilt || { x: 0, y: 0 };
    const o = this._opts;

    // Spin with inertia, decaying back toward the idle spin.
    const idle = 0.0035 * o.spin;
    if (!this._dragging || !this._dragging()) {
      this.vel.y = THREE.MathUtils.lerp(this.vel.y, idle, 0.02);
      this.vel.x = THREE.MathUtils.lerp(this.vel.x, 0, 0.04);
      this.rot.y += this.vel.y * (dt * 60);
      this.rot.x += this.vel.x * (dt * 60);
      this.rot.x = THREE.MathUtils.lerp(this.rot.x, 0.25, 0.01);
    }
    this.spinner.rotation.set(this.rot.x, this.rot.y, 0);

    // Lean toward the tilt / pointer and slide the reflections.
    const tx = tilt.x || 0, ty = tilt.y || 0;
    this.pivot.rotation.x = THREE.MathUtils.lerp(this.pivot.rotation.x, ty * 0.35 + this.pointer.y * 0.15, 0.08);
    this.pivot.rotation.z = THREE.MathUtils.lerp(this.pivot.rotation.z, -tx * 0.15, 0.08);
    this.pivot.position.x = THREE.MathUtils.lerp(this.pivot.position.x, this.pointer.x * 0.25, 0.05);
    if (this.scene.environmentRotation) {
      this.scene.environmentRotation.y = tx * 1.4 + t * 0.05;
      this.scene.environmentRotation.x = ty * 0.6;
    }

    // Scroll: sink and shrink as the section leaves the viewport.
    const r = this.getBoundingClientRect();
    const progress = THREE.MathUtils.clamp(-r.top / (r.height || 1), 0, 1);
    this.pulse = THREE.MathUtils.lerp(this.pulse, 0, 0.08);
    const scale = (1 - progress * 0.35) * (1 + Math.sin(this.pulse * Math.PI) * 0.12);
    this.pivot.scale.setScalar(scale);
    this.pivot.position.y += (progress * 1.2 - (this.pivot.position.y - this.baseY())) * 0.1;

    // Liquid blob deformation.
    if (this.blob && !still) {
      this.agitation = THREE.MathUtils.lerp(this.agitation, 0, 0.02);
      const amp = 0.14 + this.agitation * 0.22 + Math.abs(this.vel.y) * 2;
      const pos = this.blob.geometry.attributes.position;
      const base = this.blobBase;
      const arr = pos.array;
      const speed = t * (0.6 + this.agitation * 2);
      for (let i = 0; i < arr.length; i += 3) {
        const bx = base[i], by = base[i + 1], bz = base[i + 2];
        const n = 1 + wobble(bx * 1.4, by * 1.4, bz * 1.4, speed) * amp;
        arr[i] = bx * n; arr[i + 1] = by * n; arr[i + 2] = bz * n;
      }
      pos.needsUpdate = true;
      this.blob.geometry.computeVertexNormals();
    }

    if (this.rings && !still) {
      this.rings.forEach((ring, i) => {
        ring.rotation.x += (0.004 + i * 0.003) * (1 + this.agitation * 4);
        ring.rotation.y += (0.006 - i * 0.002) * (1 + this.agitation * 4);
      });
      this.core.rotation.y -= 0.01;
    }

    if (this.particles && !still) {
      this.particles.rotation.y += 0.0008 + Math.abs(this.vel.y) * 0.05;
      this.particles.rotation.x = ty * 0.1;
    }

    this.renderer.render(this.scene, this.camera);
  }
}

if (!customElements.get('faktory-scene')) customElements.define('faktory-scene', FaktoryScene);
