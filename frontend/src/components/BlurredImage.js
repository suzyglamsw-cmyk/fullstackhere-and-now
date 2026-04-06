import { useState, useRef, useEffect } from 'react';
import { analyzeImageType, getBlurStrength, getBlurStyle } from '../utils/imageBlur';
import { API } from '../App';

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
 * BlurredImage component that applies blur based on reveal status.
 * Uses server-side blurred images for pre-reveal, with CSS blur as fallback.
 */
const BlurredImage = ({ 
  src, 
  alt, 
  className = '', 
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

  // Construct the correct URL based on reveal status
  const imageUrl = getPhotoUrl(src, !isRevealed);

  useEffect(() => {
    // Reset state when src changes
    setLoaded(false);
    setError(false);
    setImageType('standard');
  }, [src, isRevealed]);

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
        className={`w-full h-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center ${className}`}
        {...props}
      >
        <span className="text-4xl text-slate-400">
          {fallbackInitial}
        </span>
      </div>
    );
  }

  // For server-side blurred images, we don't need additional CSS blur
  // But keep CSS blur as fallback for external images or legacy photos
  const needsCssBlur = src.startsWith('http') && !isRevealed;
  const blurStrength = needsCssBlur ? getBlurStrength(imageType, isThumbnail) : 0;
  const blurStyle = getBlurStyle(blurStrength, isRevealed || !needsCssBlur);

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
