import React from 'react';
import './IconWithText.css';

const IconWithText = ({ icon: Icon, text, className = '' }) => {
  return (
    <div className={`icon-with-text ${className}`.trim()}>
      {Icon ? <Icon size={16} className="icon" /> : null}
      <span className="icon-text">{text}</span>
    </div>
  );
};

export default IconWithText;
