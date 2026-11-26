const ROW_SELECTOR = "[data-participant-row]";
const ENABLED = ":not(:disabled):not([aria-disabled='true'])";
const FOCUSABLE = `a[href], button${ENABLED}`;
// Revalidation removes the row a few frames after the action resolves; past this, the page has moved on.
const MAX_FRAMES = 300;

function toRowControl(row: Element | null): HTMLElement | null {
  if (!row?.isConnected) {
    return null;
  }
  const preferred = row.querySelector<HTMLElement>(`[data-row-action]${ENABLED}`);
  if (preferred) {
    return preferred;
  }
  const focusable = row.querySelectorAll<HTMLElement>(FOCUSABLE);
  return focusable.length > 0 ? focusable[focusable.length - 1] : null;
}

function isFocusLost(): boolean {
  const active = document.activeElement;
  return active === null || active === document.body || !active.isConnected;
}

/**
 * Remembers the rows around the participant's row while it is still there, and returns what to call once the
 * removal succeeds: when the row is gone, focus goes to the next row's action, else the previous one's, else
 * the heading of the list's section, instead of falling to the body.
 */
export function planFocusAfterRowRemoval(origin: HTMLElement | null): () => void {
  const row = origin?.closest(ROW_SELECTOR);
  if (!row) {
    return () => {};
  }
  const next = row.nextElementSibling?.matches(ROW_SELECTOR) ? row.nextElementSibling : null;
  const previous = row.previousElementSibling?.matches(ROW_SELECTOR) ? row.previousElementSibling : null;
  const headingId = row.closest("section")?.getAttribute("aria-labelledby");
  const heading = headingId ? document.getElementById(headingId) : null;

  return () => {
    let frames = 0;
    const focusWhenGone = () => {
      if (row.isConnected && frames < MAX_FRAMES) {
        frames += 1;
        requestAnimationFrame(focusWhenGone);
        return;
      }
      if (row.isConnected || !isFocusLost()) {
        return;
      }
      (toRowControl(next) ?? toRowControl(previous) ?? heading)?.focus();
    };
    requestAnimationFrame(focusWhenGone);
  };
}
