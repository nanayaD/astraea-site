const atlasViewport = document.querySelector('#atlas-viewport');
const atlasCanvas = document.querySelector('#atlas-canvas');
const atlasInfo = document.querySelector('.atlas-info');
const nationTabs = [...document.querySelectorAll('.nation-tabs [data-nation]')];
const atlasTargets = [...document.querySelectorAll('#atlas [data-map-nation]')];

const mapState = { x: 0, y: 0, scale: 1, angle: 0 };
const pointers = new Map();
const pointerRegions = new Map();
let panStart = null;
let gestureStart = null;
let movedDuringPointer = false;
let suppressMapClickUntil = 0;

function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }

function applyMap() {
  mapState.scale = clamp(mapState.scale, .8, 2.5);
  const xLimit = atlasViewport.clientWidth * mapState.scale * .65;
  const yLimit = atlasViewport.clientHeight * mapState.scale * .65;
  mapState.x = clamp(mapState.x, -xLimit, xLimit);
  mapState.y = clamp(mapState.y, -yLimit, yLimit);
  atlasCanvas.style.transform = `translate(${mapState.x}px, ${mapState.y}px) rotate(${mapState.angle}deg) scale(${mapState.scale})`;
  atlasCanvas.style.setProperty('--counter-angle', `${-mapState.angle}deg`);
  document.querySelector('#atlas-zoom').textContent = `${Math.round(mapState.scale * 100)}%`;
  document.querySelector('#atlas-angle').textContent = `${Math.round(mapState.angle)}°`;
  document.querySelector('#atlas-compass-needle').style.transform = `rotate(${-mapState.angle}deg)`;
}

function updateNation(id) {
  const tab = nationTabs.find(item => item.dataset.nation === id);
  const panel = document.querySelector(`[data-nation-panel="${id}"]`);
  if (!tab || !panel) return;
  const number = ['kalden', 'serein', 'dravan'].indexOf(id) + 1;
  document.querySelector('#atlas-file').textContent = `${String(number).padStart(2, '0')} / ${id.toUpperCase()}`;
  document.querySelector('#atlas-glyph').textContent = id[0].toUpperCase();
  document.querySelector('#atlas-name').textContent = tab.querySelector('strong').textContent;
  document.querySelector('#atlas-theme').textContent = tab.querySelector('small').textContent;
  document.querySelector('#atlas-heading').textContent = panel.querySelector('h4').textContent;
  document.querySelector('#atlas-copy').textContent = panel.querySelector('p').textContent;
  const cities = document.querySelector('#atlas-city-list');
  cities.replaceChildren();
  panel.querySelectorAll('.city-list > span').forEach(city => {
    const label = document.createElement('span');
    label.textContent = city.firstChild.textContent.trim();
    cities.append(label);
  });
  atlasTargets.forEach(target => target.classList.toggle('is-active', target.dataset.mapNation === id));
}

function chooseNation(id) {
  const tab = nationTabs.find(item => item.dataset.nation === id);
  if (!tab) return;
  tab.click();
  updateNation(id);
}

atlasTargets.forEach(target => target.addEventListener('click', () => {
  if (Date.now() < suppressMapClickUntil) return;
  chooseNation(target.dataset.mapNation);
}));

nationTabs.forEach(tab => tab.addEventListener('click', () => updateNation(tab.dataset.nation)));
document.querySelector('.nation-tabs').addEventListener('keydown', event => {
  if (!['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
  queueMicrotask(() => {
    const selected = nationTabs.find(tab => tab.getAttribute('aria-selected') === 'true');
    if (selected) updateNation(selected.dataset.nation);
  });
});

document.querySelectorAll('[data-map-control]').forEach(button => button.addEventListener('click', () => {
  switch (button.dataset.mapControl) {
    case 'zoom-in': mapState.scale *= 1.2; break;
    case 'zoom-out': mapState.scale /= 1.2; break;
    case 'rotate-left': mapState.angle -= 15; break;
    case 'rotate-right': mapState.angle += 15; break;
    case 'reset': Object.assign(mapState, { x: 0, y: 0, scale: 1, angle: 0 }); break;
  }
  applyMap();
}));

atlasViewport.addEventListener('wheel', event => {
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
  if (event.target.closest('.atlas-tools, .atlas-pin')) return;
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
  if (selectedRegion && !movedDuringPointer && event.type === 'pointerup') chooseNation(selectedRegion);
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
window.addEventListener('resize', applyMap);

applyMap();
updateNation('kalden');
