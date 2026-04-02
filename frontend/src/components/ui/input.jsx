import * as React from "react"

const Input = React.forwardRef(({ className, type, style, ...props }, ref) => {
  const baseStyles = {
    display: 'flex',
    width: '100%',
    height: '56px',
    padding: '16px 24px',
    borderRadius: '20px',
    background: 'rgba(231, 217, 255, 0.28)',
    border: '2px solid #FFFFFF',
    boxShadow: '0 0 24px rgba(231, 217, 255, 0.25), inset 0 2px 4px rgba(0, 0, 0, 0.12)',
    color: 'white',
    fontSize: '16px',
    outline: 'none',
    transition: 'all 0.3s ease',
  };

  const handleFocus = (e) => {
    e.target.style.boxShadow = '0 0 36px rgba(231, 217, 255, 0.4), 0 0 0 3px rgba(255, 255, 255, 0.2), inset 0 2px 4px rgba(0, 0, 0, 0.12)';
    e.target.style.borderColor = '#FFFFFF';
    props.onFocus?.(e);
  };

  const handleBlur = (e) => {
    e.target.style.boxShadow = '0 0 24px rgba(231, 217, 255, 0.25), inset 0 2px 4px rgba(0, 0, 0, 0.12)';
    e.target.style.borderColor = '#FFFFFF';
    props.onBlur?.(e);
  };

  return (
    <input
      type={type}
      ref={ref}
      style={{ ...baseStyles, ...style }}
      onFocus={handleFocus}
      onBlur={handleBlur}
      {...props}
    />
  );
});

Input.displayName = "Input"

export { Input }
