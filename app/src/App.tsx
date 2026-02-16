import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Bell,
  User,
  Zap,
  Menu,
  X,
  Command,
  ChevronRight,
  ExternalLink,
  Play,
  Wifi,
  WifiOff
} from 'lucide-react';
import * as api from './lib/apiClient';
import AnimatedBackground from './components/background/AnimatedBackground';
import Sidebar from './components/dashboard/Sidebar';
import ActivityPanel from './components/dashboard/ActivityPanel';
import HealthMonitor from './components/dashboard/HealthMonitor';
import ContextBridgeFeed from './components/dashboard/ContextBridgeFeed';
import SlackMessages from './components/dashboard/SlackMessages';
import AgentTimeline from './components/timeline/AgentTimeline';
import DiffViewer from './components/diff/DiffViewer';
import ConnectionVault from './components/vault/ConnectionVault';
import MultiProjectWorkspace from './components/workspace/MultiProjectWorkspace';
import SettingsPanel from './components/dashboard/Settings';
import { useWebSocket } from './hooks/useWebSocket';
import { useProjects } from './hooks/useProjects';
import { Toaster, toast } from 'sonner';

import './App.css';

type View = 'dashboard' | 'timeline' | 'review' | 'vault' | 'workspace' | 'settings';

// Notification type
interface Notification {
  id: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
  type: 'info' | 'success' | 'warning' | 'error';
}

function App() {
  const [activeView, setActiveView] = useState<View>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [commandSearch, setCommandSearch] = useState('');

  const { projects, activeProject, create: createProject, switchProject } = useProjects();
  const { connected, pulses, triggerRun: wsTriggerRun } = useWebSocket(activeProject?.id || '1');

  const [notifications, setNotifications] = useState<Notification[]>([]);

  const unreadCount = notifications.filter(n => !n.read).length;

  // Command palette keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowCommandPalette(prev => !prev);
      }
      if (e.key === 'Escape') {
        setShowCommandPalette(false);
        setShowNotifications(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // WebSocket pulse → notification toast
  useEffect(() => {
    if (pulses.length > 0) {
      const latest = pulses[0];
      if (latest.status === 'completed') {
        toast.success(`${latest.agent}: ${latest.action}`, {
          description: latest.target,
          duration: 3000,
        });
      } else if (latest.status === 'error') {
        toast.error(`${latest.agent}: ${latest.action}`, {
          description: latest.target,
          duration: 5000,
        });
      }
      // Add to notifications
      setNotifications(prev => [{
        id: Date.now().toString(),
        title: `${latest.agent}: ${latest.action}`,
        message: latest.target,
        time: 'just now',
        read: false,
        type: latest.status === 'error' ? 'error' as const : 'info' as const,
      }, ...prev.slice(0, 19)]);
    }
  }, [pulses]);

  const markAllRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const handleViewChange = useCallback((view: View) => {
    setActiveView(view);
    setMobileMenuOpen(false);
  }, []);

  const handleTriggerRun = useCallback(async () => {
    if (!activeProject) return;
    try {
      // Use REST API to trigger the real orchestrator pipeline
      await api.triggerRunRest(activeProject.id);

      toast.success('Agent pipeline started', {
        description: 'Ingesting data from Slack, Figma, and Jira...',
        duration: 4000
      });

      // Auto-navigate to timeline to show progress
      setActiveView('timeline');

      setNotifications(prev => [{
        id: Date.now().toString(),
        title: 'Run Triggered',
        message: `Agent pipeline started for ${activeProject.name}`,
        time: 'just now',
        read: false,
        type: 'info',
      }, ...prev]);
    } catch (err) {
      toast.error('Failed to start run');
      console.error(err);
    }
  }, [activeProject]);

  // Command palette commands
  const commands = [
    { id: 'dashboard', label: 'Go to Dashboard', icon: '📊', action: () => handleViewChange('dashboard') },
    { id: 'timeline', label: 'Go to Timeline', icon: '🔀', action: () => handleViewChange('timeline') },
    { id: 'review', label: 'Go to Review & Approve', icon: '✅', action: () => handleViewChange('review') },
    { id: 'vault', label: 'Go to Connection Vault', icon: '🔐', action: () => handleViewChange('vault') },
    { id: 'workspace', label: 'Go to Workspace', icon: '📁', action: () => handleViewChange('workspace') },
    { id: 'settings', label: 'Go to Settings', icon: '⚙️', action: () => handleViewChange('settings') },
    { id: 'trigger', label: 'Trigger Agent Run', icon: '⚡', action: handleTriggerRun },
    { id: 'new-project', label: 'Create New Project', icon: '➕', action: () => { createProject('New Project'); toast.success('Project created'); } },
  ];

  const filteredCommands = commands.filter(c =>
    c.label.toLowerCase().includes(commandSearch.toLowerCase())
  );

  const renderContent = () => {
    switch (activeView) {
      case 'dashboard':
        return (
          <motion.div
            key="dashboard"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-5"
          >
            {/* Top Row: Context Bridge & Slack Messages */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <ContextBridgeFeed pulses={pulses} connected={connected} />
              <SlackMessages projectId={activeProject?.id || '1'} />
            </div>

            {/* Middle Row: Activity Panel & Sidebar */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <div className="lg:col-span-2">
                <ActivityPanel projectId={activeProject?.id || '1'} onNavigate={(v: string) => handleViewChange(v as View)} />
              </div>
              <div className="space-y-5">
                <HealthMonitor />
                {/* Quick Actions Card */}
                <div className="glass-card p-5">
                  <h3 className="font-heading text-base font-semibold text-nexus-text mb-4 flex items-center gap-2">
                    <Zap className="w-4 h-4 text-nexus-cyan" />
                    Quick Actions
                  </h3>
                  <div className="space-y-2">
                    <button
                      onClick={handleTriggerRun}
                      className="w-full flex items-center gap-3 p-3 rounded-xl bg-[rgba(0,240,255,0.08)] border border-[rgba(0,240,255,0.2)] hover:border-[rgba(0,240,255,0.5)] hover:bg-[rgba(0,240,255,0.12)] transition-all group"
                    >
                      <Play className="w-4 h-4 text-nexus-cyan group-hover:scale-110 transition-transform" />
                      <span className="text-sm text-nexus-text">Trigger Agent Sync</span>
                      <ChevronRight className="w-3 h-3 text-nexus-text-secondary ml-auto group-hover:translate-x-1 transition-transform" />
                    </button>
                    <button
                      onClick={() => handleViewChange('review')}
                      className="w-full flex items-center gap-3 p-3 rounded-xl bg-[rgba(184,41,247,0.08)] border border-[rgba(184,41,247,0.2)] hover:border-[rgba(184,41,247,0.5)] hover:bg-[rgba(184,41,247,0.12)] transition-all group"
                    >
                      <ExternalLink className="w-4 h-4 text-nexus-violet group-hover:scale-110 transition-transform" />
                      <span className="text-sm text-nexus-text">Review Pending</span>
                      <ChevronRight className="w-3 h-3 text-nexus-text-secondary ml-auto group-hover:translate-x-1 transition-transform" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        );
      case 'timeline':
        return (
          <motion.div key="timeline" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }}>
            <AgentTimeline projectId={activeProject?.id || '1'} />
          </motion.div>
        );
      case 'review':
        return (
          <motion.div key="review" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }}>
            <DiffViewer projectId={activeProject?.id || '1'} onTriggerRun={handleTriggerRun} />
          </motion.div>
        );
      case 'vault':
        return (
          <motion.div key="vault" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }}>
            <ConnectionVault projectId={activeProject?.id || '1'} />
          </motion.div>
        );
      case 'workspace':
        return (
          <motion.div key="workspace" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }}>
            <MultiProjectWorkspace onNavigate={(v: string) => handleViewChange(v as View)} />
          </motion.div>
        );
      case 'settings':
        return (
          <motion.div key="settings" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }}>
            <SettingsPanel />
          </motion.div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-[#070B14] text-[#F4F7FF] relative overflow-x-hidden">
      {/* Animated Background */}
      <AnimatedBackground />

      {/* Toast notifications */}
      <Toaster
        theme="dark"
        position="bottom-right"
        toastOptions={{
          style: {
            background: 'rgba(11,18,34,0.92)',
            border: '1px solid rgba(0,240,255,0.28)',
            color: '#F4F7FF',
            backdropFilter: 'blur(20px)',
          },
        }}
      />

      {/* Main Layout */}
      <div className="relative z-10 flex min-h-screen">
        {/* Sidebar (Desktop) */}
        <div className="hidden lg:block">
          <Sidebar
            activeView={activeView}
            onViewChange={(v: string) => handleViewChange(v as View)}
            projects={projects as any}
            activeProject={activeProject as any}
            onProjectSwitch={switchProject as any}
            onCreateProject={createProject}
          />
        </div>

        {/* Mobile Sidebar */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/60 z-40 lg:hidden"
                onClick={() => setMobileMenuOpen(false)}
              />
              <motion.div
                initial={{ x: -300 }}
                animate={{ x: 0 }}
                exit={{ x: -300 }}
                transition={{ type: 'spring', damping: 25 }}
                className="fixed left-0 top-0 bottom-0 z-50 lg:hidden"
              >
                <Sidebar
                  activeView={activeView}
                  onViewChange={(v: string) => handleViewChange(v as View)}
                  projects={projects as any}
                  activeProject={activeProject as any}
                  onProjectSwitch={switchProject as any}
                  onCreateProject={createProject}
                />
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top Nav */}
          <header className="sticky top-0 z-30 glass-panel border-b border-[rgba(0,240,255,0.12)]">
            <div className="flex items-center justify-between px-4 lg:px-6 h-16">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="lg:hidden p-2 rounded-xl hover:bg-[rgba(255,255,255,0.05)] transition-colors"
                >
                  {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                </button>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <Zap className="w-5 h-5 text-nexus-cyan" />
                    <h1 className="font-heading text-lg font-bold text-gradient hidden sm:block">Nexus PM</h1>
                  </div>
                  {activeProject && (
                    <span className="text-[13px] text-nexus-text-secondary hidden md:block">
                      / {activeProject.name}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Connection Status Indicator */}
                <div className="flex items-center gap-1.5 mr-2">
                  {connected ? (
                    <div className="flex items-center gap-1 text-xs text-nexus-green">
                      <Wifi className="w-3 h-3" />
                      <span className="hidden sm:inline">Live</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-xs text-nexus-text-secondary">
                      <WifiOff className="w-3 h-3" />
                      <span className="hidden sm:inline">Offline</span>
                    </div>
                  )}
                </div>

                {/* Search Button */}
                <button
                  onClick={() => setShowCommandPalette(true)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] hover:border-[rgba(0,240,255,0.3)] transition-all text-sm text-nexus-text-secondary"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Search</span>
                  <kbd className="hidden md:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-[rgba(255,255,255,0.06)] text-[10px] font-mono">
                    <Command className="w-2.5 h-2.5" />K
                  </kbd>
                </button>

                {/* Notifications */}
                <div className="relative">
                  <button
                    onClick={() => setShowNotifications(!showNotifications)}
                    className="p-2 rounded-xl hover:bg-[rgba(255,255,255,0.05)] transition-colors relative"
                  >
                    <Bell className="w-4.5 h-4.5 text-nexus-text-secondary" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-[#ff4444] rounded-full flex items-center justify-center text-[9px] font-bold text-white">
                        {unreadCount}
                      </span>
                    )}
                  </button>

                  {/* Notifications Dropdown */}
                  <AnimatePresence>
                    {showNotifications && (
                      <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.95 }}
                        className="absolute right-0 top-full mt-2 w-80 glass-card-strong p-0 overflow-hidden"
                      >
                        <div className="flex items-center justify-between p-3 border-b border-[rgba(0,240,255,0.12)]">
                          <h3 className="text-sm font-semibold">Notifications</h3>
                          <button onClick={markAllRead} className="text-xs text-nexus-cyan hover:text-nexus-text transition-colors">
                            Mark all read
                          </button>
                        </div>
                        <div className="max-h-80 overflow-y-auto scrollbar-thin">
                          {notifications.map(n => (
                            <div
                              key={n.id}
                              className={`p-3 border-b border-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.03)] transition-colors ${!n.read ? 'bg-[rgba(0,240,255,0.03)]' : ''}`}
                            >
                              <div className="flex items-start gap-2">
                                {!n.read && <div className="w-1.5 h-1.5 rounded-full bg-nexus-cyan mt-1.5 flex-shrink-0" />}
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium text-nexus-text truncate">{n.title}</p>
                                  <p className="text-xs text-nexus-text-secondary mt-0.5 truncate">{n.message}</p>
                                  <p className="text-[10px] text-nexus-text-secondary mt-1">{n.time}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* User Avatar */}
                <button className="p-1 rounded-full border border-[rgba(0,240,255,0.28)] hover:border-[rgba(0,240,255,0.5)] transition-all">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-nexus-cyan to-nexus-violet flex items-center justify-center">
                    <User className="w-3.5 h-3.5 text-nexus-bg" />
                  </div>
                </button>
              </div>
            </div>
          </header>

          {/* Page Content */}
          <main className="flex-1 p-4 lg:p-6 overflow-y-auto">
            <AnimatePresence mode="wait">
              {renderContent()}
            </AnimatePresence>
          </main>
        </div>
      </div>

      {/* Command Palette (⌘K) */}
      <AnimatePresence>
        {showCommandPalette && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
              onClick={() => setShowCommandPalette(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              className="fixed top-[20%] left-1/2 -translate-x-1/2 w-full max-w-lg z-[61]"
            >
              <div className="glass-card-strong overflow-hidden">
                <div className="flex items-center gap-3 p-4 border-b border-[rgba(0,240,255,0.12)]">
                  <Search className="w-4 h-4 text-nexus-text-secondary" />
                  <input
                    type="text"
                    autoFocus
                    value={commandSearch}
                    onChange={(e) => setCommandSearch(e.target.value)}
                    placeholder="Type a command or search..."
                    className="flex-1 bg-transparent text-sm text-nexus-text placeholder:text-nexus-text-secondary outline-none"
                  />
                  <kbd className="px-1.5 py-0.5 rounded bg-[rgba(255,255,255,0.06)] text-[10px] font-mono text-nexus-text-secondary">ESC</kbd>
                </div>
                <div className="max-h-60 overflow-y-auto scrollbar-thin p-2">
                  {filteredCommands.map(cmd => (
                    <button
                      key={cmd.id}
                      onClick={() => {
                        cmd.action();
                        setShowCommandPalette(false);
                        setCommandSearch('');
                      }}
                      className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-[rgba(255,255,255,0.05)] transition-colors text-left"
                    >
                      <span className="text-base">{cmd.icon}</span>
                      <span className="text-sm text-nexus-text">{cmd.label}</span>
                    </button>
                  ))}
                  {filteredCommands.length === 0 && (
                    <p className="text-center text-sm text-nexus-text-secondary py-6">No matching commands</p>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;