const atlasNations = {
  kalden: {
    name: '칼덴', code: 'KALDEN / NATION 01', subtitle: '질서와 복무',
    copy: '군 병원과 국책 연구소가 메네사이트 기술을 관리한다. 하르벤의 관청과 토르크의 검문소는 같은 제도의 서로 다른 얼굴이다.',
    cities: ['harven', 'brek', 'tork']
  },
  serein: {
    name: '세레인', code: 'SEREIN / NATION 02', subtitle: '계약과 선택',
    copy: '정제시설과 고급 의료 서비스는 기업망 안에서 돌아간다. 리에나와 오르센에서 같은 기술에 닿는 방식은 계약에 따라 달라진다.',
    cities: ['rienna', 'belmar', 'orsen']
  },
  dravan: {
    name: '드라반', code: 'DRAVAN / NATION 03', subtitle: '자원과 현장',
    copy: '코르가의 광산과 라브칸의 폐전선에서 원광과 회수품이 나온다. 자원 곁에 살아도 고급 정제와 치료를 받기는 어렵다.',
    cities: ['bardan', 'korga', 'ravkan']
  }
};

const atlasCities = {
  harven: { name: '하르벤', nation: 'kalden', subtitle: '중앙행정', copy: '칼덴의 관청과 군 병원이 모여 있다. 메네사이트 관련 치료와 연구도 국가의 제도 안에서 관리된다.' },
  brek: { name: '브레크', nation: 'kalden', subtitle: '군수산업', copy: '칼덴의 군수산업 거점. 공장과 군의 수요가 맞닿는 도시다.' },
  tork: { name: '토르크', nation: 'kalden', subtitle: '국경', copy: '폐전선에 가까운 국경 도시. 검문소가 늘어섰고, 오가는 사람에게 신분과 복무 기록을 묻는다.' },
  rienna: { name: '리에나', nation: 'serein', subtitle: '기업수도', copy: '세레인의 기업수도. 역에서 병원까지 같은 기업의 이름이 보인다. 이용할 수 있는 서비스는 계약에 따라 달라진다.' },
  belmar: { name: '벨마르', nation: 'serein', subtitle: '항만공업', copy: '세레인의 항만공업 도시. 기업의 물류와 생산이 이곳을 지난다.' },
  orsen: { name: '오르센', nation: 'serein', subtitle: '구산업', copy: '철수한 회사의 간판과 오래된 기업병원이 남았다. 계약이 끝난 뒤에도 건물은 그대로 서 있다.' },
  bardan: { name: '바르단', nation: 'dravan', subtitle: '수도', copy: '드라반의 수도. 정부청사가 모여 있다. 광산과 폐전선에서 올라온 보고가 이곳에 닿는다.' },
  korga: { name: '코르가', nation: 'dravan', subtitle: '광산', copy: '메네사이트 원광이 나오는 광산 도시. 광맥 곁에 있어도 고급 정제시설과 치료에 쉽게 닿는 것은 아니다.' },
  ravkan: { name: '라브칸', nation: 'dravan', subtitle: '폐전선', copy: '폐전선 곁에서 시장과 병원이 돌아간다. 전장에서 나온 회수품도 이곳의 조사 대상이 된다.' }
};

const atlasViewport = document.querySelector('#atlas-viewport');
const atlasCanvas = document.querySelector('#atlas-canvas');
const atlasPopup = document.querySelector('#atlas-popup');
const nationMarkers = [...document.querySelectorAll('.atlas-nation')];
const cityMarkers = [...document.querySelectorAll('.atlas-city')];
const nationRegions = [...document.querySelectorAll('.atlas-region[data-map-nation]')];
const cityRevealScale = 1.25;
const mapState = { x: 0, y: 0, scale: .9, angle: 0 };

function buildTerrainMesh() {
  const svg = atlasCanvas.querySelector('.atlas-svg');
  const defs = svg.querySelector('defs');
  const depthLayer = svg.querySelector('#atlas-depth');
  const terrainLayer = svg.querySelector('#atlas-terrain');
  const ns = 'http://www.w3.org/2000/svg';
  const make = (name, attributes = {}) => {
    const element = document.createElementNS(ns, name);
    Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
    return element;
  };

  // These heights are visual placeholders; they make the survey grid rise into ridges.
  const peaks = [
    [176, 274, 54, 88, 76], [293, 387, 32, 88, 75],
    [490, 161, 63, 117, 80], [687, 189, 36, 94, 74],
    [619, 430, 48, 95, 77], [793, 436, 32, 83, 73]
  ];
  const heightAt = (x, y) => peaks.reduce((height, [px, py, elevation, rx, ry]) => {
    const dx = (x - px) / rx;
    const dy = (y - py) / ry;
    return height + elevation * Math.exp(-.5 * (dx * dx + dy * dy));
  }, 0);
  const step = 36;
  const columns = Math.ceil(1000 / step);
  const rows = Math.ceil(620 / step);
  const grid = Array.from({ length: rows + 1 }, (_, row) =>
    Array.from({ length: columns + 1 }, (_, column) => {
      const x = column * step;
      const y = row * step;
      const h = heightAt(x, y);
      return { x: x + h * .2, y: y - h * .86, h };
    })
  );
  const point = vertex => `${vertex.x.toFixed(1)} ${vertex.y.toFixed(1)}`;
  const facets = ['', '', '', '', ''];
  let rowsPath = '';
  let columnsPath = '';
  let diagonalsPath = '';

  grid.forEach(row => {
    rowsPath += `M ${point(row[0])} ` + row.slice(1).map(vertex => `L ${point(vertex)}`).join(' ') + ' ';
  });
  for (let column = 0; column <= columns; column += 1) {
    columnsPath += `M ${point(grid[0][column])} `;
    for (let row = 1; row <= rows; row += 1) columnsPath += `L ${point(grid[row][column])} `;
  }
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const topLeft = grid[row][column];
      const topRight = grid[row][column + 1];
      const bottomLeft = grid[row + 1][column];
      const bottomRight = grid[row + 1][column + 1];
      const rising = (row + column) % 2 === 0;
      const triangles = rising
        ? [[topLeft, topRight, bottomRight], [topLeft, bottomRight, bottomLeft]]
        : [[topLeft, topRight, bottomLeft], [topRight, bottomRight, bottomLeft]];
      diagonalsPath += rising
        ? `M ${point(topLeft)} L ${point(bottomRight)} `
        : `M ${point(topRight)} L ${point(bottomLeft)} `;
      triangles.forEach(triangle => {
        const averageHeight = triangle.reduce((sum, vertex) => sum + vertex.h, 0) / 3;
        const centerX = (column + .5) * step;
        const centerY = (row + .5) * step;
        const light = (heightAt(centerX - 12, centerY - 12) - heightAt(centerX + 12, centerY + 12)) * .12;
        const shade = Math.max(0, Math.min(4, Math.floor(1 + averageHeight * .045 + light)));
        facets[shade] += `M ${triangle.map(point).join(' L ')} Z `;
      });
    }
  }

  const geometry = make('g', { id: 'atlas-terrain-geometry' });
  facets.forEach((d, index) => geometry.append(make('path', { class: `atlas-facet atlas-facet-${index}`, d })));
  geometry.append(make('path', { class: 'atlas-mesh-diagonal', d: diagonalsPath }));
  geometry.append(make('path', { class: 'atlas-mesh-grid', d: rowsPath + columnsPath }));
  defs.append(geometry);

  const ridgeCenters = {
    dravan: [176, 274, 53],
    kalden: [490, 161, 62],
    serein: [619, 430, 47]
  };
  const ridgeFor = nation => {
    const [cx, cy, elevation] = ridgeCenters[nation];
    const ridge = make('g', { class: 'atlas-relief' });
    const ring = (radius, rise) => Array.from({ length: 10 }, (_, index) => {
      const angle = index * Math.PI / 5;
      const irregularity = 1 + .07 * Math.sin(index * 2.7 + cx);
      return {
        x: cx + elevation * .12 * rise + Math.cos(angle) * radius * irregularity,
        y: cy - elevation * rise + Math.sin(angle) * radius * .5 * irregularity
      };
    });
    const rings = [ring(81, 0), ring(50, .38), ring(19, .73)];
    for (let level = 0; level < rings.length - 1; level += 1) {
      for (let index = 0; index < 10; index += 1) {
        const next = (index + 1) % 10;
        ridge.append(make('path', {
          class: `atlas-relief-facet atlas-relief-facet-${index % 3}`,
          d: `M ${point(rings[level][index])} L ${point(rings[level][next])} L ${point(rings[level + 1][next])} L ${point(rings[level + 1][index])} Z`
        }));
        ridge.append(make('path', {
          class: 'atlas-relief-rib',
          d: `M ${point(rings[level][index])} L ${point(rings[level + 1][index])}`
        }));
      }
    }
    rings.forEach(vertices => ridge.append(make('path', {
      class: 'atlas-relief-ring',
      d: `M ${vertices.map(point).join(' L ')} Z`
    })));
    return ridge;
  };

  nationRegions.forEach(region => {
    const nation = region.dataset.mapNation;
    const outline = region.getAttribute('d');
    [24, 17, 9].forEach((offset, layer) => depthLayer.append(make('path', {
      class: `atlas-depth-slice atlas-depth-slice-${layer} atlas-depth-${nation}`,
      d: outline,
      transform: `translate(0 ${offset})`
    })));
    const clipId = `atlas-clip-${nation}`;
    const clip = make('clipPath', { id: clipId });
    clip.append(make('path', { d: outline }));
    defs.append(clip);
    const surface = make('g', { 'clip-path': `url(#${clipId})` });
    surface.append(make('use', { href: '#atlas-terrain-geometry' }));
    surface.append(ridgeFor(nation));
    surface.append(make('rect', { class: 'atlas-scan', x: -340, y: -20, width: 250, height: 690, fill: 'url(#atlas-scan-gradient)' }));
    terrainLayer.append(surface);
  });
}

buildTerrainMesh();
const pointers = new Map();
const pointerRegions = new Map();
let panStart = null;
let gestureStart = null;
let movedDuringPointer = false;
let suppressMapClickUntil = 0;
let activeSelection = null;
let popupAnchor = null;

function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }

function positionPopup() {
  if (atlasPopup.hidden || !popupAnchor || atlasViewport.clientWidth <= 560) return;
  const host = atlasViewport.getBoundingClientRect();
  const anchor = popupAnchor.getBoundingClientRect();
  const centerX = anchor.left + anchor.width / 2 - host.left;
  const centerY = anchor.top + anchor.height / 2 - host.top;
  const width = atlasPopup.offsetWidth;
  const height = atlasPopup.offsetHeight;
  let left = centerX + 22;
  if (left + width > host.width - 15) left = centerX - width - 22;
  atlasPopup.style.left = `${clamp(left, 15, Math.max(15, host.width - width - 15))}px`;
  atlasPopup.style.top = `${clamp(centerY - height / 2, 15, Math.max(15, host.height - height - 15))}px`;
}

function applyMap() {
  mapState.scale = clamp(mapState.scale, .8, 2.5);
  const showCities = mapState.scale >= cityRevealScale;
  if (atlasViewport.classList.contains('show-cities') !== showCities) {
    closePopup();
    atlasViewport.classList.toggle('show-cities', showCities);
  }
  const xLimit = atlasViewport.clientWidth * mapState.scale * .65;
  const yLimit = atlasViewport.clientHeight * mapState.scale * .65;
  mapState.x = clamp(mapState.x, -xLimit, xLimit);
  mapState.y = clamp(mapState.y, -yLimit, yLimit);
  atlasCanvas.style.transform = `translate(${mapState.x}px, ${mapState.y}px) rotate(${mapState.angle}deg) scale(${mapState.scale})`;
  atlasCanvas.style.setProperty('--counter-angle', `${-mapState.angle}deg`);
  document.querySelector('#atlas-zoom').textContent = `${Math.round(mapState.scale * 100)}%`;
  document.querySelector('#atlas-angle').textContent = `${Math.round(mapState.angle)}°`;
  document.querySelector('#atlas-layer').textContent = showCities ? 'CITIES' : 'NATIONS';
  document.querySelector('#atlas-compass-needle').style.transform = `rotate(${-mapState.angle}deg)`;
  requestAnimationFrame(positionPopup);
}

function highlightSelection() {
  const nationId = activeSelection?.type === 'nation' ? activeSelection.id : atlasCities[activeSelection?.id]?.nation;
  nationRegions.forEach(region => region.classList.toggle('is-active', region.dataset.mapNation === nationId));
  nationMarkers.forEach(marker => marker.classList.toggle('is-active', activeSelection?.type === 'nation' && marker.dataset.mapNation === activeSelection.id));
  cityMarkers.forEach(marker => marker.classList.toggle('is-active', activeSelection?.type === 'city' && marker.dataset.mapCity === activeSelection.id));
}

function showPopup({ code, title, subtitle, copy, links }, anchor, selection) {
  activeSelection = selection;
  popupAnchor = anchor;
  document.querySelector('#atlas-popup-code').textContent = code;
  document.querySelector('#atlas-popup-title').textContent = title;
  document.querySelector('#atlas-popup-subtitle').textContent = subtitle;
  document.querySelector('#atlas-popup-copy').textContent = copy;
  const linkBox = document.querySelector('#atlas-popup-links');
  linkBox.replaceChildren();
  links.forEach(link => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = link.label;
    button.addEventListener('click', link.action);
    linkBox.append(button);
  });
  atlasPopup.hidden = false;
  highlightSelection();
  positionPopup();
  document.querySelector('.atlas-popup-close').focus({ preventScroll: true });
}

function openNation(id, anchor) {
  const nation = atlasNations[id];
  if (!nation) return;
  showPopup({ code: nation.code, title: nation.name, subtitle: nation.subtitle, copy: nation.copy, links: [] }, anchor, { type: 'nation', id });
}

function openCity(id, anchor) {
  if (!atlasViewport.classList.contains('show-cities')) return;
  const city = atlasCities[id];
  if (!city) return;
  const nation = atlasNations[city.nation];
  showPopup({
    code: `${city.nation.toUpperCase()} / CITY FILE`,
    title: city.name,
    subtitle: `${nation.name} · ${city.subtitle}`,
    copy: city.copy,
    links: [{ label: `${nation.name} 보기`, action: () => openNation(city.nation, document.querySelector(`.atlas-region[data-map-nation="${city.nation}"]`)) }]
  }, anchor, { type: 'city', id });
}

function closePopup(returnFocus = false) {
  if (atlasPopup.hidden) return;
  const focusTarget = returnFocus && activeSelection?.type === 'city' ? popupAnchor : atlasViewport;
  atlasPopup.hidden = true;
  activeSelection = null;
  popupAnchor = null;
  highlightSelection();
  if (focusTarget?.focus) focusTarget.focus({ preventScroll: true });
}

nationMarkers.forEach(marker => marker.addEventListener('click', () => openNation(marker.dataset.mapNation, marker)));
cityMarkers.forEach(marker => marker.addEventListener('click', () => openCity(marker.dataset.mapCity, marker)));
nationRegions.forEach(region => region.addEventListener('click', () => {
  if (Date.now() < suppressMapClickUntil) return;
  openNation(region.dataset.mapNation, region);
}));
document.querySelector('.atlas-popup-close').addEventListener('click', () => closePopup(true));
document.addEventListener('keydown', event => { if (event.key === 'Escape') closePopup(true); });
atlasViewport.addEventListener('click', event => {
  if (Date.now() < suppressMapClickUntil) return;
  if (!event.target.closest('.atlas-nation, .atlas-city, .atlas-region, .atlas-tools, .atlas-popup')) closePopup();
});

document.querySelectorAll('[data-map-control]').forEach(button => button.addEventListener('click', () => {
  switch (button.dataset.mapControl) {
    case 'zoom-in': mapState.scale *= 1.2; break;
    case 'zoom-out': mapState.scale /= 1.2; break;
    case 'rotate-left': mapState.angle -= 15; break;
    case 'rotate-right': mapState.angle += 15; break;
    case 'reset': Object.assign(mapState, { x: 0, y: 0, scale: .9, angle: 0 }); break;
  }
  applyMap();
}));

atlasViewport.addEventListener('wheel', event => {
  if (event.target.closest('.atlas-popup')) return;
  event.preventDefault();
  mapState.scale *= event.deltaY < 0 ? 1.12 : 1 / 1.12;
  applyMap();
}, { passive: false });

function gestureSnapshot() {
  const [a, b] = [...pointers.values()];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return {
    distance: Math.hypot(dx, dy),
    angle: Math.atan2(dy, dx) * 180 / Math.PI,
    centerX: (a.x + b.x) / 2,
    centerY: (a.y + b.y) / 2
  };
}

atlasViewport.addEventListener('pointerdown', event => {
  if (event.target.closest('.atlas-tools, .atlas-nation, .atlas-city, .atlas-popup')) return;
  atlasViewport.setPointerCapture(event.pointerId);
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  const region = event.target.closest('.atlas-region[data-map-nation]');
  if (region) pointerRegions.set(event.pointerId, region.dataset.mapNation);
  if (pointers.size === 1) {
    panStart = { x: event.clientX, y: event.clientY, mapX: mapState.x, mapY: mapState.y };
    movedDuringPointer = false;
    atlasViewport.classList.add('is-dragging');
  } else if (pointers.size === 2) {
    gestureStart = { ...gestureSnapshot(), scale: mapState.scale, rotation: mapState.angle, mapX: mapState.x, mapY: mapState.y };
    atlasViewport.classList.add('is-gesturing');
  }
});

atlasViewport.addEventListener('pointermove', event => {
  if (!pointers.has(event.pointerId)) return;
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  if (pointers.size >= 2 && gestureStart) {
    const now = gestureSnapshot();
    if (Math.abs(now.distance - gestureStart.distance) > 3 || Math.abs(now.angle - gestureStart.angle) > 2 || Math.hypot(now.centerX - gestureStart.centerX, now.centerY - gestureStart.centerY) > 4) movedDuringPointer = true;
    mapState.scale = gestureStart.scale * (now.distance / Math.max(1, gestureStart.distance));
    mapState.angle = gestureStart.rotation + now.angle - gestureStart.angle;
    mapState.x = gestureStart.mapX + now.centerX - gestureStart.centerX;
    mapState.y = gestureStart.mapY + now.centerY - gestureStart.centerY;
  } else if (panStart) {
    const dx = event.clientX - panStart.x;
    const dy = event.clientY - panStart.y;
    if (Math.hypot(dx, dy) > 4) movedDuringPointer = true;
    mapState.x = panStart.mapX + dx;
    mapState.y = panStart.mapY + dy;
  }
  applyMap();
});

function finishPointer(event) {
  if (!pointers.has(event.pointerId)) return;
  const selectedRegion = pointerRegions.get(event.pointerId);
  pointerRegions.delete(event.pointerId);
  pointers.delete(event.pointerId);
  if (movedDuringPointer || selectedRegion) suppressMapClickUntil = Date.now() + 220;
  if (selectedRegion && !movedDuringPointer && event.type === 'pointerup') {
    openNation(selectedRegion, document.querySelector(`.atlas-region[data-map-nation="${selectedRegion}"]`));
  }
  if (pointers.size === 1) {
    const point = [...pointers.values()][0];
    panStart = { x: point.x, y: point.y, mapX: mapState.x, mapY: mapState.y };
    gestureStart = null;
    atlasViewport.classList.remove('is-gesturing');
  } else if (pointers.size === 0) {
    panStart = null;
    gestureStart = null;
    atlasViewport.classList.remove('is-dragging', 'is-gesturing');
  }
}
atlasViewport.addEventListener('pointerup', finishPointer);
atlasViewport.addEventListener('pointercancel', finishPointer);
atlasCanvas.addEventListener('transitionend', positionPopup);
window.addEventListener('resize', () => { applyMap(); positionPopup(); });

applyMap();
