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
const overviewState = { x: 0, y: 0, scale: 1, angle: 0, tilt: 48, focusY: 0 };
const mapState = { ...overviewState };
let atlas3d = null;
let flightFrame = 0;
let flightToken = 0;

function shapeCoast() {
  const d = window.astraeaCoastPath;
  if (!d) return;
  document.querySelector('#atlas-land').setAttribute('d', d);
  document.querySelector('#atlas-land-clip path').setAttribute('d', d);
}

shapeCoast();

function buildTerrainMesh() {
  const svg = atlasCanvas.querySelector('.atlas-svg');
  const terrainLayer = svg.querySelector('#atlas-terrain');
  const ns = 'http://www.w3.org/2000/svg';
  const make = (name, attributes = {}) => {
    const element = document.createElementNS(ns, name);
    Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
    return element;
  };

  const surface = make('g', { 'clip-path': 'url(#atlas-land-clip)' });
  surface.append(make('rect', { x: 0, y: 0, width: 1000, height: 620, fill: '#326d77', opacity: .055 }));
  surface.append(make('rect', { x: 0, y: 0, width: 1000, height: 620, fill: 'url(#atlas-dots)' }));
  terrainLayer.append(surface);
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
  let left = atlas3d && activeSelection?.type === 'city' && centerX > host.width * .45
    ? centerX - width - 42 : centerX + 22;
  if (left + width > host.width - 15) left = centerX - width - 22;
  atlasPopup.style.left = `${clamp(left, 15, Math.max(15, host.width - width - 15))}px`;
  atlasPopup.style.top = `${clamp(centerY - height / 2, 15, Math.max(15, host.height - height - 15))}px`;
}

function applyMap() {
  mapState.scale = clamp(mapState.scale, .8, atlas3d ? 3.3 : 2.5);
  mapState.tilt = clamp(mapState.tilt, 20, 70);
  if (atlas3d && mapState.scale < 1.9 && atlasViewport.classList.contains('is-city-focus') && !atlasViewport.classList.contains('is-flying')) {
    setFocusedCity(null);
    if (activeSelection?.type === 'city') closePopup();
  }
  const showCities = mapState.scale >= cityRevealScale;
  if (atlasViewport.classList.contains('show-cities') !== showCities) {
    closePopup();
    atlasViewport.classList.toggle('show-cities', showCities);
  }
  const xLimit = atlasViewport.clientWidth * mapState.scale * .65;
  const yLimit = atlasViewport.clientHeight * mapState.scale * .65;
  mapState.x = clamp(mapState.x, -xLimit, xLimit);
  mapState.y = clamp(mapState.y, -yLimit, yLimit);
  if (atlas3d) {
    atlasCanvas.style.transform = 'none';
    atlasCanvas.style.setProperty('--counter-angle', '0deg');
    atlas3d.update(mapState, showCities);
  } else {
    atlasCanvas.style.transform = `translate(${mapState.x}px, ${mapState.y}px) rotate(${mapState.angle}deg) scale(${mapState.scale})`;
    atlasCanvas.style.setProperty('--counter-angle', `${-mapState.angle}deg`);
  }
  document.querySelector('#atlas-zoom').textContent = `${Math.round(mapState.scale * 100)}%`;
  document.querySelector('#atlas-angle').textContent = `${Math.round(mapState.angle)}°`;
  document.querySelector('#atlas-layer').textContent = showCities ? 'CITIES' : 'NATIONS';
  document.querySelector('#atlas-compass-needle').style.transform = `rotate(${-mapState.angle}deg)`;
  requestAnimationFrame(positionPopup);
}

function cancelFlight() {
  flightToken += 1;
  if (flightFrame) cancelAnimationFrame(flightFrame);
  flightFrame = 0;
  atlasViewport.classList.remove('is-flying');
}

function flyTo(target, duration, complete) {
  cancelFlight();
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    Object.assign(mapState, target);
    applyMap();
    complete?.();
    return;
  }
  const token = flightToken;
  const from = { ...mapState };
  const started = performance.now();
  atlasViewport.classList.add('is-flying');
  const frame = now => {
    if (token !== flightToken) return;
    const progress = clamp((now - started) / duration, 0, 1);
    const eased = progress < .5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2;
    for (const key of ['x', 'y', 'scale', 'angle', 'tilt', 'focusY']) {
      mapState[key] = from[key] + (target[key] - from[key]) * eased;
    }
    applyMap();
    if (progress < 1) flightFrame = requestAnimationFrame(frame);
    else {
      flightFrame = 0;
      atlasViewport.classList.remove('is-flying');
      complete?.();
    }
  };
  flightFrame = requestAnimationFrame(frame);
}

function highlightSelection() {
  const nationId = activeSelection?.type === 'nation' ? activeSelection.id : atlasCities[activeSelection?.id]?.nation;
  nationRegions.forEach(region => region.classList.toggle('is-active', region.dataset.mapNation === nationId));
  nationMarkers.forEach(marker => marker.classList.toggle('is-active', activeSelection?.type === 'nation' && marker.dataset.mapNation === activeSelection.id));
  cityMarkers.forEach(marker => marker.classList.toggle('is-active', activeSelection?.type === 'city' && marker.dataset.mapCity === activeSelection.id));
  atlas3d?.setActive(nationId);
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
  const show = () => showPopup({
    code: nation.code, title: nation.name, subtitle: nation.subtitle, copy: nation.copy,
    links: atlas3d ? nation.cities.map(cityId => ({
      label: atlasCities[cityId].name,
      action: () => openCity(cityId, document.querySelector(`.atlas-city[data-map-city="${cityId}"]`))
    })) : []
  }, atlas3d ? atlas3d.anchorForNation(id) : anchor, { type: 'nation', id });
  if (!atlas3d) { show(); return; }
  closePopup();
  setFocusedCity(null);
  atlas3d.setActive(id);
  flyTo(atlas3d.focusFor('nation', id, { scale: 1.48, angle: 0, tilt: 58 }), 950, show);
}

function openCity(id, anchor) {
  if (!atlasViewport.classList.contains('show-cities')) return;
  const city = atlasCities[id];
  if (!city) return;
  const nation = atlasNations[city.nation];
  const show = () => showPopup({
    code: `${city.nation.toUpperCase()} / CITY FILE`,
    title: city.name,
    subtitle: `${nation.name} · ${city.subtitle}`,
    copy: city.copy,
    links: [{ label: `${nation.name} 보기`, action: () => openNation(city.nation, document.querySelector(`.atlas-region[data-map-nation="${city.nation}"]`)) }]
  }, anchor, { type: 'city', id });
  if (!atlas3d) { show(); return; }
  closePopup();
  setFocusedCity(id);
  atlas3d.setActive(city.nation);
  const sideAngle = ['brek', 'rienna', 'korga'].includes(id) ? -18 : 18;
  flyTo(atlas3d.focusFor('city', id, { scale: 3, angle: sideAngle, tilt: 70 }), 1100, show);
}

function setFocusedCity(id) {
  atlasViewport.classList.toggle('is-city-focus', Boolean(id));
  const nearby = new Set(id ? atlas3d?.nearbyCities(id) ?? [] : []);
  cityMarkers.forEach(marker => {
    marker.classList.toggle('is-focused', marker.dataset.mapCity === id);
    marker.classList.toggle('is-nearby', nearby.has(marker.dataset.mapCity));
  });
  atlas3d?.setFocusCity(id);
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
  if (button.dataset.mapControl === 'reset' && atlas3d) {
    closePopup();
    setFocusedCity(null);
    atlas3d.setActive(null);
    flyTo(overviewState, 850);
    return;
  }
  cancelFlight();
  switch (button.dataset.mapControl) {
    case 'zoom-in': mapState.scale *= 1.2; break;
    case 'zoom-out': mapState.scale /= 1.2; break;
    case 'rotate-left': mapState.angle -= 15; break;
    case 'rotate-right': mapState.angle += 15; break;
    case 'reset': Object.assign(mapState, overviewState); break;
  }
  applyMap();
}));

atlasViewport.addEventListener('wheel', event => {
  if (event.target.closest('.atlas-popup')) return;
  event.preventDefault();
  cancelFlight();
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
  cancelFlight();
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
  const pickedFeature = atlas3d && !movedDuringPointer && pointers.size === 1 && event.type === 'pointerup'
    ? atlas3d.pickFeature(event.clientX, event.clientY) : null;
  pointerRegions.delete(event.pointerId);
  pointers.delete(event.pointerId);
  if (movedDuringPointer || selectedRegion || pickedFeature) suppressMapClickUntil = Date.now() + 220;
  if (selectedRegion && !movedDuringPointer && event.type === 'pointerup') {
    openNation(selectedRegion, document.querySelector(`.atlas-region[data-map-nation="${selectedRegion}"]`));
  }
  if (pickedFeature?.type === 'city') openCity(pickedFeature.id, document.querySelector(`.atlas-city[data-map-city="${pickedFeature.id}"]`));
  else if (pickedFeature?.type === 'nation') openNation(pickedFeature.id);
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

window.atlasMap = {
  connect3D(adapter) {
    atlas3d = adapter;
    atlasViewport.classList.add('is-3d');
    applyMap();
  },
  disconnect3D(adapter) {
    if (atlas3d !== adapter) return;
    cancelFlight();
    setFocusedCity(null);
    atlas3d.resetMarkers();
    atlas3d = null;
    atlasViewport.classList.remove('is-3d');
    applyMap();
  }
};

applyMap();
