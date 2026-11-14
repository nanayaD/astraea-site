const samples = [
  {
    id: 'S-01', title: '봉인된 원광', source: '새 광맥', seal: '정상', kind: 'fresh',
    intro: '채굴 직후 수송된 원광. 겉면에는 손상이 보이지 않는다.',
    clues: [
      { label: '봉인 기록', text: '채굴 직후 차폐했다. 봉인은 한 번도 열리지 않았다.' },
      { label: '판독 결과', text: '다른 정보의 중첩이 적다. 새 상태를 기록할 여지가 크다.' }
    ],
    route: 'refining',
    success: '정밀 정제로 이송한다. 정보가 적게 섞인 시료는 의료와 합성체 제작에 쓰일 수 있다.',
    hint: '이 시료의 값은 이미 담긴 흔적보다, 아직 담을 수 있는 정보에 있다.'
  },
  {
    id: 'S-02', title: '전장의 파편', source: '폐전선', seal: '회수 봉인', kind: 'recovered',
    intro: '파손된 장비에서 나온 결정 조각. 회수 뒤에야 봉인했다.',
    clues: [
      { label: '회수 기록', text: '폐전선의 손상 장비에서 수거했다. 원래의 봉인 상태는 알 수 없다.' },
      { label: '판독 결과', text: '충격과 열의 변화가 여러 겹 남아 있다. 새 기록을 담기에는 부적합하다.' }
    ],
    route: 'evidence',
    success: '증거 분석으로 이송한다. 파편에 남은 흔적은 다른 현장 기록과 대조한다.',
    hint: '이미 남은 흔적을 읽어야 한다. 새 기록을 위한 시료는 아니다.'
  },
  {
    id: 'S-03', title: '출처 미상의 시료', source: '미확인', seal: '파손', kind: 'unknown',
    intro: '인수 서류와 포장 상태가 맞지 않는다. 정식 판독 전에는 사용처를 정할 수 없다.',
    clues: [
      { label: '인수 기록', text: '채굴지와 최초 봉인 시각이 비어 있다. 이전 보관처도 확인되지 않았다.' },
      { label: '포장 상태', text: '외부 포장이 깨져 있다. 노출 범위와 정보 중첩 상태는 아직 모른다.' }
    ],
    route: 'isolation',
    success: '심부 격리로 이송한다. 출처와 노출 상태를 확인한 뒤에야 다음 처리를 정한다.',
    hint: '새 기록을 담을 수 있는지, 지난 흔적을 읽을 수 있는지 아직 판단할 자료가 없다.'
  }
];

const inspected = samples.map(() => new Set());
const solved = new Set();
let current = 0;

const caseSelect = document.querySelector('#case-select');
const clueList = document.querySelector('#clue-list');
const routeButtons = [...document.querySelectorAll('[data-route-choice]')];
const feedback = document.querySelector('#case-feedback');
const nextButton = document.querySelector('#next-case');

function updateProgress() {
  document.querySelector('#progress-count').textContent = `${String(solved.size).padStart(2, '0')} / 03`;
  document.querySelector('#progress-fill').style.width = `${solved.size / samples.length * 100}%`;
  document.querySelector('#mission-complete').hidden = solved.size !== samples.length;
}

function renderSelect() {
  caseSelect.replaceChildren();
  samples.forEach((sample, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'case-choice';
    if (index === current) button.classList.add('active');
    if (solved.has(index)) button.classList.add('done');
    button.setAttribute('aria-pressed', String(index === current));
    const number = document.createElement('span');
    number.textContent = `0${index + 1} / ${sample.id}`;
    const title = document.createElement('strong');
    title.textContent = sample.title;
    const state = document.createElement('small');
    state.textContent = solved.has(index) ? '이송 완료 ✓' : '기록 열기 ↗';
    button.append(number, title, state);
    button.addEventListener('click', () => selectSample(index));
    caseSelect.append(button);
  });
}

function updateRouting() {
  const ready = inspected[current].size === samples[current].clues.length;
  const done = solved.has(current);
  document.querySelector('#clue-count').textContent = `${inspected[current].size} / ${samples[current].clues.length} 확인`;
  document.querySelector('#routing-hint').textContent = done ? '이송 완료. 다른 시료의 기록을 열 수 있다.' : ready ? '기록을 확인했다. 이송처를 지정한다.' : '판독 항목 두 개를 확인하면 이송처를 고를 수 있다.';
  routeButtons.forEach(button => {
    button.disabled = !ready || done;
    button.classList.toggle('correct', done && button.dataset.routeChoice === samples[current].route);
  });
  const next = samples.findIndex((_, index) => !solved.has(index));
  nextButton.hidden = !done || next === -1;
}

function renderClues() {
  clueList.replaceChildren();
  samples[current].clues.forEach((clue, index) => {
    const opened = inspected[current].has(index);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'clue-button';
    button.setAttribute('aria-expanded', String(opened));
    const label = document.createElement('span');
    label.textContent = `0${index + 1} / ${clue.label}`;
    const action = document.createElement('strong');
    action.textContent = opened ? '확인됨 ✓' : '열람 +';
    const detail = document.createElement('small');
    detail.textContent = opened ? clue.text : '기록을 열어 확인한다.';
    button.append(label, action, detail);
    button.addEventListener('click', () => {
      if (inspected[current].has(index)) return;
      inspected[current].add(index);
      renderClues();
      updateRouting();
    });
    clueList.append(button);
  });
}

function selectSample(index) {
  current = index;
  const sample = samples[index];
  document.querySelector('#sample-code').textContent = sample.id;
  document.querySelector('#sample-source').textContent = `SOURCE / ${sample.source}`;
  document.querySelector('#sample-seal').textContent = `SEAL / ${sample.seal}`;
  document.querySelector('#sample-visual').dataset.kind = sample.kind;
  document.querySelector('#case-kicker').textContent = `CASE 0${index + 1} / INTAKE`;
  document.querySelector('#case-title').textContent = sample.title;
  document.querySelector('#case-intro').textContent = sample.intro;
  document.querySelector('#case-stamp').textContent = solved.has(index) ? '이송 완료' : inspected[index].size ? '확인 중' : '미분류';
  feedback.textContent = solved.has(index) ? sample.success : '';
  feedback.classList.toggle('success', solved.has(index));
  renderSelect();
  renderClues();
  updateRouting();
}

routeButtons.forEach(button => button.addEventListener('click', () => {
  const sample = samples[current];
  if (inspected[current].size !== sample.clues.length || solved.has(current)) return;
  if (button.dataset.routeChoice !== sample.route) {
    feedback.textContent = sample.hint;
    feedback.classList.remove('success');
    return;
  }
  solved.add(current);
  feedback.textContent = sample.success;
  feedback.classList.add('success');
  document.querySelector('#case-stamp').textContent = '이송 완료';
  renderSelect();
  updateRouting();
  updateProgress();
  if (solved.size === samples.length) {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.querySelector('#mission-complete').scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
  }
}));

nextButton.addEventListener('click', () => {
  const next = samples.findIndex((_, index) => !solved.has(index));
  if (next >= 0) selectSample(next);
  document.querySelector('#case-board').scrollIntoView({ behavior: 'smooth', block: 'start' });
});

function resetMission() {
  inspected.forEach(set => set.clear());
  solved.clear();
  selectSample(0);
  updateProgress();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
document.querySelector('#reset-button').addEventListener('click', resetMission);
document.querySelector('#replay-button').addEventListener('click', resetMission);

selectSample(0);
updateProgress();
