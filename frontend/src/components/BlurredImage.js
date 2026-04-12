import { useState, useRef, useEffect } from 'react';
import { analyzeImageType, getBlurStrength, getBlurStyle } from '../utils/imageBlur';
import { API } from '../App';
import SilhouetteAvatar from './SilhouetteAvatar';

/**
 * BLUR STATES - Consistent across the entire app
 * 
 * 1. UNMATCHED (12px): No interaction, one-way glance, one-way icebreaker, icebreaker not accepted
 * 2. CONNECTION_ACCEPTED (6px): Mutual glance OR icebreaker accepted
 * 3. REVEALED (0px): Both users pressed Reveal
 * 4. BLOCKED: Photos hidden entirely (not blurred)
 * 5. SELF: Always clear (0px) - except in profile preview mode
 */
export const BLUR_STATES = {
  UNMATCHED: 'unmatched',               // 12px - heavy blur
  CONNECTION_ACCEPTED: 'connection_accepted', // 6px - medium blur  
  REVEALED: 'revealed',                 // 0px - clear
  BLOCKED: 'blocked',                   // Hidden entirely
  SELF: 'self',                         // Always clear (own photos)
  // Legacy aliases for backwards compatibility
  HIGH_BLUR: 'unmatched',
  LOW_BLUR: 'connection_accepted', 
  CLEAR: 'revealed',
  // Legacy string values support
  high_blur: 'unmatched',
  low_blur: 'connection_accepted',
  clear: 'revealed',
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
 * Get CSS blur value based on blur state (12px / 6px / 0px)
 */
export const getBlurValue = (blurState) => {
  // Normalize legacy state names
  const normalizedState = BLUR_STATES[blurState] || blurState;
  
  switch (normalizedState) {
    case 'unmatched':
    case 'high_blur':
      return 12; // Heavy blur for unmatched
    case 'connection_accepted':
    case 'low_blur':
      return 6;  // Medium blur for connection accepted
    case 'revealed':
    case 'clear':
    case 'self':
      return 0;  // No blur after reveal or for self
    case 'blocked':
      return -1; // Special value: hide photo entirely
    default:
      return 12; // Default to heavy blur for safety
  }
};

/**
 * BlurredImage component that applies blur based on photo state.
 * 
 * Props:
 * - src: Image source URL
 * - alt: Alt text
 * - blurState: 'unmatched' | 'connection_accepted' | 'revealed' | 'blocked' | 'self'
 * - isRevealed: Boolean (legacy prop, maps to 'revealed' if true)
 * - isBlocked: Boolean (if true, hide photo entirely)
 * - isSelf: Boolean (if true, always show clear)
 * - isThumbnail: Boolean for thumbnail-specific blur
 * - fallbackInitial: Character to show when image fails
 */
const BlurredImage = ({ 
  src, 
  alt, 
  className = '', 
  blurState = null,
  isRevealed = false,
  isBlocked = false,
  isSelf = false,
  isThumbnail = false,
  fallbackInitial = '?',
  onLoad,
  ...props 
}) => {
  const [imageType, setImageType] = useState('standard');
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const imgRef = useRef(null);

  // Determine effective blur state with priority:
  // 1. Blocked → hide entirely
  // 2. Self → always clear
  // 3. blurState prop
  // 4. isRevealed prop (legacy)
  // 5. Default to unmatched
  const getEffectiveBlurState = () => {
    if (isBlocked) return 'blocked';
    if (isSelf) return 'self';
    if (blurState) {
      // Normalize legacy state names
      if (blurState === 'high_blur') return 'unmatched';
      if (blurState === 'low_blur') return 'connection_accepted';
      if (blurState === 'clear') return 'revealed';
      return blurState;
    }
    return isRevealed ? 'revealed' : 'unmatched';
  };
  
  const effectiveBlurState = getEffectiveBlurState();

  // Determine if we should use server-side blur
  const useServerBlur = effectiveBlurState === 'unmatched';
  
  // Construct the correct URL based on blur state
  const imageUrl = getPhotoUrl(src, useServerBlur);

  // All hooks must be called before any conditional returns
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

  // Calculate blur style (12px / 6px / 0px)
  const blurValue = getBlurValue(effectiveBlurState);
  
  // Always apply CSS blur when blur is needed - serves as fallback for server blur
  const cssBlurValue = blurValue < 0 ? 0 : blurValue;
  
  // Heavy blur (unmatched) uses enhanced styling for identity protection while showing silhouette
  // Medium blur (connection_accepted) uses standard blur
  const isHeavyBlur = effectiveBlurState === 'unmatched' || effectiveBlurState === 'high_blur';
  
  const blurStyle = isHeavyBlur ? {
    // Heavy blur: Identity protected, silhouette + rough colours visible
    // No dullness, consistent across all screen sizes
    filter: 'blur(8px) brightness(0.75) saturate(0.9)',
    opacity: 0.85,
    transition: 'filter 0.3s ease-out, opacity 0.3s ease-out',
    transform: 'scale(1.06)', // Slightly larger scale to prevent edge artifacts
  } : {
    filter: cssBlurValue > 0 ? `blur(${cssBlurValue}px)` : 'none',
    transition: 'filter 0.3s ease-out',
    transform: cssBlurValue > 0 ? 'scale(1.05)' : 'scale(1)', // Prevent blur edge artifacts
  };

  // If blocked, hide photo entirely (show silhouette)
  if (effectiveBlurState === 'blocked') {
    return <SilhouetteAvatar className={className} />;
  }

  // If no src or error, show silhouette (consistent with hide_photo_in_venues)
  if (!src || error) {
    return <SilhouetteAvatar className={className} />;
  }

  return (
    <div className={`relative w-full h-full overflow-hidden ${className}`} {...props}>
      <img
        ref={imgRef}
        src={imageUrl}
        alt={alt}
        className="w-full h-full object-cover"
        style={blurStyle}
        onLoad={handleLoad}
        onError={handleError}
      />
    </div>
  );
};

export default BlurredImage;
