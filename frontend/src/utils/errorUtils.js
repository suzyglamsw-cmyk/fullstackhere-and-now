/**
 * Extract a user-friendly error message from API error responses
 * Handles FastAPI/Pydantic validation errors which come as arrays of objects
 * @param {Error} error - Axios error object
 * @param {string} fallback - Fallback message if extraction fails
 * @returns {string} - Human-readable error message (always a string)
 */
export const getErrorMessage = (error, fallback = "An error occurred") => {
  try {
    const detail = error?.response?.data?.detail;
    
    // If detail is already a string, return it
    if (typeof detail === "string") {
      return detail;
    }
    
    // Handle Pydantic validation errors: [{loc: [...], msg: "...", type: "..."}]
    if (Array.isArray(detail) && detail.length > 0) {
      const firstError = detail[0];
      if (firstError && typeof firstError === "object") {
        const msg = firstError.msg || firstError.message;
        if (typeof msg === "string") {
          return msg;
        }
      }
      // If we can't extract a message, stringify the first error
      return fallback;
    }
    
    // Handle object with msg or message property
    if (detail && typeof detail === "object") {
      const msg = detail.msg || detail.message;
      if (typeof msg === "string") {
        return msg;
      }
      return fallback;
    }
    
    // Check for error message in other common locations
    if (error?.message && typeof error.message === "string") {
      return error.message;
    }
    
    return fallback;
  } catch (e) {
    // If anything goes wrong, return the fallback
    return fallback;
  }
};
