import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef(({ className, type, style, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        "flex w-full text-base text-white transition-all duration-300",
        "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-white/70",
        "placeholder:text-white/40",
        "focus:outline-none focus-visible:outline-none",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "md:text-sm",
        className
      )}
      style={{
        height: '56px',
        padding: '16px 24px',
        borderRadius: '20px',
        background: 'rgba(231, 217, 255, 0.12)',
        border: '2px solid #F3E8FF',
        boxShadow: '0 0 24px rgba(231, 217, 255, 0.08), inset 0 1px 2px rgba(0, 0, 0, 0.06)',
        ...style
      }}
      onFocus={(e) => {
        e.target.style.boxShadow = '0 0 32px rgba(231, 217, 255, 0.18), 0 0 0 3px rgba(243, 232, 255, 0.25), inset 0 1px 2px rgba(0, 0, 0, 0.06)';
        e.target.style.borderColor = '#F3E8FF';
        props.onFocus?.(e);
      }}
      onBlur={(e) => {
        e.target.style.boxShadow = '0 0 24px rgba(231, 217, 255, 0.08), inset 0 1px 2px rgba(0, 0, 0, 0.06)';
        e.target.style.borderColor = '#F3E8FF';
        props.onBlur?.(e);
      }}
      ref={ref}
      {...props} />
  );
})
Input.displayName = "Input"

export { Input }
