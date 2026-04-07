import React, { useState, useEffect, useRef, useCallback } from "react";

/**
 * ConfirmHint - Two-tap confirmation tooltip for high-impact actions
 * 
 * Usage:
 * <ConfirmHint
 *   hint="Send a glance?"
 *   onConfirm={() => handleGlance()}
 *   disabled={isLoading}
 * >
 *   <Button>...</Button>
 * </ConfirmHint>
 */
export const ConfirmHint = ({ 
  children, 
  hint, 
  onConfirm, 
  disabled = false,
  className = "",
  globalPendingRef = null // Shared ref to track which hint is active globally
}) => {
  const [isPending, setIsPending] = useState(false);
  const timeoutRef = useRef(null);
  const containerRef = useRef(null);

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Handle click outside to cancel
  useEffect(() => {
    if (!isPending) return;

    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        cancelPending();
      }
    };

    const handleScroll = () => {
      cancelPending();
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    window.addEventListener("scroll", handleScroll, true);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [isPending]);

  const cancelPending = useCallback(() => {
    setIsPending(false);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (globalPendingRef) {
      globalPendingRef.current = null;
    }
  }, [globalPendingRef]);

  const handleClick = (e) => {
    e.stopPropagation();
    e.preventDefault();

    if (disabled) return;

    // If another hint is pending globally, cancel it first
    if (globalPendingRef && globalPendingRef.current && globalPendingRef.current !== cancelPending) {
      globalPendingRef.current();
    }

    if (!isPending) {
      // First tap - show hint
      setIsPending(true);
      if (globalPendingRef) {
        globalPendingRef.current = cancelPending;
      }
      
      // Auto-dismiss after 3 seconds
      timeoutRef.current = setTimeout(() => {
        cancelPending();
      }, 3000);
    } else {
      // Second tap - confirm action
      cancelPending();
      onConfirm();
    }
  };

  return (
    <div 
      ref={containerRef}
      className={`relative inline-flex ${className}`}
      onClick={handleClick}
    >
      {/* Tooltip hint */}
      {isPending && (
        <div 
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 animate-in fade-in slide-in-from-bottom-2 duration-150"
          data-testid="confirm-hint-tooltip"
        >
          <div className="bg-white text-black text-xs font-medium px-3 py-1.5 rounded-lg shadow-lg whitespace-nowrap">
            {hint}
          </div>
          {/* Arrow */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1">
            <div className="w-2 h-2 bg-white rotate-45 shadow-lg" />
          </div>
        </div>
      )}
      
      {/* Children with highlight state */}
      <div className={`transition-all duration-150 ${isPending ? "ring-2 ring-white/50 rounded-full scale-105" : ""}`}>
        {children}
      </div>
    </div>
  );
};

/**
 * Hook to manage global pending state (only one hint visible at a time)
 */
export const useConfirmHintGlobal = () => {
  const pendingRef = useRef(null);
  return pendingRef;
};

export default ConfirmHint;
