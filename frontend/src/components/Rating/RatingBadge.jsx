import React from 'react';
import { Star, Pencil } from 'lucide-react';

/**
 * Compact badge showing an existing rating.
 * Clicking it opens the edit modal via onEdit().
 *
 * Props:
 *   rating  {number}  1–5
 *   onEdit  {fn}
 *   compact {boolean} pill vs. full badge
 */
export default function RatingBadge({ rating, onEdit, compact = false }) {
    if (!rating || rating < 1) return null;

    if (compact) {
        return (
            <button
                type="button"
                onClick={onEdit}
                title="Edit your rating"
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold transition-all hover:scale-105"
                style={{
                    background: 'rgba(245,158,11,0.13)',
                    color: '#b45309',
                    border: '1px solid rgba(245,158,11,0.3)',
                }}
            >
                <Star size={11} style={{ fill: '#f59e0b', color: '#f59e0b' }} />
                {rating}
            </button>
        );
    }

    return (
        <button
            type="button"
            onClick={onEdit}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all hover:scale-[1.02]"
            style={{
                background: 'rgba(245,158,11,0.10)',
                color: '#92400e',
                border: '1.5px solid rgba(245,158,11,0.25)',
            }}
        >
            <span className="flex gap-0.5">
                {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                        key={s}
                        size={12}
                        style={{
                            fill:  s <= rating ? '#f59e0b' : 'transparent',
                            color: s <= rating ? '#f59e0b' : 'rgba(245,158,11,0.3)',
                        }}
                    />
                ))}
            </span>
            Your rating
            <Pencil size={11} className="ml-0.5 opacity-60" />
        </button>
    );
}
