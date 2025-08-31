import React from 'react';

type CloseIconProps = {
  color?: string;
  size?: number;
};

export const CloseIcon: React.FC<CloseIconProps> = ({ color = 'currentColor', size = 16 }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 16 16" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path 
      d="M12 4L4 12M4 4L12 12" 
      stroke={color} 
      strokeWidth="1.5" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    />
  </svg>
);
