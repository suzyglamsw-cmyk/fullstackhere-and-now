import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth, API } from "@/App";
import { toast } from "sonner";
import axios from "axios";
import Layout from "../components/Layout";
import PageHeader from "../components/PageHeader";
import { 
  Shield, AlertTriangle, Ban, Check, 
  Loader2, ChevronRight, Clock, User 
} from "lucide-react";

const AdminReports = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(null);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      const response = await axios.get(`${API}/admin/reports`);
      setReports(response.data);
    } catch (error) {
      toast.error("Failed to load reports");
    } finally {
      setLoading(false);
    }
  };

  const handleBlockUser = async (userId, reportId) => {
    setProcessing(reportId);
    try {
      await axios.post(`${API}/admin/block-user/${userId}`);
      toast.success("User has been banned");
      // Update local state
      setReports(reports.map(r => 
        r.id === reportId ? { ...r, status: "resolved" } : r
      ));
    } catch (error) {
      toast.error("Failed to block user");
    } finally {
      setProcessing(null);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "pending":
        return (
          <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-1 rounded-full">
            Pending
          </span>
        );
      case "resolved":
        return (
          <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded-full">
            Resolved
          </span>
        );
      default:
        return (
          <span className="text-xs bg-slate-500/20 text-slate-400 px-2 py-1 rounded-full">
            {status}
          </span>
        );
    }
  };

  const getReasonIcon = (reason) => {
    switch (reason) {
      case "Harassment":
        return <AlertTriangle className="w-4 h-4 text-red-400" />;
      case "Fake profile":
        return <User className="w-4 h-4 text-orange-400" />;
      case "Safety concern":
        return <Shield className="w-4 h-4 text-amber-400" />;
      default:
        return <AlertTriangle className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-6 pb-32" data-testid="admin-reports-page">
        {/* Page Header with Back Button */}
        <PageHeader 
          title="Admin Inbox" 
          subtitle={`${reports.filter(r => r.status === "pending").length} pending reports`}
          backTo="/settings" 
        />

        {/* Reports List */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
          </div>
        ) : reports.length === 0 ? (
          <div className="glass rounded-2xl p-8 text-center">
            <Shield className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400">No reports yet</p>
            <p className="text-slate-500 text-sm mt-2">
              All clear! No user reports to review.
            </p>
          </div>
        ) : (
          <div className="space-y-4" data-testid="reports-list">
            {reports.map((report) => (
              <div
                key={report.id}
                data-testid={`report-${report.id}`}
                className="glass rounded-2xl p-5"
              >
                {/* Report Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    {getReasonIcon(report.reason)}
                    <div>
                      <p className="text-white font-semibold">{report.reason}</p>
                      <p className="text-slate-400 text-sm flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(report.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  {getStatusBadge(report.status)}
                </div>

                {/* Users involved */}
                <div className="bg-white/5 rounded-xl p-4 mb-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 text-sm">Reported User</span>
                    <span className="text-white font-medium">{report.reported_user_name}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 text-sm">Reported By</span>
                    <span className="text-slate-300">{report.reporter_user_name}</span>
                  </div>
                </div>

                {/* Actions */}
                {report.status === "pending" && (
                  <div className="flex gap-3">
                    <Button
                      data-testid={`block-${report.id}`}
                      onClick={() => handleBlockUser(report.reported_user_id, report.id)}
                      disabled={processing === report.id}
                      className="flex-1 h-11 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-400"
                    >
                      {processing === report.id ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <Ban className="w-4 h-4 mr-2" />
                      )}
                      Ban User
                    </Button>
                    <Button
                      data-testid={`dismiss-${report.id}`}
                      onClick={() => {
                        setReports(reports.map(r => 
                          r.id === report.id ? { ...r, status: "dismissed" } : r
                        ));
                        toast.success("Report dismissed");
                      }}
                      variant="ghost"
                      className="flex-1 h-11 rounded-xl text-slate-400 hover:text-white hover:bg-white/10"
                    >
                      <Check className="w-4 h-4 mr-2" />
                      Dismiss
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default AdminReports;
