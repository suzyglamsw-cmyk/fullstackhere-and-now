import { useState, useRef, useEffect } from 'react';
import { analyzeImageType, getBlurStrength, getBlurStyle } from '../utils/imageBlur';
import { API } from '../App';

/**
 * Photo blur states:
 * - HIGH_BLUR: Pre-match only (blur-[12px])
 * - LOW_BLUR: Post-match, pre-reveal (blur-[4px])
 * - CLEAR: After mutual reveal (no blur)
 */
export const BLUR_STATES = {
  HIGH_BLUR: 'high_blur',
  LOW_BLUR: 'low_blur',
  CLEAR: 'clear'
};

/**
 * Helper function to construct the correct photo URL with blur parameter.
 * Handles photo IDs, legacy URLs, and external URLs.
 */
const getPhotoUrl = (src, blur = false) => {
  if (!src) return '';
  
  // External URLs (e.g., unsplash) - no modification
  if (src.startsWith('http')) return src;
  
  // Already a serve URL - add blur parameter
  if (src.includes('/photos/serve/')) {
    const baseUrl = src.split('?')[0];
    return blur ? `${baseUrl}?blur=true` : baseUrl;
  }
  
  // Legacy URL format (/api/photos/xxx) - convert to serve URL
  if (src.startsWith('/api/photos/')) {
    const photoId = src.replace('/api/photos/', '');
    return blur ? `${API}/photos/serve/${photoId}?blur=true` : `${API}/photos/serve/${photoId}`;
  }
  
  // Just a photo ID - construct serve URL
  if (src && !src.includes('/')) {
    return blur ? `${API}/photos/serve/${src}?blur=true` : `${API}/photos/serve/${src}`;
  }
  
  // Fallback - return as-is
  return src;
};

/**
 * Get CSS blur value based on blur state
 */
const getBlurValue = (blurState) => {
  switch (blurState) {
    case BLUR_STATES.HIGH_BLUR:
      return 12; // Heavy blur for pre-match
    case BLUR_STATES.LOW_BLUR:
      return 4;  // Light blur for post-match, pre-reveal
    case BLUR_STATES.CLEAR:
    default:
      return 0;  // No blur after reveal
  }
};

/**
 * BlurredImage component that applies blur based on photo state.
 * 
 * Props:
 * - src: Image source URL
 * - alt: Alt text
 * - blurState: 'high_blur' | 'low_blur' | 'clear' (new prop)
 * - isRevealed: Boolean (legacy prop, maps to 'clear' if true)
 * - isThumbnail: Boolean for thumbnail-specific blur
 * - fallbackInitial: Character to show when image fails
 */
const BlurredImage = ({ 
  src, 
  alt, 
  className = '', 
  blurState = null,
  isRevealed = false, 
  isThumbnail = false,
  fallbackInitial = '?',
  onLoad,
  ...props 
}) => {
  const [imageType, setImageType] = useState('standard');
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const imgRef = useRef(null);

  // Determine effective blur state
  // Priority: blurState prop > isRevealed prop
  const effectiveBlurState = blurState 
    ? blurState 
    : (isRevealed ? BLUR_STATES.CLEAR : BLUR_STATES.HIGH_BLUR);

  // Determine if we should use server-side blur or CSS blur
  const useServerBlur = effectiveBlurState === BLUR_STATES.HIGH_BLUR;
  
  // Construct the correct URL based on blur state
  const imageUrl = getPhotoUrl(src, useServerBlur);

  useEffect(() => {
    // Reset state when src changes
    setLoaded(false);
    setError(false);
    setImageType('standard');
  }, [src, blurState, isRevealed]);

  const handleLoad = (e) => {
    const img = e.target;
    const type = analyzeImageType(img);
    setImageType(type);
    setLoaded(true);
    
    if (onLoad) {
      onLoad(e);
    }
  };

  const handleError = () => {
    setError(true);
  };

  // If no src or error, show fallback
  if (!src || error) {
    return (
      <div 
        className={`w-full h-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-end justify-center pb-2 ${className}`}
        {...props}
      >
        <span className="text-xl text-slate-500/70 font-medium">
          {fallbackInitial}
        </span>
      </div>
    );
  }

  // Calculate blur style
  // For external images, we always use CSS blur
  // For server-side, we use CSS blur only for LOW_BLUR (light blur)
  const isExternalUrl = src.startsWith('http');
  const blurValue = getBlurValue(effectiveBlurState);
  
  // Only apply CSS blur if:
  // 1. External URL (server blur not available), OR
  // 2. LOW_BLUR state (server only supports high blur)
  const needsCssBlur = isExternalUrl || effectiveBlurState === BLUR_STATES.LOW_BLUR;
  const cssBlurValue = needsCssBlur ? blurValue : 0;
  
  const blurStyle = {
    filter: cssBlurValue > 0 ? `blur(${cssBlurValue}px)` : 'none',
    transition: 'filter 0.3s ease-out',
    transform: cssBlurValue > 0 ? 'scale(1.05)' : 'scale(1)', // Prevent blur edge artifacts
  };

  return (
    <img
      ref={imgRef}
      src={imageUrl}
      alt={alt}
      className={`w-full h-full object-cover ${className}`}
      style={blurStyle}
      onLoad={handleLoad}
      onError={handleError}
      {...props}
    />
  );
};

export default BlurredImage;
