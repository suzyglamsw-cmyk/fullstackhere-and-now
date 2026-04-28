/**
 * PeekableCard Component
 * 
 * Wraps UserCard to add Peek functionality for:
 * - Here Now venue cards
 * - Not Here discovery cards
 * 
 * Peek shows the CLEAR profile photo briefly inside the small card.
 * Does NOT touch blur logic at all - peek is a separate visual moment.
 * 
 * 1st tap: Show clear photo overlay for 0.15-0.25s inside the card
 * 2nd tap: Navigate to expanded profile (blur logic unchanged)
 */

import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { UserCard } from "./UserCard";
import axios from "axios";

const API = process.env.REACT_APP_BACKEND_URL;

// Peek duration (in milliseconds): 0.325s
const PEEK_DURATION = 325;

export const PeekableCard = ({
  user,
  peekStatus, // { can_peek, has_peeked, show_border, allow_peek, show_as }
  onPeekComplete,
  context = "venue", // "venue" for Here Now, "not_here" for Not Here
  // All other UserCard props passed through
  ...cardProps
}) => {
  const navigate = useNavigate();
  const [isPeeking, setIsPeeking] = useState(false);
  const [hasPeekedLocal, setHasPeekedLocal] = useState(peekStatus?.has_peeked || false);
  
  // Update local state when peekStatus changes (e.g., on refresh)
  useEffect(() => {
    setHasPeekedLocal(peekStatus?.has_peeked || false);
  }, [peekStatus?.has_peeked]);
  
  // Determine if peek is enabled for this target
  const allowPeek = peekStatus?.allow_peek !== false; // Default true if undefined
  
  // Determine if card can be peeked (first tap = peek)
  const canPeek = allowPeek && !hasPeekedLocal && peekStatus?.can_peek !== false;
  
  // Show gender border only if peekable
  const showBorder = canPeek;
  
  // Get border color based on gender
  const getBorderColor = () => {
    if (!showBorder) return "transparent";
    const gender = user?.show_as || peekStatus?.show_as;
    if (gender === "female") return "#FF2D8D"; // Pink
    if (gender === "male") return "#3A7BFF"; // Blue
    return "#8B5CF6"; // Purple fallback
  };
  
  // Get clear photo URL for peek
  const getClearPhotoUrl = () => {
    // Photos array contains photo IDs - need to construct full URL
    if (user?.photos && user.photos.length > 0 && user.photos[0]) {
      const photoId = user.photos[0];
      // If it's already a full URL, use it directly
      if (photoId.startsWith('http') || photoId.startsWith('/')) {
        return photoId;
      }
      // Otherwise construct the photo serve URL (without thumb=true for clear photo)
      return `${API}/api/photos/serve/${photoId}`;
    }
    // Fallback to avatar_url (also might be an ID)
    if (user?.avatar_url) {
      if (user.avatar_url.startsWith('http') || user.avatar_url.startsWith('/')) {
        return user.avatar_url;
      }
      return `${API}/api/photos/serve/${user.avatar_url}`;
    }
    return user?.photo_url || "";
  };
  
  // Handle card tap
  const handleCardClick = useCallback(async (e) => {
    e.stopPropagation();
    e.preventDefault();
    
    // If currently peeking, ignore clicks
    if (isPeeking) {
      return;
    }
    
    // If peek not enabled or already peeked -> navigate to profile
    if (!canPeek) {
      navigate(`/profile/${user.id}`);
      return;
    }
    
    // First tap = Peek (show clear photo briefly)
    try {
      // Record peek on backend
      await axios.post(`${API}/api/peek/${user.id}`);
      
      // Start peek - show clear photo
      setIsPeeking(true);
      
      // End peek after duration
      setTimeout(() => {
        setIsPeeking(false);
        setHasPeekedLocal(true);
        onPeekComplete?.(user.id);
      }, PEEK_DURATION);
      
    } catch (error) {
      console.error("Peek failed:", error);
      // If peek already used (400) or disabled (403), mark as peeked and navigate
      if (error.response?.status === 400 || error.response?.status === 403) {
        setHasPeekedLocal(true);
        navigate(`/profile/${user.id}`);
      }
    }
  }, [isPeeking, canPeek, user?.id, navigate, onPeekComplete]);
  
  const borderColor = getBorderColor();
  const clearPhotoUrl = getClearPhotoUrl();
  
  return (
    <div 
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
      {/* The normal UserCard (blurred per existing logic) - click disabled */}
      <UserCard
        user={user}
        {...cardProps}
        context={context}
        disableClick={true}
      />
      
      {/* Peek overlay - clear photo shown briefly on top */}
      {isPeeking && clearPhotoUrl && (
        <div
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
          <img
            src={clearPhotoUrl}
            alt="Peek"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "center"
            }}
          />
        </div>
      )}
    </div>
  );
};

export default PeekableCard;
