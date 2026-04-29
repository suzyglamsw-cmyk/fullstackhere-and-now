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
  const [cardHeight, setCardHeight] = useState(0);
  const cardRef = useRef(null);
  
  // Update local state when peekStatus changes
  useEffect(() => {
    setHasPeekedLocal(peekStatus?.has_peeked || false);
  }, [peekStatus?.has_peeked]);
  
  // Get card height for animation calculations
  useEffect(() => {
    if (cardRef.current) {
      setCardHeight(cardRef.current.offsetHeight);
    }
  }, []);
  
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
  
  // Get photo URL for peek
  const getPhotoUrl = () => {
    if (user?.photos && user.photos.length > 0 && user.photos[0]) {
      return user.photos[0];
    }
    return user?.avatar_url || user?.photo_url || "";
  };
  
  // Get clear photo URL (force blur=false)
  const getClearPhotoUrl = () => {
    let url = getPhotoUrl();
    if (!url) return "";
    
    // Parse and rebuild URL with blur=false
    // Handle both ?blur=X and &blur=X patterns
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
      
      {/* Scanner-bar Peek overlay - Moving Window Technique */}
      {isScanning && cardHeight > 0 && (
        <div
          className="scanner-container"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 50,
            borderRadius: "1rem",
            overflow: "hidden"
          }}
        >
          {/* BOTTOM LAYER: Blurred image - always visible */}
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
              zIndex: 1,
              filter: "blur(12px)",
              transform: "scale(1.1)"
            }}
          />
          
          {/* TOP LAYER: Moving window with clear image inside */}
          {/* Window moves from top:0 to top:(cardHeight - SCANNER_HEIGHT)px */}
          <div
            className="scanner-window-animated"
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              height: `${SCANNER_HEIGHT}px`,
              zIndex: 2,
              overflow: "hidden",
              /* Animation handled by CSS class with CSS variables */
              "--window-travel": `${cardHeight - SCANNER_HEIGHT}px`
            }}
          >
            {/* Clear image - height matches full card, positioned to stay visually static */}
            <img
              src={clearPhotoUrl}
              alt=""
              className="scanner-image-animated"
              style={{
                position: "absolute",
                left: 0,
                width: "100%",
                height: `${cardHeight}px`,
                objectFit: "cover",
                objectPosition: "center",
                filter: "none",
                WebkitFilter: "none",
                /* Animation handled by CSS class with CSS variables */
                "--image-travel": `-${cardHeight - SCANNER_HEIGHT}px`
              }}
            />
          </div>
          
          {/* Scanner glow line - synced with window */}
          <div
            className="scanner-glow-animated"
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              height: `${SCANNER_HEIGHT}px`,
              zIndex: 3,
              background: "linear-gradient(180deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.3) 50%, rgba(255,255,255,0.15) 100%)",
              boxShadow: "0 0 6px rgba(255,255,255,0.4)",
              pointerEvents: "none",
              "--window-travel": `${cardHeight - SCANNER_HEIGHT}px`
            }}
          />
        </div>
      )}
      
      {/* Scanner animations with pixel-based travel distances - LINEAR for perfect sync */}
      <style>{`
        @keyframes windowMovePixels {
          0% { top: 0px; }
          100% { top: var(--window-travel); }
        }
        
        @keyframes imageMovePixels {
          0% { top: 0px; }
          100% { top: var(--image-travel); }
        }
        
        .scanner-window-animated {
          top: 0px;
          animation: windowMovePixels 2s linear forwards;
        }
        
        .scanner-image-animated {
          top: 0px;
          animation: imageMovePixels 2s linear forwards;
        }
        
        .scanner-glow-animated {
          top: 0px;
          animation: windowMovePixels 2s linear forwards;
        }
      `}</style>
    </div>
  );
};

export default PeekableCard;
