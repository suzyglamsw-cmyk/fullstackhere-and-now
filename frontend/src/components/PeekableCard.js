/**
 * PeekableCard Component - Scanner Bar Peek
 * 
 * Wraps UserCard to add scanner-bar Peek functionality for:
 * - Here Now venue cards (unless hide_photo_in_venues = true)
 * - Not Here discovery cards (always enabled)
 * 
 * NOT available for:
 * - Mutual connections (is_connection_accepted = true)
 * - Here Now when hide_photo_in_venues = true
 * 
 * Scanner bar animation:
 * - 2000ms duration
 * - 20% bar height
 * - Slower through middle 40% (eye/mouth zone)
 * - Only bar area is clear, rest stays blurred
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { UserCard } from "./UserCard";
import axios from "axios";

const API = process.env.REACT_APP_BACKEND_URL;

// Scanner animation duration
const SCAN_DURATION = 2000; // 2 seconds
const SCANNER_HEIGHT = 10; // pixels

export const PeekableCard = ({
  user,
  peekStatus, // { can_peek, has_peeked, show_border, allow_peek, show_as }
  onPeekComplete,
  context = "venue", // "venue" for Here Now, "not_here" for Not Here
  isMatched = false, // is_connection_accepted - mutual connection
  // All other UserCard props passed through
  ...cardProps
}) => {
  const navigate = useNavigate();
  const [isScanning, setIsScanning] = useState(false);
  const [hasPeekedLocal, setHasPeekedLocal] = useState(peekStatus?.has_peeked || false);
  const cardRef = useRef(null);
  
  // Update local state when peekStatus changes
  useEffect(() => {
    setHasPeekedLocal(peekStatus?.has_peeked || false);
  }, [peekStatus?.has_peeked]);
  
  // Determine if peek is enabled for this target
  const allowPeek = peekStatus?.allow_peek !== false;
  
  // Check if user hides photo in venues (affects Here Now only)
  const hideInVenues = user?.hide_photo_in_venues === true;
  
  // Peek is disabled for:
  // 1. Mutual connections (isMatched = true)
  // 2. Here Now when hide_photo_in_venues = true
  const isMutual = isMatched || user?.is_connection_accepted;
  const peekDisabledForContext = isMutual || (context === "venue" && hideInVenues);
  
  // Can peek if: allowed, not already peeked, not disabled for this context
  const canPeek = allowPeek && !hasPeekedLocal && !peekDisabledForContext && peekStatus?.can_peek !== false;
  
  // Show gender border only if peekable
  const showBorder = canPeek;
  
  // Get border color based on gender
  const getBorderColor = () => {
    if (!showBorder) return "transparent";
    const gender = user?.show_as || peekStatus?.show_as;
    if (gender === "female") return "#FF2D8D";
    if (gender === "male") return "#3A7BFF";
    return "#8B5CF6";
  };
  
  // Get photo URL for peek - normalize to full path
  const getPhotoUrl = () => {
    let photoId = null;
    
    // Try photos array first
    if (user?.photos && user.photos.length > 0 && user.photos[0]) {
      photoId = user.photos[0];
    } else if (user?.avatar_url) {
      // avatar_url might be full path or just ID
      photoId = user.avatar_url;
    } else if (user?.photo_url) {
      photoId = user.photo_url;
    }
    
    if (!photoId) return "";
    
    // If already a full path, return as-is
    if (photoId.startsWith('/api/') || photoId.startsWith('http')) {
      return photoId;
    }
    
    // Otherwise, construct the full path
    return `/api/photos/serve/${photoId}`;
  };
  
  // Get clear photo URL (force blur=false)
  const getClearPhotoUrl = () => {
    let url = getPhotoUrl();
    if (!url) return "";
    
    // Parse and rebuild URL with blur=false
    if (url.includes('blur=')) {
      // Replace existing blur parameter value
      url = url.replace(/blur=(true|false)/g, 'blur=false');
    } else if (url.includes('?')) {
      // Has query params but no blur - add blur=false
      url = url + '&blur=false';
    } else {
      // No query params - add blur=false
      url = url + '?blur=false';
    }
    return url;
  };
  
  // Get blurred photo URL (force blur=true)
  const getBlurredPhotoUrl = () => {
    let url = getPhotoUrl();
    if (!url) return "";
    
    // Parse and rebuild URL with blur=true
    if (url.includes('blur=')) {
      // Replace existing blur parameter value
      url = url.replace(/blur=(true|false)/g, 'blur=true');
    } else if (url.includes('?')) {
      // Has query params but no blur - add blur=true
      url = url + '&blur=true';
    } else {
      // No query params - add blur=true
      url = url + '?blur=true';
    }
    return url;
  };
  
  // Handle card tap
  const handleCardClick = useCallback(async (e) => {
    e.stopPropagation();
    e.preventDefault();
    
    // If scanning, ignore clicks
    if (isScanning) return;
    
    // If peek not available, navigate to profile
    if (!canPeek) {
      navigate(`/profile/${user.id}`);
      return;
    }
    
    // Start scanner-bar peek
    try {
      await axios.post(`${API}/api/peek/${user.id}`);
      
      setIsScanning(true);
      
      // End scan after duration
      setTimeout(() => {
        setIsScanning(false);
        setHasPeekedLocal(true);
        onPeekComplete?.(user.id);
      }, SCAN_DURATION);
      
    } catch (error) {
      console.error("Peek failed:", error);
      if (error.response?.status === 400 || error.response?.status === 403) {
        setHasPeekedLocal(true);
        navigate(`/profile/${user.id}`);
      }
    }
  }, [isScanning, canPeek, user?.id, navigate, onPeekComplete]);
  
  const borderColor = getBorderColor();
  const clearPhotoUrl = getClearPhotoUrl();
  const blurredPhotoUrl = getBlurredPhotoUrl();
  
  return (
    <div 
      ref={cardRef}
      className="peekable-card-wrapper"
      style={{
        position: "relative",
        borderRadius: "1rem",
        overflow: "hidden",
        boxShadow: showBorder ? `0 0 0 3px ${borderColor}` : "none",
        transition: "box-shadow 0.3s ease",
        cursor: "pointer"
      }}
      onClick={handleCardClick}
    >
      {/* The normal UserCard - click disabled */}
      <UserCard
        user={user}
        {...cardProps}
        context={context}
        isMatched={isMatched}
        disableClick={true}
      />
      
      {/* Scanner-bar Peek overlay - Single layer with animated mask */}
      {isScanning && (
        <div
          className="scanner-overlay"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 50,
            borderRadius: "1rem",
            overflow: "hidden",
            pointerEvents: "none"
          }}
        >
          {/* Blurred background layer - always visible */}
          <img
            src={blurredPhotoUrl}
            alt=""
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "center",
              filter: "blur(12px)",
              transform: "scale(1.05)"
            }}
          />
          
          {/* Clear image - masked to show only scanning band */}
          <div 
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              overflow: "hidden",
              clipPath: "polygon(0 0%, 100% 0%, 100% 5%, 0 5%)",
              animation: `peekScan_${user.id.replace(/-/g, '')} 2s linear forwards`
            }}
          >
            <img
              src={clearPhotoUrl}
              alt=""
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
                objectPosition: "center",
                filter: "none",
                WebkitFilter: "none"
              }}
            />
          </div>
          
          {/* Scanner glow line */}
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              height: "12px",
              top: "0%",
              background: "linear-gradient(180deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.4) 50%, rgba(255,255,255,0.1) 100%)",
              boxShadow: "0 0 15px rgba(255,255,255,0.7)",
              pointerEvents: "none",
              animation: `peekLine_${user.id.replace(/-/g, '')} 2s linear forwards`
            }}
          />
          
          {/* Unique keyframes for this specific user to avoid conflicts */}
          <style>{`
            @keyframes peekScan_${user.id.replace(/-/g, '')} {
              0% { clip-path: polygon(0 0%, 100% 0%, 100% 5%, 0 5%); }
              100% { clip-path: polygon(0 95%, 100% 95%, 100% 100%, 0 100%); }
            }
            @keyframes peekLine_${user.id.replace(/-/g, '')} {
              0% { top: 0%; }
              100% { top: calc(100% - 12px); }
            }
          `}</style>
        </div>
      )}
    </div>
  );
};

export default PeekableCard;
