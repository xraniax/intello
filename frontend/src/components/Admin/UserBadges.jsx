import React from 'react';

const UserStatusBadge = ({ status }) => {
    const styles = {
        active: 'bg-green-100 text-green-700 border-green-200',
        suspended: 'bg-red-100 text-red-700 border-red-200',
        pending: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    };

    const currentStyle = styles[status?.toLowerCase()] || 'bg-gray-100 text-gray-700 border-gray-200';

    return (
        <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${currentStyle} uppercase tracking-wider`}>
            {status || 'Unknown'}
        </span>
    );
};

const UserRoleBadge = ({ role }) => {
    const isAdmin = role?.toLowerCase() === 'admin';
    const style = isAdmin 
        ? 'bg-purple-100 text-purple-700 border-purple-200' 
        : 'bg-indigo-50 text-indigo-600 border-indigo-100';

    return (
        <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${style} uppercase tracking-wider`}>
            {role || 'User'}
        </span>
    );
};

export { UserStatusBadge, UserRoleBadge };
