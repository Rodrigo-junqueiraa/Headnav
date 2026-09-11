export default defineContentScript({
  matches: ['http://*/*', 'https://*/*'],
  main() {
    const CURSOR_ID = 'headnav-cursor';
    const SIZE = 28;

    if (document.getElementById(CURSOR_ID)) return;

    const cursor = document.createElement('div');
    cursor.id = CURSOR_ID;
    cursor.style.cssText = [
      'position: fixed',
      'top: 0',
      'left: 0',
      `width: ${SIZE}px`,
      `height: ${SIZE}px`,
      'border-radius: 50%',
      'border: 3px solid rgba(255, 255, 255, 0.95)',
      'background: rgba(37, 99, 235, 0.35)',
      'box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.55), 0 1px 6px rgba(0, 0, 0, 0.45)',
      'pointer-events: none',
      'z-index: 2147483647',
      'will-change: transform',
      'transition: transform 45ms linear',
    ].join('; ');

    const setPosition = (x: number, y: number): void => {
      cursor.style.transform = `translate(${x - SIZE / 2}px, ${y - SIZE / 2}px)`;
    };

    const attach = (): void => {
      document.body.appendChild(cursor);
      setPosition(window.innerWidth / 2, window.innerHeight / 2);
    };

    if (document.body) attach();
    else document.addEventListener('DOMContentLoaded', attach, { once: true });
  },
});
