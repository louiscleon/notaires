import React from 'react';

interface Props {
  className?: string;
}

const Logo: React.FC<Props> = ({ className = '' }) => {
  return (
    <div className={`logo-fix ${className}`}>
      <svg viewBox="0 0 682.66669 682.66669" xmlns="http://www.w3.org/2000/svg">
        <g transform="matrix(1.3333333,0,0,-1.3333333,0,682.66667)" fill="none" stroke="currentColor" strokeWidth="15" strokeLinecap="round" strokeLinejoin="round">
          <g>
            <path
              d="m 180.958,115.8271 c 24.494,3.672 49.681,5.586 75.384,5.586 85.286,0 164.895,-21.068 232.339,-57.533 4.548,-2.459 2.786,-9.373 -2.384,-9.373 h -459.91 c -5.171,0 -6.933,6.914 -2.385,9.373 36.664,19.823 76.922,35.095 119.734,44.907"
            />
            <path
              d="M 344.9707,207.0352 V 289.1492 H 167.7117 V 207.0352"
            />
            <path
              d="m 206.7295,289.1494 h -39.018 v 23.433 c 0,3.576 2.899,6.475 6.476,6.475 H 200.2545 c 3.576,0 6.475,-2.899 6.475,-6.475 z"
            />
            <path
              d="m 313.3701,319.0488 -44.333,62.473 c -6.205,8.744 -19.186,8.744 -25.392,0 L 199.3191,319.0578"
            />
            <path
              d="M 256.3418,388.0791 V 457.4931"
            />
            <circle cx="203.8374" cy="253.1504" r="7.5" className="fill-current"/>
            <circle cx="238.8403" cy="253.1504" r="7.5" className="fill-current"/>
            <circle cx="273.8428" cy="253.1504" r="7.5" className="fill-current"/>
            <circle cx="308.8457" cy="253.1504" r="7.5" className="fill-current"/>
          </g>
        </g>
      </svg>
    </div>
  );
};

export default Logo; 