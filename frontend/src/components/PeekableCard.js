/**
 * PeekableCard Component - Radial Iris Peek
 * 
 * Wraps UserCard to add radial iris Peek functionality:
 * - Circle expands from center revealing clear photo
 * - 2000ms ease-out expansion
 * - Instantly snaps back to hidden at end
 * - One peek per user per session
 * 
 * NOT available for:
 * - Mutual connections (is_connection_accepted = true)
 * - Here Now when hide_photo_in_venues = true
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { UserCard } from "./UserCard";
import axios from "axios";

const API = process.env.REACT_APP_BACKEND_URL;

const PEEK_DURATION = 2000; // 2 seconds

export const PeekableCard = ({
  user,
  peekStatus,
  onPeekComplete,
  context = "venue",
  isMatched = false,
  ...cardProps
}) => {
  const navigate = useNavigate();
  const [isPeeking, setIsPeeking] = useState(false);
  const [hasPeekedLocal, setHasPeekedLocal] = useState(peekStatus?.has_peeked || false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const cardRef = useRef(null);
  const animationRef = useRef(null);
  
  // Sync with server state
  useEffect(() => {
    setHasPeekedLocal(peekStatus?.has_peeked || false);
  }, [peekStatus?.has_peeked]);
  
  // Cancel animation if user leaves screen
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && isPeeking) {
        setIsPeeking(false);
        if (animationRef.current) {
          clearTimeout(animationRef.current);
        }
      }
    };
    
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [isPeeking]);
  
  // Peek eligibility
  const allowPeek = peekStatus?.allow_peek !== false;
  const hideInVenues = user?.hide_photo_in_venues === true;
  const isMutual = isMatched || user?.is_connection_accepted;
  const peekDisabledForContext = isMutual || (context === "venue" && hideInVenues);
  const canPeek = allowPeek && !hasPeekedLocal && !peekDisabledForContext && peekStatus?.can_peek !== false;
  
  const showBorder = canPeek;
  
  const getBorderColor = () => {
    if (!showBorder) return "transparent";
    const gender = user?.show_as || peekStatus?.show_as;
    if (gender === "female") return "#FF2D8D";
    if (gender === "male") return "#3A7BFF";
    return "#8B5CF6";
  };
  
  // Build photo URLs
  const getPhotoUrl = () => {
    let photoId = user?.photos?.[0] || user?.avatar_url || user?.photo_url || "";
    if (!photoId) return "";
    if (photoId.startsWith('/api/') || photoId.startsWith('http')) return photoId;
    return `/api/photos/serve/${photoId}`;
  };
  
  const getClearPhotoUrl = () => {
    let url = getPhotoUrl();
    if (!url) return "";
    if (url.includes('blur=')) {
      return url.replace(/blur=(true|false)/g, 'blur=false');
    }
    return url + (url.includes('?') ? '&' : '?') + 'blur=false';
  };
  
  const getBlurredPhotoUrl = () => {
    let url = getPhotoUrl();
    if (!url) return "";
    if (url.includes('blur=')) {
      return url.replace(/blur=(true|false)/g, 'blur=true');
    }
    return url + (url.includes('?') ? '&' : '?') + 'blur=true';
  };
  
  const clearPhotoUrl = getClearPhotoUrl();
  const blurredPhotoUrl = getBlurredPhotoUrl();
  
  // Preload clear image
  useEffect(() => {
    if (canPeek && clearPhotoUrl) {
      const img = new Image();
      img.onload = () => setImageLoaded(true);
      img.src = clearPhotoUrl;
    }
  }, [canPeek, clearPhotoUrl]);
  
  // Handle tap
  const handleCardClick = useCallback(async (e) => {
    e.stopPropagation();
    e.preventDefault();
    
    if (isPeeking) return;
    
    if (!canPeek) {
      navigate(`/profile/${user.id}`);
      return;
    }
    
    // Record peek on server
    try {
      await axios.post(`${API}/api/peek/${user.id}`);
    } catch (error) {
      if (error.response?.status === 400 || error.response?.status === 403) {
        setHasPeekedLocal(true);
        navigate(`/profile/${user.id}`);
        return;
      }
    }
    
    // Wait for image if not ready
    if (!imageLoaded) {
      const img = new Image();
      img.src = clearPhotoUrl;
      await new Promise(r => {
        img.onload = r;
        setTimeout(r, 300);
      });
    }
    
    // Start iris animation
    setIsPeeking(true);
    
    // End after duration
    animationRef.current = setTimeout(() => {
      setIsPeeking(false);
      setHasPeekedLocal(true);
      onPeekComplete?.(user.id);
    }, PEEK_DURATION);
    
  }, [isPeeking, canPeek, user?.id, navigate, onPeekComplete, imageLoaded, clearPhotoUrl]);
  
  const borderColor = getBorderColor();
  
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
      {/* Base UserCard */}
      <UserCard
        user={user}
        {...cardProps}
        context={context}
        isMatched={isMatched}
        disableClick={true}
      />
      
      {/* Radial Iris Peek Overlay */}
      {isPeeking && (
        <div
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
          {/* Bottom layer: Blurred image */}
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
          
          {/* Top layer: Clear image inside expanding circle */}
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              width: "150%",
              height: "150%",
              transform: "translate(-50%, -50%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <div
              className={`iris-circle iris-circle-${user.id.replace(/-/g, '')}`}
              style={{
                width: "100%",
                height: "100%",
                borderRadius: "50%",
                overflow: "hidden",
                transform: "scale(0)",
                animation: `irisExpand-${user.id.replace(/-/g, '')} ${PEEK_DURATION}ms ease-out forwards`
              }}
            >
              <img
                src={clearPhotoUrl}
                alt=""
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  width: "calc(100% / 1.5)",
                  height: "calc(100% / 1.5)",
                  transform: "translate(-50%, -50%)",
                  objectFit: "cover",
                  objectPosition: "center"
                }}
              />
            </div>
          </div>
          
          {/* Unique keyframes for this user */}
          <style>{`
            @keyframes irisExpand-${user.id.replace(/-/g, '')} {
              0% { transform: scale(0); }
              95% { transform: scale(1.2); }
              100% { transform: scale(0); }
            }
          `}</style>
        </div>
      )}
    </div>
  );
};

export default PeekableCard;
