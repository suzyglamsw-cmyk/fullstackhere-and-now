import * as React from "react"

const Input = React.forwardRef(({ className, type, style, ...props }, ref) => {
  const baseStyles = {
    display: 'flex',
    width: '100%',
    height: '56px',
    padding: '16px 24px',
    borderRadius: '20px',
    background: 'rgba(231, 217, 255, 0.12)',
    border: '2px solid #F3E8FF',
    boxShadow: '0 0 24px rgba(231, 217, 255, 0.08), inset 0 1px 2px rgba(0, 0, 0, 0.06)',
    color: 'white',
    fontSize: '16px',
    outline: 'none',
    transition: 'all 0.3s ease',
  };

  const handleFocus = (e) => {
    e.target.style.boxShadow = '0 0 32px rgba(231, 217, 255, 0.2), 0 0 0 3px rgba(243, 232, 255, 0.3), inset 0 1px 2px rgba(0, 0, 0, 0.06)';
    props.onFocus?.(e);
  };

  const handleBlur = (e) => {
    e.target.style.boxShadow = '0 0 24px rgba(231, 217, 255, 0.08), inset 0 1px 2px rgba(0, 0, 0, 0.06)';
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
