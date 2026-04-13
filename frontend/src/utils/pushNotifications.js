import axios from 'axios';

// VAPID public key from environment or backend
let VAPID_PUBLIC_KEY = null;

/**
 * Convert a base64 string to Uint8Array for applicationServerKey
 */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Check if push notifications are supported
 */
export function isPushSupported() {
  return 'serviceWorker' in navigator && 
         'PushManager' in window && 
         'Notification' in window;
}

/**
 * Get the current notification permission status
 */
export function getPermissionStatus() {
  if (!('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

/**
 * Request notification permission from the user
 */
export async function requestPermission() {
  if (!('Notification' in window)) {
    throw new Error('Notifications not supported');
  }
  
  const permission = await Notification.requestPermission();
  return permission;
}

/**
 * Register the service worker
 */
export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    throw new Error('Service workers not supported');
  }
  
  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/'
    });
    console.log('Service Worker registered:', registration.scope);
    return registration;
  } catch (error) {
    console.error('Service Worker registration failed:', error);
    throw error;
  }
}

/**
 * Get VAPID public key from backend
 */
async function getVapidPublicKey(api) {
  if (VAPID_PUBLIC_KEY) {
    return VAPID_PUBLIC_KEY;
  }
  
  try {
    const response = await axios.get(`${api}/push/vapid-public-key`);
    VAPID_PUBLIC_KEY = response.data.public_key;
    return VAPID_PUBLIC_KEY;
  } catch (error) {
    console.error('Failed to get VAPID public key:', error);
    throw error;
  }
}

/**
 * Subscribe to push notifications
 */
export async function subscribeToPush(api) {
  if (!isPushSupported()) {
    throw new Error('Push notifications not supported');
  }
  
  // Request permission first
  const permission = await requestPermission();
  if (permission !== 'granted') {
    throw new Error('Notification permission denied');
  }
  
  // Register service worker
  const registration = await registerServiceWorker();
  
  // Wait for service worker to be ready
  await navigator.serviceWorker.ready;
  
  // Get VAPID public key
  const vapidPublicKey = await getVapidPublicKey(api);
  if (!vapidPublicKey) {
    throw new Error('VAPID public key not available');
  }
  
  // Subscribe to push
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
  });
  
  // Send subscription to backend
  const subscriptionJson = subscription.toJSON();
  await axios.post(`${api}/push/subscribe`, {
    endpoint: subscriptionJson.endpoint,
    keys: subscriptionJson.keys
  });
  
  console.log('Push subscription successful:', subscription.endpoint);
  return subscription;
}

/**
 * Unsubscribe from push notifications
 */
export async function unsubscribeFromPush(api) {
  if (!isPushSupported()) {
    return;
  }
  
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    
    if (subscription) {
      await subscription.unsubscribe();
      console.log('Unsubscribed from push');
    }
    
    // Notify backend
    await axios.delete(`${api}/push/unsubscribe`);
  } catch (error) {
    console.error('Error unsubscribing from push:', error);
    throw error;
  }
}

/**
 * Check if currently subscribed to push
 */
export async function isSubscribedToPush() {
  if (!isPushSupported()) {
    return false;
  }
  
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    return !!subscription;
  } catch (error) {
    console.error('Error checking push subscription:', error);
    return false;
  }
}

/**
 * Get current push subscription
 */
export async function getCurrentSubscription() {
  if (!isPushSupported()) {
    return null;
  }
  
  try {
    const registration = await navigator.serviceWorker.ready;
    return await registration.pushManager.getSubscription();
  } catch (error) {
    console.error('Error getting push subscription:', error);
    return null;
  }
}

/**
 * Ensure valid push subscription exists on app load.
 * Re-subscribes automatically if:
 * 1. No valid push subscription exists locally
 * 2. Backend indicates subscription was deleted (410 Gone)
 * 3. Permission is granted but no subscription
 * 
 * Call this on app load when user is authenticated.
 */
export async function ensureValidPushSubscription(api) {
  if (!isPushSupported()) {
    console.log('[Push] Not supported on this device');
    return null;
  }
  
  // Check if permission is granted
  const permission = getPermissionStatus();
  if (permission !== 'granted') {
    console.log('[Push] Permission not granted:', permission);
    return null;
  }
  
  try {
    // Check for existing local subscription
    const registration = await navigator.serviceWorker.ready;
    const existingSubscription = await registration.pushManager.getSubscription();
    
    if (existingSubscription) {
      // Verify with backend that subscription is still valid
      try {
        const response = await axios.get(`${api}/push/subscription-status`);
        if (response.data.valid) {
          console.log('[Push] Existing subscription is valid');
          return existingSubscription;
        } else {
          console.log('[Push] Backend reports subscription invalid, re-subscribing...');
          // Unsubscribe locally before re-subscribing
          await existingSubscription.unsubscribe();
        }
      } catch (error) {
        // If endpoint doesn't exist or returns error, re-subscribe
        if (error.response?.status === 404 || error.response?.status === 410) {
          console.log('[Push] Subscription not found on backend, re-subscribing...');
          await existingSubscription.unsubscribe();
        } else {
          // For other errors, keep existing subscription
          console.log('[Push] Backend check failed, keeping existing subscription');
          return existingSubscription;
        }
      }
    } else {
      console.log('[Push] No local subscription found');
    }
    
    // Re-subscribe with fresh token
    console.log('[Push] Creating fresh subscription...');
    const vapidPublicKey = await getVapidPublicKey(api);
    if (!vapidPublicKey) {
      console.error('[Push] VAPID public key not available');
      return null;
    }
    
    const newSubscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
    });
    
    // Send to backend
    const subscriptionJson = newSubscription.toJSON();
    await axios.post(`${api}/push/subscribe`, {
      endpoint: subscriptionJson.endpoint,
      keys: subscriptionJson.keys
    });
    
    console.log('[Push] Fresh subscription created successfully');
    return newSubscription;
  } catch (error) {
    console.error('[Push] Error ensuring valid subscription:', error);
    return null;
  }
}

export default {
  isPushSupported,
  getPermissionStatus,
  requestPermission,
  registerServiceWorker,
  subscribeToPush,
  unsubscribeFromPush,
  isSubscribedToPush,
  getCurrentSubscription,
  ensureValidPushSubscription
};
