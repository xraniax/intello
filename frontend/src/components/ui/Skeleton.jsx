import React from 'react';

const Skeleton = ({ className, variant = 'rect', width, height }) => {
    const baseClass = "anim-skeleton overflow-hidden relative";
    
    const variantClasses = {
        rect: "rounded-[1.25rem]",
        circle: "rounded-full",
        text: "rounded h-4 w-full"
    };

    const style = {
        width: width || '100%',
        height: height || (variant === 'text' ? '1rem' : '100%'),
        background: 'var(--c-surface-alt)'
    };

    return (
        <div 
            className={`${baseClass} ${variantClasses[variant]} ${className || ''}`}
            style={style}
        >
            <div className="absolute inset-0 -translate-x-full anim-shimmer" style={{ 
                animationDuration: '1.5s',
                background: 'linear-gradient(to right, transparent, var(--c-surface), transparent)'
            }}></div>
        </div>
    );
};

export default Skeleton;
