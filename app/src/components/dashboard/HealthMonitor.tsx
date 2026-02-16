import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Figma,
  Slack,
  Trello,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  Activity,
  Loader2
} from 'lucide-react';
import * as api from '../../lib/apiClient';

interface ConnectionStatus {
  id: string;
  name: string;
  icon: string;
  status: 'connected' | 'disconnected' | 'error' | 'syncing';
  lastSync: string;
  health: number;
  latency: number;
  color: string;
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  figma: Figma,
  slack: Slack,
  jira: Trello,
};

export default function HealthMonitor() {
  const [connections, setConnections] = useState<ConnectionStatus[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchStatus = useCallback(async () => {
    try {
      const data = await api.getServicesStatus();
      setConnections(data as ConnectionStatus[]);
    } catch {
      setConnections([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    // Poll every 30 seconds
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setConnections(prev => prev.map(conn => ({
      ...conn,
      status: 'syncing' as const,
      lastSync: 'syncing...',
    })));
    await fetchStatus();
    setIsRefreshing(false);
  };

  const getStatusIcon = (status: ConnectionStatus['status']) => {
    switch (status) {
      case 'connected':
        return <CheckCircle2 className="w-5 h-5 text-nexus-green" />;
      case 'disconnected':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-[#FFB800]" />;
      case 'syncing':
        return <RefreshCw className="w-5 h-5 text-nexus-cyan animate-spin" />;
    }
  };

  const getStatusColor = (status: ConnectionStatus['status']) => {
    switch (status) {
      case 'connected':
        return 'border-nexus-green/30 bg-nexus-green/5';
      case 'disconnected':
        return 'border-red-500/30 bg-red-500/5';
      case 'error':
        return 'border-[#FFB800]/30 bg-[#FFB800]/5';
      case 'syncing':
        return 'border-nexus-cyan/30 bg-nexus-cyan/5';
    }
  };

  const overallHealth = connections.length > 0
    ? Math.round(connections.reduce((acc, conn) => acc + conn.health, 0) / connections.length)
    : 0;

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card-strong p-6 h-full flex items-center justify-center"
      >
        <Loader2 className="w-6 h-6 text-nexus-cyan animate-spin" />
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="glass-card-strong p-6 h-full"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-nexus-cyan/10 flex items-center justify-center">
            <Activity className="w-5 h-5 text-nexus-cyan" />
          </div>
          <div>
            <h3 className="font-heading font-semibold text-lg text-nexus-text">Global Health</h3>
            <p className="text-xs text-nexus-text-secondary">Real-time connection status</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-xs text-nexus-text-secondary uppercase tracking-wider">Overall</p>
            <p className={`text-2xl font-heading font-bold ${overallHealth >= 90 ? 'text-nexus-green' :
                overallHealth >= 70 ? 'text-[#FFB800]' : 'text-red-500'
              }`}>
              {overallHealth}%
            </p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2 rounded-lg hover:bg-white/5 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-5 h-5 text-nexus-text-secondary ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Connection Cards */}
      <div className="space-y-3">
        {connections.length === 0 && (
          <div className="text-center py-8 text-nexus-text-secondary text-sm">
            No services configured. Add connections in the Vault.
          </div>
        )}
        {connections.map((connection, index) => {
          const Icon = iconMap[connection.icon] || Activity;
          return (
            <motion.div
              key={connection.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.1 * index }}
              className={`p-4 rounded-xl border ${getStatusColor(connection.status)} transition-all duration-300 hover:scale-[1.02]`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${connection.status === 'connected' ? 'bg-nexus-green/10' :
                      connection.status === 'syncing' ? 'bg-nexus-cyan/10' :
                        'bg-red-500/10'
                    }`}>
                    <Icon className={`w-5 h-5 ${connection.status === 'connected' ? 'text-nexus-green' :
                        connection.status === 'syncing' ? 'text-nexus-cyan' :
                          'text-red-500'
                      }`} />
                  </div>
                  <div>
                    <p className="font-medium text-nexus-text">{connection.name}</p>
                    <p className="text-xs text-nexus-text-secondary">
                      Last sync: {connection.lastSync}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {/* Health Bar */}
                  <div className="w-24">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-nexus-text-secondary">Health</span>
                      <span className={`font-mono ${connection.health >= 90 ? 'text-nexus-green' :
                          connection.health >= 70 ? 'text-[#FFB800]' :
                            'text-red-500'
                        }`}>
                        {Math.round(connection.health)}%
                      </span>
                    </div>
                    <div className="h-1.5 bg-nexus-bg-secondary rounded-full overflow-hidden">
                      <motion.div
                        className={`h-full rounded-full ${connection.health >= 90 ? 'bg-nexus-green' :
                            connection.health >= 70 ? 'bg-[#FFB800]' :
                              'bg-red-500'
                          }`}
                        initial={{ width: 0 }}
                        animate={{ width: `${connection.health}%` }}
                        transition={{ duration: 0.5 }}
                      />
                    </div>
                  </div>

                  {/* Latency */}
                  <div className="text-right min-w-[60px]">
                    <p className="text-xs text-nexus-text-secondary">Latency</p>
                    <p className={`font-mono text-sm ${connection.latency < 50 ? 'text-nexus-green' :
                        connection.latency < 100 ? 'text-[#FFB800]' :
                          'text-red-500'
                      }`}>
                      {Math.round(connection.latency)}ms
                    </p>
                  </div>

                  {/* Status Icon */}
                  {getStatusIcon(connection.status)}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Footer Stats */}
      <div className="mt-6 pt-4 border-t border-[rgba(0,240,255,0.1)]">
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-2xl font-heading font-bold text-nexus-green">
              {connections.filter(c => c.status === 'connected').length}
            </p>
            <p className="text-xs text-nexus-text-secondary uppercase tracking-wider">Connected</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-heading font-bold text-nexus-cyan">
              {connections.filter(c => c.status === 'syncing').length}
            </p>
            <p className="text-xs text-nexus-text-secondary uppercase tracking-wider">Syncing</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-heading font-bold text-nexus-text-secondary">
              {connections.filter(c => c.status === 'disconnected' || c.status === 'error').length}
            </p>
            <p className="text-xs text-nexus-text-secondary uppercase tracking-wider">Issues</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}