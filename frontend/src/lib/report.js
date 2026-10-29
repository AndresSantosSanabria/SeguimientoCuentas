const SECTION_PATTERN = /^---\s*(.+?)\s*---$/;
const KEY_VALUE_PATTERN = /^(.+?):\s*(.*)$/;
function newSection(title = 'Resumen') {
    return { title, rows: [], notes: [] };
}
/**
 * The backend returns a plain-text report. This parser keeps the UI readable
 * without requiring a new backend endpoint.
 */
export function parseReport(raw) {
    const sections = [];
    let current = newSection();
    for (const rawLine of raw.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith('===='))
            continue;
        const sectionMatch = SECTION_PATTERN.exec(line);
        if (sectionMatch) {
            if (current.rows.length > 0 || current.notes.length > 0) {
                sections.push(current);
            }
            current = newSection(sectionMatch[1]);
            continue;
        }
        if (/^CONTRATO:/i.test(line)) {
            const value = line.replace(/^CONTRATO:/i, '').trim();
            current.title = 'Contrato';
            if (value)
                current.rows.push({ label: 'No. contrato', value });
            continue;
        }
        if (/^Contrato no encontrado/i.test(line)) {
            current.notes.push(line);
            continue;
        }
        const keyValue = KEY_VALUE_PATTERN.exec(line);
        if (keyValue) {
            current.rows.push({
                label: keyValue[1].trim(),
                value: keyValue[2].trim() || '—',
            });
        }
        else {
            current.notes.push(line);
        }
    }
    if (current.rows.length > 0 || current.notes.length > 0) {
        sections.push(current);
    }
    return { sections };
}
