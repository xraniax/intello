import React from 'react';
import { motion } from 'framer-motion';
import { textRevealContainer, textRevealWord } from '@/utils/motion';

const AnimatedGreeting = ({ greeting, isDark = false }) => {
    const words = `${greeting}`.split(' ');
    const textColor = isDark ? 'white' : 'var(--c-text)';
    return (
        <motion.h1
            variants={textRevealContainer}
            initial="initial"
            animate="animate"
            className="text-[1.75rem] sm:text-[2.25rem] font-extrabold mb-2 flex flex-wrap gap-x-[0.3em]"
            style={{ color: textColor, letterSpacing: '-0.02em', perspective: '400px', fontWeight: 800 }}
        >
            {words.map((word, i) => (
                <motion.span
                    key={i}
                    variants={textRevealWord}
                    style={{ display: 'inline-block' }}
                    className={i === words.length - 1 ? 'text-gradient-hero' : ''}
                >
                    {word}
                </motion.span>
            ))}
        </motion.h1>
    );
};

export default AnimatedGreeting;
