import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GitCompare,
  Check,
  X,
  FileEdit,
  ArrowRight,
  Figma,
  MessageSquare,
  Trello,
  ChevronDown,
  Loader2,
  Play,
  AlertCircle,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import * as api from '../../lib/apiClient';
import { toast } from 'sonner';

const platformIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  figma: Figma,
  slack: MessageSquare,
  jira: Trello,
};

const platformColors: Record<string, string> = {
  figma: 'text-nexus-cyan',
  slack: 'text-nexus-violet',
  jira: 'text-nexus-blue',
};

const changeTypeColors: Record<string, string> = {
  added: 'bg-nexus-green/10 border-nexus-green/30 text-nexus-green',
  removed: 'bg-red-500/10 border-red-500/30 text-red-500',
  modified: 'bg-nexus-cyan/10 border-nexus-cyan/30 text-nexus-cyan',
  moved: 'bg-[#FFB800]/10 border-[#FFB800]/30 text-[#FFB800]',
};

const statusConfig: Record<string, { icon: React.ComponentType<{ className?: string }>; color: string; label: string }> = {
  pending: { icon: AlertCircle, color: 'text-[#FFB800]', label: 'Pending Review' },
  approved: { icon: CheckCircle2, color: 'text-nexus-green', label: 'Approved' },
  rejected: { icon: XCircle, color: 'text-red-500', label: 'Rejected' },
  completed: { icon: CheckCircle2, color: 'text-nexus-green', label: 'Completed' },
  failed: { icon: XCircle, color: 'text-red-500', label: 'Failed' },
};

interface DiffViewerProps {
  projectId?: string;
  onTriggerRun?: () => void;
}

export default function DiffViewer({ projectId, onTriggerRun }: DiffViewerProps) {
  const [diffs, setDiffs] = useState<api.DiffItem[]>([]);
  const [selectedDiff, setSelectedDiff] = useState<string>('');
  const [expandedChanges, setExpandedChanges] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [currentRunId, setCurrentRunId] = useState<string>('');
  const [runStatus, setRunStatus] = useState<string>('');

  const fetchDiffs = useCallback(async () => {
    if (!projectId) return;
    try {
      const runs = await api.getRuns(projectId);
      // Find the latest run that's in human_review stage (or has diffs)
      const reviewRun = runs.find(r => r.currentStage === 'human_review' && r.diffs?.length) ||
        runs.find(r => r.diffs?.length);
      if (reviewRun?.diffs?.length) {
        setDiffs(reviewRun.diffs);
        setCurrentRunId(reviewRun.id);
        setRunStatus(reviewRun.status);
        if (!selectedDiff || !reviewRun.diffs.find(d => d.id === selectedDiff)) {
          setSelectedDiff(reviewRun.diffs[0].id);
        }
      } else {
        setDiffs([]);
        setCurrentRunId('');
        setRunStatus('');
      }
    } catch {
      setDiffs([]);
    } finally {
      setLoading(false);
    }
  }, [projectId, selectedDiff]);

  useEffect(() => {
    fetchDiffs();
    const interval = setInterval(fetchDiffs, 5000);
    return () => clearInterval(interval);
  }, [fetchDiffs]);

  const handleAction = async (action: 'approve' | 'reject') => {
    if (!projectId || !currentRunId) return;
    setActionLoading(action);
    try {
      if (action === 'approve') {
        await api.approveRun(projectId, currentRunId);
        toast.success('Run approved & changes executed!');
      } else {
        await api.rejectRun(projectId, currentRunId);
        toast.info('Run rejected. No changes applied.');
      }
      // Immediately update local state for responsiveness
      setRunStatus(action === 'approve' ? 'completed' : 'failed');
      setDiffs(prev => prev.map(d => ({
        ...d,
        status: action === 'approve' ? 'approved' : 'rejected',
      })));
      // Clear selection and re-fetch to get the latest state
      setSelectedDiff('');
      setCurrentRunId('');
      setTimeout(() => fetchDiffs(), 500);
    } catch (err) {
      toast.error(`Failed to ${action} run: ${err instanceof Error ? err.message : 'unknown error'}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDiffAction = async (diffId: string, action: 'approve' | 'reject') => {
    if (!projectId || !currentRunId) return;
    setActionLoading(`${action}-${diffId}`);
    try {
      const result = await api.diffAction(projectId, currentRunId, diffId, action);
      
      if (action === 'approve' && result.diff?.execution_result) {
        const execResult = result.diff.execution_result;
        const actionType = execResult.action;
        const ticketKey = execResult.key;
        
        if (actionType === 'create') {
          toast.success(`Created Jira ticket ${ticketKey}`, {
            description: execResult.title,
          });
        } else if (actionType === 'update') {
          toast.success(`Updated Jira ticket ${ticketKey}`, {
            description: execResult.reason || execResult.title,
          });
        } else if (actionType === 'mark_done') {
          toast.success(`Marked ${ticketKey} as Done`, {
            description: execResult.title,
          });
        }
      } else if (action === 'reject') {
        toast.info('Proposal rejected');
      }
      
      // Update local state
      setDiffs(prev => prev.map(d => 
        d.id === diffId 
          ? { ...d, status: action === 'approve' ? 'approved' : 'rejected', execution_result: result.diff?.execution_result }
          : d
      ));
      
      // Re-fetch to get latest state
      setTimeout(() => fetchDiffs(), 500);
    } catch (err) {
      toast.error(`Failed to ${action}: ${err instanceof Error ? err.message : 'unknown error'}`);
    } finally {
      setActionLoading(null);
    }
  };

  const toggleChange = (changeId: string) => {
    setExpandedChanges(prev => {
      const next = new Set(prev);
      if (next.has(changeId)) next.delete(changeId);
      else next.add(changeId);
      return next;
    });
  };

  const currentDiff = diffs.find(d => d.id === selectedDiff);
  const isPending = runStatus === 'running' || diffs.some(d => d.status === 'pending');

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-nexus-cyan animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full flex gap-6">
      {/* Left Panel */}
      <motion.div
        initial={{ opacity: 0, x: -30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5 }}
        className="w-[28vw] glass-card-strong p-6 flex flex-col"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-nexus-cyan/10 flex items-center justify-center">
            <GitCompare className="w-5 h-5 text-nexus-cyan" />
          </div>
          <div>
            <h2 className="font-heading font-bold text-2xl text-nexus-text">Review & Approve</h2>
            <p className="text-xs text-nexus-text-secondary">Human-in-the-loop control</p>
          </div>
        </div>

        <p className="text-nexus-text-secondary mb-4 leading-relaxed text-sm">
          Review AI-proposed changes before they're applied. You maintain full control over what gets executed.
        </p>

        {/* Run Status Badge */}
        {currentRunId && (
          <div className={`mb-4 p-3 rounded-xl border ${runStatus === 'completed' ? 'bg-nexus-green/5 border-nexus-green/20' :
              runStatus === 'failed' ? 'bg-red-500/5 border-red-500/20' :
                'bg-[#FFB800]/5 border-[#FFB800]/20'
            }`}>
            <div className="flex items-center gap-2">
              {(() => {
                const cfg = statusConfig[runStatus] || statusConfig.pending;
                const Icon = cfg.icon;
                return <><Icon className={`w-4 h-4 ${cfg.color}`} /><span className={`text-sm font-medium ${cfg.color}`}>{cfg.label}</span></>;
              })()}
            </div>
            <p className="text-xs text-nexus-text-secondary mt-1">Run: {currentRunId}</p>
          </div>
        )}

        {/* Diff List */}
        <div className="space-y-2 flex-1 overflow-y-auto scrollbar-thin">
          {diffs.length === 0 && (
            <div className="text-center py-8">
              <GitCompare className="w-12 h-12 text-nexus-text-secondary/30 mx-auto mb-3" />
              <p className="text-nexus-text-secondary text-sm mb-2">No pending diffs.</p>
              <p className="text-nexus-text-secondary/60 text-xs mb-4">Trigger an Agent Sync to generate proposals from your Slack, Figma, and Jira data.</p>
              <button
                onClick={onTriggerRun}
                className="px-4 py-2 btn-primary text-sm flex items-center gap-2 mx-auto"
              >
                <Play className="w-4 h-4" />
                Trigger Sync
              </button>
            </div>
          )}
          {diffs.map((diff) => {
            const PlatformIcon = platformIcons[diff.platform] || FileEdit;
            const diffStatus = diff.status || 'pending';
            const execResult = (diff as any).execution_result;
            return (
              <button
                key={diff.id}
                onClick={() => setSelectedDiff(diff.id)}
                className={`w-full p-3 rounded-xl flex items-center gap-3 transition-all ${selectedDiff === diff.id
                    ? 'bg-nexus-cyan/10 border border-nexus-cyan/30'
                    : 'bg-nexus-bg-secondary/50 border border-transparent hover:border-nexus-cyan/20'
                  }`}
              >
                <PlatformIcon className={`w-5 h-5 ${platformColors[diff.platform] || 'text-nexus-text'}`} />
                <div className="text-left flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${selectedDiff === diff.id ? 'text-nexus-cyan' : 'text-nexus-text'}`}>
                    {diff.title}
                  </p>
                  <p className="text-xs text-nexus-text-secondary">
                    {diffStatus === 'approved' && execResult ? (
                      <span className="text-nexus-green">
                        {execResult.action === 'create' && `Created ${execResult.key}`}
                        {execResult.action === 'update' && `Updated ${execResult.key}`}
                        {execResult.action === 'mark_done' && `Done ${execResult.key}`}
                      </span>
                    ) : (
                      `${diff.changes.length} change(s)`
                    )}
                  </p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${diffStatus === 'pending' ? 'bg-[#FFB800]/10 text-[#FFB800]' :
                    diffStatus === 'approved' ? 'bg-nexus-green/10 text-nexus-green' :
                      'bg-red-500/10 text-red-500'
                  }`}>
                  {diffStatus}
                </span>
              </button>
            );
          })}
        </div>

        {/* Individual Diff Actions */}
        {selectedDiff && currentDiff?.status === 'pending' && (
          <div className="mt-4 pt-4 border-t border-[rgba(0,240,255,0.1)]">
            <p className="text-xs text-nexus-text-secondary mb-2">Actions for selected proposal:</p>
            <div className="flex gap-2">
              <button
                onClick={() => handleDiffAction(selectedDiff, 'approve')}
                disabled={actionLoading !== null}
                className="flex-1 px-4 py-2.5 rounded-xl bg-nexus-green/10 border border-nexus-green/30 text-nexus-green hover:bg-nexus-green/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {actionLoading === `approve-${selectedDiff}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                <span className="font-medium">Approve</span>
              </button>
              <button
                onClick={() => handleDiffAction(selectedDiff, 'reject')}
                disabled={actionLoading !== null}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-500 hover:bg-red-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {actionLoading === `reject-${selectedDiff}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                <span className="font-medium">Reject</span>
              </button>
            </div>
          </div>
        )}

        {/* Bulk Actions - Only show if multiple pending */}
        {diffs.length > 1 && diffs.filter(d => d.status === 'pending').length > 1 && (
          <div className="mt-4 pt-4 border-t border-[rgba(0,240,255,0.1)]">
            <p className="text-xs text-nexus-text-secondary mb-2">Bulk actions:</p>
            <div className="flex gap-2">
              <button
                onClick={() => handleAction('approve')}
                disabled={actionLoading !== null}
                className="flex-1 px-4 py-2 rounded-xl bg-nexus-green/5 border border-nexus-green/20 text-nexus-green/70 hover:bg-nexus-green/10 transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-sm"
              >
                <Check className="w-3 h-3" />
                <span>Approve All</span>
              </button>
              <button
                onClick={() => handleAction('reject')}
                disabled={actionLoading !== null}
                className="flex-1 px-4 py-2 rounded-xl bg-red-500/5 border border-red-500/20 text-red-500/70 hover:bg-red-500/10 transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-sm"
              >
                <X className="w-3 h-3" />
                <span>Reject All</span>
              </button>
            </div>
          </div>
        )}

        {/* Post-action message */}
        {diffs.length > 0 && !isPending && (
          <div className="mt-4 pt-4 border-t border-[rgba(0,240,255,0.1)]">
            <p className="text-sm text-nexus-text-secondary text-center">
              {runStatus === 'completed' ? '✅ All proposals have been approved and executed.' : '❌ Proposals were rejected. No changes applied.'}
            </p>
            <button
              onClick={onTriggerRun}
              className="mt-3 w-full px-4 py-2 btn-primary text-sm flex items-center justify-center gap-2"
            >
              <Play className="w-4 h-4" />
              Trigger New Sync
            </button>
          </div>
        )}
      </motion.div>

      {/* Right Panel - Diff Detail */}
      <motion.div
        initial={{ opacity: 0, x: 30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="flex-1 glass-card-strong p-6 overflow-y-auto scrollbar-thin"
      >
        {!currentDiff ? (
          <div className="h-full flex flex-col items-center justify-center text-nexus-text-secondary">
            <GitCompare className="w-16 h-16 text-nexus-text-secondary/20 mb-4" />
            <p className="text-sm">{diffs.length > 0 ? 'Select a diff to view details.' : 'No diffs to review.'}</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-heading font-semibold text-lg text-nexus-text">{currentDiff.title}</h3>
                <p className="text-sm text-nexus-text-secondary mt-1">{currentDiff.description}</p>
              </div>
              <div className="text-right flex-shrink-0 ml-4">
                <p className="text-xs text-nexus-text-secondary">Author: {currentDiff.author}</p>
                <p className="text-xs text-nexus-text-secondary">Platform: {currentDiff.platform}</p>
              </div>
            </div>

            {/* Changes */}
            <div className="space-y-3">
              {currentDiff.changes.map((change) => (
                <div
                  key={change.id}
                  className={`rounded-xl border ${changeTypeColors[change.type] || 'bg-nexus-bg-secondary/50 border-[rgba(0,240,255,0.08)]'} overflow-hidden`}
                >
                  <button
                    onClick={() => toggleChange(change.id)}
                    className="w-full p-4 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-mono uppercase px-2 py-0.5 rounded ${changeTypeColors[change.type] || ''}`}>
                        {change.type}
                      </span>
                      <span className="text-sm font-medium text-nexus-text">{change.field}</span>
                    </div>
                    <ChevronDown className={`w-5 h-5 text-nexus-text-secondary transition-transform ${expandedChanges.has(change.id) ? 'rotate-180' : ''}`} />
                  </button>

                  <AnimatePresence>
                    {expandedChanges.has(change.id) && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="px-4 pb-4 space-y-2">
                          {change.oldValue && (
                            <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/20 font-mono text-sm">
                              <span className="text-red-400">- {change.oldValue}</span>
                            </div>
                          )}
                          {change.newValue && (
                            <div className="flex items-center gap-2">
                              {change.oldValue && <ArrowRight className="w-4 h-4 text-nexus-text-secondary flex-shrink-0" />}
                              <div className="flex-1 p-3 rounded-lg bg-nexus-green/5 border border-nexus-green/20 font-mono text-sm">
                                <span className="text-nexus-green">+ {change.newValue}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>

            {/* Proposal Details */}
            {currentDiff.proposal && Object.keys(currentDiff.proposal).length > 0 && (
              <div className="mt-6 p-4 rounded-xl bg-nexus-bg-secondary/50 border border-[rgba(0,240,255,0.08)]">
                <h4 className="text-sm font-medium text-nexus-text mb-2">Proposal Details</h4>
                <div className="space-y-1 text-xs text-nexus-text-secondary">
                  {(currentDiff.proposal as Record<string, unknown>).priority && (
                    <p>Priority: <span className="text-nexus-text">{String((currentDiff.proposal as Record<string, unknown>).priority)}</span></p>
                  )}
                  {(currentDiff.proposal as Record<string, unknown>).type && (
                    <p>Type: <span className="text-nexus-text">{String((currentDiff.proposal as Record<string, unknown>).type)}</span></p>
                  )}
                  {(currentDiff.proposal as Record<string, unknown>).existingTicket && (
                    <p>Existing Ticket: <span className="text-nexus-cyan">{String((currentDiff.proposal as Record<string, unknown>).existingTicket)}</span></p>
                  )}
                </div>
              </div>
            )}

            {/* Execution Result */}
            {(currentDiff as any).execution_result && (
              <div className="mt-6 p-4 rounded-xl bg-nexus-green/5 border border-nexus-green/20">
                <h4 className="text-sm font-medium text-nexus-green mb-2 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  Execution Result
                </h4>
                {(() => {
                  const result = (currentDiff as any).execution_result;
                  return (
                    <div className="space-y-2 text-sm">
                      <p className="text-nexus-text">
                        <span className="text-nexus-text-secondary">Action:</span>{' '}
                        {result.action === 'create' && 'Created new Jira ticket'}
                        {result.action === 'update' && 'Updated existing Jira ticket'}
                        {result.action === 'mark_done' && 'Marked ticket as Done'}
                      </p>
                      <p className="text-nexus-text">
                        <span className="text-nexus-text-secondary">Ticket:</span>{' '}
                        <span className="text-nexus-cyan font-mono">{result.key}</span>
                      </p>
                      <p className="text-nexus-text">
                        <span className="text-nexus-text-secondary">Title:</span>{' '}
                        {result.title}
                      </p>
                      {result.reason && (
                        <p className="text-nexus-text-secondary text-xs">
                          Reason: {result.reason}
                        </p>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}
          </>
        )}
      </motion.div>
    </div>
  );
}