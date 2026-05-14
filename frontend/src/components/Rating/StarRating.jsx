import React, { useState } from 'react';
import { Star } from 'lucide-react';

const LABELS = ['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'];

/**
 * Interactive 1–5 star rating input.
 *
 * Props:
 *   value        {number}  current rating (0 = none)
 *   onChange     {fn}      called with new value
 *   size         {number}  icon size in px (default 28)
 *   readOnly     {boolean}
 *   showLabel    {boolean} show text label under stars
 */
export default function StarRating({
    value = 0,
    onChange,
    size = 28,
    readOnly = false,
    showLabel = true,
}) {
    const [hovered, setHovered] = useState(0);
    const active = hovered || value;

    return (
        <div className="flex flex-col items-center gap-1.5 select-none">
            <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                    <button
                        key={star}
                        type="button"
                        disabled={readOnly}
                        onClick={() => !readOnly && onChange?.(star)}
                        onMouseEnter={() => !readOnly && setHovered(star)}
                        onMouseLeave={() => !readOnly && setHovered(0)}
                        className="transition-transform duration-100 disabled:cursor-default"
                        style={{ transform: !readOnly && hovered === star ? 'scale(1.2)' : 'scale(1)' }}
                        aria-label={`Rate ${star} out of 5`}
                    >
                        <Star
                            size={size}
                            style={{
                                color:  active >= star ? '#f59e0b' : 'var(--c-border)',
                                fill:   active >= star ? '#f59e0b' : 'transparent',
                                transition: 'color 0.15s, fill 0.15s',
                            }}
                        />
                    </button>
                ))}
            </div>

            {showLabel && (
                <span
                    className="text-xs font-semibold h-4 transition-opacity"
                    style={{
                        color: active ? '#f59e0b' : 'var(--c-text-muted)',
                        opacity: active ? 1 : 0,
                    }}
                >
                    {LABELS[active] || ''}
                </span>
            )}
        </div>
    );
}
