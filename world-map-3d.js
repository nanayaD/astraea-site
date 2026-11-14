import * as THREE from './vendor/three/three.module.js';

const viewport = document.querySelector('#atlas-viewport');
const canvasHost = document.querySelector('#atlas-webgl');
const atlasCanvas = document.querySelector('#atlas-canvas');
const nationPaths = [...document.querySelectorAll('.atlas-region[data-map-nation]')];
const nationButtons = [...document.querySelectorAll('.atlas-nation')];
const cityButtons = [...document.querySelectorAll('.atlas-city')];
const peaks = {
  dravan: [[176, 274, 82, 86, 78], [302, 390, 43, 78, 67]],
  kalden: [[490, 158, 94, 111, 84], [690, 192, 52, 88, 74]],
  serein: [[619, 430, 76, 93, 74], [793, 443, 47, 76, 67]]
};
const nationColors = {
  dravan: '#3c6258', kalden: '#4b6470', serein: '#5c706c'
};

function heightAt(nation, x, y) {
  return peaks[nation].reduce((height, [px, py, rise, rx, ry]) => {
    const dx = (x - px) / rx;
    const dy = (y - py) / ry;
    return height + rise * Math.exp(-.5 * (dx * dx + dy * dy));
  }, 0);
}

function outlinePoints(path) {
  const length = path.getTotalLength();
  const count = Math.ceil(length / 9);
  return Array.from({ length: count }, (_, index) => {
    const point = path.getPointAtLength(index * length / count);
    return { x: point.x, y: point.y };
  });
}

function contains(points, x, y) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const a = points[i];
    const b = points[j];
    if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

function terrainGeometry(nation, outline) {
  const positions = [];
  const colors = [];
  const bounds = outline.reduce((box, point) => ({
    left: Math.min(box.left, point.x), right: Math.max(box.right, point.x),
    top: Math.min(box.top, point.y), bottom: Math.max(box.bottom, point.y)
  }), { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity });
  const step = 20;
  const base = new THREE.Color(nationColors[nation]);
  const peak = new THREE.Color('#bdc9a9');
  const appendVertex = (x, y) => {
    const height = heightAt(nation, x, y);
    positions.push(x - 500, height + 1, y - 310);
    const color = base.clone().lerp(peak, Math.min(.65, height / 150));
    colors.push(color.r, color.g, color.b);
  };
  const appendPolygon = polygon => {
    for (let index = 1; index < polygon.length - 1; index += 1) {
      [polygon[0], polygon[index + 1], polygon[index]].forEach(([x, y]) => appendVertex(x, y));
    }
  };
  for (let y = Math.floor(bounds.top / step) * step; y < bounds.bottom; y += step) {
    for (let x = Math.floor(bounds.left / step) * step; x < bounds.right; x += step) {
      const corners = [[x, y], [x + step, y], [x + step, y + step], [x, y + step]];
      const inside = corners.map(([px, py]) => contains(outline, px, py));
      const count = inside.filter(Boolean).length;
      if (!count) continue;
      const crossings = corners.map((corner, index) => {
        const next = (index + 1) % 4;
        if (inside[index] === inside[next]) return null;
        let low = 0;
        let high = 1;
        for (let sample = 0; sample < 8; sample += 1) {
          const middle = (low + high) / 2;
          const px = corner[0] + (corners[next][0] - corner[0]) * middle;
          const py = corner[1] + (corners[next][1] - corner[1]) * middle;
          if (contains(outline, px, py) === inside[index]) low = middle;
          else high = middle;
        }
        const edge = (low + high) / 2;
        return [corner[0] + (corners[next][0] - corner[0]) * edge,
          corner[1] + (corners[next][1] - corner[1]) * edge];
      });
      if (count === 2 && inside[0] === inside[2]) {
        [0, 2].filter(index => inside[index]).forEach(index =>
          appendPolygon([corners[index], crossings[index], crossings[(index + 3) % 4]])
        );
        [1, 3].filter(index => inside[index]).forEach(index =>
          appendPolygon([corners[index], crossings[index], crossings[(index + 3) % 4]])
        );
        continue;
      }
      const polygon = [];
      corners.forEach((corner, index) => {
        if (inside[index]) polygon.push(corner);
        if (crossings[index]) polygon.push(crossings[index]);
      });
      appendPolygon(polygon);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function mapMarkers(buttons, nationOf) {
  return buttons.map(button => ({
    button,
    nation: nationOf(button),
    x: parseFloat(button.style.left) * 10,
    y: parseFloat(button.style.top) * 6.2,
    originalLeft: button.style.left,
    originalTop: button.style.top
  }));
}

function init3D() {
  if (!viewport || !window.atlasMap) return;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  } catch (error) {
    console.info('3D atlas unavailable; SVG atlas remains active.', error);
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
  renderer.setClearColor('#0c2530');
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  canvasHost.append(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2('#0c2530', .0005);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 4000);
  scene.add(new THREE.HemisphereLight('#e1f3e5', '#0c2630', 2.3));
  const sunlight = new THREE.DirectionalLight('#f5d5a1', 2.6);
  sunlight.position.set(-350, 620, 250);
  scene.add(sunlight);
  const edgeLight = new THREE.DirectionalLight('#80bdc5', 1.2);
  edgeLight.position.set(300, 240, -500);
  scene.add(edgeLight);

  const ground = new THREE.GridHelper(1500, 36, '#426b73', '#254b53');
  ground.position.y = -32;
  ground.material.transparent = true;
  ground.material.opacity = .43;
  ground.material.depthWrite = false;
  scene.add(ground);
  const world = new THREE.Group();
  scene.add(world);
  const pickMeshes = [];
  const nationMeshes = new Map();
  const cityBeacons = [];
  const nationMarkers = mapMarkers(nationButtons, button => button.dataset.mapNation);
  const cityMarkers = mapMarkers(cityButtons, button => ({
    harven: 'kalden', brek: 'kalden', tork: 'kalden',
    bardan: 'dravan', korga: 'dravan', ravkan: 'dravan',
    rienna: 'serein', belmar: 'serein', orsen: 'serein'
  })[button.dataset.mapCity]);
  const nationAnchors = new Map(nationMarkers.map(({ nation }) => {
    const anchor = document.createElement('span');
    anchor.className = 'atlas-3d-anchor';
    anchor.setAttribute('aria-hidden', 'true');
    atlasCanvas.append(anchor);
    return [nation, anchor];
  }));

  nationPaths.forEach(path => {
    const nation = path.dataset.mapNation;
    const outline = outlinePoints(path);
    const shape = new THREE.Shape();
    outline.forEach(({ x, y }, index) => {
      if (index === 0) shape.moveTo(x - 500, y - 310);
      else shape.lineTo(x - 500, y - 310);
    });
    shape.closePath();
    const plateGeometry = new THREE.ExtrudeGeometry(shape, { depth: 17, bevelEnabled: false, curveSegments: 1 });
    plateGeometry.rotateX(Math.PI / 2);
    const topMaterial = new THREE.MeshStandardMaterial({ color: nationColors[nation], roughness: .82, metalness: .12, side: THREE.DoubleSide });
    const sideMaterial = new THREE.MeshStandardMaterial({ color: '#19323c', roughness: .9, metalness: .22, side: THREE.DoubleSide });
    const plate = new THREE.Mesh(plateGeometry, [topMaterial, sideMaterial]);
    plate.userData.nation = nation;
    world.add(plate);
    pickMeshes.push(plate);

    const geometry = terrainGeometry(nation, outline);
    const surface = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
      vertexColors: true, side: THREE.DoubleSide, roughness: .75, metalness: .22,
      flatShading: true, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1
    }));
    surface.userData.nation = nation;
    world.add(surface);
    pickMeshes.push(surface);
    const meshLines = new THREE.LineSegments(new THREE.WireframeGeometry(geometry), new THREE.LineBasicMaterial({
      color: nation === 'dravan' ? '#a0d3bc' : '#b8d9d1', transparent: true, opacity: .47, depthWrite: false
    }));
    meshLines.renderOrder = 2;
    world.add(meshLines);

    const topEdge = outline.map(({ x, y }) => new THREE.Vector3(x - 500, 2.2, y - 310));
    const lowerEdge = outline.map(({ x, y }) => new THREE.Vector3(x - 500, -17, y - 310));
    world.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(topEdge), new THREE.LineBasicMaterial({ color: '#dcc695', transparent: true, opacity: .92 })));
    world.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(lowerEdge), new THREE.LineBasicMaterial({ color: '#638585', transparent: true, opacity: .45 })));
    const studs = [];
    for (let index = 0; index < outline.length; index += 8) studs.push(...topEdge[index].toArray(), ...lowerEdge[index].toArray());
    const studGeometry = new THREE.BufferGeometry();
    studGeometry.setAttribute('position', new THREE.Float32BufferAttribute(studs, 3));
    world.add(new THREE.LineSegments(studGeometry, new THREE.LineBasicMaterial({ color: '#99b2aa', transparent: true, opacity: .24 })));
    nationMeshes.set(nation, plate);
  });

  cityMarkers.forEach(({ nation, x, y }) => {
    const rise = heightAt(nation, x, y) + 4;
    const beacon = new THREE.Group();
    beacon.position.set(x - 500, rise, y - 310);
    const ring = new THREE.Mesh(new THREE.RingGeometry(7, 8.7, 24), new THREE.MeshBasicMaterial({ color: '#e5c995', side: THREE.DoubleSide, transparent: true, opacity: .85, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    beacon.add(ring);
    const needle = new THREE.Mesh(new THREE.ConeGeometry(2.8, 13, 6), new THREE.MeshBasicMaterial({ color: '#cde8d6' }));
    needle.position.y = 8;
    beacon.add(needle);
    beacon.visible = false;
    world.add(beacon);
    cityBeacons.push({ beacon, ring });
  });

  const raycaster = new THREE.Raycaster();
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let width = 0;
  let height = 0;
  let activeNation = null;
  let visible = false;
  let animationFrame = 0;
  let lastFrame = 0;
  let currentState = null;
  let unavailable = false;

  function resize() {
    const nextWidth = viewport.clientWidth;
    const nextHeight = viewport.clientHeight;
    if (nextWidth === width && nextHeight === height) return;
    width = nextWidth;
    height = nextHeight;
    renderer.setSize(width, height, false);
  }

  function projectMarker(marker, lift) {
    const { nation, x, y, button } = marker;
    const local = new THREE.Vector3(x - 500, heightAt(nation, x, y) + lift, y - 310);
    const point = world.localToWorld(local).project(camera);
    button.style.left = `${(point.x + 1) * width / 2}px`;
    button.style.top = `${(1 - point.y) * height / 2}px`;
    return point;
  }

  function draw() {
    if (!unavailable) renderer.render(scene, camera);
  }

  const adapter = {
    update(state, showCities) {
      if (unavailable) return;
      currentState = state;
      resize();
      const aspect = width / Math.max(1, height);
      world.scale.set(aspect < .9 ? .52 : 1, 1, aspect < .9 ? 1.25 : 1);
      world.updateMatrixWorld(true);
      const viewWidth = (aspect < .9 ? 520 : 1180) / state.scale;
      const viewHeight = viewWidth / aspect;
      camera.left = -viewWidth / 2;
      camera.right = viewWidth / 2;
      camera.top = viewHeight / 2;
      camera.bottom = -viewHeight / 2;
      camera.updateProjectionMatrix();
      const azimuth = state.angle * Math.PI / 180;
      const tilt = state.tilt * Math.PI / 180;
      const unitsPerPixel = viewWidth / Math.max(1, width);
      const panX = -state.x * unitsPerPixel;
      const panZ = -state.y * unitsPerPixel / Math.max(.3, Math.cos(tilt));
      const targetX = panX * Math.cos(azimuth) + panZ * Math.sin(azimuth);
      const targetZ = -panX * Math.sin(azimuth) + panZ * Math.cos(azimuth);
      const target = new THREE.Vector3(targetX, 0, targetZ);
      camera.position.set(targetX + 950 * Math.sin(azimuth) * Math.sin(tilt), 950 * Math.cos(tilt), targetZ + 950 * Math.cos(azimuth) * Math.sin(tilt));
      camera.lookAt(target);
      camera.updateMatrixWorld();
      nationMarkers.forEach(marker => {
        const point = projectMarker(marker, 17);
        const anchor = nationAnchors.get(marker.nation);
        anchor.style.left = `${(point.x + 1) * width / 2}px`;
        anchor.style.top = `${(1 - point.y) * height / 2}px`;
      });
      cityMarkers.forEach(marker => projectMarker(marker, 23));
      cityBeacons.forEach(({ beacon }) => { beacon.visible = showCities; });
      draw();
    },
    pickNation(clientX, clientY) {
      const rect = viewport.getBoundingClientRect();
      raycaster.setFromCamera(new THREE.Vector2(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1
      ), camera);
      return raycaster.intersectObjects(pickMeshes, false)[0]?.object.userData.nation || null;
    },
    anchorForNation(nation) { return nationAnchors.get(nation); },
    setActive(nation) {
      if (nation === activeNation) return;
      activeNation = nation;
      nationMeshes.forEach((mesh, id) => {
        mesh.material[0].emissive.set(id === nation ? '#7c6849' : '#000000');
        mesh.material[0].emissiveIntensity = id === nation ? .36 : 0;
      });
      draw();
    },
    resetMarkers() {
      [...nationMarkers, ...cityMarkers].forEach(({ button, originalLeft, originalTop }) => {
        button.style.left = originalLeft;
        button.style.top = originalTop;
      });
      nationAnchors.forEach(anchor => anchor.remove());
    }
  };

  renderer.domElement.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    unavailable = true;
    cancelAnimationFrame(animationFrame);
    observer.disconnect();
    resizeObserver.disconnect();
    window.atlasMap.disconnect3D(adapter);
  });
  window.atlasMap.connect3D(adapter);
  const observer = new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    if (visible && !reducedMotion.matches && !animationFrame) animationFrame = requestAnimationFrame(animate);
    if (!visible) { cancelAnimationFrame(animationFrame); animationFrame = 0; }
  }, { threshold: .01 });
  observer.observe(viewport);
  const resizeObserver = new ResizeObserver(() => { if (currentState) adapter.update(currentState, viewport.classList.contains('show-cities')); });
  resizeObserver.observe(viewport);

  function animate(now) {
    animationFrame = requestAnimationFrame(animate);
    if (!visible || now - lastFrame < 33) return;
    lastFrame = now;
    cityBeacons.forEach(({ ring }, index) => {
      const pulse = 1 + .13 * Math.sin(now * .0021 + index * .8);
      ring.scale.set(pulse, pulse, 1);
    });
    draw();
  }
}

try { init3D(); } catch (error) { console.error('3D atlas setup failed; SVG atlas remains active.', error); }
