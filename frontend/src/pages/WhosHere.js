import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth, API } from "@/App";
import { toast } from "sonner";
import axios from "axios";
import Layout from "../components/Layout";
import { UserCard, SelfCard } from "../components/UserCard";
import { NotForNowSheet } from "../components/NotForNowSheet";
import { useConfirmHintGlobal } from "../components/ConfirmHint";
import { getErrorMessage } from "../utils/errorUtils";
import { onUserBlocked } from "../utils/blockEvents";
import { onPresenceChange, onPageVisible } from "../utils/presenceEvents";
import {
  Eye,
  Snowflake,
  MessageCircle,
  ArrowLeft,
  Loader2,
  Sparkles,
  Users,
  Crown,
  Clock,
  Filter,
  MapPin,
  User,
  RefreshCw,
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

// Filter options
const MATCH_FILTER_OPTIONS = [
  { value: "unmatched", label: "Unmatched" },
  { value: "all", label: "All" },
  { value: "mutual", label: "Mutual" },
  { value: "hidden", label: "Hidden Matches" },
];

const ACTIVITY_FILTER_OPTIONS = [
  { value: "all", label: "All", icon: "👥" },
  { value: "now", label: "Active now", subtext: "≤2 min", icon: "🟢", maxMinutes: 2 },
  { value: "recent", label: "Recently", subtext: "≤10 min", icon: "🟡", maxMinutes: 10 },
  { value: "hour", label: "This hour", subtext: "≤60 min", icon: "🟠", maxMinutes: 60 },
];

const AGE_PRESETS = [
  { value: "all", label: "All ages", min: 18, max: 99 },
  { value: "18-25", label: "18-25", min: 18, max: 25 },
  { value: "25-35", label: "25-35", min: 25, max: 35 },
  { value: "35-45", label: "35-45", min: 35, max: 45 },
  { value: "45+", label: "45+", min: 45, max: 99 },
];

const WhosHere = () => {
  const { venueId } = useParams();
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();
  const [venue, setVenue] = useState(null);
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [glancing, setGlancing] = useState(null);
  const [showIcebreakerModal, setShowIcebreakerModal] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [sendingIcebreaker, setSendingIcebreaker] = useState(false);
  const [sendingChatRequest, setSendingChatRequest] = useState(null);
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  
  // Filter states
  const [matchFilter, setMatchFilter] = useState("unmatched");
  const [activityFilter, setActivityFilter] = useState("all");
  const [ageFilter, setAgeFilter] = useState("all");
  
  // Not for now
  const [notForNowUser, setNotForNowUser] = useState(null);
  const [hiddenUsers, setHiddenUsers] = useState([]);
  const [hiddenFromMatches, setHiddenFromMatches] = useState([]); // Users hidden from Mutual Matches
  const [showHiddenMatchesSection, setShowHiddenMatchesSection] = useState(() => {
    // Load preference from localStorage (same key as Connections.js)
    const saved = localStorage.getItem('showHiddenMatchesSection');
    return saved !== null ? JSON.parse(saved) : true;
  });
  
  // Global ref for confirmation hints
  const confirmHintRef = useConfirmHintGlobal();
  const fetchPeopleRef = useRef(null);

  // Listen for block events
  useEffect(() => {
    const cleanup = onUserBlocked((blockedUserId) => {
      setPeople(prev => prev.filter(p => p.id !== blockedUserId));
    });
    return cleanup;
  }, []);

  // Fetch hidden users
  useEffect(() => {
    const fetchHiddenUsers = async () => {
      try {
        const response = await axios.get(`${API}/users/hidden`);
        setHiddenUsers(response.data.map(h => h.hidden_user_id));
      } catch (error) {
        console.error("Failed to fetch hidden users:", error);
      }
    };
    fetchHiddenUsers();
  }, []);

  // Fetch hidden from matches (for the Hidden Matches filter)
  useEffect(() => {
    const fetchHiddenFromMatches = async () => {
      try {
        const response = await axios.get(`${API}/connections/hidden-from-matches`);
        setHiddenFromMatches(response.data.map(h => h.user_id));
      } catch (error) {
        console.error("Failed to fetch hidden from matches:", error);
      }
    };
    fetchHiddenFromMatches();
  }, []);

  // Fetch venue and people
  useEffect(() => {
    fetchVenue();
    fetchPeople();
    checkIfCheckedIn();
  }, [venueId]);

  const fetchVenue = async () => {
    try {
      const response = await axios.get(`${API}/venues/${venueId}`);
      setVenue(response.data);
    } catch (error) {
      console.error("Failed to fetch venue:", error);
      navigate("/venues");
    }
  };

  const checkIfCheckedIn = async () => {
    try {
      const response = await axios.get(`${API}/checkin/current`);
      // API returns { checked_in: true, checkin: { venue_id: "..." }, venue: {...} }
      const isAtThisVenue = response.data?.checked_in && response.data?.checkin?.venue_id === venueId;
      setIsCheckedIn(isAtThisVenue);
    } catch (error) {
      setIsCheckedIn(false);
    }
  };

  const fetchPeople = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/venues/${venueId}/people`);
      let fetchedPeople = response.data || [];

      // Filter out blocked users (but NOT self - self card has is_self: true)
      const blockedUsers = user?.blocked_users || [];
      fetchedPeople = fetchedPeople.filter(p => 
        p.is_self || (!blockedUsers.includes(p.id) && p.id !== user?.id)
      );

      // Filter out hidden users (but NOT self)
      fetchedPeople = fetchedPeople.filter(p => p.is_self || !hiddenUsers.includes(p.id));

      // Apply match filter (but NOT to self)
      if (matchFilter === "unmatched") {
        // Show unmatched users (exclude hidden from matches from mutual)
        fetchedPeople = fetchedPeople.filter(p => p.is_self || !p.is_connection_accepted);
      } else if (matchFilter === "mutual") {
        // Show mutual matches EXCLUDING those hidden from matches
        fetchedPeople = fetchedPeople.filter(p => 
          p.is_self || (p.is_connection_accepted && !hiddenFromMatches.includes(p.id))
        );
      } else if (matchFilter === "hidden") {
        // Show ONLY users that are hidden from matches AND are mutual matches at this venue
        fetchedPeople = fetchedPeople.filter(p => 
          p.is_self || (p.is_connection_accepted && hiddenFromMatches.includes(p.id))
        );
      }
      // matchFilter === "all" shows everyone (including hidden from matches)

      // Apply activity filter (but NOT to self)
      if (activityFilter !== "all") {
        const maxMinutes = ACTIVITY_FILTER_OPTIONS.find(o => o.value === activityFilter)?.maxMinutes;
        if (maxMinutes) {
          const cutoff = new Date(Date.now() - maxMinutes * 60 * 1000);
          fetchedPeople = fetchedPeople.filter(p => {
            if (p.is_self) return true;
            if (!p.last_active) return false;
            return new Date(p.last_active) >= cutoff;
          });
        }
      }

      // Apply age filter (but NOT to self)
      if (ageFilter !== "all") {
        const preset = AGE_PRESETS.find(p => p.value === ageFilter);
        if (preset) {
          fetchedPeople = fetchedPeople.filter(p => {
            if (p.is_self) return true;
            if (!p.age) return true;
            return p.age >= preset.min && p.age <= preset.max;
          });
        }
      }

      setPeople(fetchedPeople);
    } catch (error) {
      console.error("Failed to fetch people:", error);
      setPeople([]);
    } finally {
      setLoading(false);
    }
  };

  fetchPeopleRef.current = fetchPeople;

  // Re-fetch when filters change
  useEffect(() => {
    if (!loading) {
      fetchPeople();
    }
  }, [matchFilter, activityFilter, ageFilter, hiddenUsers]);

  // Auto-refresh: Poll every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (fetchPeopleRef.current) {
        fetchPeopleRef.current();
      }
    }, 30000); // 30 seconds
    
    return () => clearInterval(interval);
  }, [venueId]);

  // Auto-refresh: When page becomes visible/focused
  useEffect(() => {
    const cleanup = onPageVisible(() => {
      if (fetchPeopleRef.current) {
        fetchPeopleRef.current();
      }
    });
    return cleanup;
  }, []);

  // Auto-refresh: When presence changes (logout, checkin, etc.)
  useEffect(() => {
    const cleanup = onPresenceChange(() => {
      if (fetchPeopleRef.current) {
        fetchPeopleRef.current();
      }
    });
    return cleanup;
  }, []);

  const handleCheckIn = async () => {
    setCheckingIn(true);
    try {
      await axios.post(`${API}/checkin/${venueId}`);
      setIsCheckedIn(true);
      toast.success(`Checked in to ${venue?.name || "venue"}`);
      fetchPeople();
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to check in"));
    } finally {
      setCheckingIn(false);
    }
  };

  const handleGlance = async (userId) => {
    setGlancing(userId);
    try {
      await axios.post(`${API}/glance`, { to_user_id: userId, venue_id: venueId });
      toast.success("Glance sent!");
      fetchPeople();
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to send glance"));
    } finally {
      setGlancing(null);
    }
  };

  const handleOpenIcebreaker = (person) => {
    setSelectedPerson(person);
    setShowIcebreakerModal(true);
  };

  const handleSendIcebreaker = async (messageType) => {
    if (!selectedPerson) return;
    
    setSendingIcebreaker(true);
    try {
      await axios.post(`${API}/icebreaker`, {
        to_user_id: selectedPerson.id,
        venue_id: venueId,
        message_type: messageType
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

  const handleSendChatRequest = async (userId) => {
    setSendingChatRequest(userId);
    try {
      await axios.post(`${API}/chat-request`, { 
        to_user_id: userId, 
        venue_id: venueId 
      });
      toast.success("Chat request sent!");
      fetchPeople();
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to send chat request"));
    } finally {
      setSendingChatRequest(null);
    }
  };

  const handleLongPress = (person) => {
    setNotForNowUser(person);
  };

  const handleHideUser = async () => {
    if (!notForNowUser) return;
    
    try {
      await axios.post(`${API}/users/${notForNowUser.id}/hide`);
      setHiddenUsers(prev => [...prev, notForNowUser.id]);
      setPeople(prev => prev.filter(p => p.id !== notForNowUser.id));
      toast.success("Profile hidden for 90 days");
    } catch (error) {
      toast.error("Failed to hide profile");
    } finally {
      setNotForNowUser(null);
    }
  };

  // Determine photo state for a user
  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
        {/* Header */}
        <div className="sticky top-0 z-40 glass border-b border-white/5">
          <div className="max-w-4xl mx-auto px-4 py-4">
            {/* Back button */}
            <button
              data-testid="back-to-venues"
              onClick={() => navigate("/venues")}
              className="flex items-center gap-2 text-slate-400 hover:text-white mb-3 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm">Back to venues</span>
            </button>

            {/* Venue info */}
            {venue && (
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-indigo-500/20 flex items-center justify-center">
                    <MapPin className="w-6 h-6 text-indigo-400" />
                  </div>
                  <div>
                    <h1 className="text-xl font-bold text-white">{venue.name}</h1>
                    <p className="text-sm text-slate-400">{venue.address}</p>
                  </div>
                </div>
                
                {/* People count badge */}
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/20 border border-indigo-500/30">
                  <Users className="w-4 h-4 text-indigo-400" />
                  <span className="text-sm text-indigo-300 font-medium">
                    {people.length} here
                  </span>
                </div>
              </div>
            )}

            {/* Filters */}
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              <select
                value={matchFilter}
                onChange={(e) => setMatchFilter(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                data-testid="match-filter"
              >
                {MATCH_FILTER_OPTIONS
                  .filter(opt => opt.value !== "hidden" || showHiddenMatchesSection)
                  .map(opt => (
                    <option key={opt.value} value={opt.value} className="bg-slate-900">{opt.label}</option>
                  ))}
              </select>

              <select
                value={activityFilter}
                onChange={(e) => setActivityFilter(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                data-testid="activity-filter"
              >
                {ACTIVITY_FILTER_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value} className="bg-slate-900">
                    {opt.icon} {opt.label}
                  </option>
                ))}
              </select>

              <select
                value={ageFilter}
                onChange={(e) => setAgeFilter(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                data-testid="age-filter"
              >
                {AGE_PRESETS.map(opt => (
                  <option key={opt.value} value={opt.value} className="bg-slate-900">{opt.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* People count */}
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <p className="text-slate-400 text-sm">
              {people.length} {people.length === 1 ? "person" : "people"} here
            </p>
            <button
              onClick={fetchPeople}
              className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-white/5 transition-colors"
              data-testid="refresh-people"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* People Grid */}
        <div className="max-w-4xl mx-auto px-4 pb-28">
          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            </div>
          ) : people.length === 0 ? (
            <div className="text-center py-20">
              <Users className="w-16 h-16 text-slate-600 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-white mb-2">No one here yet</h2>
              <p className="text-slate-400 mb-4">
                {isCheckedIn 
                  ? "Be the first to arrive! Others will see you when they check in."
                  : "Check in to see who's around and let others find you."
                }
              </p>
              {!isCheckedIn && (
                <Button
                  onClick={handleCheckIn}
                  disabled={checkingIn}
                  className="bg-indigo-500 hover:bg-indigo-600"
                >
                  {checkingIn ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <MapPin className="w-4 h-4 mr-2" />
                  )}
                  Check in now
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {people.map((person) => (
                person.is_self ? (
                  <SelfCard
                    key={person.id}
                    user={person}
                    context="venue"
                    showSilhouette={person.hide_photo_in_venues}
                  />
                ) : (
                  <UserCard
                    key={person.id}
                    user={person}
                    isMatched={person.is_connection_accepted}
                    revealState={person.reveal_state}
                    onGlance={handleGlance}
                    onIcebreaker={handleOpenIcebreaker}
                    onChatRequest={handleSendChatRequest}
                    onLongPress={handleLongPress}
                    disabled={{
                      glanced: person.i_glanced_at,
                      icebreaker: person.icebreaker_sent,
                      chatRequest: person.chat_request_sent
                    }}
                    loading={{
                      glance: glancing === person.id,
                      chatRequest: sendingChatRequest === person.id
                    }}
                    globalPendingRef={confirmHintRef}
                    context="venue"
                    venueId={venueId}
                  />
                )
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Icebreaker Modal */}
      <IcebreakerModal
        show={showIcebreakerModal}
        person={selectedPerson}
        sending={sendingIcebreaker}
        onClose={() => {
          setShowIcebreakerModal(false);
          setSelectedPerson(null);
        }}
        onSend={handleSendIcebreaker}
      />

      {/* Not For Now Sheet */}
      <NotForNowSheet
        isOpen={!!notForNowUser}
        onClose={() => setNotForNowUser(null)}
        onConfirm={handleHideUser}
        userName={notForNowUser?.display_name}
      />
    </Layout>
  );
};

// Icebreaker Modal Component
const IcebreakerModal = ({ show, person, sending, onClose, onSend }) => {
  if (!show || !person) return null;

  return (
    <Dialog open={show} onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border-white/10 max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-white">Send Icebreaker</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-slate-400 text-sm">Choose a message to send:</p>
          {ICEBREAKER_MESSAGES.map((msg) => (
            <button
              key={msg.id}
              data-testid={`icebreaker-option-${msg.id}`}
              onClick={() => onSend(msg.id)}
              disabled={sending}
              className="w-full flex items-center gap-3 p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-colors disabled:opacity-50"
            >
              <span className="text-2xl">{msg.icon}</span>
              <span className="text-white">{msg.name}</span>
              {sending && <Loader2 className="w-4 h-4 animate-spin ml-auto text-slate-400" />}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default WhosHere;
