import * as React from "react"

const Input = React.forwardRef(({ className, type, style, ...props }, ref) => {
  return (
    <div
      style={{
        display: 'block',
        width: '100%',
        padding: '0',
        borderRadius: '20px',
        border: '2px solid #FFFFFF',
        background: 'rgba(231, 217, 255, 0.28)',
        boxShadow: '0 0 24px rgba(231, 217, 255, 0.25), inset 0 2px 4px rgba(0, 0, 0, 0.12)',
        overflow: 'hidden',
      }}
    >
      <input
        type={type}
        ref={ref}
        style={{
          display: 'block',
          width: '100%',
          height: '56px',
          padding: '16px 24px',
          background: 'transparent',
          border: 'none',
          color: 'white',
          fontSize: '16px',
          outline: 'none',
          ...style
        }}
        {...props}
      />
    </div>
  );
});

Input.displayName = "Input"

export { Input }
