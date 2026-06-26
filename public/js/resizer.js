export function initResizer({ handle, cssVar, min, max, invert = false, onResize }) {
  if (!handle) return;

  handle.addEventListener('mousedown', (e) => {
    e.preventDefault();
    const startX = e.clientX;
    const root = document.documentElement;
    const startWidth = parseInt(getComputedStyle(root).getPropertyValue(cssVar), 10);

    document.body.classList.add('is-resizing');
    handle.classList.add('active');

    const onMove = (ev) => {
      const delta = invert ? startX - ev.clientX : ev.clientX - startX;
      const next = Math.min(max, Math.max(min, startWidth + delta));
      root.style.setProperty(cssVar, `${next}px`);
      onResize?.(next);
    };

    const onUp = () => {
      document.body.classList.remove('is-resizing');
      handle.classList.remove('active');
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      const finalWidth = parseInt(getComputedStyle(root).getPropertyValue(cssVar), 10);
      onResize?.(finalWidth, true);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}

export function applyPanelWidth(cssVar, width) {
  if (width) {
    document.documentElement.style.setProperty(cssVar, `${width}px`);
  }
}
