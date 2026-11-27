// Render coach replies as Markdown without trusting generated HTML.
export function renderCoachMarkdown(container, source) {
  const lines = String(source ?? "").replace(/\r\n?/g, "\n").split("\n");
  let list = null;
  const inline = (parent, value) => {
    const pattern = /(\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|\*\*(.+?)\*\*|__(.+?)__|`([^`]+)`|\*([^*\n]+)\*)/g;
    let cursor = 0, match;
    while ((match = pattern.exec(value))) {
      parent.append(document.createTextNode(value.slice(cursor, match.index)));
      if (match[2]) {
        const link = document.createElement("a");
        link.href = match[3]; link.target = "_blank"; link.rel = "noopener noreferrer";
        link.textContent = match[2]; parent.append(link);
      } else {
        const element = document.createElement(match[6] ? "code" : match[7] ? "em" : "strong");
        element.textContent = match[4] || match[5] || match[6] || match[7]; parent.append(element);
      }
      cursor = pattern.lastIndex;
    }
    parent.append(document.createTextNode(value.slice(cursor)));
  };
  for (const line of lines) {
    if (!line.trim()) { list = null; continue; }
    const item = line.match(/^\s*(?:[-*•]|\d+[.)])\s+(.+)/);
    if (item) {
      const ordered = /^\s*\d/.test(line);
      if (!list || list.tagName !== (ordered ? "OL" : "UL")) {
        list = document.createElement(ordered ? "ol" : "ul"); container.append(list);
      }
      const li = document.createElement("li"); inline(li, item[1]); list.append(li);
      continue;
    }
    list = null;
    const heading = line.match(/^#{1,3}\s+(.+)/);
    const block = document.createElement(heading ? "h3" : "p");
    inline(block, heading ? heading[1] : line); container.append(block);
  }
}
