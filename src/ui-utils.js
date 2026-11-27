// Shared UI helpers for the vanilla-DOM modules and the React shell.

// Consistent skip icon (Lucide "ban" style). Use everywhere a skipped status is shown,
// instead of a text glyph whose appearance depends on the font.
export const SKIP_ICON_SVG =
  '<svg class="ui-icon ui-icon-skip" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="9"/><path d="M5.7 5.7l12.6 12.6"/></svg>';

export const CLOSE_ICON_SVG =
  '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6L6 18"/></svg>';

// Pluralize a count with an explicit word pair: plural(3, "set") -> "3 sets".
export function plural(count, singular, pluralWord = `${singular}s`) {
  const n = Number(count) || 0;
  return `${n} ${n === 1 ? singular : pluralWord}`;
}

// Convenience for set labels: setsLabel(1) -> "1 set", setsLabel(4) -> "4 sets".
export const setsLabel = count => plural(count, "set");
