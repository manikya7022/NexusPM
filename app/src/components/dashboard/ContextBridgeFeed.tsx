import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Terminal,
  Cpu,
  MessageSquare,
  Figma,
  Trello,
  Download,
  Wifi,
  WifiOff,
  Pause,
  Play
} from 'lucide-react';

interface AgentPulse {
  id: string;
  timestamp: string | Date;
  agent: string;
  action: string;
  source: string;
  target: string;
  status: string;
  details?: string;
}

interface ContextBridgeFeedProps {
  pulses?: AgentPulse[];
  connected?: boolean;
}

const sourceIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  slack: MessageSquare,
  figma: Figma,
  jira: Trello,
  system: Cpu,
};

const sourceColors: Record<string, string> = {
  slack: '#B829F7',
  figma: '#00F0FF',
  jira: '#2B6FFF',
  system: '#00FFAA',
};

const agentColors: Record<string, string> = {
  Architect: '#00F0FF',
  Scribe: '#B829F7',
  Curator: '#2B6FFF',
  Operator: '#00FFAA',
  Synthesizer: '#FF6B6B',
  Orchestrator: '#FFB800',
};

export default function ContextBridgeFeed({ pulses: externalPulses, connected: wsConnected }: ContextBridgeFeedProps) {
  const [allPulses, setAllPulses] = useState<AgentPulse[]>([]);
  const [paused, setPaused] = useState(false);
  const [filter, setFilter] = useState<string>('all');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Merge external WebSocket pulses with local ones
  useEffect(() => {
    if (externalPulses && externalPulses.length > 0) {
      setAllPulses(externalPulses);
    }
  }, [externalPulses]);



  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current && !paused) {
      scrollRef.current.scrollTop = 0;
    }
  }, [allPulses, paused]);

  const filteredPulses = filter === 'all'
    ? allPulses
    : allPulses.filter(p => p.source === filter);

  const formatTime = (ts: string | Date) => {
    const d = ts instanceof Date ? ts : new Date(ts);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const handleExport = () => {
    const csv = filteredPulses.map(p =>
      `${formatTime(p.timestamp)},${p.agent},${p.action},${p.target},${p.source},${p.status}`
    ).join('\n');
    const blob = new Blob([`Time,Agent,Action,Target,Source,Status\n${csv}`], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'nexus-pm-agent-feed.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="glass-card p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <Terminal className="w-4 h-4 text-nexus-cyan" />
          <h3 className="font-heading text-base font-semibold text-nexus-text">
            Context Bridge
          </h3>
          <div className="flex items-center gap-1.5">
            {wsConnected ? (
              <div className="flex items-center gap-1 text-[10px] text-nexus-green">
                <Wifi className="w-3 h-3" />
                <span>LIVE</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 text-[10px] text-nexus-text-secondary">
                <WifiOff className="w-3 h-3" />
                <span>DEMO</span>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {/* Source filter */}
          <div className="flex items-center gap-0.5 mr-1">
            {['all', 'slack', 'figma', 'jira', 'system'].map(src => (
              <button
                key={src}
                onClick={() => setFilter(src)}
                className={`px-2 py-1 rounded-lg text-[10px] font-medium transition-all ${filter === src
                  ? 'bg-[rgba(0,240,255,0.15)] text-nexus-cyan border border-[rgba(0,240,255,0.3)]'
                  : 'text-nexus-text-secondary hover:text-nexus-text hover:bg-[rgba(255,255,255,0.04)]'
                  }`}
              >
                {src === 'all' ? 'All' : src.charAt(0).toUpperCase() + src.slice(1)}
              </button>
            ))}
          </div>
          <button onClick={() => setPaused(!paused)} className="p-1.5 rounded-lg hover:bg-[rgba(255,255,255,0.05)] transition-colors">
            {paused ? <Play className="w-3 h-3 text-nexus-text-secondary" /> : <Pause className="w-3 h-3 text-nexus-text-secondary" />}
          </button>
          <button onClick={handleExport} className="p-1.5 rounded-lg hover:bg-[rgba(255,255,255,0.05)] transition-colors">
            <Download className="w-3 h-3 text-nexus-text-secondary" />
          </button>
        </div>
      </div>

      {/* Feed */}
      <div ref={scrollRef} className="h-64 overflow-y-auto scrollbar-thin space-y-1 font-mono text-xs">
        <AnimatePresence initial={false}>
          {filteredPulses.slice(0, 50).map((pulse) => {
            const SourceIcon = sourceIcons[pulse.source] || Cpu;
            const agentColor = agentColors[pulse.agent] || '#00F0FF';
            const statusColor = pulse.status === 'completed' ? '#00FFAA' : pulse.status === 'error' ? '#ff4444' : '#FFB800';

            return (
              <motion.div
                key={pulse.id}
                initial={{ opacity: 0, x: -20, height: 0 }}
                animate={{ opacity: 1, x: 0, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25 }}
                className="flex items-start gap-2 p-2 rounded-lg hover:bg-[rgba(255,255,255,0.03)] transition-colors group"
              >
                {/* Time */}
                <span className="text-[10px] text-nexus-text-secondary whitespace-nowrap mt-0.5 font-mono">
                  {formatTime(pulse.timestamp)}
                </span>

                {/* Source icon */}
                <div className="mt-0.5" style={{ color: sourceColors[pulse.source] }}>
                  <SourceIcon className="w-3 h-3" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <span className="font-semibold" style={{ color: agentColor }}>
                    Agent: {pulse.agent}
                  </span>
                  <span className="text-nexus-text-secondary mx-1">is</span>
                  <span className="text-nexus-text">{pulse.action}</span>
                  <span className="text-nexus-text-secondary mx-1">→</span>
                  <span className="text-nexus-cyan">{pulse.target}</span>
                </div>

                {/* Status dot */}
                <div className="flex items-center gap-1 mt-0.5">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: statusColor, boxShadow: `0 0 6px ${statusColor}60` }} />
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div className="mt-3 pt-3 border-t border-[rgba(0,240,255,0.08)] flex items-center justify-between">
        <span className="text-[10px] text-nexus-text-secondary">
          {filteredPulses.length} events • {filteredPulses.filter(p => p.status === 'processing').length} active
        </span>
        <span className="text-[10px] text-nexus-text-secondary">
          {paused ? 'Paused' : 'Auto-updating'}
        </span>
      </div>
    </div>
  );
}