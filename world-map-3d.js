import * as THREE from './vendor/three/three.module.js';

const viewport = document.querySelector('#atlas-viewport');
const canvasHost = document.querySelector('#atlas-webgl');
const atlasCanvas = document.querySelector('#atlas-canvas');
const nationPaths = [...document.querySelectorAll('.atlas-region[data-map-nation]')];
const nationButtons = [...document.querySelectorAll('.atlas-nation')];
const cityButtons = [...document.querySelectorAll('.atlas-city')];
const peaks = {
  dravan: [[239, 289, 72, 68, 82], [287, 433, 92, 57, 72], [122, 328, 28, 48, 76]],
  kalden: [[486, 139, 63, 139, 92], [638, 171, 43, 124, 85], [748, 234, 26, 65, 59]],
  serein: [[544, 384, 26, 79, 77], [666, 468, 19, 107, 79]]
};
const nationColors = {
  dravan: '#72d9db', kalden: '#a5e9f0', serein: '#80c9e9'
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

function terrainDots(nation, outline, glow = false, mobile = false) {
  const positions = [];
  const colors = [];
  const base = new THREE.Color(nationColors[nation]);
  const high = new THREE.Color('#e4faff');
  const step = mobile ? 16 : glow ? 18 : 9;
  for (let y = 45, row = 0; y < 580; y += step, row += 1) {
    for (let x = 48 + (row % 2) * step / 2; x < 908; x += step) {
      if (!contains(outline, x, y)) continue;
      const rise = heightAt(nation, x, y);
      positions.push(x - 500, rise + 2.8, y - 310);
      const color = base.clone().lerp(high, Math.min(.72, rise / 130));
      colors.push(color.r, color.g, color.b);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return new THREE.Points(geometry, new THREE.PointsMaterial({
    size: glow ? 5.5 : mobile ? 2.3 : 2.15, sizeAttenuation: false, vertexColors: true,
    transparent: true, opacity: glow ? .16 : .86, depthWrite: false,
    blending: glow ? THREE.AdditiveBlending : THREE.NormalBlending
  }));
}

function lineModel(cityIndex, nation) {
  const lines = [];
  const nodes = [];
  const segment = (a, b) => lines.push(...a, ...b);
  const box = (cx, cz, width, depth, height, detail = 7) => {
    const x0 = cx - width / 2; const x1 = cx + width / 2;
    const z0 = cz - depth / 2; const z1 = cz + depth / 2;
    const corners = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
    for (let level = 0; level <= detail; level += 1) {
      const elevation = 2 + height * level / detail;
      corners.forEach(([x, z], index) => {
        const [nx, nz] = corners[(index + 1) % 4];
        segment([x, elevation, z], [nx, elevation, nz]);
        if (level === detail) nodes.push(x, elevation, z);
      });
    }
    for (const [x, z] of corners) segment([x, 2, z], [x, height + 2, z]);
    for (let fraction = 1; fraction < 4; fraction += 1) {
      const x = x0 + width * fraction / 4;
      const z = z0 + depth * fraction / 4;
      segment([x, 2, z0], [x, height + 2, z0]);
      segment([x, 2, z1], [x, height + 2, z1]);
      segment([x0, 2, z], [x0, height + 2, z]);
      segment([x1, 2, z], [x1, height + 2, z]);
    }
  };
  // A common survey model, with different skylines for the administrative,
  // industrial, port, mining and former-front city records.
  for (let row = -2; row <= 2; row += 1) {
    for (let column = -2; column <= 2; column += 1) {
      if ((row === 0 && column === 0) || (Math.abs(row) === 2 && Math.abs(column) === 2)) continue;
      const seed = Math.abs(cityIndex * 17 + row * 11 + column * 7);
      const height = 10 + (seed % 5) * 7 + (cityIndex === 1 || cityIndex === 7 ? 7 : 0);
      box(column * 16.5, row * 16, 10 + seed % 4, 10 + seed % 3, height, 4 + seed % 3);
    }
  }
  const civicHeight = [68, 46, 35, 60, 42, 31, 78, 52, 29][cityIndex];
  box(0, 0, cityIndex === 1 || cityIndex === 4 ? 25 : 17, 18, civicHeight, 11);
  for (let at = -48; at <= 48; at += 8) {
    segment([-50, 1.5, at], [50, 1.5, at]);
    segment([at, 1.5, -48], [at, 1.5, 48]);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3));
  const group = new THREE.Group();
  group.add(new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({
    color: nationColors[nation], transparent: true, opacity: .63,
    depthWrite: false, blending: THREE.AdditiveBlending
  })));
  const nodeGeometry = new THREE.BufferGeometry();
  nodeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(nodes, 3));
  group.add(new THREE.Points(nodeGeometry, new THREE.PointsMaterial({
    color: '#e0fcff', size: 2.8, sizeAttenuation: false, transparent: true,
    opacity: .9, depthWrite: false, blending: THREE.AdditiveBlending
  })));
  return group;
}

function mapMarkers(buttons, nationOf) {
  return buttons.map(button => ({
    button,
    id: button.dataset.mapCity || button.dataset.mapNation,
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
  renderer.setClearColor('#061624');
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  canvasHost.append(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2('#061624', .00033);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 4000);
  const ground = new THREE.GridHelper(1500, 60, '#315c70', '#173a4c');
  ground.position.y = -22;
  ground.material.transparent = true;
  ground.material.opacity = .24;
  ground.material.depthWrite = false;
  scene.add(ground);
  const world = new THREE.Group();
  scene.add(world);
  const pickMeshes = [];
  const cityPickMeshes = [];
  const nationMeshes = new Map();
  const terrainWires = [];
  const terrainPointLayers = [];
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
    const plateGeometry = new THREE.ShapeGeometry(shape);
    plateGeometry.rotateX(Math.PI / 2);
    const plate = new THREE.Mesh(plateGeometry, new THREE.MeshBasicMaterial({
      side: THREE.DoubleSide, colorWrite: false, depthWrite: false
    }));
    plate.userData.nation = nation;
    world.add(plate);
    pickMeshes.push(plate);

    const geometry = terrainGeometry(nation, outline);
    const surface = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
      side: THREE.DoubleSide, colorWrite: false, depthWrite: false
    }));
    surface.userData.nation = nation;
    world.add(surface);
    pickMeshes.push(surface);
    const meshLines = new THREE.LineSegments(new THREE.WireframeGeometry(geometry), new THREE.LineBasicMaterial({
      color: nationColors[nation], transparent: true, opacity: .17, depthWrite: false,
      blending: THREE.AdditiveBlending
    }));
    meshLines.renderOrder = 2;
    world.add(meshLines);
    terrainWires.push(meshLines);
    const halo = terrainDots(nation, outline, true);
    const detail = terrainDots(nation, outline);
    const compact = terrainDots(nation, outline, false, true);
    world.add(halo, detail, compact);
    terrainPointLayers.push({ halo, detail, compact });

    const topEdge = outline.map(({ x, y }) => new THREE.Vector3(x - 500, heightAt(nation, x, y) + 2.5, y - 310));
    const lowerEdge = outline.map(({ x, y }) => new THREE.Vector3(x - 500, -14, y - 310));
    const border = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(topEdge), new THREE.LineBasicMaterial({
      color: nationColors[nation], transparent: true, opacity: .72, depthWrite: false
    }));
    world.add(border);
    const studs = [];
    for (let index = 0; index < outline.length; index += 12) studs.push(...topEdge[index].toArray(), ...lowerEdge[index].toArray());
    const studGeometry = new THREE.BufferGeometry();
    studGeometry.setAttribute('position', new THREE.Float32BufferAttribute(studs, 3));
    world.add(new THREE.LineSegments(studGeometry, new THREE.LineBasicMaterial({ color: nationColors[nation], transparent: true, opacity: .18, depthWrite: false })));
    nationMeshes.set(nation, border);
  });

  cityMarkers.forEach(({ nation, x, y, id }, cityIndex) => {
    const rise = heightAt(nation, x, y) + 4;
    const beacon = new THREE.Group();
    beacon.position.set(x - 500, rise, y - 310);
    const platform = new THREE.Mesh(new THREE.BoxGeometry(100, 3, 96), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
    platform.position.y = 1;
    platform.userData.city = id;
    beacon.add(platform);
    cityPickMeshes.push(platform);
    beacon.add(lineModel(cityIndex, nation));
    const ring = new THREE.Mesh(new THREE.RingGeometry(54, 54.5, 64), new THREE.MeshBasicMaterial({ color: '#b5f5ff', side: THREE.DoubleSide, transparent: true, opacity: .4, depthWrite: false, blending: THREE.AdditiveBlending }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 1.2;
    beacon.add(ring);
    beacon.visible = false;
    world.add(beacon);
    cityBeacons.push({ id, beacon, ring });
  });

  const raycaster = new THREE.Raycaster();
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let width = 0;
  let height = 0;
  let activeNation = null;
  let focusedCity = null;
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

  const horizontalScale = (aspect, scale) => aspect < .9
    ? .52 + .48 * Math.max(0, Math.min(1, (scale - 1.48) / 1.52)) : 1;

  const adapter = {
    update(state, showCities) {
      if (unavailable) return;
      currentState = state;
      resize();
      const aspect = width / Math.max(1, height);
      terrainWires.forEach(wire => { wire.material.opacity = aspect < .9 ? .045 : .17; });
      terrainPointLayers.forEach(({ halo, detail, compact }) => {
        halo.visible = detail.visible = aspect >= .9;
        compact.visible = aspect < .9;
      });
      world.scale.set(horizontalScale(aspect, state.scale), 1, aspect < .9 ? 1.25 : 1);
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
      const target = new THREE.Vector3(targetX, state.focusY, targetZ);
      camera.position.set(targetX + 950 * Math.sin(azimuth) * Math.sin(tilt), state.focusY + 950 * Math.cos(tilt), targetZ + 950 * Math.cos(azimuth) * Math.sin(tilt));
      camera.lookAt(target);
      camera.updateMatrixWorld();
      nationMarkers.forEach(marker => {
        const point = projectMarker(marker, 17);
        const anchor = nationAnchors.get(marker.nation);
        anchor.style.left = `${(point.x + 1) * width / 2}px`;
        anchor.style.top = `${(1 - point.y) * height / 2}px`;
      });
      cityMarkers.forEach(marker => projectMarker(marker, 48));
      cityBeacons.forEach(({ id, beacon }) => { beacon.visible = showCities && (!focusedCity || focusedCity === id); });
      draw();
    },
    focusFor(type, id, view) {
      const marker = (type === 'city' ? cityMarkers : nationMarkers).find(item => item.id === id);
      if (!marker) return view;
      const aspect = width / Math.max(1, height);
      const xScale = horizontalScale(aspect, view.scale);
      const zScale = aspect < .9 ? 1.25 : 1;
      const targetX = (marker.x - 500) * xScale;
      const targetZ = (marker.y - 310) * zScale;
      const azimuth = view.angle * Math.PI / 180;
      const tilt = view.tilt * Math.PI / 180;
      const viewWidth = (aspect < .9 ? 520 : 1180) / view.scale;
      const unitsPerPixel = viewWidth / Math.max(1, width);
      const panX = targetX * Math.cos(azimuth) - targetZ * Math.sin(azimuth);
      const panZ = targetX * Math.sin(azimuth) + targetZ * Math.cos(azimuth);
      const focusY = heightAt(marker.nation, marker.x, marker.y) * (type === 'city' ? 1 : .42)
        + (type === 'city' ? (aspect < .9 ? -38 : 16) : 0);
      return { ...view, x: -panX / unitsPerPixel, y: -panZ * Math.cos(tilt) / unitsPerPixel, focusY };
    },
    pickFeature(clientX, clientY) {
      const rect = viewport.getBoundingClientRect();
      raycaster.setFromCamera(new THREE.Vector2(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1
      ), camera);
      const showCities = viewport.classList.contains('show-cities');
      const hit = raycaster.intersectObjects(showCities ? [...cityPickMeshes, ...pickMeshes] : pickMeshes, false)[0]?.object;
      if (hit?.userData.city) return { type: 'city', id: hit.userData.city };
      if (hit?.userData.nation) return { type: 'nation', id: hit.userData.nation };
      return null;
    },
    anchorForNation(nation) { return nationAnchors.get(nation); },
    setFocusCity(id) {
      focusedCity = id;
      cityBeacons.forEach(({ id: cityId, beacon }) => {
        beacon.visible = viewport.classList.contains('show-cities') && (!id || id === cityId);
      });
      draw();
    },
    setActive(nation) {
      if (nation === activeNation) return;
      activeNation = nation;
      nationMeshes.forEach((line, id) => {
        line.material.opacity = id === nation ? 1 : .72;
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
