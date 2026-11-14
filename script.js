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
  field: '출격과 귀환 사이에서, 당신의 판단이 누군가의 다음 하루를 바꾼다.',
  research: '미지의 현상 앞에서 당신은 한 줄의 관측, 하나의 설계로 길을 만든다.',
  visitor: '당신은 이곳에 머물 이유를 찾는다. 공식적인 일일 수도, 아주 개인적인 일일 수도 있다.'
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
  {role:'최고집행관',group:'command',name:'이름 미정',duty:'중대한 헌장 위반과 국가 간 충돌, 전략급 재난에서 특별집행을 맡습니다. 함내 판정·외교와 현장 집행을 연결합니다.',area:'판정·외교 구역 / 집행 구역',number:'01'},
  {role:'아스트라이아 함장',group:'command',name:'리아 벤트 · 임시 이름',duty:'항로와 접안, 선체 안전, 승조원 생활과 함내 비상통제를 책임집니다. 운항과 임무가 충돌할 때 함의 안전을 판단합니다.',area:'함교 / 비상지휘실 / 중앙 생활구역',number:'02'},
  {role:'수석판정관',group:'command',name:'이름 미정',duty:'확보된 증거를 바탕으로 헌장사건의 책임과 조치를 판정합니다. 비공개 심리와 미공개 증거는 사건 인가를 따릅니다.',area:'중앙 판정실 / 판정 구역',number:'03'},
  {role:'아스트라이아 조사책임자',group:'investigation',name:'이름 미정',duty:'함의 조사인력을 이끌고 헌장사건과 전쟁 잔재, 실종과 변칙체 관련 사건을 조사합니다. 확인된 증거와 연구 가설을 구분합니다.',area:'조사국 / 증거분석실 / 현장',number:'04'},
  {role:'집행국장',group:'field',name:'이름 미정',duty:'기구 집행국의 인력·훈련·장비와 전력 배분을 총괄합니다. 아스트라이아는 주요 전방 지휘거점 중 하나입니다.',area:'집행국 / 현장지휘실 / 격납고',number:'05'},
  {role:'의료책임자',group:'care',name:'이름 미정',duty:'승조원과 부상자, 매질 노출자의 진료 및 임무 복귀 적합성을 판단합니다. 환자의 개인 의료기록은 보호됩니다.',area:'의료센터 / 응급실 / 재활구역',number:'06'},
  {role:'합성체 정비책임자',group:'care',name:'노아 르벨 · 임시 이름',duty:'합성체의 신체진단과 정비, 복원과 재활을 담당합니다. 의료진과 협력하며 신체에 대한 당사자의 결정을 존중합니다.',area:'합성체 정비동 / 공용 진단구역',number:'07'},
  {role:'격리·변칙체 연구책임자',group:'field',name:'이름 미정',duty:'오염 매질과 미확인 회수품의 분석·격리를 맡습니다. 공개되지 않은 표본과 가설은 사건의 시점과 인가를 따릅니다.',area:'심부 격리구역 / 분석실 / 회수도크',number:'08'},
  {role:'현장집행 지휘관',group:'field',name:'이름 미정',duty:'아스트라이아 상주 집행전력의 출격준비와 배속 전력의 전술지휘를 맡습니다. 구조·회수·호송 현장으로 이어집니다.',area:'브리핑실 / 격납고 / 현장',number:'09'},
  {role:'부함장·작전항해',group:'operation',name:'이름 미정',duty:'함장의 결정을 실제 일정과 인력, 항로로 옮기고 함교와 운항체계의 실무를 관리합니다.',area:'함교 / 운항통제 / 비상지휘',number:'10'},
  {role:'기록책임자',group:'investigation',name:'마렌 소르 · 임시 이름',duty:'헌장사건과 실종·사망, 전쟁과 변칙체 관측기록을 보존하고 열람을 관리합니다. 봉인 원본은 별도 인가가 필요합니다.',area:'기록원 / 제한보관고 / 조사국',number:'11'},
  {role:'기관·기술책임자',group:'operation',name:'이름 미정',duty:'추진과 발전, 함체 수리, 공조와 비상폐쇄의 기술 운용을 맡습니다. 안전 조건을 함장과 관련 부서에 알립니다.',area:'기관구역 / 정비고 / 함교',number:'12'},
  {role:'제2 현장집행 지휘관',group:'field',name:'이안 케스트 · 임시 이름',duty:'주 지휘관을 보조하고 조사팀 호위·회수·구출·호송 등의 현장지휘를 맡을 수 있습니다. 구체적 작전 분장은 추후 확정됩니다.',area:'집행구역 / 격납고 / 현장',number:'13'},
  {role:'보급·행정책임자',group:'operation',name:'이름 미정',duty:'식량과 생활물자, 장비 보급 및 외부 조달과 승조원 행정을 맡습니다. 계약과 예산의 세부는 업무 인가를 따릅니다.',area:'중앙 행정구역 / 보급창 / 화물 접안구',number:'14'}
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
  const access = document.createElement('span'); access.className = 'detail-access'; access.textContent = '공개 업무 개요 · 개인 기록 준비 중';
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
