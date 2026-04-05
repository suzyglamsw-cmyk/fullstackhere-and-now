import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth, API } from "@/App";
import { toast } from "sonner";
import axios from "axios";
import Layout from "../components/Layout";
import {
  Eye,
  Snowflake,
  MessageCircle,
  ArrowLeft,
  Loader2,
  Sparkles,
  Users,
  MoreVertical,
  Ban,
  Flag,
  Crown,
  Coins,
  X,
  Clock,
  Filter,
  ChevronDown,
  MapPin,
  User,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getErrorMessage } from "../utils/errorUtils";
import BlurredImage from "../components/BlurredImage";

const ICEBREAKER_MESSAGES = [
  { id: 0, name: "Hello", icon: "👋" },
  { id: 1, name: "You seem interesting", icon: "✨" },
  { id: 2, name: "Fancy a chat?", icon: "💬" },
  { id: 3, name: "Can I buy you a drink?", icon: "🍸" },
];

// Last Active filter options
const LAST_ACTIVE_FILTERS = [
  { value: null, label: "All users", icon: "👥" },
  { value: "now", label: "Active now", subtext: "≤2 min", icon: "🟢" },
  { value: "recent", label: "Active recently", subtext: "≤10 min", icon: "🟡" },
  { value: "hour", label: "Active this hour", subtext: "≤60 min", icon: "🟠" },
];

// Silhouette component for users who have "Hide photo in venues" enabled
const SilhouetteAvatar = ({ className = "" }) => (
  <div className={`w-full h-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center ${className}`}>
    <User className="w-1/2 h-1/2 text-slate-500/60" strokeWidth={1.5} />
  </div>
);

const WhosHere = () => {
  const { venueId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [venue, setVenue] = useState(null);
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [glancing, setGlancing] = useState(null);
  const [showIcebreakerModal, setShowIcebreakerModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [sendingIcebreaker, setSendingIcebreaker] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [glancesRemaining, setGlancesRemaining] = useState(5);
  const [lastActiveFilter, setLastActiveFilter] = useState(null);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const wsRef = useRef(null);

  useEffect(() => {
    fetchVenue();
    fetchPeople();
    fetchGlancesRemaining();
    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [venueId]);

  // Refetch people when filter changes
  useEffect(() => {
    fetchPeople();
  }, [lastActiveFilter]);

  const connectWebSocket = () => {
    const wsUrl = process.env.REACT_APP_BACKEND_URL.replace("https://", "wss://").replace("http://", "ws://");
    wsRef.current = new WebSocket(`${wsUrl}/ws/${venueId}/${user.id}`);

    wsRef.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      handleWebSocketMessage(data);
    };

    wsRef.current.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    // Keep alive ping
    const pingInterval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send("ping");
      }
    }, 30000);

    return () => clearInterval(pingInterval);
  };

  const handleWebSocketMessage = (data) => {
    switch (data.type) {
      case "user_checked_in":
        setPeople((prev) => {
          if (prev.find((p) => p.id === data.user.id)) return prev;
          return [...prev, { ...data.user, checked_in_at: new Date().toISOString() }];
        });
        toast.info("Someone just arrived!");
        break;
      case "user_checked_out":
        setPeople((prev) => prev.filter((p) => p.id !== data.user_id));
        break;
      case "new_glance":
        toast.info(data.message, { icon: <Eye className="w-4 h-4 text-pink-400" /> });
        fetchPeople();
        break;
      case "mutual_glance":
        toast.success(`You matched with ${data.from_user.display_name}!`, {
          icon: <Sparkles className="w-4 h-4" />,
        });
        fetchPeople();
        break;
      case "icebreaker_received":
        toast.success(`${data.from_user.display_name} sent you an icebreaker!`, {
          icon: <Snowflake className="w-4 h-4" />,
        });
        break;
      default:
        break;
    }
  };

  const fetchVenue = async () => {
    try {
      // First try to get from venues collection
      const response = await axios.get(`${API}/venues/${venueId}`);
      setVenue(response.data);
    } catch (error) {
      // If not found in venues, try Google Places details
      try {
        const placeResponse = await axios.get(`${API}/places/${venueId}/details`);
        setVenue({
          id: placeResponse.data.place_id,
          name: placeResponse.data.name,
          type: placeResponse.data.types?.[0] || 'venue',
          address: placeResponse.data.address,
          description: "",
          rating: placeResponse.data.rating,
          image_url: placeResponse.data.photos?.[0],
          is_open: placeResponse.data.is_open
        });
      } catch (e) {
        toast.error("Failed to load venue");
        navigate("/venues");
      }
    }
  };

  const fetchPeople = async () => {
    try {
      const params = lastActiveFilter ? `?last_active_filter=${lastActiveFilter}` : '';
      const response = await axios.get(`${API}/venues/${venueId}/people${params}`);
      setPeople(response.data);
    } catch (error) {
      toast.error("Failed to load people");
    } finally {
      setLoading(false);
    }
  };

  const fetchGlancesRemaining = async () => {
    try {
      const response = await axios.get(`${API}/glances/remaining`);
      setGlancesRemaining(response.data.remaining);
    } catch (error) {
      console.error("Failed to fetch glances remaining");
    }
  };

  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);

  const handleGlance = async (personId) => {
    if (glancesRemaining <= 0) {
      setShowUpgradePrompt(true);
      return;
    }
    setGlancing(personId);
    try {
      const response = await axios.post(`${API}/glance`, {
        to_user_id: personId,
        venue_id: venueId,
      });
      
      setGlancesRemaining(prev => prev - 1);
      
      if (response.data.is_mutual) {
        toast.success("It's a match! You can now connect.", {
          icon: <Sparkles className="w-4 h-4" />,
        });
      } else {
        toast.success("Glance sent!");
      }
      fetchPeople();
    } catch (error) {
      if (error.response?.data?.detail === "no_glances_remaining") {
        setShowUpgradePrompt(true);
      } else {
        toast.error(getErrorMessage(error, "Failed to send glance"));
      }
    } finally {
      setGlancing(null);
    }
  };

  const handleBlockUser = async (personId) => {
    try {
      await axios.post(`${API}/users/block`, { user_id: personId });
      toast.success("User blocked");
      fetchPeople();
    } catch (error) {
      toast.error("Failed to block user");
    }
  };

  const handleReportUser = async () => {
    if (!selectedPerson || !reportReason) return;
    try {
      await axios.post(`${API}/users/report`, { 
        user_id: selectedPerson.id,
        reason: reportReason
      });
      toast.success("Report submitted. User has been blocked.");
      setShowReportModal(false);
      setReportReason("");
      setSelectedPerson(null);
      fetchPeople();
    } catch (error) {
      toast.error("Failed to submit report");
    }
  };

  const handleSendIcebreaker = async (messageType) => {
    if (!selectedPerson) return;
    setSendingIcebreaker(true);
    try {
      await axios.post(`${API}/icebreaker`, {
        to_user_id: selectedPerson.id,
        venue_id: venueId,
        message_type: messageType,
      });
      toast.success(`Icebreaker sent to ${selectedPerson.is_revealed ? selectedPerson.display_name : "someone"}!`);
      setShowIcebreakerModal(false);
      setSelectedPerson(null);
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to send icebreaker"));
    } finally {
      setSendingIcebreaker(false);
    }
  };

  const openIcebreakerModal = (person) => {
    setSelectedPerson(person);
    setShowIcebreakerModal(true);
  };

  return (
    <Layout hideNav>
      <div className="min-h-screen bg-slate-950 pb-8" data-testid="whos-here-page">
        {/* Header */}
        <div className="sticky top-0 z-40 glass border-b border-white/5">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button
                  data-testid="back-btn"
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate("/venues")}
                  className="text-slate-400 hover:text-white hover:bg-white/10"
                >
                  <ArrowLeft className="w-5 h-5" />
                </Button>
                <div>
                  <h1 className="text-xl font-bold text-white">{venue?.name || "Loading..."}</h1>
                  <div className="flex items-center gap-2 text-slate-400 text-sm">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-live" />
                    <span>{people.length} {people.length === 1 ? "person" : "people"} here</span>
                  </div>
                </div>
              </div>
              
              {/* Last Active Filter */}
              <DropdownMenu open={showFilterMenu} onOpenChange={setShowFilterMenu}>
                <DropdownMenuTrigger asChild>
                  <Button
                    data-testid="filter-btn"
                    variant="ghost"
                    className="text-slate-400 hover:text-white hover:bg-white/10 gap-2"
                  >
                    <Filter className="w-4 h-4" />
                    <span className="hidden sm:inline">
                      {LAST_ACTIVE_FILTERS.find(f => f.value === lastActiveFilter)?.label || "Filter"}
                    </span>
                    <ChevronDown className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="bg-slate-900 border-white/10 w-48">
                  {LAST_ACTIVE_FILTERS.map((filter) => (
                    <DropdownMenuItem
                      key={filter.value || "all"}
                      data-testid={`filter-${filter.value || "all"}`}
                      onClick={() => {
                        setLastActiveFilter(filter.value);
                        setShowFilterMenu(false);
                      }}
                      className={`text-slate-300 focus:text-white focus:bg-white/10 ${
                        lastActiveFilter === filter.value ? "bg-white/10" : ""
                      }`}
                    >
                      <span className="mr-2">{filter.icon}</span>
                      <span className="flex-1">{filter.label}</span>
                      {filter.subtext && (
                        <span className="text-xs text-slate-500">{filter.subtext}</span>
                      )}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-4xl mx-auto px-4 py-6">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {people.map((person) => (
                <PersonCard 
                  key={person.id}
                  person={person}
                  navigate={navigate}
                  handleGlance={handleGlance}
                  glancing={glancing}
                  openIcebreakerModal={openIcebreakerModal}
                  handleBlockUser={handleBlockUser}
                  setSelectedPerson={setSelectedPerson}
                  setShowReportModal={setShowReportModal}
                />
              ))}
            </div>
          )}
        </div>

        {/* Icebreaker Modal */}
        <Dialog open={showIcebreakerModal} onOpenChange={setShowIcebreakerModal}>
          <DialogContent className="bg-slate-900 border-white/10 max-w-sm" data-testid="icebreaker-modal">
            <DialogHeader>
              <DialogTitle className="text-white text-center">
                Send an icebreaker to {selectedPerson?.is_revealed ? selectedPerson?.display_name : "someone"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-2 mt-4">
              {ICEBREAKER_MESSAGES.map((msg) => (
                <Button
                  key={msg.id}
                  data-testid={`icebreaker-option-${msg.id}`}
                  onClick={() => handleSendIcebreaker(msg.id)}
                  disabled={sendingIcebreaker}
                  className="w-full h-14 justify-start gap-3 rounded-xl bg-white/5 hover:bg-cyan-500/20 border border-white/5 text-left"
                >
                  <span className="text-2xl">{msg.icon}</span>
                  <span className="text-sm font-medium text-white">{msg.name}</span>
                </Button>
              ))}
            </div>
          </DialogContent>
        </Dialog>

        {/* Report Modal */}
        <Dialog open={showReportModal} onOpenChange={setShowReportModal}>
          <DialogContent className="bg-slate-900 border-white/10 max-w-sm" data-testid="report-modal">
            <DialogHeader>
              <DialogTitle className="text-white">Report User</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <p className="text-slate-400 text-sm">
                Please select a reason for reporting this user. They will be blocked automatically.
              </p>
              <div className="space-y-2">
                {["Harassment", "Inappropriate behavior", "Spam", "Fake profile", "Other"].map((reason) => (
                  <button
                    key={reason}
                    onClick={() => setReportReason(reason)}
                    className={`w-full p-3 rounded-xl text-left transition-colors ${
                      reportReason === reason 
                        ? "bg-red-500/20 border border-red-500/30 text-red-300"
                        : "bg-white/5 border border-transparent text-slate-300 hover:bg-white/10"
                    }`}
                  >
                    {reason}
                  </button>
                ))}
              </div>
              <Button
                onClick={handleReportUser}
                disabled={!reportReason}
                className="w-full rounded-xl bg-red-500 hover:bg-red-600 text-white"
                data-testid="submit-report-btn"
              >
                Submit Report
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* No Glances Remaining Prompt */}
        {showUpgradePrompt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <div className="glass rounded-3xl p-6 max-w-sm w-full relative">
              <button
                onClick={() => setShowUpgradePrompt(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
              
              <div className="text-center mb-6">
                <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto mb-4">
                  <Eye className="w-8 h-8 text-amber-400" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">No Glances Left</h3>
                <p className="text-slate-400 text-sm">
                  You've used all your daily glances. Get more to keep connecting!
                </p>
              </div>

              <div className="space-y-3">
                <Button
                  data-testid="upgrade-premium-btn"
                  onClick={() => {
                    setShowUpgradePrompt(false);
                    navigate("/premium");
                  }}
                  className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-pink-500 text-white font-semibold h-12"
                >
                  <Crown className="w-4 h-4 mr-2" />
                  Upgrade to Premium
                  <span className="ml-2 text-xs opacity-80">20 glances/day</span>
                </Button>
                
                <Button
                  data-testid="buy-tokens-btn"
                  onClick={() => {
                    setShowUpgradePrompt(false);
                    navigate("/tokens");
                  }}
                  variant="outline"
                  className="w-full rounded-xl h-12"
                >
                  <Coins className="w-4 h-4 mr-2" />
                  Buy Glance Tokens
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

// ============================================================================
// Person Card Component - handles both self-card and regular cards
// ============================================================================
const PersonCard = ({ 
  person, 
  navigate, 
  handleGlance, 
  glancing, 
  openIcebreakerModal, 
  handleBlockUser,
  setSelectedPerson,
  setShowReportModal
}) => {
  const isSelf = person.is_self === true;
  
  // Show silhouette for self if hide_photo_in_venues is ON
  const showSilhouette = isSelf && person.hide_photo_in_venues;
  
  // Self card - special rendering
  if (isSelf) {
    return (
      <div
        data-testid="self-card"
        onClick={() => navigate("/profile-tab")}
        className="user-card rounded-2xl p-4 border-2 transition-all cursor-pointer bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border-indigo-500/50 hover:border-indigo-400"
      >
        {/* Avatar */}
        <div className="relative mb-3">
          <div className="aspect-square rounded-2xl overflow-hidden">
            {showSilhouette ? (
              <SilhouetteAvatar />
            ) : (
              <BlurredImage
                src={person.avatar_url}
                alt="You"
                isRevealed={false}
                isThumbnail={false}
                fallbackInitial={(person.first_name || "Y").charAt(0)}
              />
            )}
          </div>
          
          {/* "You're here" badge */}
          <div className="absolute -top-2 -left-2 px-2 py-1 rounded-full bg-indigo-500 flex items-center gap-1 shadow-lg">
            <MapPin className="w-3 h-3 text-white" />
            <span className="text-xs text-white font-medium">You</span>
          </div>
          
          {/* Premium badge */}
          {person.is_premium && (
            <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center">
              <Crown className="w-3 h-3 text-white" />
            </div>
          )}
          
          {/* Gender indicator - bottom left */}
          {person.show_as && (
            <div 
              className={`absolute -bottom-1 -left-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shadow-md ${
                person.show_as === "male" 
                  ? "bg-blue-400/90 text-white" 
                  : "bg-pink-400/90 text-white"
              }`}
              data-testid="self-gender-indicator"
            >
              {person.show_as === "male" ? "M" : "F"}
            </div>
          )}
          
          {/* Rainbow/OpenToAll indicators - bottom right */}
          <div className="absolute -bottom-1 -right-1 flex gap-0.5">
            {person.rainbow && (
              <div 
                className="w-5 h-5 rounded-full flex items-center justify-center shadow-md overflow-hidden"
                style={{ 
                  background: 'linear-gradient(135deg, #ef4444 0%, #f97316 20%, #eab308 40%, #22c55e 60%, #3b82f6 80%, #8b5cf6 100%)'
                }}
                data-testid="self-rainbow-indicator"
              >
                <div className="w-3 h-3 rounded-full bg-slate-900/40" />
              </div>
            )}
            {person.open_to_all && (
              <div 
                className="w-5 h-5 rounded-full flex items-center justify-center shadow-md bg-amber-400/90"
                data-testid="self-open-to-all-indicator"
              >
                <span className="text-[10px]">🤗</span>
              </div>
            )}
          </div>
        </div>

        {/* Info */}
        <div className="text-center mb-3">
          <h3 className="font-semibold text-white truncate">
            You're here{person.age ? `, ${person.age}` : ""}
          </h3>
          {/* Intent badge */}
          {person.intent && (
            <span className={`inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full ${
              person.intent === "dating" ? "bg-pink-500/20 text-pink-300" :
              person.intent === "friends" ? "bg-emerald-500/20 text-emerald-300" :
              "bg-purple-500/20 text-purple-300"
            }`}>
              {person.intent === "dating" ? "Dating" : 
               person.intent === "friends" ? "Friends" : 
               person.intent === "open_to_both" ? "Open to both" : ""}
            </span>
          )}
          {person.presence_note && (
            <p className="text-slate-400 text-xs mt-1 line-clamp-2">{person.presence_note}</p>
          )}
        </div>

        {/* Action - View Profile */}
        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
          <Button
            data-testid="view-profile-btn"
            onClick={() => navigate("/profile-tab")}
            size="sm"
            className="flex-1 h-9 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border-0"
          >
            <Eye className="w-4 h-4 mr-1" />
            View profile
          </Button>
        </div>
      </div>
    );
  }
  
  // Regular person card (non-self)
  return (
    <div
      data-testid={`person-card-${person.id}`}
      onClick={() => navigate(`/profile/${person.id}`)}
      className={`user-card rounded-2xl p-4 border transition-all cursor-pointer ${
        person.is_revealed
          ? "bg-gradient-to-br from-indigo-500/10 to-pink-500/10 border-indigo-500/30 hover:border-indigo-500/50"
          : person.has_glanced_at_me
          ? "bg-pink-500/10 border-pink-500/30 hover:border-pink-500/50"
          : "bg-white/5 border-white/5 hover:border-white/20"
      } ${person.is_premium ? "premium-glow" : ""}`}
    >
      {/* Avatar - tappable */}
      <div className="relative mb-3">
        <div
          className={`aspect-square rounded-2xl overflow-hidden hover:ring-2 hover:ring-indigo-500 transition-all ${
            person.is_revealed
              ? "avatar-ring-revealed"
              : person.has_glanced_at_me
              ? "avatar-ring-glanced animate-glance"
              : ""
          }`}
        >
          {person.hide_photo_in_venues ? (
            <SilhouetteAvatar />
          ) : (
            <BlurredImage
              src={person.avatar_url}
              alt={person.display_name}
              isRevealed={person.is_revealed}
              isThumbnail={false}
              fallbackInitial={(person.first_name || person.display_name?.split(' ')[0] || "?").charAt(0)}
            />
          )}
        </div>

        {/* Status indicators */}
        {person.is_premium && (
          <div className="absolute -top-1 -left-1 w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center">
            <Crown className="w-3 h-3 text-white" />
          </div>
        )}
        {person.has_glanced_at_me && !person.i_glanced_at && (
          <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-pink-500 flex items-center justify-center animate-glance">
            <Eye className="w-3 h-3 text-white" />
          </div>
        )}
        {person.is_revealed && !person.has_glanced_at_me && (
          <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
            <Sparkles className="w-3 h-3 text-white" />
          </div>
        )}
        
        {/* Gender indicator - bottom left */}
        {person.show_as && (
          <div 
            className={`absolute -bottom-1 -left-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shadow-md ${
              person.show_as === "male" 
                ? "bg-blue-400/90 text-white" 
                : "bg-pink-400/90 text-white"
            }`}
            data-testid={`gender-indicator-${person.id}`}
          >
            {person.show_as === "male" ? "M" : "F"}
          </div>
        )}
        
        {/* Rainbow/OpenToAll indicators - bottom right */}
        {/* Rule: rainbow only = 🌈, open_to_all only = 🤗, both = 🌈🤗, neither = nothing */}
        <div className="absolute -bottom-1 -right-1 flex gap-0.5">
          {person.rainbow && (
            <div 
              className="w-5 h-5 rounded-full flex items-center justify-center shadow-md overflow-hidden"
              style={{ 
                background: 'linear-gradient(135deg, #ef4444 0%, #f97316 20%, #eab308 40%, #22c55e 60%, #3b82f6 80%, #8b5cf6 100%)'
              }}
              data-testid={`rainbow-indicator-${person.id}`}
            >
              <div className="w-3 h-3 rounded-full bg-slate-900/40" />
            </div>
          )}
          {person.open_to_all && (
            <div 
              className="w-5 h-5 rounded-full flex items-center justify-center shadow-md bg-amber-400/90"
              data-testid={`open-to-all-indicator-${person.id}`}
            >
              <span className="text-[10px]">🤗</span>
            </div>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="text-center mb-3">
        <h3 className="font-semibold text-white truncate">
          {person.is_revealed 
            ? `${person.display_name}${person.age ? `, ${person.age}` : ""}` 
            : `${person.first_name || person.display_name?.split(' ')[0] || "Someone"}${person.age ? `, ${person.age}` : ""}`
          }
        </h3>
        {/* Intent badge */}
        {person.intent && (
          <span className={`inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full ${
            person.intent === "dating" ? "bg-pink-500/20 text-pink-300" :
            person.intent === "friends" ? "bg-emerald-500/20 text-emerald-300" :
            "bg-purple-500/20 text-purple-300"
          }`}>
            {person.intent === "dating" ? "Dating" : 
             person.intent === "friends" ? "Friends" : 
             person.intent === "open_to_both" ? "Open to both" : ""}
          </span>
        )}
        {person.is_revealed && person.bio && (
          <p className="text-slate-400 text-xs mt-1 line-clamp-2">{person.bio}</p>
        )}
        {person.has_glanced_at_me && !person.is_revealed && (
          <p className="text-pink-400 text-xs mt-1">Glanced at you</p>
        )}
      </div>

      {/* Interests */}
      {person.is_revealed && person.interests?.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3 justify-center">
          {person.interests.slice(0, 3).map((interest) => (
            <span
              key={interest}
              className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300"
            >
              {interest}
            </span>
          ))}
        </div>
      )}

      {/* Actions - stop propagation to prevent card click */}
      <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
        {!person.i_glanced_at && (
          <Button
            data-testid={`glance-btn-${person.id}`}
            onClick={() => handleGlance(person.id)}
            disabled={glancing === person.id}
            size="sm"
            className="flex-1 h-9 rounded-xl bg-pink-500/20 hover:bg-pink-500/30 text-pink-400 border-0"
          >
            {glancing === person.id ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
          </Button>
        )}
        <Button
          data-testid={`icebreaker-btn-${person.id}`}
          onClick={() => openIcebreakerModal(person)}
          size="sm"
          className="flex-1 h-9 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 border-0"
        >
          <Snowflake className="w-4 h-4" />
        </Button>
        {person.is_connected && (
          <Button
            data-testid={`chat-btn-${person.id}`}
            onClick={() => navigate(`/chat/${person.id}`)}
            size="sm"
            className="flex-1 h-9 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-400 border-0"
          >
            <MessageCircle className="w-4 h-4" />
          </Button>
        )}
        {/* Block/Report Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="sm"
              variant="ghost"
              className="h-9 w-9 rounded-xl hover:bg-white/10"
              data-testid={`more-btn-${person.id}`}
            >
              <MoreVertical className="w-4 h-4 text-slate-400" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="bg-slate-900 border-white/10">
            <DropdownMenuItem 
              onClick={() => handleBlockUser(person.id)}
              className="text-slate-300 focus:text-white focus:bg-white/10"
              data-testid={`block-btn-${person.id}`}
            >
              <Ban className="w-4 h-4 mr-2" />
              Block
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => {
                setSelectedPerson(person);
                setShowReportModal(true);
              }}
              className="text-red-400 focus:text-red-300 focus:bg-red-500/10"
              data-testid={`report-btn-${person.id}`}
            >
              <Flag className="w-4 h-4 mr-2" />
              Report
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};

export default WhosHere;
