import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GitBranch,
  Cpu,
  Brain,
  FileEdit,
  UserCheck,
  Play,
  Clock,
  ChevronRight,
  RotateCcw,
  Loader2,
  CheckCircle2,
  Circle
} from 'lucide-react';
import * as api from '../../lib/apiClient';

const stageIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  ingest: Cpu,
  reason: Brain,
  draft: FileEdit,
  human_review: UserCheck,
  execute: Play,
};

const stageColors: Record<string, string> = {
  ingest: 'text-nexus-cyan',
  reason: 'text-nexus-violet',
  draft: 'text-nexus-blue',
  human_review: 'text-[#FFB800]',
  execute: 'text-nexus-green',
};

const statusColors: Record<string, string> = {
  completed: 'bg-nexus-green',
  active: 'bg-nexus-cyan animate-pulse',
  pending: 'bg-nexus-text-secondary',
  error: 'bg-red-500',
};

interface AgentTimelineProps {
  projectId?: string;
}

export default function AgentTimeline({ projectId }: AgentTimelineProps) {
  const [runs, setRuns] = useState<api.AgentRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string>('');
  const [expandedNode, setExpandedNode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchRuns = useCallback(async () => {
    if (!projectId) return;
    try {
      const data = await api.getRuns(projectId);
      setRuns(data);

      // Auto-select latest run if none selected or if a new run starts
      if (data.length > 0) {
        setRuns(prev => {
          // If we have a new run at the top that is running, switch to it
          if (prev.length > 0 && data[0].id !== prev[0].id && data[0].status === 'running') {
            setSelectedRunId(data[0].id);
            return data; // Update state
          }
          // Initial load
          if (!selectedRunId) setSelectedRunId(data[0].id);
          return data;
        });
      }
    } catch {
      setRuns([]);
    } finally {
      setLoading(false);
    }
  }, [projectId, selectedRunId]);

  useEffect(() => {
    fetchRuns();
    const interval = setInterval(fetchRuns, 2000); // Poll faster for live feel
    return () => clearInterval(interval);
  }, [fetchRuns]);

  const currentRun = runs.find(r => r.id === selectedRunId) || runs[0];

  // Auto-expand active node
  useEffect(() => {
    if (currentRun) {
      const activeNode = currentRun.nodes.find(n => n.status === 'active');
      if (activeNode && expandedNode !== activeNode.id) {
        setExpandedNode(activeNode.id);
      }
    }
  }, [currentRun, expandedNode]);

  // Scroll to bottom of logs on new details
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [currentRun?.nodes]);

  const formatTimestamp = (ts: string) => {
    if (!ts || ts === '-' || ts === 'now') return ts;
    try {
      const d = new Date(ts);
      if (isNaN(d.getTime())) return ts;
      const diff = Date.now() - d.getTime();
      if (diff < 60000) return 'just now';
      if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
      return `${Math.floor(diff / 3600000)}h ago`;
    } catch {
      return ts;
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-nexus-cyan animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full flex gap-6">
      {/* Left Panel - Run History */}
      <motion.div
        initial={{ opacity: 0, x: -30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5 }}
        className="w-[28vw] glass-card-strong p-6 flex flex-col"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-nexus-cyan/10 flex items-center justify-center">
            <GitBranch className="w-5 h-5 text-nexus-cyan" />
          </div>
          <div>
            <h2 className="font-heading font-bold text-2xl text-nexus-text">Agent Timeline</h2>
            <p className="text-xs text-nexus-text-secondary">Execution history</p>
          </div>
        </div>

        <div className="space-y-2 mb-6 flex-1 overflow-y-auto scrollbar-thin">
          {runs.map((run) => (
            <button
              key={run.id}
              onClick={() => setSelectedRunId(run.id)}
              className={`w-full p-3 rounded-xl flex items-center justify-between transition-all ${selectedRunId === run.id
                ? 'bg-nexus-cyan/10 border border-nexus-cyan/30'
                : 'bg-nexus-bg-secondary/50 border border-transparent hover:border-nexus-cyan/20'
                }`}
            >
              <div className="text-left">
                <p className={`text-sm font-medium ${selectedRunId === run.id ? 'text-nexus-cyan' : 'text-nexus-text'}`}>
                  {run.name}
                </p>
                <p className="text-xs text-nexus-text-secondary">{formatTimestamp(run.createdAt)}</p>
              </div>
              <div className={`w-2 h-2 rounded-full ${run.status === 'completed' ? 'bg-nexus-green' :
                  run.status === 'running' ? 'bg-nexus-cyan animate-pulse' :
                    run.status === 'failed' ? 'bg-red-500' :
                      'bg-[#FFB800]'
                }`} />
            </button>
          ))}
          {runs.length === 0 && (
            <div className="text-center py-10 text-nexus-text-secondary">
              <p className="text-sm">No runs yet</p>
            </div>
          )}
        </div>
      </motion.div>

      {/* Right Panel - Timeline Detail */}
      <motion.div
        initial={{ opacity: 0, x: 30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="flex-1 glass-card-strong p-0 flex flex-col overflow-hidden"
      >
        {!currentRun ? (
          <div className="h-full flex items-center justify-center text-nexus-text-secondary text-sm">
            Select a run to view details.
          </div>
        ) : (
          <>
            {/* Header with Stepper */}
            <div className="p-6 border-b border-[rgba(0,240,255,0.1)] bg-nexus-bg-secondary/30">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="font-heading font-semibold text-lg text-nexus-text flex items-center gap-2">
                    {currentRun.name}
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${currentRun.status === 'completed' ? 'bg-nexus-green/10 text-nexus-green border-nexus-green/30' :
                        currentRun.status === 'running' ? 'bg-nexus-cyan/10 text-nexus-cyan border-nexus-cyan/30 animate-pulse' :
                          currentRun.status === 'failed' ? 'bg-red-500/10 text-red-500 border-red-500/30' :
                            'bg-[#FFB800]/10 text-[#FFB800] border-[#FFB800]/30'
                      }`}>
                      {currentRun.status.toUpperCase()}
                    </span>
                  </h3>
                  <p className="text-xs text-nexus-text-secondary mt-1 font-mono">ID: {currentRun.id}</p>
                </div>
                <button onClick={fetchRuns} className="p-2 rounded-lg hover:bg-white/5 transition-colors">
                  <RotateCcw className="w-4 h-4 text-nexus-text-secondary" />
                </button>
              </div>

              {/* Stepper */}
              <div className="flex items-center justify-between relative px-2">
                {/* Connecting line */}
                <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-[rgba(255,255,255,0.1)] -z-10" />

                {currentRun.nodes.map((node, i) => {
                  const isCompleted = node.status === 'completed';
                  const isActive = node.status === 'active';
                  const isError = node.status === 'error';
                  const Icon = stageIcons[node.stage] || Cpu;

                  return (
                    <div key={node.id} className="flex flex-col items-center gap-2 bg-[#0C1221] px-2 z-10">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${isCompleted ? 'bg-nexus-green/20 border-nexus-green text-nexus-green' :
                          isActive ? 'bg-nexus-cyan/20 border-nexus-cyan text-nexus-cyan animate-pulse' :
                            isError ? 'bg-red-500/20 border-red-500 text-red-500' :
                              'bg-nexus-bg border-[rgba(255,255,255,0.2)] text-nexus-text-secondary'
                        }`}>
                        {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                      </div>
                      <span className={`text-[10px] font-medium uppercase tracking-wider ${isCompleted ? 'text-nexus-green' :
                          isActive ? 'text-nexus-cyan' :
                            isError ? 'text-red-500' :
                              'text-nexus-text-secondary'
                        }`}>
                        {node.title}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Timeline Logs */}
            <div className="flex-1 overflow-y-auto scrollbar-thin p-6" ref={scrollRef}>
              <div className="relative pl-6 border-l-2 border-[rgba(0,240,255,0.1)] space-y-8">
                {currentRun.nodes.map((node, index) => {
                  const Icon = stageIcons[node.stage] || Cpu;
                  const isExpanded = expandedNode === node.id || node.status === 'active';

                  return (
                    <motion.div
                      key={node.id}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="relative"
                    >
                      {/* Timeline Dot */}
                      <div className={`absolute -left-[31px] top-0 w-4 h-4 rounded-full border-4 border-[#070B14] shadow-[0_0_10px_rgba(0,0,0,0.5)] ${node.status === 'completed' ? 'bg-nexus-green' :
                          node.status === 'active' ? 'bg-nexus-cyan animate-pulse' :
                            node.status === 'error' ? 'bg-red-500' :
                              'bg-nexus-text-secondary'
                        }`} />

                      <div
                        className={`rounded-xl border p-4 transition-all ${node.status === 'active'
                            ? 'bg-nexus-cyan/5 border-nexus-cyan/30 shadow-[0_0_20px_rgba(0,240,255,0.05)]'
                            : 'bg-nexus-bg-secondary/40 border-[rgba(0,240,255,0.05)]'
                          }`}
                        onClick={() => setExpandedNode(expandedNode === node.id ? null : node.id)}
                      >
                        <div className="flex justify-between items-start cursor-pointer">
                          <div className="flex gap-3">
                            <div className={`mt-0.5 ${stageColors[node.stage]}`}>
                              <Icon className="w-5 h-5" />
                            </div>
                            <div>
                              <h4 className={`text-sm font-semibold ${node.status === 'active' ? 'text-nexus-cyan' : 'text-nexus-text'
                                }`}>
                                {node.description}
                              </h4>
                              <p className="text-xs text-nexus-text-secondary mt-1">
                                Agent: <span className="text-nexus-text">{node.agent}</span>
                              </p>
                            </div>
                          </div>
                          <span className="text-xs font-mono text-nexus-text-secondary opacity-50">
                            {formatTimestamp(node.timestamp)}
                          </span>
                        </div>

                        {/* Console Logs / Details */}
                        <AnimatePresence>
                          {(isExpanded && (node.details || node.status === 'active')) && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="mt-4 pt-4 border-t border-[rgba(255,255,255,0.05)]">
                                <div className="bg-[#05080F] rounded-lg p-3 font-mono text-xs text-nexus-text-secondary space-y-1.5 border border-[rgba(0,240,255,0.1)]">
                                  {node.details?.map((log, i) => (
                                    <div key={i} className="flex gap-2">
                                      <span className="text-nexus-cyan/50 select-none">{'>'}</span>
                                      <span>{log}</span>
                                    </div>
                                  ))}
                                  {node.status === 'active' && (
                                    <div className="flex gap-2 animate-pulse">
                                      <span className="text-nexus-cyan/50">{'>'}</span>
                                      <span className="text-nexus-cyan">Processing...</span>
                                    </div>
                                  )}
                                  {!node.details && node.status !== 'active' && (
                                    <span className="opacity-50 italic">No output logs</span>
                                  )}
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}