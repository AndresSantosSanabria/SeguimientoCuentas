const numberFormatter = new Intl.NumberFormat('es-CO');
const percentFormatter = new Intl.NumberFormat('es-CO', {
    maximumFractionDigits: 1,
});
export function formatNumber(value) {
    if (value === null || value === undefined || !Number.isFinite(value)) {
        return '—';
    }
    return numberFormatter.format(value);
}
export function formatPercent(value, digits = 1) {
    if (value === null || value === undefined || !Number.isFinite(value)) {
        return '—';
    }
    const formatter = digits === 1
        ? percentFormatter
        : new Intl.NumberFormat('es-CO', { maximumFractionDigits: digits });
    return `${formatter.format(value)}%`;
}
/**
 * Igual que formatPercent pero nunca redondea un valor < 100 hacia "100%".
 * Útil en segmentos casi nulos de gráficos (p. ej. 99,9919% ≠ 100%).
 */
export function formatPercentReal(value, digits = 2) {
    if (value === null || value === undefined || !Number.isFinite(value)) {
        return '—';
    }
    const redondeado = Math.round(value * 10 ** digits) / 10 ** digits;
    const usados = redondeado >= 100 && value < 100 ? digits + 3 : digits;
    return formatPercent(value, usados);
}
export function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}
/** Parses `yyyy-mm-dd` as a local date (avoids UTC offsets moving the day). */
export function parseDateOnly(value) {
    if (!value)
        return null;
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
    if (!match)
        return null;
    const [, year, month, day] = match;
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    if (Number.isNaN(date.getTime()))
        return null;
    return date;
}
export function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
export function diffInDays(from, to) {
    const ms = startOfDay(to).getTime() - startOfDay(from).getTime();
    return Math.round(ms / 86_400_000);
}
export function formatDate(value) {
    if (!value)
        return '—';
    const date = parseDateOnly(value);
    if (!date)
        return value;
    return new Intl.DateTimeFormat('es-CO', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    }).format(date);
}
export function formatDateShort(value) {
    if (!value)
        return '—';
    const date = parseDateOnly(value);
    if (!date)
        return value;
    return new Intl.DateTimeFormat('es-CO', {
        day: '2-digit',
        month: 'short',
        year: '2-digit',
    }).format(date);
}
export function formatDateTime(value) {
    if (value === null || value === undefined || value === '')
        return '—';
    const date = typeof value === 'number' ? new Date(value) : new Date(value);
    if (Number.isNaN(date.getTime()))
        return String(value);
    return new Intl.DateTimeFormat('es-CO', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    }).format(date);
}
export function formatTime(value) {
    if (!value)
        return '—';
    return new Intl.DateTimeFormat('es-CO', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    }).format(new Date(value));
}
export function formatRelativeTime(timestamp) {
    if (!timestamp)
        return '—';
    const diff = Date.now() - timestamp;
    if (diff < 5_000)
        return 'ahora';
    if (diff < 60_000)
        return `hace ${Math.floor(diff / 1_000)} s`;
    if (diff < 3_600_000)
        return `hace ${Math.floor(diff / 60_000)} min`;
    if (diff < 86_400_000)
        return `hace ${Math.floor(diff / 3_600_000)} h`;
    return `hace ${Math.floor(diff / 86_400_000)} d`;
}
export function initials(name) {
    if (!name)
        return '—';
    const parts = name
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2);
    if (parts.length === 0)
        return '—';
    return parts.map((part) => part[0]?.toUpperCase() ?? '').join('');
}
export function truncate(value, max) {
    if (!value)
        return '—';
    return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}
