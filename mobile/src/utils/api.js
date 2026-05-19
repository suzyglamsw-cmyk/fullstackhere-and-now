import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { API_URL } from './constants';

// Create axios instance
const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  async (config) => {
    try {
      const token = await SecureStore.getItemAsync('authToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.log('Error getting token:', error);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Token expired - clear storage
      await SecureStore.deleteItemAsync('authToken');
      // Navigation to login will be handled by AuthContext
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: (email, password) => api.post('/api/auth/login', { email, password }),
  register: (data) => api.post('/api/auth/register', data),
  me: () => api.get('/api/auth/me'),
  updateProfile: (data) => api.put('/api/auth/profile', data),
  forgotPassword: (email) => api.post('/api/auth/forgot-password', { email }),
  resetPassword: (token, password) => api.post('/api/auth/reset-password', { token, password }),
};

// Venues API
export const venuesAPI = {
  nearby: (lat, lng, radius = 5) => api.get(`/api/venues/nearby?lat=${lat}&lng=${lng}&radius=${radius}`),
  details: (venueId) => api.get(`/api/venues/${venueId}`),
  people: (venueId) => api.get(`/api/venues/${venueId}/people`),
  checkIn: (venueId, lat, lng) => api.post('/api/checkin', { venue_id: venueId, lat, lng }),
  checkOut: () => api.post('/api/checkout'),
  currentCheckIn: () => api.get('/api/checkin/current'),
};

// Discovery API
export const discoveryAPI = {
  notHere: (lat, lng, radius = 25) => api.get(`/api/discovery/not-here?lat=${lat}&lng=${lng}&radius=${radius}`),
};

// Connections API
export const connectionsAPI = {
  // Glances
  sendGlance: (targetId) => api.post(`/api/connections/glance/${targetId}`),
  getGlances: () => api.get('/api/connections/glances'),
  
  // Reveals
  sendReveal: (targetId) => api.post(`/api/connections/reveal/${targetId}`),
  getReveals: () => api.get('/api/connections/revealed-to-me'),
  acceptReveal: (revealId) => api.post(`/api/connections/reveal/${revealId}/accept`),
  
  // Icebreakers
  sendIcebreaker: (targetId, message) => api.post(`/api/connections/icebreaker/${targetId}`, { message }),
  getIcebreakers: () => api.get('/api/connections/icebreakers'),
  
  // Chat Requests
  sendChatRequest: (targetId, message) => api.post(`/api/connections/chat-request/${targetId}`, { message }),
  getChatRequests: () => api.get('/api/connections/chat-requests'),
  acceptChatRequest: (requestId) => api.post(`/api/connections/chat-request/${requestId}/accept`),
  
  // Mutual connections
  getMutuals: () => api.get('/api/connections/mutuals'),
  
  // Peek
  sendPeek: (targetId) => api.post(`/api/peek/${targetId}`),
  getPeekStatus: (targetId) => api.get(`/api/peek/status/${targetId}`),
  getPeekBatch: (userIds) => api.get(`/api/peek/batch?user_ids=${userIds.join(',')}`),
};

// Messages API
export const messagesAPI = {
  getThreads: () => api.get('/api/messages/threads'),
  getMessages: (threadId) => api.get(`/api/messages/thread/${threadId}`),
  sendMessage: (threadId, content) => api.post(`/api/messages/thread/${threadId}`, { content }),
  markRead: (threadId) => api.post(`/api/messages/thread/${threadId}/read`),
};

// Photos API
export const photosAPI = {
  upload: (formData) => api.post('/api/photos/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  delete: (photoId) => api.delete(`/api/photos/${photoId}`),
  getUrl: (photoId, blur = true) => `${API_URL}/api/photos/serve/${photoId}?blur=${blur}`,
};

/**
 * Canonical photo URL builder - USE THIS FOR ALL USER PHOTO LOADS
 * 
 * @param {Object} user - User object containing photos array and/or avatar_url
 * @param {Object} options - Configuration options
 * @param {number} options.index - Photo index to retrieve (default: 0)
 * @param {boolean} options.blur - Whether to request blurred version from server (default: true)
 * @param {string} options.revealState - 'both_revealed' | 'one_revealed' | 'none' for reveal logic
 * @param {boolean} options.isMutual - Whether this is a mutual connection
 * @returns {string|null} - The photo URL or null if no photo available
 */
export const buildPhotoUrl = (user, options = {}) => {
  const { 
    index = 0, 
    blur = true, 
    revealState = 'none',
    isMutual = false 
  } = options;

  // If no user, return null
  if (!user) return null;

  // Determine if we should show clear image
  // Only clear when reveal_state === 'both_revealed'
  const shouldBlur = revealState !== 'both_revealed' && blur;

  // Check for photos array first (preferred)
  if (user.photos && user.photos[index]) {
    const photoId = user.photos[index];
    return `${API_URL}/api/photos/serve/${photoId}?blur=${shouldBlur}`;
  }

  // Fallback to avatar_url
  if (user.avatar_url) {
    // If it's already a full URL, return as-is
    if (user.avatar_url.startsWith('http')) {
      return user.avatar_url;
    }
    // Otherwise prepend API_URL
    return `${API_URL}${user.avatar_url}`;
  }

  return null;
};

/**
 * Get blur radius for React Native Image component
 * Based on reveal state and connection type
 * 
 * @param {string} revealState - 'both_revealed' | 'one_revealed' | 'none'
 * @param {boolean} isMutual - Whether this is a mutual connection
 * @param {string} context - 'herehub' | 'venue' | 'profile' | 'discovery'
 * @returns {number} - Blur radius value
 */
export const getBlurRadius = (revealState, isMutual = false, context = 'default') => {
  // Clear only when both have revealed
  if (revealState === 'both_revealed') {
    return 0;
  }
  
  // HereHub uses LIGHT blur (5)
  if (context === 'herehub') {
    return 5;
  }
  
  // Mutual connections get lighter blur
  if (isMutual) {
    return 6;
  }
  
  // Default heavy blur
  return 12;
};

// Voice Intro API
export const voiceAPI = {
  upload: (formData) => api.post('/api/profile/voice-intro', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  delete: () => api.delete('/api/profile/voice-intro'),
};

// Settings API
export const settingsAPI = {
  getPrivacy: () => api.get('/api/settings/privacy'),
  updatePrivacy: (data) => api.put('/api/settings/privacy', data),
  registerPush: (token) => api.post('/api/push/mobile/register', { token, platform: 'android' }),
  unregisterPush: () => api.delete('/api/push/mobile/unregister'),
  getPushSettings: () => api.get('/api/push/settings'),
  updatePushSettings: (data) => api.put('/api/push/settings', data),
};

// Premium API
export const premiumAPI = {
  getStatus: () => api.get('/api/premium/status'),
  createCheckout: (priceId) => api.post('/api/stripe/create-checkout-session', { price_id: priceId }),
};

export default api;
