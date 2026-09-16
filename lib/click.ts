const CLICKABLE_SELECTOR = [
  'a[href]',
  'button',
  'input',
  'select',
  'textarea',
  'label',
  'summary',
  '[contenteditable]:not([contenteditable="false"])',
  '[onclick]',
  '[role="button"]',
  '[role="link"]',
  '[role="checkbox"]',
  '[role="radio"]',
  '[role="switch"]',
  '[role="tab"]',
  '[role="menuitem"]',
  '[role="option"]',
].join(', ');

export type ClickTarget = {
  element: Element;
  clickable: Element;
};

export function findClickTarget(x: number, y: number): ClickTarget | null {
  const element = document.elementFromPoint(x, y);
  if (!element) return null;

  const clickable = element.closest(CLICKABLE_SELECTOR);
  if (clickable) return { element, clickable };

  return getComputedStyle(element).cursor === 'pointer' ? { element, clickable: element } : null;
}

export function performClick(target: ClickTarget, x: number, y: number): void {
  const mouseInit: MouseEventInit = {
    bubbles: true,
    cancelable: true,
    composed: true,
    view: window,
    clientX: x,
    clientY: y,
    button: 0,
  };
  const pointerInit: PointerEventInit = { ...mouseInit, pointerId: 1, pointerType: 'mouse', isPrimary: true };
  const { element, clickable } = target;

  element.dispatchEvent(new PointerEvent('pointerdown', { ...pointerInit, buttons: 1 }));
  element.dispatchEvent(new MouseEvent('mousedown', { ...mouseInit, buttons: 1 }));
  if (clickable instanceof HTMLElement) clickable.focus({ preventScroll: true });
  element.dispatchEvent(new PointerEvent('pointerup', pointerInit));
  element.dispatchEvent(new MouseEvent('mouseup', mouseInit));
  element.dispatchEvent(new MouseEvent('click', mouseInit));
}
