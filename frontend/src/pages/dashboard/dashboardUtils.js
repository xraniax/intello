export const ACCENTS = [
    { bg: 'var(--grad-primary)',  light: 'var(--c-primary-ultra)', text: 'var(--c-primary)', shadow: 'var(--shadow-primary)', hex: '#7C5CFC' },
    { bg: 'var(--grad-warm)',     light: 'var(--c-coral-light)',   text: 'var(--c-coral)',   shadow: 'var(--shadow-coral)',   hex: '#FF6B6B' },
    { bg: 'var(--grad-cool)',     light: 'var(--c-teal-light)',    text: 'var(--c-teal)',    shadow: 'var(--shadow-teal)',    hex: '#0EB8D5' },
    { bg: 'var(--grad-success)',  light: 'var(--c-mint-light)',    text: 'var(--c-mint)',    shadow: 'var(--shadow-mint)',    hex: '#00C896' },
    { bg: 'var(--grad-sunset)',   light: 'var(--c-amber-light)',   text: 'var(--c-amber)',   shadow: 'var(--shadow-amber)',   hex: '#FFB020' },
    { bg: 'var(--grad-candy)',    light: 'var(--c-rose-light)',    text: 'var(--c-rose)',    shadow: 'var(--shadow-rose)',    hex: '#F43F5E' },
    { bg: 'var(--grad-ocean)',    light: 'var(--c-sky-light)',     text: 'var(--c-sky)',     shadow: 'var(--shadow-sky)',     hex: '#3BAAFF' },
    { bg: 'var(--grad-peach)',    light: 'var(--c-fuchsia-light)', text: 'var(--c-fuchsia)', shadow: 'var(--shadow-fuchsia)', hex: '#D946EF' },
];

export const accentFor = (id = '') => ACCENTS[(id.charCodeAt(0) || 0) % ACCENTS.length];

export const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
};

export const timeSince = (dateStr) => {
    if (!dateStr) return null;
    const diff = Date.now() - new Date(dateStr).getTime();
    const m = Math.floor(diff / 60000), h = Math.floor(m / 60), d = Math.floor(h / 24);
    if (d > 0) return `${d}d ago`;
    if (h > 0) return `${h}h ago`;
    if (m > 0) return `${m}m ago`;
    return 'Just now';
};
