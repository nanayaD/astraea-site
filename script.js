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
