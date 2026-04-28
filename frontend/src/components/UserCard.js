/**
 * Unified UserCard Component
 * Used across: Here Now (WhosHere.js), Not Here (Discovery.js), and all venue pages
 * 
 * BLUR STATES (12px / 6px / 0px):
 * - unmatched (12px): No interaction, one-way glance/icebreaker
 * - connection_accepted (6px): Mutual glance OR icebreaker accepted
 * - revealed (0px): Both users pressed Reveal
 * - blocked: Photo hidden entirely
 * - self: Always clear (own photos)
 * 
 * Props:
 * - user: User object with profile data
 * - photoState: 'unmatched' | 'connection_accepted' | 'revealed' | 'blocked' | 'self'
 * - isBlocked: Boolean - if true, hide photo entirely
 * - isSelf: Boolean - if true, always show clear
 * - revealState: { iRevealed, theyRevealed } - controls reveal logic
 * - onGlance, onIcebreaker, onChatRequest, onMessage, onReveal: Action handlers
 * - onSnooze: Handler for "Snooze" action (replaces long-press)
 * - disabled: Object with action states { glance, icebreaker, chatRequest }
 * - loading: Object with loading states
 * - globalPendingRef: For confirmation hints
 * - context: 'here_now' | 'not_here' | 'discovery' | 'matches' | 'venue'
 */

import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { 
  Eye, Snowflake, MessageSquare, MessageCircle, Crown, 
  Heart, MapPin, Sparkles, Mic, UserPlus, Clock
} from "lucide-react";
import BlurredImage, { getBlurValue } from "./BlurredImage";
import { ConfirmHint } from "./ConfirmHint";
import SilhouetteAvatar from "./SilhouetteAvatar";

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
      <div className="relative aspect-square">
        {showSilhouette ? (
          <SilhouetteAvatar />
        ) : getPhotoUrl(user.avatar_url) || getPhotoUrl(user.photos?.[0]) ? (
          <img
            src={getPhotoUrl(user.avatar_url) || getPhotoUrl(user.photos?.[0])}
            alt="You"
            className="w-full h-full object-cover"
          />
        ) : (
          <SilhouetteAvatar />
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
          {/* Name + Age row with gender badge only */}
          <div className="flex justify-between items-center flex-nowrap">
            {/* Left: Name + Age */}
            <p className="text-white font-medium truncate min-w-0 flex-shrink">
              You{user.age ? `, ${user.age}` : ""}
            </p>
            {/* Right: Gender badge only (rainbow/open_to_all removed - shown in full profile) */}
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
  isMatched = false,  // Now equals is_connection_accepted from parent
  matchType = null,
  photoState = 'unmatched', // DEPRECATED: Now derived from backend flags (user.is_revealed, isMatched)
  isBlocked = false,
  revealState = { iRevealed: false, theyRevealed: false, is_revealed: false },
  onGlance,
  onIcebreaker,
  onChatRequest,
  onMessage,
  onReveal,
  onAddFriend,
  onSnooze,  // Replaces onLongPress - "Snooze" action
  onLongPress,  // Deprecated: kept for backward compatibility, maps to onSnooze
  disabled = {},
  loading = {},
  globalPendingRef,
  context = 'discovery',
  venueId = null
}) => {
  const navigate = useNavigate();
  
  // Handle snooze action (consolidate onSnooze and legacy onLongPress)
  const handleSnooze = (e) => {
    e.stopPropagation();
    const snoozeHandler = onSnooze || onLongPress;
    if (snoozeHandler) {
      snoozeHandler(user);
    }
  };
  
  // Determine photo state using ONLY backend flags (12px / 6px / 0px)
  // Priority: blocked → revealed → connection_accepted → unmatched
  const getEffectivePhotoState = () => {
    // 1. BLOCKED: Hide photos entirely
    if (isBlocked || user.is_blocked) return 'blocked';
    
    // 2. REVEALED (0px): ONLY when both users pressed Reveal
    if (revealState?.is_revealed || user.is_revealed) return 'revealed';
    
    // 3. CONNECTION_ACCEPTED (6px): Mutual glance, accepted icebreaker/chat
    // Use the passed isMatched prop which now equals is_connection_accepted from parent
    if (isMatched || user.is_connection_accepted) return 'connection_accepted';
    
    // 4. UNMATCHED (12px): No connection
    return 'unmatched';
  };
  
  const effectivePhotoState = getEffectivePhotoState();
  
  // Get blur style using unified blur values (12px / 6px / 0px)
  const getBlurStyle = () => {
    const blurValue = getBlurValue(effectivePhotoState);
    if (blurValue < 0) {
      // Blocked - will be handled by showing placeholder
      return { display: 'none' };
    }
    return {
      filter: blurValue > 0 ? `blur(${blurValue}px)` : 'none',
      transition: 'filter 0.3s ease-out',
      transform: blurValue > 0 ? 'scale(1.05)' : 'scale(1)', // Prevent blur edge artifacts
    };
  };
  
  // Check if we should show silhouette:
  // 1. Blocked users
  // 2. User has hide_photo_in_venues enabled AND not yet connected (avatar_url is null from server)
  // 3. avatar_url is explicitly null (server-side privacy enforcement)
  const serverHiddenPhoto = user.avatar_url === null || user.avatar_url === undefined;
  const showSilhouette = effectivePhotoState === 'blocked' || 
    (user.hide_photo_in_venues && effectivePhotoState === 'unmatched') ||
    (serverHiddenPhoto && !user.is_self);
  
  // Handle card click - navigate to profile
  const handleClick = () => {
    navigate(`/profile/${user.id}`);
  };
  
  // Display name logic - Only show full name when revealed (0px blur)
  // Unmatched and connection_accepted show initial only
  const displayName = effectivePhotoState === 'revealed'
    ? `${user.display_name}${user.age ? `, ${user.age}` : ""}`
    : `${(user.display_name || "?").charAt(0)}${user.age ? `, ${user.age}` : ""}`;
  
  // Connection state for styling (used for card border color)
  const isConnected = effectivePhotoState === 'connection_accepted' || effectivePhotoState === 'revealed';
  
  return (
    <div
      data-testid={`user-card-${user.id}`}
      onClick={handleClick}
      className={`rounded-2xl overflow-hidden border transition-all group cursor-pointer ${
        isConnected 
          ? "bg-emerald-500/10 border-emerald-500/30 hover:border-emerald-500/50"
          : "bg-white/5 border-white/10 hover:border-indigo-500/50"
      }`}
    >
      {/* Photo */}
      <div className="relative aspect-square">
        {showSilhouette ? (
          <SilhouetteAvatar />
        ) : (getPhotoUrl(user.avatar_url) || getPhotoUrl(user.thumbnail_url) || getPhotoUrl(user.photos?.[0])) ? (
          <div className="w-full h-full overflow-hidden">
            <img
              src={getPhotoUrl(user.avatar_url) || getPhotoUrl(user.thumbnail_url) || getPhotoUrl(user.photos?.[0])}
              alt={user.display_name}
              className="w-full h-full object-cover"
              style={getBlurStyle()}
            />
          </div>
        ) : (
          <SilhouetteAvatar />
        )}
        
        {/* Snooze icon - Top-left corner */}
        {(onSnooze || onLongPress) && (
          <button
            data-testid={`snooze-btn-${user.id}`}
            onClick={handleSnooze}
            className="absolute top-2 left-2 w-7 h-7 rounded-full bg-slate-900/60 hover:bg-slate-800/80 flex items-center justify-center z-10 transition-all opacity-70 hover:opacity-100"
            aria-label="Snooze this person"
            title="Snooze"
          >
            <Clock className="w-3.5 h-3.5 text-slate-300" />
          </button>
        )}
        
        {/* Top-right badges (Premium only) */}
        <div className="absolute top-2 right-2 flex flex-col gap-1.5 items-end z-10">
          {/* Premium badge */}
          {user.is_premium && (
            <div className="w-6 h-6 rounded-full bg-amber-500/90 flex items-center justify-center shadow-lg">
              <Crown className="w-3 h-3 text-white" />
            </div>
          )}
        </div>
        
        {/* Voice intro indicator (only when clear) */}
        {user.voice_intro_url && photoState === 'clear' && (
          <div className="absolute bottom-14 right-2 w-7 h-7 rounded-full bg-purple-500/90 flex items-center justify-center z-10">
            <Mic className="w-3.5 h-3.5 text-white" />
          </div>
        )}
        
        {/* Name overlay */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
          {/* Name + Age - color-coded by gender (bold, exact hex) */}
          <p 
            className="text-sm font-bold truncate"
            style={{ 
              color: user.show_as === "male" ? "#3A7BFF" : 
                     user.show_as === "female" ? "#FF2D8D" : "#FFFFFF" 
            }}
          >
            {displayName}
          </p>
          
          {/* Intent badge - left-aligned, full text, below name */}
          {user.intent && (
            <div className="mt-1">
              <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${
                user.intent === "dating" ? "bg-pink-500/30 text-pink-300" :
                user.intent === "friends" ? "bg-emerald-500/30 text-emerald-300" :
                "bg-purple-500/30 text-purple-300"
              }`}>
                {user.intent === "dating" ? "Dating" : 
                 user.intent === "friends" ? "Friends" : 
                 user.intent === "open_to_both" ? "Open to both" : ""}
              </span>
            </div>
          )}
          
          {/* Presence Note - below intent badge */}
          {user.presence_note && (
            <p className="text-slate-400 text-xs mt-1.5 truncate">{user.presence_note}</p>
          )}
        </div>
      </div>
      
      {/* Mutual Connection Banner - 8px margin above */}
      {isMatched && (
        <div className="bg-emerald-500/20 border-t border-emerald-500/30 px-3 py-2 mt-2">
          <p className="text-emerald-300 text-xs text-center">
            You're mutual. Start a conversation
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
      
      {/* Actions - 10px top padding for spacing from banners */}
      <div className="p-3 pt-2.5">
        {isMatched ? (
          /* MUTUAL CONNECTION: Show Message button + Add Friend */
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
            {/* Glance Button - shows different states based on glance relationship */}
            {(() => {
              const iGlanced = disabled.glanced;  // I sent a glance to them
              const theyGlanced = user.has_glanced_at_me;  // They sent a glance to me
              const isMutualGlance = iGlanced && theyGlanced;
              
              // Mutual glance - show filled pink (connection formed)
              if (isMutualGlance) {
                return (
                  <Button
                    data-testid={`glance-btn-${user.id}`}
                    size="icon"
                    variant="ghost"
                    className="w-10 h-10 rounded-full bg-gradient-to-r from-pink-500 to-rose-500 text-white"
                    disabled
                    title="Mutual glance!"
                  >
                    <Eye className="w-5 h-5" />
                  </Button>
                );
              }
              
              // They glanced at me (incoming interest) - show amber/yellow
              if (theyGlanced && !iGlanced) {
                return (
                  <ConfirmHint
                    hint="They glanced at you! Glance back?"
                    onConfirm={() => onGlance && onGlance(user.id, venueId)}
                    disabled={loading.glance}
                    globalPendingRef={globalPendingRef}
                    compact
                  >
                    <Button
                      data-testid={`glance-btn-${user.id}`}
                      size="icon"
                      variant="ghost"
                      className="w-10 h-10 rounded-full bg-amber-500/30 text-amber-400 hover:bg-amber-500/40 ring-2 ring-amber-500/50 animate-pulse"
                      disabled={loading.glance}
                      title="They glanced at you"
                    >
                      <Eye className="w-5 h-5" />
                    </Button>
                  </ConfirmHint>
                );
              }
              
              // I glanced at them (waiting for response) - show pink outline
              if (iGlanced && !theyGlanced) {
                return (
                  <Button
                    data-testid={`glance-btn-${user.id}`}
                    size="icon"
                    variant="ghost"
                    className="w-10 h-10 rounded-full bg-pink-500/20 text-pink-400 ring-1 ring-pink-500/30"
                    disabled
                    title="Glance sent"
                  >
                    <Eye className="w-5 h-5" />
                  </Button>
                );
              }
              
              // No glances - default state
              return (
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
              );
            })()}
            
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
