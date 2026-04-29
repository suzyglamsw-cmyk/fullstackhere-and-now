/**
 * PeekableCard Component - Camera Shutter Peek v6
 * 
 * Aperture-style iris that opens from pinhole and closes slowly
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { UserCard } from "./UserCard";
import axios from "axios";

const API = process.env.REACT_APP_BACKEND_URL;

// Timing: slow open, brief hold, slow close
const OPEN_DURATION = 600;    // Time to fully open
const HOLD_DURATION = 400;    // Time held open
const CLOSE_DURATION = 800;   // Time to close (slower than open)
const TOTAL_DURATION = OPEN_DURATION + HOLD_DURATION + CLOSE_DURATION;

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
    }, TOTAL_DURATION);
    
  }, [isPeeking, canPeek, user?.id, navigate, onPeekComplete]);
  
  const uid = user?.id?.replace(/-/g, '') || 'default';
  
  // Calculate keyframe percentages
  const openEnd = (OPEN_DURATION / TOTAL_DURATION * 100).toFixed(1);
  const holdEnd = ((OPEN_DURATION + HOLD_DURATION) / TOTAL_DURATION * 100).toFixed(1);
  
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
          <div style={{
            position: "absolute",
            inset: 0,
            zIndex: 50,
            borderRadius: "1rem",
            overflow: "hidden",
            pointerEvents: "none"
          }}>
            {/* Blurred base */}
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
            
            {/* Clear image with shutter mask */}
            <img
              src={clearUrl}
              alt=""
              className={`shutter-${uid}`}
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
                filter: "none",
                WebkitFilter: "none"
              }}
            />
          </div>
          
          <style>{`
            .shutter-${uid} {
              -webkit-mask-image: radial-gradient(
                circle 2px at 50% 35%,
                black 0%,
                black 60%,
                transparent 100%
              );
              mask-image: radial-gradient(
                circle 2px at 50% 35%,
                black 0%,
                black 60%,
                transparent 100%
              );
              animation: shutterAperture-${uid} ${TOTAL_DURATION}ms ease-in-out forwards;
            }
            
            @keyframes shutterAperture-${uid} {
              /* Start: tiny pinhole */
              0% {
                -webkit-mask-image: radial-gradient(
                  circle 2px at 50% 35%,
                  black 0%,
                  black 50%,
                  transparent 100%
                );
                mask-image: radial-gradient(
                  circle 2px at 50% 35%,
                  black 0%,
                  black 50%,
                  transparent 100%
                );
              }
              
              /* Opening: gradual expansion */
              ${openEnd}% {
                -webkit-mask-image: radial-gradient(
                  circle 65px at 50% 35%,
                  black 0%,
                  black 45%,
                  transparent 100%
                );
                mask-image: radial-gradient(
                  circle 65px at 50% 35%,
                  black 0%,
                  black 45%,
                  transparent 100%
                );
              }
              
              /* Hold open */
              ${holdEnd}% {
                -webkit-mask-image: radial-gradient(
                  circle 65px at 50% 35%,
                  black 0%,
                  black 45%,
                  transparent 100%
                );
                mask-image: radial-gradient(
                  circle 65px at 50% 35%,
                  black 0%,
                  black 45%,
                  transparent 100%
                );
              }
              
              /* Closing: slow retraction back to pinhole */
              100% {
                -webkit-mask-image: radial-gradient(
                  circle 2px at 50% 35%,
                  black 0%,
                  black 50%,
                  transparent 100%
                );
                mask-image: radial-gradient(
                  circle 2px at 50% 35%,
                  black 0%,
                  black 50%,
                  transparent 100%
                );
              }
            }
          `}</style>
        </>
      )}
    </div>
  );
};

export default PeekableCard;
