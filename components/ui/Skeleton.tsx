import React from 'react';

interface SkeletonProps {
    className?: string;
}

const Skeleton: React.FC<SkeletonProps> = ({ className }) => {
    return (
        <div className={`bg-savant-light animate-pulse rounded-md ${className}`} />
    );
};

export default Skeleton;
