/**
 * NotForNowSheet - Bottom sheet for snoozing profiles
 * Snooze action that hides a profile for 90 days without blocking
 */

import { Button } from "@/components/ui/button";
import { Clock } from "lucide-react";

export const NotForNowSheet = ({ 
  isOpen, 
  onClose, 
  onConfirm,
  userName 
}) => {
  if (!isOpen) return null;
  
  return (
    <div 
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-lg bg-slate-900 rounded-t-3xl p-6 pb-10 animate-in slide-in-from-bottom duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle bar */}
        <div className="w-12 h-1 bg-slate-700 rounded-full mx-auto mb-6" />
        
        {/* Header with icon */}
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center">
            <Clock className="w-5 h-5 text-slate-300" />
          </div>
          <h2 className="text-xl font-bold text-white">Snooze</h2>
        </div>
        <p className="text-slate-400 mb-6">
          Take a break from seeing this profile. They won't be notified, and you can always undo this later.
        </p>
        
        <div className="flex flex-col gap-3">
          <Button
            data-testid="confirm-snooze"
            onClick={onConfirm}
            className="w-full bg-slate-800 hover:bg-slate-700 text-white py-6"
          >
            <Clock className="w-4 h-4 mr-2" />
            Snooze for 90 days
          </Button>
          
          <Button
            data-testid="cancel-snooze"
            variant="ghost"
            onClick={onClose}
            className="w-full text-slate-400 hover:text-white"
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NotForNowSheet;
