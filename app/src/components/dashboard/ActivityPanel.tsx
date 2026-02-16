import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Zap,
  TrendingUp,
  TrendingDown,
  MessageSquare,
  Figma,
  Trello,
  Calendar,
  Loader2
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import * as api from '../../lib/apiClient';

interface PlatformStat {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  events: number;
  change: number;
  trend: 'up' | 'down' | 'stable';
}

const platformIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  slack: MessageSquare,
  figma: Figma,
  jira: Trello,
};

const platformColors: Record<string, string> = {
  slack: '#B829F7',
  figma: '#00F0FF',
  jira: '#2B6FFF',
};

interface ActivityPanelProps {
  projectId?: string;
  onNavigate?: (view: string) => void;
}

export default function ActivityPanel({ projectId, onNavigate }: ActivityPanelProps) {
  const [activityData, setActivityData] = useState<Array<{ time: string; events: number; syncs: number }>>([]);
  const [platformStats, setPlatformStats] = useState<PlatformStat[]>([]);
  const [totalEvents, setTotalEvents] = useState(0);
  const [totalEventsAllTime, setTotalEventsAllTime] = useState(0);
  const [totalSyncs, setTotalSyncs] = useState(0);
  const [activeAgents, setActiveAgents] = useState(0);
  const [isLive, setIsLive] = useState(true);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<{ from: string; to: string } | null>(null);
  const [slackHistory, setSlackHistory] = useState(0);

  useEffect(() => {
    const fetchActivity = async () => {
      if (!projectId) return;
      try {
        const data = await api.getActivityStats(projectId);
        setPlatformStats(data.platforms.map(p => ({
          ...p,
          icon: platformIcons[p.id] || MessageSquare,
          color: platformColors[p.id] || '#00F0FF',
          trend: p.trend as 'up' | 'down' | 'stable',
        })));
        setTotalEvents(data.totalEvents);
        setTotalEventsAllTime(data.totalEventsAllTime || data.totalEvents);
        setTotalSyncs(data.totalSyncs);
        setActiveAgents(data.activeAgents);
        setActivityData(data.chartData.length > 0 ? data.chartData : []);
        setTimeRange(data.timeRange || null);
        setSlackHistory(data.slackHistory || 0);
      } catch {
        // Keep empty state on error
      } finally {
        setLoading(false);
      }
    };

    fetchActivity();

    // Poll every 15 seconds when live
    let interval: ReturnType<typeof setInterval> | null = null;
    if (isLive) {
      interval = setInterval(fetchActivity, 15000);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [projectId, isLive]);

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card-strong p-6 h-full flex items-center justify-center min-h-[400px]"
      >
        <Loader2 className="w-6 h-6 text-nexus-cyan animate-spin" />
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
      className="glass-card-strong p-6 h-full"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-nexus-cyan/10 flex items-center justify-center">
            <Zap className="w-5 h-5 text-nexus-cyan" />
          </div>
          <div>
            <h3 className="font-heading font-semibold text-lg text-nexus-text">Project Pulse</h3>
            <p className="text-xs text-nexus-text-secondary">Live updates from all platforms</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsLive(!isLive)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${isLive
                ? 'bg-nexus-green/10 text-nexus-green'
                : 'bg-nexus-bg-secondary text-nexus-text-secondary'
              }`}
          >
            <div className={`w-2 h-2 rounded-full ${isLive ? 'bg-nexus-green animate-pulse' : 'bg-nexus-text-secondary'}`} />
            {isLive ? 'LIVE' : 'PAUSED'}
          </button>
        </div>
      </div>

      {/* Platform Pills */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        {platformStats.map((platform) => {
          const Icon = platform.icon;
          const totalEvents = (platform as any).total_events || platform.events;
          return (
            <motion.div
              key={platform.id}
              whileHover={{ scale: 1.02 }}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-nexus-bg-secondary border border-[rgba(0,240,255,0.08)]"
            >
              <span style={{ color: platform.color }}>
                <Icon className="w-4 h-4" />
              </span>
              <span className="text-sm font-medium text-nexus-text">{platform.name}</span>
              <span className="text-xs text-nexus-text-secondary" title="Last 24h / Total">
                {platform.events}
                {totalEvents > platform.events && (
                  <span className="text-nexus-text-secondary/50"> / {totalEvents}</span>
                )}
              </span>
              {platform.change !== 0 && (
                <div className={`flex items-center gap-1 text-xs ${platform.trend === 'up' ? 'text-nexus-green' :
                    platform.trend === 'down' ? 'text-red-500' : 'text-nexus-text-secondary'
                  }`}>
                  {platform.trend === 'up' ? <TrendingUp className="w-3 h-3" /> :
                    platform.trend === 'down' ? <TrendingDown className="w-3 h-3" /> : null}
                  {Math.abs(platform.change)}%
                </div>
              )}
            </motion.div>
          );
        })}
        {platformStats.length === 0 && (
          <div className="text-xs text-nexus-text-secondary py-2">
            No activity data yet. Run a sync to start tracking.
          </div>
        )}
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="p-4 rounded-xl bg-nexus-bg-secondary/50 border border-[rgba(0,240,255,0.08)]">
          <p className="text-xs text-nexus-text-secondary uppercase tracking-wider mb-1">Events (24h)</p>
          <p className="text-2xl font-heading font-bold text-nexus-text">{totalEvents.toLocaleString()}</p>
        </div>
        <div className="p-4 rounded-xl bg-nexus-bg-secondary/50 border border-[rgba(0,240,255,0.08)]">
          <p className="text-xs text-nexus-text-secondary uppercase tracking-wider mb-1">Total Events</p>
          <p className="text-2xl font-heading font-bold text-nexus-cyan">{(totalEventsAllTime || totalEvents).toLocaleString()}</p>
        </div>
        <div className="p-4 rounded-xl bg-nexus-bg-secondary/50 border border-[rgba(0,240,255,0.08)]">
          <p className="text-xs text-nexus-text-secondary uppercase tracking-wider mb-1">Syncs</p>
          <p className="text-2xl font-heading font-bold text-nexus-violet">{totalSyncs.toLocaleString()}</p>
        </div>
        <div className="p-4 rounded-xl bg-nexus-bg-secondary/50 border border-[rgba(0,240,255,0.08)]">
          <p className="text-xs text-nexus-text-secondary uppercase tracking-wider mb-1">Active Agents</p>
          <p className="text-2xl font-heading font-bold text-nexus-green">{activeAgents}</p>
          {activeAgents > 0 && (
            <div className="flex items-center gap-1 mt-1 text-nexus-text-secondary text-xs">
              <div className="w-2 h-2 rounded-full bg-nexus-green animate-pulse" />
              <span>Running</span>
            </div>
          )}
        </div>
      </div>

      {/* Activity Chart */}
      <div className="h-48">
        {activityData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={activityData}>
              <defs>
                <linearGradient id="colorEvents" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00F0FF" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#00F0FF" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorSyncs" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00FFAA" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#00FFAA" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,240,255,0.05)" />
              <XAxis
                dataKey="time"
                stroke="#A7B1C8"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                interval={4}
              />
              <YAxis
                stroke="#A7B1C8"
                fontSize={10}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0B1222',
                  border: '1px solid rgba(0,240,255,0.2)',
                  borderRadius: '12px',
                  fontSize: '12px'
                }}
                itemStyle={{ color: '#F4F7FF' }}
              />
              <Area
                type="monotone"
                dataKey="events"
                stroke="#00F0FF"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorEvents)"
              />
              <Area
                type="monotone"
                dataKey="syncs"
                stroke="#00FFAA"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorSyncs)"
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-nexus-text-secondary text-sm">
            No activity data yet. Trigger a sync to see chart data.
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="mt-4 pt-4 border-t border-[rgba(0,240,255,0.1)] flex items-center gap-2 text-xs text-nexus-text-secondary">
        <Calendar className="w-4 h-4" />
        <span>
          {timeRange 
            ? `Last 24h (${new Date(timeRange.from).toLocaleDateString()} - ${new Date(timeRange.to).toLocaleDateString()})`
            : 'Last 24 hours'
          }
        </span>
        {slackHistory > 0 && (
          <span className="text-nexus-cyan">• {slackHistory} messages stored</span>
        )}
      </div>
    </motion.div>
  );
}