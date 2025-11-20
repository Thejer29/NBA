
import React from 'react';

interface LoadingSpinnerProps {
    message: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ message }) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 mt-8 bg-savant-main rounded-lg">
      <div className="w-12 h-12 border-4 border-savant-light border-t-savant-gold rounded-full animate-spin"></div>
      <p className="mt-4 text-savant-accent text-center">{message}</p>
    </div>
  );
};

export default LoadingSpinner;
