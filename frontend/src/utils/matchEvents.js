/**
 * Match Event System
 * 
 * Provides a simple event-based system for notifying components when a mutual match is created.
 * Components can listen for match events and refresh their data accordingly.
 */

const MATCH_EVENT = 'mutual-match-created';

/**
 * Dispatch a mutual match event to notify all listening components
 * @param {object} matchData - The match data including source and user info
 */
export const dispatchMatchEvent = (matchData) => {
  const event = new CustomEvent(MATCH_EVENT, {
    detail: matchData
  });
  window.dispatchEvent(event);
};

/**
 * Subscribe to mutual match events
 * @param {function} callback - Function to call when a mutual match is created
 * @returns {function} Cleanup function to remove the listener
 */
export const onMutualMatch = (callback) => {
  const handler = (event) => {
    callback(event.detail);
  };
  window.addEventListener(MATCH_EVENT, handler);
  return () => window.removeEventListener(MATCH_EVENT, handler);
};

export default { dispatchMatchEvent, onMutualMatch };
