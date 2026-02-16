import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { MessageSquare, RefreshCw, User, Hash } from 'lucide-react';
import * as api from '../../lib/apiClient';

interface SlackMessage {
  text: string;
  user: string;
  ts: string;
  channel?: string;
}

interface SlackMessagesProps {
  projectId: string;
}

export default function SlackMessages({ projectId }: SlackMessagesProps) {
  const [messages, setMessages] = useState<SlackMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMessages = async () => {
    try {
      setLoading(true);
      const data = await api.getSlackMessages(projectId);
      setMessages(data.messages || []);
      setError(null);
    } catch (err) {
      setError('Failed to fetch Slack messages');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
    // Poll every 30 seconds
    const interval = setInterval(fetchMessages, 30000);
    return () => clearInterval(interval);
  }, [projectId]);

  const formatTime = (ts: string) => {
    const date = new Date(parseFloat(ts) * 1000);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (ts: string) => {
    const date = new Date(parseFloat(ts) * 1000);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Group messages by date
  const groupedMessages = messages.reduce((groups, msg) => {
    const date = formatDate(msg.ts);
    if (!groups[date]) groups[date] = [];
    groups[date].push(msg);
    return groups;
  }, {} as Record<string, SlackMessage[]>);

  return (
    <div className="glass-card p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <MessageSquare className="w-4 h-4 text-[#B829F7]" />
          <h3 className="font-heading text-base font-semibold text-nexus-text">
            Slack Messages
          </h3>
          <span className="text-xs text-nexus-text-secondary bg-[rgba(184,41,247,0.1)] px-2 py-0.5 rounded-full">
            #{messages[0]?.channel || 'nexus-engineering'}
          </span>
        </div>
        <button
          onClick={fetchMessages}
          disabled={loading}
          className="p-1.5 rounded-lg hover:bg-[rgba(255,255,255,0.05)] transition-colors"
        >
          <RefreshCw className={`w-3 h-3 text-nexus-text-secondary ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Messages List */}
      <div className="h-64 overflow-y-auto scrollbar-thin space-y-4">
        {loading && messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <RefreshCw className="w-5 h-5 text-nexus-text-secondary animate-spin" />
          </div>
        ) : error ? (
          <div className="text-center text-sm text-nexus-text-secondary py-8">
            {error}
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center text-sm text-nexus-text-secondary py-8">
            No Slack messages found
          </div>
        ) : (
          Object.entries(groupedMessages).map(([date, msgs]) => (
            <div key={date}>
              {/* Date Divider */}
              <div className="flex items-center gap-3 mb-3">
                <div className="flex-1 h-px bg-[rgba(255,255,255,0.08)]" />
                <span className="text-[10px] text-nexus-text-secondary uppercase tracking-wider">{date}</span>
                <div className="flex-1 h-px bg-[rgba(255,255,255,0.08)]" />
              </div>

              {/* Messages for this date */}
              <div className="space-y-3">
                {msgs.map((msg, idx) => (
                  <motion.div
                    key={`${msg.ts}-${idx}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: idx * 0.05 }}
                    className="flex gap-3 p-3 rounded-xl bg-[rgba(255,255,255,0.02)] hover:bg-[rgba(255,255,255,0.04)] transition-colors"
                  >
                    {/* Avatar */}
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-[#B829F7] to-[#2B6FFF] flex items-center justify-center">
                      <User className="w-4 h-4 text-white" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-nexus-text">
                          {msg.user}
                        </span>
                        <span className="text-[10px] text-nexus-text-secondary">
                          {formatTime(msg.ts)}
                        </span>
                      </div>
                      <p className="text-sm text-nexus-text-secondary leading-relaxed">
                        {msg.text}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="mt-3 pt-3 border-t border-[rgba(0,240,255,0.08)] flex items-center justify-between">
        <span className="text-[10px] text-nexus-text-secondary">
          {messages.length} messages
        </span>
        <span className="text-[10px] text-nexus-text-secondary">
          Auto-updating
        </span>
      </div>
    </div>
  );
}
