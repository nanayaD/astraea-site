import * as THREE from './vendor/three/three.module.js';

const viewport = document.querySelector('#atlas-viewport');
const canvasHost = document.querySelector('#atlas-webgl');
const atlasCanvas = document.querySelector('#atlas-canvas');
const landPath = document.querySelector('#atlas-land');
const nationButtons = [...document.querySelectorAll('.atlas-nation')];
const cityButtons = [...document.querySelectorAll('.atlas-city')];
let elevationGrid;
let citySites = [];
const nationColors = {
  dravan: '#67c4d3', kalden: '#b1e8ed', serein: '#80d3eb'
};

const citySurveyLoads = new Map();
function loadCitySurvey(id) {
  if (citySurveyLoads.has(id)) return citySurveyLoads.get(id);
  const request = fetch(`./assets/cities/city-${id}-v3.bin`).then(async response => {
    if (!response.ok) throw new Error(`City survey ${id}: ${response.status}`);
    const buffer = await response.arrayBuffer();
    const view = new DataView(buffer);
    if (view.getUint32(0, true) !== 0x33545341) throw new Error(`Invalid city survey: ${id}`);
    const buildingCount = view.getUint32(4, true);
    const terrainCount = view.getUint32(8, true);
    if (buffer.byteLength !== 12 + (buildingCount + terrainCount) * 24) {
      throw new Error(`Incomplete city survey: ${id}`);
    }
    const geometry = (offset, count) => {
      const positions = new Float32Array(buffer, offset, count * 6);
      const result = new THREE.BufferGeometry();
      result.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      return result;
    };
    return {
      buildings: geometry(12, buildingCount),
      terrain: geometry(12 + buildingCount * 24, terrainCount)
    };
  }).catch(error => {
    citySurveyLoads.delete(id);
    throw error;
  });
  citySurveyLoads.set(id, request);
  return request;
}

function baseHeightAt(x, y) {
  const gx = Math.max(0, Math.min(511, x / 1000 * 511));
  const gy = Math.max(0, Math.min(287, y / 620 * 287));
  const ix = Math.min(510, Math.floor(gx));
  const iy = Math.min(286, Math.floor(gy));
  const fx = gx - ix, fy = gy - iy;
  const at = (px, py) => elevationGrid[py * 512 + px];
  const a = at(ix, iy) * (1 - fx) + at(ix + 1, iy) * fx;
  const b = at(ix, iy + 1) * (1 - fx) + at(ix + 1, iy + 1) * fx;
  return 2 + (a * (1 - fy) + b * fy) * .043;
}

function heightAt(_nation, x, y) {
  const natural = baseHeightAt(x, y);
  let weight = 0;
  let graded = 0;
  for (const site of citySites) {
    const distance = Math.hypot(x - site.x, y - site.y);
    if (distance >= 110) continue;
    const t = Math.max(0, Math.min(1, (distance - 68) / 42));
    const smooth = t * t * (3 - 2 * t);
    const influence = (1 - smooth) ** 4;
    weight += influence;
    graded += influence * site.height;
  }
  return weight ? natural * (1 - Math.min(1, weight)) + graded / weight * Math.min(1, weight) : natural;
}

function nationAt(x, y) {
  const west = y < 310 ? 338 + (y - 100) * .53 : 450 + (y - 310) * .07;
  if (x < west) return 'dravan';
  const south = 320 + 22 * Math.sin((x - 450) * .012) + (x - 450) * .07;
  return y < south ? 'kalden' : 'serein';
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
  const step = 12;
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

function terrainDots(outline) {
  const positions = [];
  const colors = [];
  const colorCache = Object.fromEntries(Object.entries(nationColors).map(([nation, value]) =>
    [nation, new THREE.Color(value)]));
  const light = new THREE.Color('#effdff');
  const step = 5.3;
  for (let y = 55; y < 570; y += step) {
    for (let x = 50; x < 935; x += step) {
      if (!contains(outline, x, y)) continue;
      const rise = heightAt(null, x, y);
      positions.push(x - 500, rise + 2.8, y - 310);
      const color = colorCache[nationAt(x, y)].clone().lerp(light, .28 + Math.min(.32, rise / 180));
      color.multiplyScalar(.66 + Math.min(.3, rise / 170) + .08 * (y / 620));
      colors.push(color.r, color.g, color.b);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const halo = new THREE.Points(geometry, new THREE.PointsMaterial({
    size: 4.5, sizeAttenuation: false, vertexColors: true,
    transparent: true, opacity: .09, depthWrite: false, blending: THREE.AdditiveBlending
  }));
  const core = new THREE.Points(geometry, new THREE.PointsMaterial({
    size: 1.6, sizeAttenuation: false, vertexColors: true,
    transparent: true, opacity: .8, depthWrite: false, blending: THREE.AdditiveBlending
  }));
  return { halo, core };
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
  const ground = new THREE.GridHelper(1500, 90, '#42657a', '#244454');
  ground.position.y = -22;
  ground.material.transparent = true;
  ground.material.opacity = .1;
  ground.material.depthWrite = false;
  scene.add(ground);
  const world = new THREE.Group();
  scene.add(world);
  const pickMeshes = [];
  const cityPickMeshes = [];
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

  const outline = outlinePoints(landPath);
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
  plate.userData.land = true;
  world.add(plate);
  pickMeshes.push(plate);
  const geometry = terrainGeometry('kalden', outline);
  const surface = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
    side: THREE.DoubleSide, colorWrite: false, depthWrite: false
  }));
  surface.userData.land = true;
  world.add(surface);
  pickMeshes.push(surface);
  const dots = terrainDots(outline);
  world.add(dots.halo, dots.core);

  cityMarkers.forEach(({ nation, x, y, id }) => {
    const rise = heightAt(nation, x, y);
    const beacon = new THREE.Group();
    beacon.position.set(x - 500, rise, y - 310);
    beacon.scale.set(.7, 1, .7);
    const platform = new THREE.Mesh(new THREE.BoxGeometry(100, 3, 96), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
    platform.position.y = 2;
    platform.userData.city = id;
    beacon.add(platform);
    cityPickMeshes.push(platform);
    beacon.visible = true;
    world.add(beacon);
    cityBeacons.push({ id, beacon, survey: null, surveyLoading: false, revealStarted: 0 });
  });

  function nearbyCities(id) {
    const center = cityMarkers.find(marker => marker.id === id);
    if (!center) return [];
    return cityMarkers.filter(marker => marker.id !== id)
      .map(marker => ({ id: marker.id, distance: Math.hypot(marker.x - center.x, marker.y - center.y) }))
      .filter(marker => marker.distance < 210)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 2)
      .map(marker => marker.id);
  }

  function surveyVisible(city, scale) {
    return Boolean(focusedCity && scale > 1.9
      && (city.id === focusedCity || nearbyCityIds.has(city.id)));
  }

  async function showCitySurvey(id) {
    const city = cityBeacons.find(item => item.id === id);
    if (!city || city.survey || city.surveyLoading) return;
    city.surveyLoading = true;
    try {
      const { buildings, terrain } = await loadCitySurvey(id);
      const marker = cityMarkers.find(item => item.id === id);
      const fitToLand = source => {
        const input = source.getAttribute('position').array;
        const structure = [];
        const detail = [];
        const densityScale = Math.max(1, Math.min(1.5, 850 / viewport.clientWidth));
        for (let i = 0; i < input.length; i += 6) {
          const ax = input[i], az = input[i + 2], bx = input[i + 3], bz = input[i + 5];
          if (!contains(outline, marker.x + ax * .7, marker.y + az * .7)
            || !contains(outline, marker.x + bx * .7, marker.y + bz * .7)) continue;
          const length = Math.hypot(input[i] - input[i + 3], input[i + 1] - input[i + 4], az - bz);
          if (length < .8 * densityScale) continue;
          const points = length >= 2 * densityScale ? structure : detail;
          for (let j = 0; j < 6; j += 3) {
            const x = input[i + j];
            const z = input[i + j + 2];
            points.push(x, input[i + j + 1] + 3, z);
          }
        }
        return [structure, detail].map(points => {
          const geometry = new THREE.BufferGeometry();
          geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
          return geometry;
        });
      };
      const group = new THREE.Group();
      const [structure, detail] = fitToLand(buildings);
      const targetOpacity = id === 'korga' ? [.13, .012] : [.16, .02];
      [structure, detail].forEach((geometry, index) => {
        group.add(new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({
          color: '#6fd5e6', transparent: true,
          opacity: reducedMotion.matches ? targetOpacity[index] : 0, depthWrite: false
        })));
      });
      terrain.dispose();
      buildings.dispose();
      city.beacon.add(group);
      city.survey = group;
      city.targetOpacity = targetOpacity;
      city.revealStarted = focusedCity === id || nearbyCityIds.has(id) ? performance.now() : 0;
      if (currentState) adapter.update(currentState, viewport.classList.contains('show-cities'));
    } catch (error) {
      console.warn('City survey could not be loaded.', error);
    } finally {
      city.surveyLoading = false;
    }
  }

  const raycaster = new THREE.Raycaster();
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let width = 0;
  let height = 0;
  let activeNation = null;
  let focusedCity = null;
  let nearbyCityIds = new Set();
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

  function updateSurveyOpacity(city, scale, now) {
    if (!city.survey) return;
    const reveal = reducedMotion.matches ? 1 : Math.max(0, Math.min(1, (now - city.revealStarted) / 350));
    const zoom = Math.max(0, Math.min(1, (scale - 1.9) / .45));
    const isNearby = city.id !== focusedCity && nearbyCityIds.has(city.id);
    city.survey.children.forEach((lines, index) => {
      const strength = isNearby ? (index === 0 ? .32 : .12) : 1;
      lines.material.opacity = city.targetOpacity[index] * strength * reveal * zoom;
    });
  }

  const horizontalScale = (aspect, scale) => aspect < .9
    ? .52 + .48 * Math.max(0, Math.min(1, (scale - 1.48) / 1.52)) : 1;

  const adapter = {
    update(state, showCities) {
      if (unavailable) return;
      currentState = state;
      resize();
      const aspect = width / Math.max(1, height);
      const perspective = Math.max(0, Math.min(1, (state.tilt - 48) / 10));
      dots.core.material.size = 1.6 - .25 * perspective;
      dots.halo.material.size = 4.5 - .8 * perspective;
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
      cityBeacons.forEach(city => {
        city.beacon.visible = !focusedCity || focusedCity === city.id || nearbyCityIds.has(city.id);
        if (city.survey) city.survey.visible = surveyVisible(city, state.scale);
        updateSurveyOpacity(city, state.scale, performance.now());
      });
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
      return { ...view, x: -panX / unitsPerPixel + (type === 'city' && aspect >= .9 ? 80 : 0),
        y: -panZ * Math.cos(tilt) / unitsPerPixel, focusY };
    },
    pickFeature(clientX, clientY) {
      const rect = viewport.getBoundingClientRect();
      raycaster.setFromCamera(new THREE.Vector2(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1
      ), camera);
      const showCities = viewport.classList.contains('show-cities');
      const hit = raycaster.intersectObjects(showCities ? [...cityPickMeshes, ...pickMeshes] : pickMeshes, false)[0];
      if (hit?.object.userData.city) return { type: 'city', id: hit.object.userData.city };
      if (hit?.object.userData.land) {
        const local = world.worldToLocal(hit.point.clone());
        return { type: 'nation', id: nationAt(local.x + 500, local.z + 310) };
      }
      return null;
    },
    anchorForNation(nation) { return nationAnchors.get(nation); },
    nearbyCities,
    setFocusCity(id) {
      focusedCity = id;
      nearbyCityIds = new Set(id ? nearbyCities(id) : []);
      if (id) [id, ...nearbyCityIds].forEach(cityId => showCitySurvey(cityId));
      cityBeacons.forEach(city => {
        city.beacon.visible = !id || id === city.id || nearbyCityIds.has(city.id);
        if (city.survey) city.survey.visible = surveyVisible(city, currentState?.scale ?? 1);
        if (city.survey && (id === city.id || nearbyCityIds.has(city.id))) {
          city.revealStarted = performance.now();
          updateSurveyOpacity(city, currentState?.scale ?? 1, city.revealStarted);
        }
      });
      draw();
    },
    setActive(nation) {
      if (nation === activeNation) return;
      activeNation = nation;
      if (nation) cityMarkers.filter(marker => marker.nation === nation)
        .forEach(marker => { loadCitySurvey(marker.id).catch(() => {}); });
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
    cityBeacons.forEach(city => updateSurveyOpacity(city, currentState?.scale ?? 1, now));
    draw();
  }
}

async function start3D() {
  try {
    const response = await fetch('./assets/atlas-elevation.bin');
    if (!response.ok) throw new Error(`Atlas elevation: ${response.status}`);
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength !== 512 * 288 * 2) throw new Error('Invalid atlas elevation grid');
    elevationGrid = new Uint16Array(buffer);
    citySites = cityButtons.map(button => {
      const x = parseFloat(button.style.left) * 10;
      const y = parseFloat(button.style.top) * 6.2;
      return { x, y, height: baseHeightAt(x, y) };
    });
    init3D();
  } catch (error) {
    console.error('3D atlas setup failed; SVG atlas remains active.', error);
  }
}

start3D();
