/**
 * PeekableCard Component - Soft Polygonal Iris Peek v4
 * 
 * 6-8 sided polygon with feathered edges, rotation, and gentle fade
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { UserCard } from "./UserCard";
import axios from "axios";

const API = process.env.REACT_APP_BACKEND_URL;
const EXPAND_DURATION = 400; // 350-450ms expansion
const FADE_DURATION = 250;   // 200-300ms fade out
const TOTAL_DURATION = EXPAND_DURATION + FADE_DURATION;

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
    }, TOTAL_DURATION);
    
  }, [isPeeking, canPeek, user?.id, navigate, onPeekComplete]);
  
  const uid = user?.id?.replace(/-/g, '') || 'default';
  
  // 8-sided polygon (octagon) - slightly irregular for organic feel
  const polygonShape = "polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)";
  
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
            {/* Blurred background - always visible */}
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
            
            {/* Polygon mask container - positioned above center (35% from top) */}
            <div
              className={`poly-container-${uid}`}
              style={{
                position: "absolute",
                top: "35%",
                left: "50%",
                width: "120px",
                height: "120px",
                transform: "translate(-50%, -50%) scale(0.05) rotate(0deg)",
                transformOrigin: "center center"
              }}
            >
              {/* Inner polygon with feathered edges */}
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  clipPath: polygonShape,
                  borderRadius: "8px",
                  overflow: "hidden",
                  /* Feathered edge using radial gradient mask */
                  WebkitMaskImage: "radial-gradient(ellipse 50% 50% at 50% 50%, black 50%, transparent 100%)",
                  maskImage: "radial-gradient(ellipse 50% 50% at 50% 50%, black 50%, transparent 100%)"
                }}
              >
                {/* Clear image - no blur */}
                <img
                  src={clearUrl}
                  alt=""
                  style={{
                    position: "absolute",
                    top: "-35%",
                    left: "-50%",
                    width: "calc(100vw)",
                    height: "calc(100vh)",
                    maxWidth: "none",
                    objectFit: "cover",
                    objectPosition: "center 35%",
                    filter: "none",
                    WebkitFilter: "none",
                    transform: "scale(2)"
                  }}
                />
              </div>
            </div>
            
            {/* Separate clear image properly positioned */}
            <div
              className={`poly-iris-${uid}`}
              style={{
                position: "absolute",
                inset: 0,
                opacity: 1
              }}
            >
              <img
                src={clearUrl}
                alt=""
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  filter: "none",
                  WebkitFilter: "none",
                  /* Polygon clip + feathered radial mask combined */
                  clipPath: polygonShape,
                  WebkitMaskImage: "radial-gradient(ellipse 60px 60px at 50% 35%, black 40%, transparent 100%)",
                  maskImage: "radial-gradient(ellipse 60px 60px at 50% 35%, black 40%, transparent 100%)",
                  WebkitMaskSize: "100% 100%",
                  maskSize: "100% 100%",
                  transform: "rotate(0deg)",
                  transformOrigin: "50% 35%"
                }}
              />
            </div>
          </div>
          
          <style>{`
            .poly-iris-${uid} {
              animation: polyReveal-${uid} ${TOTAL_DURATION}ms ease-out forwards;
            }
            
            .poly-iris-${uid} img {
              animation: polyMask-${uid} ${TOTAL_DURATION}ms ease-out forwards;
            }
            
            @keyframes polyReveal-${uid} {
              0% {
                opacity: 1;
              }
              ${(EXPAND_DURATION / TOTAL_DURATION * 100).toFixed(0)}% {
                opacity: 1;
              }
              100% {
                opacity: 0;
              }
            }
            
            @keyframes polyMask-${uid} {
              0% {
                -webkit-mask-image: radial-gradient(ellipse 5px 5px at 50% 35%, black 40%, transparent 100%);
                mask-image: radial-gradient(ellipse 5px 5px at 50% 35%, black 40%, transparent 100%);
                transform: rotate(0deg);
              }
              ${(EXPAND_DURATION / TOTAL_DURATION * 100).toFixed(0)}% {
                -webkit-mask-image: radial-gradient(ellipse 60px 60px at 50% 35%, black 40%, transparent 100%);
                mask-image: radial-gradient(ellipse 60px 60px at 50% 35%, black 40%, transparent 100%);
                transform: rotate(8deg);
              }
              100% {
                -webkit-mask-image: radial-gradient(ellipse 60px 60px at 50% 35%, black 40%, transparent 100%);
                mask-image: radial-gradient(ellipse 60px 60px at 50% 35%, black 40%, transparent 100%);
                transform: rotate(8deg);
              }
            }
            
            .poly-container-${uid} {
              display: none;
            }
          `}</style>
        </>
      )}
    </div>
  );
};

export default PeekableCard;
