import React from 'react';

const UserStatusBadge = ({ status }) => {
    const styles = {
        active: 'bg-emerald-500 text-white border-emerald-600 shadow-[0_0_15px_rgba(16,185,129,0.4)]',
        suspended: 'bg-orange-500 text-white border-orange-600 shadow-[0_0_15px_rgba(249,115,22,0.4)]',
        pending: 'bg-amber-500 text-white border-amber-600 shadow-[0_0_15px_rgba(245,158,11,0.4)]',
    };

    const currentStyle = styles[status?.toLowerCase()] || 'bg-gray-500 text-white border-gray-600';

    return (
        <span className={`px-2 py-0.5 rounded-sm text-[8px] font-black border ${currentStyle} uppercase tracking-[0.2em] backdrop-blur-md`}>
            {status || 'Unknown'}
        </span>
    );
};

const UserRoleBadge = ({ role }) => {
    const isAdmin = role?.toLowerCase() === 'admin';
    const style = isAdmin 
        ? 'bg-fuchsia-500 text-white border-fuchsia-600 shadow-[0_0_15px_rgba(217,70,239,0.4)]' 
        : 'bg-indigo-500 text-white border-indigo-600 shadow-[0_0_15px_rgba(99,102,241,0.4)]';

    return (
        <span className={`px-2 py-0.5 rounded-sm text-[8px] font-black border ${style} uppercase tracking-[0.2em] backdrop-blur-md`}>
            {isAdmin ? 'System Admin' : 'Academic Member'}
        </span>
    );
};

export { UserStatusBadge, UserRoleBadge };
