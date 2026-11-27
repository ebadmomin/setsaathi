function escapeStep(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  })[character]);
}

export function renderExerciseSteps(instructions) {
  const text = String(instructions ?? "").trim();
  const markers = [...text.matchAll(/(?:^|\s)(\d+)[.)]\s+/g)];
  if (markers.length < 2 || Number(markers[0][1]) !== 1) {
    return `<p>${escapeStep(text)}</p>`;
  }

  const steps = markers.map((marker, index) => {
    const start = marker.index + marker[0].length;
    const end = index + 1 < markers.length ? markers[index + 1].index : text.length;
    return text.slice(start, end).trim();
  }).filter(Boolean);
  return `<ol class="exercise-steps">${steps.map(step => `<li>${escapeStep(step)}</li>`).join("")}</ol>`;
}
