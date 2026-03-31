import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth, API } from "@/App";
import { toast } from "sonner";
import axios from "axios";
import Layout from "../components/Layout";
import BlurredImage from "../components/BlurredImage";
import { getErrorMessage } from "../utils/errorUtils";
import {
  Eye,
  Snowflake,
  MapPin,
  Loader2,
  Sparkles,
  Users,
  Crown,
  Bell,
  Shield,
  Mic,
  Heart,
  X,
  ChevronDown,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const ICEBREAKER_MESSAGES = [
  { id: 0, name: "Hello", icon: "👋" },
  { id: 1, name: "You seem interesting", icon: "✨" },
  { id: 2, name: "Fancy a chat?", icon: "💬" },
  { id: 3, name: "Can I buy you a drink?", icon: "🍸" },
];

const RADIUS_OPTIONS = [
  { value: "0-10", label: "0–10 miles" },
  { value: "10-25", label: "10–25 miles" },
];

const Discovery = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  
  // Mode: "here" or "not-here"
  const [mode, setMode] = useState(searchParams.get("mode") || "here");
  const [radius, setRadius] = useState("0-10");
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [venue, setVenue] = useState(null);
  const [proximityEchoes, setProximityEchoes] = useState([]);
  
  // Interaction states
  const [glancing, setGlancing] = useState(null);
  const [showIcebreakerModal, setShowIcebreakerModal] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [sendingIcebreaker, setSendingIcebreaker] = useState(false);

  useEffect(() => {
    if (mode === "here") {
      fetchCurrentVenue();
      fetchProximityEchoes();
    }
    fetchPeople();
  }, [mode, radius]);

  useEffect(() => {
    setSearchParams({ mode });
  }, [mode]);

  const fetchCurrentVenue = async () => {
    try {
      const response = await axios.get(`${API}/checkin/current`);
      if (response.data) {
        setVenue(response.data);
      }
    } catch (error) {
      // Not checked in anywhere
      setVenue(null);
    }
  };

  const fetchPeople = async () => {
    setLoading(true);
    try {
      if (mode === "here" && venue?.venue_id) {
        const response = await axios.get(`${API}/venues/${venue.venue_id}/people`);
        setPeople(response.data);
      } else if (mode === "not-here") {
        const response = await axios.get(`${API}/discovery/not-here?radius=${radius}`);
        setPeople(response.data);
      } else if (mode === "here") {
        // Try to get current venue first
        try {
          const checkinRes = await axios.get(`${API}/checkin/current`);
          if (checkinRes.data?.venue_id) {
            setVenue(checkinRes.data);
            const response = await axios.get(`${API}/venues/${checkinRes.data.venue_id}/people`);
            setPeople(response.data);
          } else {
            setPeople([]);
          }
        } catch {
          setPeople([]);
        }
      }
    } catch (error) {
      console.error("Failed to load people:", error);
      setPeople([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchProximityEchoes = async () => {
    try {
      const response = await axios.get(`${API}/discovery/proximity-echoes`);
      setProximityEchoes(response.data.echoes || []);
    } catch (error) {
      console.error("Failed to fetch proximity echoes:", error);
    }
  };

  const handleGlance = async (personId) => {
    setGlancing(personId);
    try {
      await axios.post(`${API}/glance`, {
        to_user_id: personId,
        venue_id: venue?.venue_id || "not-here",
      });
      toast.success("Glance sent!");
      fetchPeople();
    } catch (error) {
      if (error.response?.data?.detail === "no_glances_remaining") {
        toast.error("No glances remaining. Get more tokens!");
      } else {
        toast.error(getErrorMessage(error, "Failed to send glance"));
      }
    } finally {
      setGlancing(null);
    }
  };

  const handleSendIcebreaker = async (messageType) => {
    if (!selectedPerson) return;
    setSendingIcebreaker(true);
    try {
      await axios.post(`${API}/icebreaker`, {
        to_user_id: selectedPerson.id,
        venue_id: venue?.venue_id || "not-here",
        message_type: messageType,
      });
      toast.success("Icebreaker sent!");
      setShowIcebreakerModal(false);
      setSelectedPerson(null);
      fetchPeople();
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to send icebreaker"));
    } finally {
      setSendingIcebreaker(false);
    }
  };

  const renderPersonCard = (person) => (
    <div
      key={person.id}
      data-testid={`person-card-${person.id}`}
      className={`rounded-2xl p-4 border transition-all ${
        person.is_revealed
          ? "bg-gradient-to-br from-indigo-500/10 to-pink-500/10 border-indigo-500/30"
          : person.has_glanced_at_me
          ? "bg-pink-500/10 border-pink-500/30"
          : "bg-white/5 border-white/5"
      } ${person.is_premium ? "ring-1 ring-amber-500/30" : ""}`}
    >
      {/* Avatar */}
      <div className="relative mb-3">
        <div
          className={`aspect-square rounded-2xl overflow-hidden cursor-pointer ${
            person.is_revealed ? "ring-2 ring-emerald-500/50" : ""
          }`}
          onClick={() => navigate(`/profile/${person.id}`)}
        >
          <BlurredImage
            src={person.avatar_url}
            alt={person.display_name}
            isRevealed={person.is_revealed}
            isThumbnail={false}
            fallbackInitial={(person.first_name || "?").charAt(0)}
          />
        </div>

        {/* Badges */}
        {person.is_premium && (
          <div className="absolute -top-1 -left-1 w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center">
            <Crown className="w-3 h-3 text-white" />
          </div>
        )}
        {person.has_glanced_at_me && !person.i_glanced_at && (
          <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-pink-500 flex items-center justify-center animate-pulse">
            <Eye className="w-3 h-3 text-white" />
          </div>
        )}
        {person.is_revealed && person.has_safety_halo && (
          <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center" title="Safety Halo">
            <Shield className="w-3 h-3 text-white" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="text-center mb-3">
        <h3 className="font-semibold text-white truncate">
          {person.is_revealed
            ? person.display_name
            : `${person.first_name || "Someone"}${person.age ? `, ${person.age}` : ""}`}
        </h3>
        
        {/* Shy Indicator - visible while blurred */}
        {person.shy_indicator && (
          <p className="text-xs text-pink-400 mt-1">May be shy to start</p>
        )}
        
        {/* Presence Note - visible while blurred */}
        {person.presence_note && (
          <p className="text-xs text-slate-400 mt-1 italic">"{person.presence_note}"</p>
        )}
        
        {/* Celebrity Crush - visible while blurred */}
        {person.celebrity_crush && (
          <p className="text-xs text-slate-500 mt-1">Celebrity crush: {person.celebrity_crush}</p>
        )}
        
        {/* Distance - Not Here mode only */}
        {person.distance_miles && (
          <p className="text-xs text-slate-500 mt-1">
            <MapPin className="w-3 h-3 inline mr-1" />
            {person.distance_miles} mi away
          </p>
        )}
        
        {/* Voice Intro - only after reveal */}
        {person.is_revealed && person.voice_intro_url && (
          <button className="flex items-center justify-center gap-1 text-xs text-indigo-400 mt-2 hover:text-indigo-300">
            <Mic className="w-3 h-3" />
            Play voice intro
          </button>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        {!person.i_glanced_at && !person.is_connected && (
          <Button
            data-testid={`glance-btn-${person.id}`}
            onClick={() => handleGlance(person.id)}
            disabled={glancing === person.id}
            size="sm"
            className="flex-1 rounded-xl bg-pink-500/20 hover:bg-pink-500/30 text-pink-400 border-0"
          >
            {glancing === person.id ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Eye className="w-4 h-4 mr-1" />
                Glance
              </>
            )}
          </Button>
        )}
        
        {!person.is_connected && (
          <Button
            data-testid={`icebreaker-btn-${person.id}`}
            onClick={() => {
              setSelectedPerson(person);
              setShowIcebreakerModal(true);
            }}
            size="sm"
            className="flex-1 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 border-0"
          >
            <Snowflake className="w-4 h-4 mr-1" />
            Icebreaker
          </Button>
        )}
        
        {person.is_revealed && (
          <Button
            data-testid={`chat-btn-${person.id}`}
            onClick={() => navigate(`/chat/${person.id}`)}
            size="sm"
            className="flex-1 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white"
          >
            <Sparkles className="w-4 h-4 mr-1" />
            Chat
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
        {/* Header with Tabs */}
        <div className="sticky top-0 z-40 glass border-b border-white/5">
          <div className="max-w-4xl mx-auto px-4 py-4">
            {/* Mode Toggle Tabs */}
            <div className="flex rounded-xl bg-white/5 p-1 mb-4">
              <button
                data-testid="tab-here"
                onClick={() => setMode("here")}
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                  mode === "here"
                    ? "bg-indigo-500 text-white"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                HERE & NOW
              </button>
              <button
                data-testid="tab-not-here"
                onClick={() => setMode("not-here")}
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                  mode === "not-here"
                    ? "bg-indigo-500 text-white"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                NOT HERE
              </button>
            </div>

            {/* Mode-specific header content */}
            {mode === "here" ? (
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-bold text-white">
                    {venue?.venue_name || "Check in somewhere"}
                  </h1>
                  <div className="flex items-center gap-2 text-slate-400 text-sm">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>{people.length} people here</span>
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <p className="text-slate-400 text-sm mb-3">
                  People who aren't here right now, but quite near.
                </p>
                {/* Radius Selector */}
                <div className="flex gap-2">
                  {RADIUS_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      data-testid={`radius-${option.value}`}
                      onClick={() => setRadius(option.value)}
                      className={`px-4 py-2 rounded-xl text-sm transition-all ${
                        radius === option.value
                          ? "bg-indigo-500 text-white"
                          : "bg-white/5 text-slate-400 hover:bg-white/10"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-slate-500 mt-2">Choose how near you want people to be</p>
              </div>
            )}
          </div>
        </div>

        {/* Proximity Echoes - Here & Now only */}
        {mode === "here" && proximityEchoes.length > 0 && (
          <div className="max-w-4xl mx-auto px-4 py-3">
            <div className="bg-pink-500/10 border border-pink-500/30 rounded-xl p-3 flex items-center gap-3">
              <Bell className="w-5 h-5 text-pink-400" />
              <p className="text-sm text-pink-300">
                {proximityEchoes.length === 1
                  ? "Someone nearby noticed you."
                  : `${proximityEchoes.length} people nearby noticed you.`}
              </p>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="max-w-4xl mx-auto px-4 py-6">
          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            </div>
          ) : people.length === 0 ? (
            <div className="text-center py-20">
              <Users className="w-16 h-16 text-slate-600 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-white mb-2">
                {mode === "here" ? "No one's around" : "No one nearby"}
              </h2>
              <p className="text-slate-400">
                {mode === "here"
                  ? "No one's around at the moment. Try again soon or switch to Not Here."
                  : "No one is near enough right now. Try widening your radius."}
              </p>
              {mode === "here" && !venue && (
                <Button
                  onClick={() => navigate("/venues")}
                  className="mt-4 rounded-xl bg-indigo-500 hover:bg-indigo-600"
                >
                  Find a venue to check in
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {people.map(renderPersonCard)}
            </div>
          )}
        </div>

        {/* Icebreaker Modal */}
        <Dialog open={showIcebreakerModal} onOpenChange={setShowIcebreakerModal}>
          <DialogContent className="bg-slate-900 border-white/10 max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-white text-center">
                Send an Icebreaker
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 mt-4">
              {ICEBREAKER_MESSAGES.map((msg) => (
                <button
                  key={msg.id}
                  onClick={() => handleSendIcebreaker(msg.id)}
                  disabled={sendingIcebreaker}
                  className="w-full p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-left transition-all flex items-center gap-3"
                >
                  <span className="text-2xl">{msg.icon}</span>
                  <span className="text-white">{msg.name}</span>
                </button>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default Discovery;
