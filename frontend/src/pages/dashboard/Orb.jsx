import React from 'react';
import { motion } from 'framer-motion';

const Orb = ({ style, delay = 0, size = 80, opacity = 0.12 }) => (
    <motion.div
        className="absolute rounded-full pointer-events-none"
        style={{ width: size, height: size, ...style, opacity }}
        animate={{ y: [0, -18, 0], x: [0, 8, 0] }}
        transition={{ duration: 5 + delay, repeat: Infinity, ease: 'easeInOut', delay }}
    />
);

export default Orb;
