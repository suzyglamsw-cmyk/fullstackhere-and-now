/**
 * PeekableCard Component - Radial Iris Peek v2
 * 
 * Simple iris effect using clip-path circle animation
 * Updated: Forces circular iris for ALL users
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { UserCard } from "./UserCard";
import axios from "axios";

const API = process.env.REACT_APP_BACKEND_URL;
const PEEK_DURATION = 1200; // Shorter duration for quick tease

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
  const cardRef = useRef(null);
  const timeoutRef = useRef(null);
  
  useEffect(() => {
    setHasPeekedLocal(peekStatus?.has_peeked || false);
  }, [peekStatus?.has_peeked]);
  
  // Cancel on visibility change
  useEffect(() => {
    const onHide = () => {
      if (document.hidden && isPeeking) {
        setIsPeeking(false);
        clearTimeout(timeoutRef.current);
      }
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [isPeeking]);
  
  const allowPeek = peekStatus?.allow_peek !== false;
  const hideInVenues = user?.hide_photo_in_venues === true;
  const isMutual = isMatched || user?.is_connection_accepted;
  const peekDisabled = isMutual || (context === "venue" && hideInVenues);
  const canPeek = allowPeek && !hasPeekedLocal && !peekDisabled && peekStatus?.can_peek !== false;
  const showBorder = canPeek;
  
  const getBorderColor = () => {
    if (!showBorder) return "transparent";
    const g = user?.show_as || peekStatus?.show_as;
    return g === "female" ? "#FF2D8D" : g === "male" ? "#3A7BFF" : "#8B5CF6";
  };
  
  const getPhotoUrl = () => {
    const p = user?.photos?.[0] || user?.avatar_url || user?.photo_url || "";
    if (!p) return "";
    return p.startsWith('/api/') || p.startsWith('http') ? p : `/api/photos/serve/${p}`;
  };
  
  const addBlurParam = (url, blur) => {
    if (!url) return "";
    const val = blur ? 'true' : 'false';
    if (url.includes('blur=')) return url.replace(/blur=(true|false)/g, `blur=${val}`);
    return url + (url.includes('?') ? '&' : '?') + `blur=${val}`;
  };
  
  const clearUrl = addBlurParam(getPhotoUrl(), false);
  const blurUrl = addBlurParam(getPhotoUrl(), true);
  
  // Preload clear image
  useEffect(() => {
    if (canPeek && clearUrl) {
      const img = new Image();
      img.src = clearUrl;
    }
  }, [canPeek, clearUrl]);
  
  const handleClick = useCallback(async (e) => {
    e.stopPropagation();
    e.preventDefault();
    
    if (isPeeking) return;
    
    if (!canPeek) {
      navigate(`/profile/${user.id}`);
      return;
    }
    
    try {
      await axios.post(`${API}/api/peek/${user.id}`);
    } catch (err) {
      if (err.response?.status === 400 || err.response?.status === 403) {
        setHasPeekedLocal(true);
        navigate(`/profile/${user.id}`);
        return;
      }
    }
    
    setIsPeeking(true);
    
    timeoutRef.current = setTimeout(() => {
      setIsPeeking(false);
      setHasPeekedLocal(true);
      onPeekComplete?.(user.id);
    }, PEEK_DURATION);
    
  }, [isPeeking, canPeek, user?.id, navigate, onPeekComplete]);
  
  const uid = user?.id?.replace(/-/g, '') || 'default';
  
  return (
    <div 
      ref={cardRef}
      className="peekable-card-wrapper"
      onClick={handleClick}
      style={{
        position: "relative",
        borderRadius: "1rem",
        overflow: "hidden",
        boxShadow: showBorder ? `0 0 0 3px ${getBorderColor()}` : "none",
        transition: "box-shadow 0.3s ease",
        cursor: "pointer"
      }}
    >
      <UserCard
        user={user}
        {...cardProps}
        context={context}
        isMatched={isMatched}
        disableClick={true}
      />
      
      {isPeeking && (
        <>
          {/* Overlay container */}
          <div style={{
            position: "absolute",
            inset: 0,
            zIndex: 50,
            borderRadius: "1rem",
            overflow: "hidden",
            pointerEvents: "none"
          }}>
            {/* Blurred background */}
            <img
              src={blurUrl}
              alt=""
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
                filter: "blur(12px)",
                transform: "scale(1.05)"
              }}
            />
            
            {/* Clear image with iris clip-path */}
            <img
              src={clearUrl}
              alt=""
              className={`iris-${uid}`}
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
                clipPath: "circle(0% at 50% 50%)"
              }}
            />
          </div>
          
          <style>{`
            .iris-${uid} {
              animation: irisOpen-${uid} ${PEEK_DURATION}ms ease-out forwards;
            }
            @keyframes irisOpen-${uid} {
              0% { clip-path: circle(0% at 50% 50%); }
              70% { clip-path: circle(35% at 50% 50%); }
              85% { clip-path: circle(40% at 50% 50%); }
              100% { clip-path: circle(0% at 50% 50%); }
            }
          `}</style>
        </>
      )}
    </div>
  );
};

export default PeekableCard;
