import React from 'react';
import { Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const FloatingActionButton = ({ onClick, icon: Icon = Plus, label = "Add" }) => {
    return (
        <AnimatePresence>
            <motion.button
                initial={{ scale: 0, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0, opacity: 0, y: 20 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={onClick}
                className="md:hidden fixed bottom-24 right-6 w-14 h-14 bg-gradient-to-tr from-purple-600 to-indigo-600 text-white rounded-2xl shadow-xl shadow-purple-200/50 flex items-center justify-center z-40 border border-white/20"
                aria-label={label}
            >
                <Icon className="w-6 h-6" />
            </motion.button>
        </AnimatePresence>
    );
};

export default FloatingActionButton;
