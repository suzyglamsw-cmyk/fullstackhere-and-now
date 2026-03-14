import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth, API } from "@/App";
import { toast } from "sonner";
import axios from "axios";
import Layout from "../components/Layout";
import {
  Eye,
  Wine,
  MessageCircle,
  ArrowLeft,
  Loader2,
  Sparkles,
  Users,
  Beer,
  Coffee,
  GlassWater,
  MoreVertical,
  Ban,
  Flag,
  Crown,
  Coins,
  X,
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

const DRINK_TYPES = [
  { id: "cocktail", name: "Cocktail", icon: Wine, color: "text-pink-400" },
  { id: "beer", name: "Beer", icon: Beer, color: "text-amber-400" },
  { id: "wine", name: "Wine", icon: Wine, color: "text-red-400" },
  { id: "coffee", name: "Coffee", icon: Coffee, color: "text-amber-600" },
  { id: "mocktail", name: "Mocktail", icon: GlassWater, color: "text-emerald-400" },
];

const WhosHere = () => {
  const { venueId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [venue, setVenue] = useState(null);
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [glancing, setGlancing] = useState(null);
  const [showDrinkModal, setShowDrinkModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [sendingDrink, setSendingDrink] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [glancesRemaining, setGlancesRemaining] = useState(5);
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
      case "drink_token_received":
        toast.success(`${data.from_user.display_name} sent you a ${data.drink_type}!`, {
          icon: <Wine className="w-4 h-4" />,
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
      const response = await axios.get(`${API}/venues/${venueId}/people`);
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
        toast.error(error.response?.data?.detail || "Failed to send glance");
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

  const handleSendDrink = async (drinkType) => {
    if (!selectedPerson) return;
    setSendingDrink(true);
    try {
      await axios.post(`${API}/drink-token`, {
        to_user_id: selectedPerson.id,
        venue_id: venueId,
        drink_type: drinkType,
      });
      toast.success(`Drink sent to ${selectedPerson.is_revealed ? selectedPerson.display_name : "someone"}!`);
      setShowDrinkModal(false);
      setSelectedPerson(null);
    } catch (error) {
      toast.error("Failed to send drink");
    } finally {
      setSendingDrink(false);
    }
  };

  const openDrinkModal = (person) => {
    setSelectedPerson(person);
    setShowDrinkModal(true);
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
                    <span>{people.length} people here</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-4xl mx-auto px-4 py-6">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
            </div>
          ) : people.length === 0 ? (
            <div className="text-center py-20">
              <Users className="w-16 h-16 text-slate-700 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-white mb-2">No one else here yet</h2>
              <p className="text-slate-400">Be the first to start connecting!</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {people.map((person) => (
                <div
                  key={person.id}
                  data-testid={`person-card-${person.id}`}
                  onClick={() => navigate(`/profile/${person.id}`)}
                  className={`user-card rounded-2xl p-4 border transition-all cursor-pointer ${
                    person.is_revealed
                      ? "bg-gradient-to-br from-indigo-500/10 to-pink-500/10 border-indigo-500/30 hover:border-indigo-500/50"
                      : person.has_glanced_at_me
                      ? "bg-pink-500/10 border-pink-500/30 hover:border-pink-500/50"
                      : "bg-white/5 border-white/5 hover:border-white/20"
                  }`}
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
                      {person.avatar_url ? (
                        <img
                          src={person.avatar_url}
                          alt={person.display_name}
                          className={`w-full h-full object-cover transition-all duration-300 ${
                            person.is_revealed ? "" : "blur-[5px]"
                          }`}
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center">
                          <span className="text-4xl text-slate-400">
                            {(person.first_name || person.display_name?.split(' ')[0] || "?").charAt(0)}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Status indicators */}
                    {person.has_glanced_at_me && !person.i_glanced_at && (
                      <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-pink-500 flex items-center justify-center animate-glance">
                        <Eye className="w-3 h-3 text-white" />
                      </div>
                    )}
                    {person.is_revealed && (
                      <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
                        <Sparkles className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="text-center mb-3">
                    <h3 className="font-semibold text-white truncate">
                      {person.is_revealed 
                        ? person.display_name 
                        : `${person.first_name || person.display_name?.split(' ')[0] || "Someone"}${person.age ? `, ${person.age}` : ""}`
                      }
                    </h3>
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
                      data-testid={`drink-btn-${person.id}`}
                      onClick={() => openDrinkModal(person)}
                      size="sm"
                      className="flex-1 h-9 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border-0"
                    >
                      <Wine className="w-4 h-4" />
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
              ))}
            </div>
          )}
        </div>

        {/* Drink Modal */}
        <Dialog open={showDrinkModal} onOpenChange={setShowDrinkModal}>
          <DialogContent className="bg-slate-900 border-white/10 max-w-sm" data-testid="drink-modal">
            <DialogHeader>
              <DialogTitle className="text-white text-center">
                Send a drink to {selectedPerson?.is_revealed ? selectedPerson?.display_name : "someone"}
              </DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3 mt-4">
              {DRINK_TYPES.map((drink) => (
                <Button
                  key={drink.id}
                  data-testid={`drink-option-${drink.id}`}
                  onClick={() => handleSendDrink(drink.id)}
                  disabled={sendingDrink}
                  className={`h-20 flex-col gap-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 ${drink.color}`}
                >
                  <drink.icon className="w-6 h-6" />
                  <span className="text-sm font-medium text-white">{drink.name}</span>
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

export default WhosHere;
