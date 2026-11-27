/**
 * Installs a roving-tabindex keyboard fallback on a `role="toolbar"` container ONLY when native
 * HTML `focusgroup` is unsupported in the current browser.
 */
export function attachToolbarRovingTabindexFallback(toolbar: HTMLElement): () => void {
  if ('focusGroup' in HTMLElement.prototype) {
    return () => {};
  }

  const getItems = (): HTMLElement[] =>
    Array.from(toolbar.querySelectorAll<HTMLElement>('button, select, input'));

  const items = getItems();
  items.forEach((el, index) => {
    el.tabIndex = index === 0 ? 0 : -1;
  });

  const onFocusIn = (event: FocusEvent): void => {
    const current = getItems();
    const target = event.target;
    if (!(target instanceof HTMLElement) || !current.includes(target)) return;
    for (const el of current) {
      el.tabIndex = el === target ? 0 : -1;
    }
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    const current = getItems();
    if (current.length === 0) return;
    const active = document.activeElement;
    if (!(active instanceof HTMLElement)) return;
    const index = current.indexOf(active);
    if (index === -1) return;

    const rtl = getComputedStyle(toolbar).direction === 'rtl';
    let nextIndex: number | null = null;
    if (event.key === 'ArrowRight') {
      nextIndex = (index + (rtl ? -1 : 1) + current.length) % current.length;
    } else if (event.key === 'ArrowLeft') {
      nextIndex = (index + (rtl ? 1 : -1) + current.length) % current.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = current.length - 1;
    }

    if (nextIndex !== null) {
      event.preventDefault();
      const target = current[nextIndex];
      target?.focus();
    }
  };

  toolbar.addEventListener('focusin', onFocusIn);
  toolbar.addEventListener('keydown', onKeyDown);

  return () => {
    toolbar.removeEventListener('focusin', onFocusIn);
    toolbar.removeEventListener('keydown', onKeyDown);
  };
}
