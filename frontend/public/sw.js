// Service Worker for Here & Now Push Notifications
// This file should be in the public folder

const CACHE_NAME = 'here-and-now-v1';

// Install event - cache essential files
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  event.waitUntil(clients.claim());
});

// Push event - receive and show notification
self.addEventListener('push', (event) => {
  console.log('[SW] Push received:', event);
  
  let data = {
    title: 'Here & Now',
    body: 'You have a new notification',
    icon: '/logo192.png',
    badge: '/logo192.png',
    data: {}
  };
  
  if (event.data) {
    try {
      const payload = event.data.json();
      console.log('[SW] Push payload:', payload);
      data = { ...data, ...payload };
    } catch (e) {
      console.error('[SW] Error parsing push data:', e);
      data.body = event.data.text();
    }
  }
  
  const options = {
    body: data.body,
    icon: data.icon || '/logo192.png',
    badge: data.badge || '/logo192.png',
    vibrate: [200, 100, 200],
    data: data.data || {},
    actions: getActionsForType(data.data?.type),
    tag: data.data?.type || 'default',
    renotify: true,
    requireInteraction: data.data?.type === 'match' || data.data?.type === 'drink',
    silent: false
  };
  
  console.log('[SW] Showing notification:', data.title, options);
  
  event.waitUntil(
    self.registration.showNotification(data.title, options)
      .then(() => console.log('[SW] Notification shown successfully'))
      .catch((err) => console.error('[SW] Failed to show notification:', err))
  );
});

// Helper function to get actions based on notification type
function getActionsForType(type) {
  switch (type) {
    case 'match':
      return [
        { action: 'view', title: 'View Match' },
        { action: 'dismiss', title: 'Dismiss' }
      ];
    case 'drink':
      return [
        { action: 'accept', title: 'Accept' },
        { action: 'dismiss', title: 'Dismiss' }
      ];
    case 'message':
      return [
        { action: 'reply', title: 'Reply' },
        { action: 'dismiss', title: 'Dismiss' }
      ];
    case 'glance':
      return [
        { action: 'view', title: 'See Who\'s Here' },
        { action: 'dismiss', title: 'Dismiss' }
      ];
    default:
      return [];
  }
}

// Notification click event - handle user interaction
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event);
  event.notification.close();
  
  const data = event.notification.data || {};
  let url = '/notifications';
  
  // Determine URL based on notification type and action
  if (event.action === 'dismiss') {
    return;
  }
  
  switch (data.type) {
    case 'match':
      // Navigate to chat with the matched user
      if (data.from_user_id) {
        url = `/chat/${data.from_user_id}`;
      } else {
        url = '/notifications';
      }
      break;
    case 'glance':
      // Navigate to notifications to see who glanced
      url = '/notifications';
      break;
    case 'drink':
    case 'chat_request':
      // Navigate to notifications to respond
      url = '/notifications';
      break;
    case 'message':
      // Navigate directly to chat with sender
      if (data.from_user_id) {
        url = `/chat/${data.from_user_id}`;
      } else {
        url = '/notifications';
      }
      break;
    default:
      url = '/notifications';
  }
  
  console.log('[SW] Navigating to:', url);
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Check if there's already a window open
        for (const client of clientList) {
          if (client.url.includes(self.registration.scope) && 'focus' in client) {
            client.navigate(url);
            return client.focus();
          }
        }
        // Open a new window if none is open
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      })
  );
});

// Notification close event
self.addEventListener('notificationclose', (event) => {
  console.log('[SW] Notification closed:', event);
});

// Background sync for offline actions (future enhancement)
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag);
});

console.log('[SW] Service worker loaded');
