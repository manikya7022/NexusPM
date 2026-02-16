import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield,
  Figma,
  Slack,
  Trello,
  Plus,
  CheckCircle2,
  XCircle,
  Key,
  Webhook,
  Lock,
  Eye,
  EyeOff,
  Copy,
  RefreshCw,
  Trash2,
  ExternalLink,
  Loader2
} from 'lucide-react';
import { useConnections } from '../../hooks/useConnections';
import type { Connection as ApiConnection } from '../../lib/apiClient';

interface ConnectionVaultProps {
  projectId: string;
}

// Map icon string names from the backend to Lucide components
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  figma: Figma,
  slack: Slack,
  jira: Trello,
  key: Key,
};

function getIcon(iconName: string) {
  return iconMap[iconName.toLowerCase()] || Key;
}

export default function ConnectionVault({ projectId }: ConnectionVaultProps) {
  const { connections, loading, add, update, test, remove, refresh } = useConnections(projectId);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newConnection, setNewConnection] = useState({ name: '', token: '', webhook: '' });
  const [showToken, setShowToken] = useState<Record<string, boolean>>({});
  const [, setSelectedConnection] = useState<string | null>(null);
  const [testingIds, setTestingIds] = useState<Set<string>>(new Set());

  // Auto-test all connections on first load
  useEffect(() => {
    if (!loading && connections.length > 0) {
      connections.forEach((conn) => {
        if (conn.status !== 'connected') {
          handleTest(conn.id);
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  const [editingId, setEditingId] = useState<string | null>(null);

  const handleConnect = async () => {
    if (newConnection.name && (newConnection.token || editingId)) {
      if (editingId) {
        await update(editingId, {
          token: newConnection.token,
          webhook: newConnection.webhook
        });
      } else {
        const iconKey = newConnection.name.toLowerCase().includes('figma') ? 'figma'
          : newConnection.name.toLowerCase().includes('slack') ? 'slack'
            : newConnection.name.toLowerCase().includes('jira') ? 'jira'
              : 'key';
        const colorMap: Record<string, string> = { figma: '#00F0FF', slack: '#B829F7', jira: '#2B6FFF', key: '#00F0FF' };
        await add(newConnection.name, newConnection.token, iconKey, colorMap[iconKey]);
      }
      setNewConnection({ name: '', token: '', webhook: '' });
      setIsAddingNew(false);
      setEditingId(null);
    }
  };

  const handleEdit = (conn: ApiConnection) => {
    setNewConnection({
      name: conn.name,
      token: '', // Don't show existing token value for security
      webhook: conn.webhook || ''
    });
    setEditingId(conn.id);
    setIsAddingNew(true);
  };

  const handleTest = async (id: string) => {
    setTestingIds(prev => new Set(prev).add(id));
    await test(id);
    setTestingIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const handleDisconnect = async (id: string) => {
    await remove(id);
  };

  const toggleTokenVisibility = (id: string) => {
    setShowToken(prev => ({ ...prev, [id]: !prev[id] }));
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
      {/* Left Panel - Info */}
      <motion.div
        initial={{ opacity: 0, x: -30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5 }}
        className="w-[28vw] glass-card-strong p-6 flex flex-col"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-nexus-cyan/10 flex items-center justify-center">
            <Shield className="w-5 h-5 text-nexus-cyan" />
          </div>
          <div>
            <h2 className="font-heading font-bold text-2xl text-nexus-text">Connection Vault</h2>
            <p className="text-xs text-nexus-text-secondary">Secure integrations</p>
          </div>
        </div>

        <p className="text-nexus-text-secondary mb-6 leading-relaxed">
          Secure tokens, webhooks, and API keys—stored encrypted and never exposed to the frontend.
        </p>

        {/* Security Badges */}
        <div className="space-y-3 mb-6">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-nexus-bg-secondary/50 border border-[rgba(0,240,255,0.08)]">
            <div className="w-8 h-8 rounded-lg bg-nexus-green/10 flex items-center justify-center">
              <Lock className="w-4 h-4 text-nexus-green" />
            </div>
            <div>
              <p className="text-sm font-medium text-nexus-text">AES-256 Encryption</p>
              <p className="text-xs text-nexus-text-secondary">Data at rest</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-xl bg-nexus-bg-secondary/50 border border-[rgba(0,240,255,0.08)]">
            <div className="w-8 h-8 rounded-lg bg-nexus-cyan/10 flex items-center justify-center">
              <Key className="w-4 h-4 text-nexus-cyan" />
            </div>
            <div>
              <p className="text-sm font-medium text-nexus-text">Scoped Tokens</p>
              <p className="text-xs text-nexus-text-secondary">Minimal permissions</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-xl bg-nexus-bg-secondary/50 border border-[rgba(0,240,255,0.08)]">
            <div className="w-8 h-8 rounded-lg bg-nexus-violet/10 flex items-center justify-center">
              <Webhook className="w-4 h-4 text-nexus-violet" />
            </div>
            <div>
              <p className="text-sm font-medium text-nexus-text">Signed Webhooks</p>
              <p className="text-xs text-nexus-text-secondary">HMAC verification</p>
            </div>
          </div>
        </div>

        <div className="mt-auto space-y-2">
          <button
            onClick={() => { refresh(); }}
            className="btn-secondary w-full flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh All
          </button>
          <button
            onClick={() => setIsAddingNew(true)}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Connection
          </button>
        </div>
      </motion.div>

      {/* Right Panel - Connections Grid */}
      <motion.div
        initial={{ opacity: 0, x: 30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="flex-1"
      >
        <div className="grid grid-cols-2 gap-4">
          {connections.map((connection: ApiConnection, index: number) => {
            const Icon = getIcon(connection.icon || 'key');
            const status = connection.status as 'connected' | 'disconnected' | 'error';
            const isTesting = testingIds.has(connection.id);
            return (
              <motion.div
                key={connection.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
                className={`glass-card p-5 transition-all hover:scale-[1.02] ${status === 'connected' ? 'neon-border-glow' : ''
                  }`}
                onClick={() => setSelectedConnection(connection.id)}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: `${connection.color}15` }}
                    >
                      <span style={{ color: connection.color }}>
                        <Icon className="w-6 h-6" />
                      </span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-nexus-text">{connection.name}</h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        {isTesting ? (
                          <>
                            <Loader2 className="w-3 h-3 text-nexus-cyan animate-spin" />
                            <span className="text-xs text-nexus-cyan">Testing…</span>
                          </>
                        ) : status === 'connected' ? (
                          <>
                            <CheckCircle2 className="w-3 h-3 text-nexus-green" />
                            <span className="text-xs text-nexus-green">Connected</span>
                          </>
                        ) : status === 'error' ? (
                          <>
                            <XCircle className="w-3 h-3 text-red-500" />
                            <span className="text-xs text-red-500">Error</span>
                          </>
                        ) : (
                          <>
                            <div className="w-2 h-2 rounded-full bg-nexus-text-secondary" />
                            <span className="text-xs text-nexus-text-secondary">Disconnected</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleTest(connection.id); }}
                      className="p-2 rounded-lg hover:bg-white/5 transition-colors"
                      title="Test connection"
                      disabled={isTesting}
                    >
                      {isTesting ? (
                        <Loader2 className="w-4 h-4 text-nexus-cyan animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4 text-nexus-text-secondary" />
                      )}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDisconnect(connection.id); }}
                      className="p-2 rounded-lg hover:bg-red-500/10 transition-colors"
                      title="Disconnect"
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                  </div>
                </div>

                {/* Details */}
                <div className="space-y-2 mb-4">
                  {connection.account && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-nexus-text-secondary">Account</span>
                      <span className="text-nexus-text">{connection.account}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-nexus-text-secondary">Last sync</span>
                    <span className="text-nexus-text">{connection.lastSync}</span>
                  </div>
                  {connection.tokenPreview && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-nexus-text-secondary">Token</span>
                      <div className="flex items-center gap-2">
                        <span className="text-nexus-text font-mono text-xs">
                          {showToken[connection.id] ? (connection.token || connection.tokenPreview) : connection.tokenPreview}
                        </span>
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleTokenVisibility(connection.id); }}
                          className="p-1 rounded hover:bg-white/5"
                        >
                          {showToken[connection.id] ? (
                            <EyeOff className="w-3 h-3 text-nexus-text-secondary" />
                          ) : (
                            <Eye className="w-3 h-3 text-nexus-text-secondary" />
                          )}
                        </button>
                        <button className="p-1 rounded hover:bg-white/5">
                          <Copy className="w-3 h-3 text-nexus-text-secondary" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEdit(connection);
                    }}
                    className="flex-1 py-2 px-3 rounded-lg bg-nexus-bg-secondary text-xs text-nexus-text hover:bg-nexus-cyan/10 hover:text-nexus-cyan transition-colors flex items-center justify-center gap-1"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Configure
                  </button>
                  {status === 'error' && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleTest(connection.id); }}
                      className="flex-1 py-2 px-3 rounded-lg bg-red-500/10 text-xs text-red-500 hover:bg-red-500/20 transition-colors"
                    >
                      Retry
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}

          {/* Add New/Edit Card */}
          <AnimatePresence>
            {isAddingNew ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="glass-card-strong p-5 col-span-2"
              >
                <h3 className="font-semibold text-nexus-text mb-4">{editingId ? 'Edit Connection' : 'Add New Connection'}</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-nexus-text-secondary mb-1 block">Service Name</label>
                    <input
                      type="text"
                      value={newConnection.name}
                      onChange={(e) => setNewConnection({ ...newConnection, name: e.target.value })}
                      placeholder="e.g., Notion"
                      disabled={!!editingId}
                      className={`w-full px-3 py-2 bg-nexus-bg-secondary border border-nexus-cyan/20 rounded-lg text-sm text-nexus-text placeholder-nexus-text-secondary focus:outline-none focus:border-nexus-cyan ${editingId ? 'opacity-50 cursor-not-allowed' : ''}`}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-nexus-text-secondary mb-1 block">API Token</label>
                    <input
                      type="password"
                      value={newConnection.token}
                      onChange={(e) => setNewConnection({ ...newConnection, token: e.target.value })}
                      placeholder={editingId ? "Enter new token to update..." : "Enter token..."}
                      className="w-full px-3 py-2 bg-nexus-bg-secondary border border-nexus-cyan/20 rounded-lg text-sm text-nexus-text placeholder-nexus-text-secondary focus:outline-none focus:border-nexus-cyan"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs text-nexus-text-secondary mb-1 block">Webhook URL (optional)</label>
                    <input
                      type="text"
                      value={newConnection.webhook}
                      onChange={(e) => setNewConnection({ ...newConnection, webhook: e.target.value })}
                      placeholder="https://..."
                      className="w-full px-3 py-2 bg-nexus-bg-secondary border border-nexus-cyan/20 rounded-lg text-sm text-nexus-text placeholder-nexus-text-secondary focus:outline-none focus:border-nexus-cyan"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-4">
                  <button
                    onClick={handleConnect}
                    className="btn-primary flex-1"
                  >
                    {editingId ? 'Update Connection' : 'Connect'}
                  </button>
                  <button
                    onClick={() => setIsAddingNew(false)}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onClick={() => setIsAddingNew(true)}
                className="glass-card p-5 border-dashed border-2 border-nexus-cyan/30 hover:border-nexus-cyan/50 hover:bg-nexus-cyan/5 transition-all flex flex-col items-center justify-center gap-3 min-h-[200px]"
              >
                <div className="w-12 h-12 rounded-xl border-2 border-nexus-cyan/30 flex items-center justify-center">
                  <Plus className="w-6 h-6 text-nexus-cyan" />
                </div>
                <span className="text-nexus-cyan font-medium">Add New Connection</span>
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}