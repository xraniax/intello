// Shared Framer Motion presets — import and spread onto motion elements

export const fadeIn = {
    initial:    { opacity: 0 },
    animate:    { opacity: 1 },
    exit:       { opacity: 0 },
    transition: { duration: 0.18, ease: [0.4, 0, 0.2, 1] },
};

export const slideUp = {
    initial:    { opacity: 0, y: 12 },
    animate:    { opacity: 1, y: 0 },
    exit:       { opacity: 0, y: 12 },
    transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] },
};

export const slideDown = {
    initial:    { opacity: 0, y: -10 },
    animate:    { opacity: 1, y: 0 },
    exit:       { opacity: 0, y: -10 },
    transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] },
};

export const scaleIn = {
    initial:    { opacity: 0, scale: 0.94 },
    animate:    { opacity: 1, scale: 1 },
    exit:       { opacity: 0, scale: 0.94 },
    transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] },
};

// Bouncy entrance — for playful moments
export const bounceUp = {
    initial:    { opacity: 0, y: 20, scale: 0.92 },
    animate:    { opacity: 1, y: 0,  scale: 1 },
    exit:       { opacity: 0, y: 16, scale: 0.94 },
    transition: { type: 'spring', damping: 16, stiffness: 260, mass: 0.8 },
};

// Pop in — for achievements, badges, streaks
export const popIn = {
    initial:    { opacity: 0, scale: 0.6 },
    animate:    { opacity: 1, scale: 1 },
    exit:       { opacity: 0, scale: 0.7 },
    transition: { type: 'spring', damping: 14, stiffness: 320, mass: 0.7 },
};

// Slide up with strong bounce — hero headlines
export const heroSlideUp = {
    initial:    { opacity: 0, y: 32 },
    animate:    { opacity: 1, y: 0 },
    exit:       { opacity: 0, y: 24 },
    transition: { type: 'spring', damping: 20, stiffness: 180, mass: 1 },
};

// Page-level transition
export const pageFade = {
    initial:    { opacity: 0 },
    animate:    { opacity: 1, transition: { duration: 0.28, ease: 'easeOut' } },
    exit:       { opacity: 0, transition: { duration: 0.16, ease: 'easeIn' } },
};

// Card hover — tactile lift
export const cardHover = {
    whileHover: { y: -4, scale: 1.008, transition: { duration: 0.22, ease: [0.34, 1.56, 0.64, 1] } },
    whileTap:   { scale: 0.96, transition: { duration: 0.1 } },
};

// Subtle card hover — for workspace panels
export const cardHoverSubtle = {
    whileHover: { y: -2, transition: { duration: 0.18, ease: [0.4, 0, 0.2, 1] } },
    whileTap:   { scale: 0.98, transition: { duration: 0.1 } },
};

// Button tap — satisfying press
export const buttonTap = {
    whileTap: { scale: 0.94, transition: { duration: 0.08 } },
};

// List stagger container
export const staggerContainer = {
    animate: {
        transition: { staggerChildren: 0.06, delayChildren: 0.04 },
    },
};

// Fast stagger — for smaller items
export const staggerContainerFast = {
    animate: {
        transition: { staggerChildren: 0.035, delayChildren: 0.02 },
    },
};

// Individual stagger item — spring
export const staggerItem = {
    initial:    { opacity: 0, y: 18, scale: 0.96 },
    animate:    { opacity: 1, y: 0,  scale: 1,
        transition: { type: 'spring', damping: 20, stiffness: 220, mass: 0.8 } },
};

// Stagger item with more bounce
export const staggerItemBouncy = {
    initial:    { opacity: 0, y: 24, scale: 0.90 },
    animate:    { opacity: 1, y: 0,  scale: 1,
        transition: { type: 'spring', damping: 15, stiffness: 260, mass: 0.7 } },
};

// Overlay background
export const overlayBg = {
    initial:    { opacity: 0 },
    animate:    { opacity: 1 },
    exit:       { opacity: 0 },
    transition: { duration: 0.2 },
};

// Overlay panel
export const overlayPanel = {
    initial:    { opacity: 0, scale: 0.95, y: 16 },
    animate:    { opacity: 1, scale: 1,    y: 0 },
    exit:       { opacity: 0, scale: 0.95, y: 16 },
    transition: { type: 'spring', damping: 24, stiffness: 260 },
};

// Slide in from right — drawers, focus mode
export const slideInRight = {
    initial:    { x: '100%' },
    animate:    { x: 0 },
    exit:       { x: '100%' },
    transition: { type: 'spring', damping: 28, stiffness: 220 },
};

// Slide in from left
export const slideInLeft = {
    initial:    { x: '-100%' },
    animate:    { x: 0 },
    exit:       { x: '-100%' },
    transition: { type: 'spring', damping: 28, stiffness: 220 },
};

// Tab content swap
export const tabSwap = {
    initial:    { opacity: 0, y: 8 },
    animate:    { opacity: 1, y: 0 },
    exit:       { opacity: 0, y: -8 },
    transition: { duration: 0.16, ease: [0.4, 0, 0.2, 1] },
};

// Number counter — for stats
export const countUp = {
    initial:    { opacity: 0, y: 10 },
    animate:    { opacity: 1, y: 0,
        transition: { type: 'spring', damping: 18, stiffness: 200 } },
};

// Morph in — tab content swap with blur fade (premium feel)
export const morphIn = {
    initial:    { opacity: 0, scale: 0.97, filter: 'blur(4px)' },
    animate:    { opacity: 1, scale: 1,    filter: 'blur(0px)' },
    exit:       { opacity: 0, scale: 0.97, filter: 'blur(4px)' },
    transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] },
};

// Page transition — directional spring for route changes
export const pageTransition = {
    initial:    { opacity: 0, y: 16 },
    animate:    { opacity: 1, y: 0 },
    exit:       { opacity: 0, y: -8, transition: { duration: 0.12 } },
    transition: { type: 'spring', damping: 22, stiffness: 200, mass: 0.8 },
};

// List item slide — lateral entrance for file panels, chat items
export const listItemSlide = {
    initial:    { opacity: 0, x: -10, scale: 0.97 },
    animate:    { opacity: 1, x: 0,   scale: 1,
        transition: { type: 'spring', damping: 22, stiffness: 280, mass: 0.6 } },
};

// Slow stagger — for large grids
export const staggerContainerSlow = {
    animate: {
        transition: { staggerChildren: 0.10, delayChildren: 0.06 },
    },
};

// Text reveal — container and word-level items
export const textRevealContainer = {
    animate: {
        transition: { staggerChildren: 0.04, delayChildren: 0.02 },
    },
};
export const textRevealWord = {
    initial:    { opacity: 0, y: 14, rotateX: -20 },
    animate:    { opacity: 1, y: 0,  rotateX: 0,
        transition: { type: 'spring', damping: 18, stiffness: 240, mass: 0.7 } },
};

// Chat bubble — directional entrance
export const chatBubbleUser = {
    initial:    { opacity: 0, x: 16, scale: 0.95 },
    animate:    { opacity: 1, x: 0,  scale: 1,
        transition: { type: 'spring', damping: 20, stiffness: 260, mass: 0.7 } },
};
export const chatBubbleAI = {
    initial:    { opacity: 0, x: -16, scale: 0.95 },
    animate:    { opacity: 1, x: 0,   scale: 1,
        transition: { type: 'spring', damping: 20, stiffness: 260, mass: 0.7 } },
};
