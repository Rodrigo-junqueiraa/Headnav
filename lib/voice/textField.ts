const TEXT_INPUT_TYPES = new Set(['text', 'search', 'url', 'email', 'tel']);
const SEARCH_NAMES = new Set(['q', 'query', 'search', 'search_query', 's', 'k', 'p', 'keyword', 'keywords', 'term']);
const SEARCH_WORDS = /search|results|pesquis|busca|procur/i;
const ENTER_KEY: KeyboardEventInit = { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true, cancelable: true };

type FormField = HTMLInputElement | HTMLTextAreaElement;

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

function isFormField(field: HTMLElement): field is FormField {
  return field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement;
}

export function isSearchField(field: HTMLElement): boolean {
  if (!isFormField(field)) return false;
  if (field instanceof HTMLInputElement && field.type === 'search') return true;
  if (field.getAttribute('role') === 'searchbox') return true;
  if (field.closest('[role="search"]')) return true;
  if (SEARCH_NAMES.has(field.name.toLowerCase())) return true;
  if (SEARCH_WORDS.test(field.form?.getAttribute('action') ?? '')) return true;
  const hints = [field.id, field.getAttribute('aria-label'), field.getAttribute('placeholder'), field.title];
  return SEARCH_WORDS.test(hints.join(' '));
}

function setNativeValue(field: FormField, value: string): void {
  const prototype = field instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
  if (setter) setter.call(field, value);
  else field.value = value;
}

function placeCaretAtEnd(field: FormField): boolean {
  try {
    field.setSelectionRange(field.value.length, field.value.length);
    return true;
  } catch {
    return false;
  }
}

function joinWithSpace(existing: string, text: string): string {
  return existing.trim() !== '' && !/\s$/.test(existing) ? ` ${text}` : text;
}

function insertIntoFormField(field: FormField, text: string, replace: boolean): void {
  const existing = field.value;
  const piece = replace ? text : joinWithSpace(existing, text);
  if (replace) field.select();
  const caretReady = replace || placeCaretAtEnd(field);
  if (caretReady && document.execCommand('insertText', false, piece)) return;
  setNativeValue(field, replace ? piece : existing + piece);
  field.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: piece }));
}

function insertIntoEditable(field: HTMLElement, text: string): void {
  const selection = window.getSelection();
  selection?.selectAllChildren(field);
  selection?.collapseToEnd();
  document.execCommand('insertText', false, joinWithSpace(field.textContent ?? '', text));
}

export function insertDictation(field: HTMLElement, text: string, replace: boolean): void {
  field.focus({ preventScroll: true });
  if (isFormField(field)) insertIntoFormField(field, text, replace);
  else insertIntoEditable(field, text);
}

export function submitSearch(field: HTMLElement): void {
  const form = field.closest('form');
  if (form) {
    try {
      form.requestSubmit();
      return;
    } catch {
      form.submit();
      return;
    }
  }
  for (const type of ['keydown', 'keypress', 'keyup']) {
    field.dispatchEvent(new KeyboardEvent(type, ENTER_KEY));
  }
}
