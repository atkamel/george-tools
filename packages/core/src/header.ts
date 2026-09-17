/**
 * Writes `#u id1 id2` as the file's user line. Handout files start with a
 * `#u` line (usually blank after the directive); that line is replaced.
 * A file without one gets the line prepended.
 */
export function writeHeader(text: string, userIds: string[]): string {
  const header = `#u ${userIds.join(" ")}`;
  const lines = text.split(/\r?\n/);
  const idx = lines.findIndex((l) => l.trim().length > 0);
  if (idx !== -1 && /^#u\b/.test(lines[idx].trim())) {
    lines[idx] = header;
    return lines.join("\n");
  }
  return `${header}\n${text}`;
}
