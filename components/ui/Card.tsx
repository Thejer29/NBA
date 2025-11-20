import React from 'react';

interface CardProps {
    children: React.ReactNode;
    className?: string;
    onClick?: () => void;
}

const Card: React.FC<CardProps> = ({ children, className = '', onClick }) => {
    const clickableClasses = onClick ? 'cursor-pointer hover:bg-savant-light transition-colors' : '';
    return (
        <div className={`bg-savant-main p-4 rounded-lg shadow-2xl ${clickableClasses} ${className}`} onClick={onClick}>
            {children}
        </div>
    );
};

export default Card;
