/**
 * Presence Events Utility
 * Dispatches and listens for presence change events across the app
 * Used to trigger venue/discovery list refreshes
 */

// Event types
export const PRESENCE_EVENTS = {
  LOGOUT: 'presence:logout',
  CHECKIN: 'presence:checkin',
  CHECKOUT: 'presence:checkout',
  VENUE_CHANGE: 'presence:venue_change',
  PRESENCE_UPDATE: 'presence:update'
};

/**
 * Dispatch a presence change event
 * @param {string} eventType - One of PRESENCE_EVENTS
 * @param {object} detail - Optional event details
 */
export const dispatchPresenceEvent = (eventType, detail = {}) => {
  window.dispatchEvent(new CustomEvent(eventType, { detail }));
  // Also dispatch a generic update event
  window.dispatchEvent(new CustomEvent(PRESENCE_EVENTS.PRESENCE_UPDATE, { detail: { type: eventType, ...detail } }));
};

/**
 * Subscribe to presence change events
 * @param {function} callback - Called when any presence event occurs
 * @returns {function} Cleanup function
 */
export const onPresenceChange = (callback) => {
  const handler = (event) => callback(event.detail);
  window.addEventListener(PRESENCE_EVENTS.PRESENCE_UPDATE, handler);
  return () => window.removeEventListener(PRESENCE_EVENTS.PRESENCE_UPDATE, handler);
};

/**
 * Subscribe to visibility/focus changes (when user returns to tab)
 * @param {function} callback - Called when page becomes visible
 * @returns {function} Cleanup function
 */
export const onPageVisible = (callback) => {
  const handleVisibility = () => {
    if (document.visibilityState === 'visible') {
      callback();
    }
  };
  
  const handleFocus = () => {
    callback();
  };
  
  document.addEventListener('visibilitychange', handleVisibility);
  window.addEventListener('focus', handleFocus);
  
  return () => {
    document.removeEventListener('visibilitychange', handleVisibility);
    window.removeEventListener('focus', handleFocus);
  };
};
