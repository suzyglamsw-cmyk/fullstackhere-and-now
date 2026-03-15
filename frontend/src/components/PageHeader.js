import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

/**
 * Consistent page header with back button and centered title
 * Use this for full-screen pages (not modals)
 */
const PageHeader = ({ title, subtitle, backTo, onBack, rightAction, className = "" }) => {
  const navigate = useNavigate();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (backTo) {
      navigate(backTo);
    } else {
      navigate(-1);
    }
  };

  return (
    <div className={`relative flex items-center justify-center mb-6 ${className}`}>
      {/* Back button - left aligned */}
      <button
        onClick={handleBack}
        className="absolute left-0 flex items-center gap-2 text-slate-400 hover:text-white transition-colors p-2 -ml-2 rounded-xl hover:bg-white/5"
        data-testid="page-back-btn"
      >
        <ArrowLeft className="w-5 h-5" />
        <span className="text-sm font-medium">Back</span>
      </button>

      {/* Centered title */}
      <div className="text-center">
        <h1 className="text-xl font-bold text-white">{title}</h1>
        {subtitle && (
          <p className="text-slate-400 text-sm mt-0.5">{subtitle}</p>
        )}
      </div>

      {/* Right action - optional */}
      {rightAction && (
        <div className="absolute right-0">
          {rightAction}
        </div>
      )}
    </div>
  );
};

export default PageHeader;
