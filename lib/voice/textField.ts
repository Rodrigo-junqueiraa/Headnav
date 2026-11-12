const TEXT_INPUT_TYPES = new Set(['text', 'search', 'url', 'email', 'tel']);

export function asTextField(element: Element | null): HTMLElement | null {
  if (element instanceof HTMLInputElement) {
    return TEXT_INPUT_TYPES.has(element.type) && !element.readOnly && !element.disabled ? element : null;
  }
  if (element instanceof HTMLTextAreaElement) {
    return !element.readOnly && !element.disabled ? element : null;
  }
  if (element instanceof HTMLElement && element.isContentEditable) return element;
  return null;
}

export function deepActiveElement(): Element | null {
  let active = document.activeElement;
  while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
  return active;
}

export function findTextField(clicked: Element): HTMLElement | null {
  return asTextField(clicked) ?? asTextField(deepActiveElement());
}
