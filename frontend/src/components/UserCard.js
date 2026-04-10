/**
 * Unified UserCard Component
 * Used across: Here Now (WhosHere.js), Not Here (Discovery.js), and all venue pages
 * 
 * CONSISTENT BEHAVIOR ACROSS ALL CONTEXTS:
 * - 3-stage blur: high_blur (pre-match) → low_blur (post-match) → clear (post-reveal)
 * - Name display: Initial only until post-reveal, then full name
 * - Icon layout: Name+Age left, icons (gender/rainbow/open_to_all) right, flex no-wrap
 * - Clicking any card navigates to UserProfile.js (clicked-thumb expanded view)
 * 
 * Props:
 * - user: User object with profile data
 * - isMatched: Boolean indicating if users are matched
 * - matchType: Type of match (icebreaker_accepted, chat_request_accepted, mutual_glance, etc.)
 * - photoState: 'high_blur' | 'low_blur' | 'clear' - controls blur level AND name display
 * - revealState: { iRevealed, theyRevealed } - controls reveal logic
 * - onGlance, onIcebreaker, onChatRequest, onMessage, onReveal: Action handlers
 * - onLongPress: Handler for "Not for now" action
 * - disabled: Object with action states { glance, icebreaker, chatRequest }
 * - loading: Object with loading states
 * - globalPendingRef: For confirmation hints
 * - context: 'here_now' | 'not_here' | 'discovery' | 'matches' | 'venue'
 */

import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { 
  Eye, Snowflake, MessageSquare, MessageCircle, Crown, 
  Heart, MapPin, Sparkles, Mic, UserPlus
} from "lucide-react";
import BlurredImage from "./BlurredImage";
import { ConfirmHint } from "./ConfirmHint";

// Convert photo ID/URL to full URL
// Handles multiple formats:
// - Full http URLs -> return as-is
// - /api/photos/serve/UUID -> return as-is (backend serve endpoint)
// - /api/photos/UUID -> convert to serve endpoint
// - UUID only -> convert to serve endpoint
const getPhotoUrl = (photoIdOrUrl, apiBase = '') => {
  if (!photoIdOrUrl) return null;
  // Already a full URL
  if (photoIdOrUrl.startsWith('http')) return photoIdOrUrl;
  // Already a serve endpoint path
  if (photoIdOrUrl.startsWith('/api/photos/serve/')) return photoIdOrUrl;
  // Direct photo path: /api/photos/UUID -> convert to serve endpoint
  if (photoIdOrUrl.startsWith('/api/photos/')) {
    const uuid = photoIdOrUrl.replace('/api/photos/', '');
    return `/api/photos/serve/${uuid}`;
  }
  // Just a UUID -> construct serve URL
  return `/api/photos/serve/${photoIdOrUrl}`;
};

// Silhouette Avatar for hidden photos
const SilhouetteAvatar = () => (
  <div className="w-full h-full bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center">
    <svg viewBox="0 0 100 100" className="w-2/3 h-2/3 text-slate-600">
      <circle cx="50" cy="35" r="20" fill="currentColor" />
      <ellipse cx="50" cy="85" rx="35" ry="25" fill="currentColor" />
    </svg>
  </div>
);

// ============================================================================
// SELF CARD - For current user only
// ============================================================================
export const SelfCard = ({ 
  user, 
  context = 'discovery',
  showSilhouette = false,
  onClick 
}) => {
  const navigate = useNavigate();
  
  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      navigate("/profile-tab");
    }
  };
  
  return (
    <div
      data-testid="self-card"
      onClick={handleClick}
      className="bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-2xl overflow-hidden border-2 border-indigo-500/50 hover:border-indigo-400 transition-all cursor-pointer group"
    >
      {/* Photo - CLEAR for self (never blurred except in Preview Mode) */}
      <div className="relative aspect-[3/4]">
        {showSilhouette ? (
          <SilhouetteAvatar />
        ) : (
          <img
            src={getPhotoUrl(user.avatar_url) || getPhotoUrl(user.photos?.[0]) || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200"}
            alt="You"
            className="w-full h-full object-cover"
          />
        )}
        
        {/* Top-right badges (You badge, Premium only) */}
        <div className="absolute top-2 right-2 flex flex-col gap-1.5 items-end z-10">
          {/* "You" badge */}
          <div className="px-2 py-1 rounded-full bg-indigo-500 flex items-center gap-1 shadow-lg">
            <MapPin className="w-3 h-3 text-white" />
            <span className="text-[10px] text-white font-medium">You</span>
          </div>
          
          {/* Premium badge */}
          {user.is_premium && (
            <div className="w-6 h-6 rounded-full bg-amber-500/90 flex items-center justify-center shadow-lg">
              <Crown className="w-3 h-3 text-white" />
            </div>
          )}
        </div>
        
        {/* Name overlay with icons right-aligned */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
          {/* Name + Age row with icons right-aligned - nowrap flex */}
          <div className="flex justify-between items-center flex-nowrap">
            {/* Left: Name + Age */}
            <p className="text-white font-medium truncate min-w-0 flex-shrink">
              You{user.age ? `, ${user.age}` : ""}
            </p>
            {/* Right: Icon group (horizontal) */}
            <div className="flex items-center gap-1 flex-shrink-0 ml-2">
              {user.show_as && (
                <div 
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shadow-sm ${
                    user.show_as === "male" 
                      ? "bg-blue-400/90 text-white" 
                      : "bg-pink-400/90 text-white"
                  }`}
                >
                  {user.show_as === "male" ? "M" : "F"}
                </div>
              )}
              {user.rainbow && (
                <div 
                  className="w-5 h-5 rounded-full flex items-center justify-center shadow-sm overflow-hidden"
                  style={{ 
                    background: 'linear-gradient(135deg, #ef4444 0%, #f97316 20%, #eab308 40%, #22c55e 60%, #3b82f6 80%, #8b5cf6 100%)'
                  }}
                >
                  <div className="w-3 h-3 rounded-full bg-slate-900/50" />
                </div>
              )}
              {user.open_to_all && (
                <div className="w-5 h-5 rounded-full flex items-center justify-center shadow-sm bg-amber-400/90">
                  <span className="text-[8px]">🤗</span>
                </div>
              )}
            </div>
          </div>
          {user.presence_note && (
            <p className="text-slate-400 text-xs mt-1 truncate">{user.presence_note}</p>
          )}
        </div>
      </div>
      
      {/* Action */}
      <div className="p-3">
        <Button
          size="sm"
          className="w-full bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30"
          onClick={(e) => {
            e.stopPropagation();
            handleClick();
          }}
        >
          <Eye className="w-4 h-4 mr-2" />
          View profile
        </Button>
      </div>
    </div>
  );
};

// ============================================================================
// USER CARD - For other users
// ============================================================================
export const UserCard = ({ 
  user,
  isMatched = false,
  matchType = null,
  photoState = 'high_blur', // 'high_blur' | 'low_blur' | 'clear'
  revealState = { iRevealed: false, theyRevealed: false },
  onGlance,
  onIcebreaker,
  onChatRequest,
  onMessage,
  onReveal,
  onAddFriend,
  onLongPress,
  disabled = {},
  loading = {},
  globalPendingRef,
  context = 'discovery',
  venueId = null
}) => {
  const navigate = useNavigate();
  const longPressTimer = useRef(null);
  const [longPressTriggered, setLongPressTriggered] = useState(false);
  
  // Get blur value based on photoState (same logic as BlurredImage.js)
  const getBlurValue = () => {
    switch (photoState) {
      case 'clear':
        return 0;
      case 'low_blur':
        return 4;
      case 'high_blur':
      default:
        return 12;
    }
  };
  
  // Get blur style (same approach as BlurredImage.js - always apply CSS blur)
  const getBlurStyle = () => {
    const blurValue = getBlurValue();
    return {
      filter: blurValue > 0 ? `blur(${blurValue}px)` : 'none',
      transition: 'filter 0.3s ease-out',
      transform: blurValue > 0 ? 'scale(1.05)' : 'scale(1)', // Prevent blur edge artifacts
    };
  };
  
  // Check if we should show silhouette
  const showSilhouette = user.hide_photo_in_venues && context === 'here_now' && !isMatched;
  
  // Handle card click
  const handleClick = () => {
    if (!longPressTriggered) {
      navigate(`/profile/${user.id}`);
    }
    setLongPressTriggered(false);
  };
  
  // Long press handlers for "Not for now"
  const handleTouchStart = () => {
    longPressTimer.current = setTimeout(() => {
      setLongPressTriggered(true);
      if (onLongPress) {
        onLongPress(user);
      }
    }, 500);
  };
  
  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
  };
  
  // Display name logic - Only show full name when photoState is 'clear' (post-reveal)
  // Pre-match and post-match (before reveal) show initial only
  const displayName = photoState === 'clear'
    ? `${user.display_name}${user.age ? `, ${user.age}` : ""}`
    : `${(user.display_name || "?").charAt(0)}${user.age ? `, ${user.age}` : ""}`;
  
  return (
    <div
      data-testid={`user-card-${user.id}`}
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleTouchStart}
      onMouseUp={handleTouchEnd}
      onMouseLeave={handleTouchEnd}
      className={`rounded-2xl overflow-hidden border transition-all group cursor-pointer ${
        isMatched 
          ? "bg-emerald-500/10 border-emerald-500/30 hover:border-emerald-500/50"
          : "bg-white/5 border-white/10 hover:border-indigo-500/50"
      }`}
    >
      {/* Photo */}
      <div className="relative aspect-[3/4]">
        {showSilhouette ? (
          <SilhouetteAvatar />
        ) : (
          <div className="w-full h-full overflow-hidden">
            <img
              src={getPhotoUrl(user.avatar_url) || getPhotoUrl(user.thumbnail_url) || getPhotoUrl(user.photos?.[0]) || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200"}
              alt={user.display_name}
              className="w-full h-full object-cover"
              style={getBlurStyle()}
            />
          </div>
        )}
        
        {/* Top-right badges (Premium, Match only) */}
        <div className="absolute top-2 right-2 flex flex-col gap-1.5 items-end z-10">
          {/* Premium badge */}
          {user.is_premium && (
            <div className="w-6 h-6 rounded-full bg-amber-500/90 flex items-center justify-center shadow-lg">
              <Crown className="w-3 h-3 text-white" />
            </div>
          )}
          
          {/* Match badge - for matched users */}
          {isMatched && (
            <div 
              className="w-6 h-6 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg"
              data-testid={`match-badge-${user.id}`}
            >
              <Sparkles className="w-3 h-3 text-white" />
            </div>
          )}
        </div>
        
        {/* Voice intro indicator (only when clear) */}
        {user.voice_intro_url && photoState === 'clear' && (
          <div className="absolute bottom-14 right-2 w-7 h-7 rounded-full bg-purple-500/90 flex items-center justify-center z-10">
            <Mic className="w-3.5 h-3.5 text-white" />
          </div>
        )}
        
        {/* Name overlay with icons right-aligned */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
          {/* Name + Age row with icons right-aligned - nowrap flex */}
          <div className="flex justify-between items-center flex-nowrap">
            {/* Left: Name + Age */}
            <p className="text-white font-medium truncate min-w-0 flex-shrink">{displayName}</p>
            {/* Right: Icon group (horizontal) - hidden on thumbs, shown in detail views */}
            <div className="flex items-center gap-1 flex-shrink-0 ml-2">
              {user.show_as && (
                <div 
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shadow-sm ${
                    user.show_as === "male" 
                      ? "bg-blue-400/90 text-white" 
                      : "bg-pink-400/90 text-white"
                  }`}
                >
                  {user.show_as === "male" ? "M" : "F"}
                </div>
              )}
              {user.rainbow && (
                <div 
                  className="w-5 h-5 rounded-full flex items-center justify-center shadow-sm overflow-hidden"
                  style={{ 
                    background: 'linear-gradient(135deg, #ef4444 0%, #f97316 20%, #eab308 40%, #22c55e 60%, #3b82f6 80%, #8b5cf6 100%)'
                  }}
                >
                  <div className="w-3 h-3 rounded-full bg-slate-900/50" />
                </div>
              )}
              {user.open_to_all && (
                <div className="w-5 h-5 rounded-full flex items-center justify-center shadow-sm bg-amber-400/90">
                  <span className="text-[8px]">🤗</span>
                </div>
              )}
            </div>
          </div>
          
          {/* Intent badge */}
          {user.intent && (
            <span className={`inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full ${
              user.intent === "dating" ? "bg-pink-500/30 text-pink-300" :
              user.intent === "friends" ? "bg-emerald-500/30 text-emerald-300" :
              "bg-purple-500/30 text-purple-300"
            }`}>
              {user.intent === "dating" ? "Dating" : 
               user.intent === "friends" ? "Friends" : 
               user.intent === "open_to_both" ? "Open to both" : ""}
            </span>
          )}
          
          {user.presence_note && (
            <p className="text-slate-400 text-xs mt-1 truncate">{user.presence_note}</p>
          )}
          
          {user.shy_indicator && (
            <div className="flex items-center gap-1 mt-1">
              <Heart className="w-3 h-3 text-pink-400" />
              <span className="text-pink-300 text-xs">May be shy</span>
            </div>
          )}
        </div>
      </div>
      
      {/* Matched Banner */}
      {isMatched && (
        <div className="bg-emerald-500/20 border-t border-emerald-500/30 px-3 py-2">
          <p className="text-emerald-300 text-xs text-center">
            You're matched! Start a conversation
          </p>
        </div>
      )}
      
      {/* Reveal Banner (for post-match, one-sided reveal) */}
      {isMatched && revealState.theyRevealed && !revealState.iRevealed && (
        <div className="bg-indigo-500/20 border-t border-indigo-500/30 px-3 py-2">
          <p className="text-indigo-300 text-xs text-center">
            They revealed their photo. Reveal yours when ready.
          </p>
        </div>
      )}
      
      {/* Actions */}
      <div className="p-3">
        {isMatched ? (
          /* MATCHED USER: Show Message button + Add Friend */
          <div className="flex gap-2">
            <Button
              data-testid={`message-btn-${user.id}`}
              size="sm"
              className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white"
              onClick={(e) => {
                e.stopPropagation();
                if (onMessage) onMessage(user.id);
                else navigate(`/chat/${user.id}`);
              }}
            >
              <MessageCircle className="w-4 h-4 mr-2" />
              Message
            </Button>
            
            {/* Reveal button (if post-match, not revealed by me) */}
            {!revealState.iRevealed && onReveal && (
              <Button
                data-testid={`reveal-btn-${user.id}`}
                size="sm"
                variant="outline"
                className="border-indigo-500/50 text-indigo-300 hover:bg-indigo-500/20"
                onClick={(e) => {
                  e.stopPropagation();
                  onReveal(user.id);
                }}
              >
                <Eye className="w-4 h-4" />
              </Button>
            )}
            
            {/* Add Friend button (if handler provided) */}
            {onAddFriend && (
              <Button
                data-testid={`add-friend-btn-${user.id}`}
                size="sm"
                variant="ghost"
                className="text-slate-400 hover:text-white hover:bg-white/10"
                onClick={(e) => {
                  e.stopPropagation();
                  onAddFriend(user.id);
                }}
              >
                <UserPlus className="w-4 h-4" />
              </Button>
            )}
          </div>
        ) : (
          /* NON-MATCHED USER: Show pre-match actions */
          <div className="flex gap-2 justify-center">
            {/* Glance Button */}
            {disabled.glanced ? (
              <Button
                data-testid={`glance-btn-${user.id}`}
                size="icon"
                variant="ghost"
                className="w-10 h-10 rounded-full bg-pink-500/20 text-pink-400"
                disabled
              >
                <Eye className="w-5 h-5" />
              </Button>
            ) : (
              <ConfirmHint
                hint="Send a glance?"
                onConfirm={() => onGlance && onGlance(user.id, venueId)}
                disabled={loading.glance}
                globalPendingRef={globalPendingRef}
                compact
              >
                <Button
                  data-testid={`glance-btn-${user.id}`}
                  size="icon"
                  variant="ghost"
                  className="w-10 h-10 rounded-full bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white"
                  disabled={loading.glance}
                >
                  <Eye className="w-5 h-5" />
                </Button>
              </ConfirmHint>
            )}
            
            {/* Icebreaker Button */}
            {disabled.icebreaker ? (
              <Button
                data-testid={`icebreaker-btn-${user.id}`}
                size="icon"
                variant="ghost"
                className="w-10 h-10 rounded-full bg-cyan-500/20 text-cyan-400"
                disabled
              >
                <Snowflake className="w-5 h-5" />
              </Button>
            ) : (
              <ConfirmHint
                hint="Send an icebreaker?"
                onConfirm={() => onIcebreaker && onIcebreaker(user)}
                disabled={loading.icebreaker}
                globalPendingRef={globalPendingRef}
                compact
              >
                <Button
                  data-testid={`icebreaker-btn-${user.id}`}
                  size="icon"
                  variant="ghost"
                  className="w-10 h-10 rounded-full bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white"
                  disabled={loading.icebreaker}
                >
                  <Snowflake className="w-5 h-5" />
                </Button>
              </ConfirmHint>
            )}
            
            {/* Chat Request Button */}
            {disabled.chatRequest ? (
              <Button
                data-testid={`chat-request-btn-${user.id}`}
                size="icon"
                variant="ghost"
                className="w-10 h-10 rounded-full bg-purple-500/20 text-purple-400"
                disabled
              >
                <MessageSquare className="w-5 h-5" />
              </Button>
            ) : (
              <ConfirmHint
                hint="Send a chat request?"
                onConfirm={() => onChatRequest && onChatRequest(user.id, venueId)}
                disabled={loading.chatRequest}
                globalPendingRef={globalPendingRef}
                compact
              >
                <Button
                  data-testid={`chat-request-btn-${user.id}`}
                  size="icon"
                  variant="ghost"
                  className="w-10 h-10 rounded-full bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white"
                  disabled={loading.chatRequest}
                >
                  <MessageSquare className="w-5 h-5" />
                </Button>
              </ConfirmHint>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default UserCard;
