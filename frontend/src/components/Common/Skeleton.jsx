import React from 'react';

const Skeleton = ({ className, variant = 'rect', width, height }) => {
    const baseClass = "bg-gray-100/50 anim-skeleton rounded-lg overflow-hidden relative";
    
    const variantClasses = {
        rect: "rounded-lg",
        circle: "rounded-full",
        text: "rounded h-4 w-full"
    };

    const style = {
        width: width || '100%',
        height: height || (variant === 'text' ? '1rem' : '100%'),
    };

    return (
        <div 
            className={`${baseClass} ${variantClasses[variant]} ${className || ''}`}
            style={style}
        >
            <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent anim-shimmer"></div>
        </div>
    );
};

export default Skeleton;
