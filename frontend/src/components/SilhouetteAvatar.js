/**
 * SilhouetteAvatar - Consistent silhouette component for hidden photos
 * 
 * Used when:
 * - User has hide_photo_in_venues enabled and is not connected
 * - Server returns avatar_url: null (privacy enforcement)
 * - User is blocked
 * 
 * This provides a consistent visual across the entire app.
 */

const SilhouetteAvatar = ({ className = "", size = "full" }) => {
  // Size variants for different use cases
  const sizeClasses = {
    full: "w-full h-full",
    sm: "w-10 h-10",
    md: "w-12 h-12", 
    lg: "w-16 h-16",
    xl: "w-20 h-20",
  };

  return (
    <div 
      className={`${sizeClasses[size] || sizeClasses.full} bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center ${className}`}
      data-testid="silhouette-avatar"
    >
      <svg viewBox="0 0 100 100" className="w-2/3 h-2/3 text-slate-600">
        <circle cx="50" cy="35" r="20" fill="currentColor" />
        <ellipse cx="50" cy="85" rx="35" ry="25" fill="currentColor" />
      </svg>
    </div>
  );
};

export default SilhouetteAvatar;
