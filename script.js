const menuButton = document.querySelector('.menu-toggle');
const mobileNav = document.querySelector('.mobile-nav');

if (menuButton && mobileNav) {
  menuButton.addEventListener('click', () => {
    const isOpen = menuButton.getAttribute('aria-expanded') === 'true';
    menuButton.setAttribute('aria-expanded', String(!isOpen));
    menuButton.setAttribute('aria-label', isOpen ? '메뉴 열기' : '메뉴 닫기');
    mobileNav.hidden = isOpen;
  });
  mobileNav.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
    menuButton.setAttribute('aria-expanded', 'false');
    menuButton.setAttribute('aria-label', '메뉴 열기');
    mobileNav.hidden = true;
  }));
}

const siteHeader = document.querySelector('.site-header');
const sectionLinks = [...document.querySelectorAll('.desktop-nav a, .mobile-nav a')];
const pageSections = [...document.querySelectorAll('main > section[id]')];
let scrollUpdateQueued = false;
function updateScrollNavigation() {
  scrollUpdateQueued = false;
  siteHeader.classList.toggle('is-scrolled', window.scrollY > 24);
  const travel = document.documentElement.scrollHeight - window.innerHeight;
  siteHeader.style.setProperty('--scroll-progress', `${travel > 0 ? Math.min(100, window.scrollY / travel * 100) : 0}%`);
  const marker = siteHeader.offsetHeight + 70;
  let currentId = '';
  pageSections.forEach(section => {
    if (section.getBoundingClientRect().top <= marker) currentId = section.id;
  });
  sectionLinks.forEach(link => {
    if (link.getAttribute('href') === `#${currentId}`) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  });
}
function queueScrollNavigation() {
  if (scrollUpdateQueued) return;
  scrollUpdateQueued = true;
  requestAnimationFrame(updateScrollNavigation);
}
window.addEventListener('scroll', queueScrollNavigation, { passive: true });
window.addEventListener('resize', queueScrollNavigation);
queueScrollNavigation();

const deckTabs = [...document.querySelectorAll('[data-deck]')];
const deckPanels = [...document.querySelectorAll('[data-panel]')];
function showDeck(id, focus = false) {
  deckTabs.forEach(tab => {
    const active = tab.dataset.deck === id;
    tab.setAttribute('aria-selected', String(active));
    tab.tabIndex = active ? 0 : -1;
    if (active && focus) tab.focus();
  });
  deckPanels.forEach(panel => { panel.hidden = panel.dataset.panel !== id; });
}
deckTabs.forEach((tab, index) => {
  tab.addEventListener('click', () => showDeck(tab.dataset.deck));
  tab.addEventListener('keydown', event => {
    let nextIndex;
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') nextIndex = (index + 1) % deckTabs.length;
    if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') nextIndex = (index - 1 + deckTabs.length) % deckTabs.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = deckTabs.length - 1;
    if (nextIndex !== undefined) {
      event.preventDefault();
      showDeck(deckTabs[nextIndex].dataset.deck, true);
    }
  });
});

const entryCopy = {
  field: '브리핑실에서 장비를 받는다. 귀환 뒤에는 검사를 마쳐야 생활구역으로 올라갈 수 있다.',
  research: '배정된 시료를 분석한다. 격리구역에 들어가려면 별도 인가가 필요하다.',
  visitor: '승함 허가증이 있어도 모든 문이 열리지는 않는다. 안내받은 경로부터 확인하자.'
};
const entryResult = document.querySelector('#entry-result');
document.querySelectorAll('[data-entry]').forEach(button => {
  button.addEventListener('click', () => {
    document.querySelectorAll('[data-entry]').forEach(other => {
      const active = other === button;
      other.classList.toggle('active', active);
      other.setAttribute('aria-pressed', String(active));
    });
    entryResult.textContent = entryCopy[button.dataset.entry];
  });
});

function bindTabs(buttonSelector, panelSelector, buttonKey, panelKey) {
  const buttons = [...document.querySelectorAll(buttonSelector)];
  const panels = [...document.querySelectorAll(panelSelector)];
  function select(id, focus = false) {
    buttons.forEach(button => {
      const active = button.dataset[buttonKey] === id;
      button.setAttribute('aria-selected', String(active));
      button.tabIndex = active ? 0 : -1;
      if (active && focus) button.focus();
    });
    panels.forEach(panel => { panel.hidden = panel.dataset[panelKey] !== id; });
  }
  buttons.forEach((button, index) => {
    button.addEventListener('click', () => select(button.dataset[buttonKey]));
    button.addEventListener('keydown', event => {
      let next;
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % buttons.length;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index - 1 + buttons.length) % buttons.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = buttons.length - 1;
      if (next !== undefined) { event.preventDefault(); select(buttons[next].dataset[buttonKey], true); }
    });
  });
}

bindTabs('[data-nation]', '[data-nation-panel]', 'nation', 'nationPanel');
bindTabs('[data-era]', '[data-era-panel]', 'era', 'eraPanel');

const routes = {
  return: ['격납고', '장비 반납', '검사', '보고', '생활구역'],
  medical: ['격납고 · 작전구역', '응급 전용통로', '의료센터'],
  hazard: ['위험물 회수도크', '원격 계측 · 제염', '밀폐승강기', '심부 격리실']
};
const routeOutput = document.querySelector('#route-output');
function showRoute(key) {
  document.querySelectorAll('[data-route]').forEach(button => {
    const active = button.dataset.route === key;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  routeOutput.replaceChildren();
  routes[key].forEach((label, index) => {
    if (index) {
      const arrow = document.createElement('span');
      arrow.className = 'route-arrow';
      arrow.setAttribute('aria-hidden', 'true');
      arrow.textContent = '→';
      routeOutput.append(arrow);
    }
    const step = document.createElement('span');
    step.className = 'route-step';
    const number = document.createElement('b');
    number.textContent = String(index + 1).padStart(2, '0');
    step.append(number, document.createTextNode(label));
    routeOutput.append(step);
  });
}
document.querySelectorAll('[data-route]').forEach(button => button.addEventListener('click', () => showRoute(button.dataset.route)));
showRoute('return');

// Only official roles and public-facing duties are used here. Four names remain UI samples.
const personnel = [
  {role:'최고집행관',group:'command',name:'이름 미정',duty:'중대한 헌장 위반이나 국가 간 위기에서 특별집행을 맡는다. 긴급명령은 72시간 안에 판정원의 심사를 받는다.',area:'판정·외교 구역 / 집행 구역',number:'01'},
  {role:'아스트라이아 함장',group:'command',name:'리아 벤트 · 임시 이름',duty:'항로와 접안, 함체 안전을 책임진다. 비상시에는 승조원의 대피와 함내 통제를 지휘한다.',area:'함교 / 비상지휘실 / 중앙 생활구역',number:'02'},
  {role:'수석판정관',group:'command',name:'이름 미정',duty:'제출된 증거로 헌장사건의 책임과 조치를 판정한다. 조사 중인 가설은 확인되기 전까지 판정의 근거가 될 수 없다.',area:'중앙 판정실 / 판정 구역',number:'03'},
  {role:'아스트라이아 조사책임자',group:'investigation',name:'이름 미정',duty:'함의 조사관을 이끈다. 헌장사건과 실종, 변칙체 관련 현장을 조사하고 확인된 증거를 판정원에 넘긴다.',area:'조사국 / 증거분석실 / 현장',number:'04'},
  {role:'집행국장',group:'field',name:'이름 미정',duty:'집행국의 인원과 장비, 부대 배치를 총괄한다. 아스트라이아를 주요 전방 지휘거점으로 쓴다.',area:'집행국 / 현장지휘실 / 격납고',number:'05'},
  {role:'의료책임자',group:'care',name:'이름 미정',duty:'승조원과 부상자, 매질 노출자를 진료한다. 임무에 복귀할 수 있는지도 판단한다.',area:'의료센터 / 응급실 / 재활구역',number:'06'},
  {role:'합성체 정비책임자',group:'care',name:'노아 르벨 · 임시 이름',duty:'합성체의 신체진단과 정비, 재활을 맡는다. 의료센터와 협력하지만 개인의 복원 기록은 별도로 보호한다.',area:'합성체 정비동 / 공용 진단구역',number:'07'},
  {role:'격리·변칙체 연구책임자',group:'field',name:'이름 미정',duty:'오염 매질과 미확인 회수품을 분석하고 격리한다. 심부 출입에는 담당 임무에 맞는 인가가 필요하다.',area:'심부 격리구역 / 분석실 / 회수도크',number:'08'},
  {role:'현장집행 지휘관',group:'field',name:'이름 미정',duty:'함의 현장 부대를 출격시키고 현지에서 지휘한다. 구조와 호송, 회수 작전에 나선다.',area:'브리핑실 / 격납고 / 현장',number:'09'},
  {role:'부함장·작전항해',group:'operation',name:'이름 미정',duty:'함장의 결정을 일정과 인력, 항로로 옮긴다. 함장이 다른 업무에 묶이면 함교 실무를 맡는다.',area:'함교 / 운항통제 / 비상지휘',number:'10'},
  {role:'기록책임자',group:'investigation',name:'마렌 소르 · 임시 이름',duty:'헌장사건과 실종자, 사망자, 변칙체 관측기록을 보존한다. 봉인된 원본을 열람하려면 별도 인가가 필요하다.',area:'기록원 / 제한보관고 / 조사국',number:'11'},
  {role:'기관·기술책임자',group:'operation',name:'이름 미정',duty:'추진과 발전, 공조와 비상폐쇄를 관리한다. 함장이 항로를 정할 때 기술적 한계를 알린다.',area:'기관구역 / 정비고 / 함교',number:'12'},
  {role:'제2 현장집행 지휘관',group:'field',name:'이안 케스트 · 임시 이름',duty:'현장집행 지휘관을 보조한다. 호위와 회수, 구조 임무를 맡을 수 있지만 고정된 분장은 아직 정해지지 않았다.',area:'집행구역 / 격납고 / 현장',number:'13'},
  {role:'보급·행정책임자',group:'operation',name:'이름 미정',duty:'식량과 부품을 접안지와 계약처에서 조달한다. 승조원 행정도 맡는다.',area:'중앙 행정구역 / 보급창 / 화물 접안구',number:'14'}
];

const directoryList = document.querySelector('#directory-list');
const directoryDetail = document.querySelector('#directory-detail-text');
let activePerson = '01';
let activeFilter = 'all';
function showPerson(person) {
  activePerson = person.number;
  directoryList.querySelectorAll('button').forEach(button => button.classList.toggle('active', button.dataset.person === activePerson));
  directoryDetail.replaceChildren();
  const code = document.createElement('small'); code.textContent = `PERSONNEL / ${person.number}`;
  const title = document.createElement('h4'); title.textContent = person.role;
  const name = document.createElement('p'); name.className = 'provisional-name'; name.textContent = person.name;
  const duty = document.createElement('p'); duty.className = 'role-description'; duty.textContent = person.duty;
  const meta = document.createElement('div'); meta.className = 'detail-meta';
  const areaLabel = document.createElement('span'); areaLabel.textContent = 'PRIMARY AREA / 주요 활동 구역';
  const area = document.createElement('p'); area.textContent = person.area;
  meta.append(areaLabel, area);
  const access = document.createElement('span'); access.className = 'detail-access'; access.textContent = '직책 정보 공개 · 개인 설정 미정';
  directoryDetail.append(code, title, name, duty, meta, access);
}
function renderPersonnel() {
  const visible = personnel.filter(person => activeFilter === 'all' || person.group === activeFilter);
  if (!visible.some(person => person.number === activePerson)) activePerson = visible[0].number;
  directoryList.replaceChildren();
  visible.forEach(person => {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'directory-item'; button.dataset.person = person.number;
    const number = document.createElement('b'); number.textContent = person.number;
    const content = document.createElement('span');
    const role = document.createElement('strong'); role.textContent = person.role;
    const name = document.createElement('small'); name.textContent = person.name;
    content.append(role, name);
    const arrow = document.createElement('span'); arrow.textContent = '↗'; arrow.setAttribute('aria-hidden', 'true');
    button.append(number, content, arrow);
    button.addEventListener('click', () => showPerson(person));
    directoryList.append(button);
  });
  showPerson(visible.find(person => person.number === activePerson));
}
document.querySelectorAll('[data-person-filter]').forEach(button => button.addEventListener('click', () => {
  activeFilter = button.dataset.personFilter;
  document.querySelectorAll('[data-person-filter]').forEach(other => {
    const active = other === button;
    other.classList.toggle('active', active);
    other.setAttribute('aria-pressed', String(active));
  });
  renderPersonnel();
}));
renderPersonnel();
