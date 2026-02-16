import { useState } from 'react';
import {
  LayoutDashboard,
  GitBranch,
  Shield,
  Settings,
  Plus,
  ChevronDown,
  Zap,
  FolderOpen,
  CheckCircle2,
  FileCheck,
  Globe
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Project {
  id: string;
  name: string;
  status: string;
  lastActivity?: string;
  agentCount?: number;
  color?: string;
}

interface SidebarProps {
  activeView: string;
  onViewChange: (view: string) => void;
  projects?: Project[];
  activeProject?: Project | null;
  onProjectSwitch?: (project: Project) => void;
  onCreateProject?: (name: string) => void;
}

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'timeline', label: 'Timeline', icon: GitBranch },
  { id: 'review', label: 'Review & Approve', icon: FileCheck },
  { id: 'vault', label: 'Connection Vault', icon: Shield },
  { id: 'workspace', label: 'Workspace', icon: Globe },
  { id: 'settings', label: 'Settings', icon: Settings },
];

const statusColors: Record<string, string> = {
  active: 'bg-nexus-green',
  paused: 'bg-yellow-400',
  completed: 'bg-nexus-cyan',
};

export default function Sidebar({
  activeView,
  onViewChange,
  projects: externalProjects,
  activeProject: externalActiveProject,
  onProjectSwitch,
  onCreateProject,
}: SidebarProps) {
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false);

  const projects = externalProjects || [];
  const activeProject = externalActiveProject || projects[0];


  return (
    <div className="w-[260px] h-screen glass-panel flex flex-col py-4 border-r border-[rgba(0,240,255,0.12)]">
      {/* Logo */}
      <div className="px-5 mb-5">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-nexus-cyan to-nexus-violet flex items-center justify-center shadow-neon">
            <Zap className="w-4.5 h-4.5 text-white" />
          </div>
          <div>
            <h1 className="font-heading text-base font-bold text-gradient">Nexus PM</h1>
            <p className="text-[10px] text-nexus-text-secondary tracking-wider uppercase">Command Center</p>
          </div>
        </div>
      </div>

      {/* Project Switcher */}
      <div className="px-3 mb-4">
        <div className="relative">
          <button
            onClick={() => setProjectDropdownOpen(!projectDropdownOpen)}
            className="w-full flex items-center gap-2.5 p-2.5 rounded-xl bg-[rgba(0,240,255,0.06)] border border-[rgba(0,240,255,0.15)] hover:border-[rgba(0,240,255,0.35)] transition-all"
          >
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: activeProject?.color || '#00F0FF', boxShadow: `0 0 8px ${activeProject?.color || '#00F0FF'}50` }} />
            <span className="text-sm font-medium text-nexus-text truncate flex-1 text-left">{activeProject?.name || 'Select Project'}</span>
            <ChevronDown className={`w-3.5 h-3.5 text-nexus-text-secondary transition-transform ${projectDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          <AnimatePresence>
            {projectDropdownOpen && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
                className="absolute top-full left-0 right-0 mt-1.5 glass-card-strong p-1.5 z-50"
              >
                {projects.map(project => (
                  <button
                    key={project.id}
                    onClick={() => {
                      onProjectSwitch?.(project);
                      setProjectDropdownOpen(false);
                    }}
                    className={`w-full flex items-center gap-2.5 p-2 rounded-lg text-left transition-colors ${activeProject?.id === project.id
                      ? 'bg-[rgba(0,240,255,0.12)]'
                      : 'hover:bg-[rgba(255,255,255,0.04)]'
                      }`}
                  >
                    <div className={`w-1.5 h-1.5 rounded-full ${statusColors[project.status] || 'bg-gray-400'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-nexus-text truncate">{project.name}</p>
                      <p className="text-[10px] text-nexus-text-secondary">
                        {project.agentCount ?? 0} agents • {project.lastActivity || 'just now'}
                      </p>
                    </div>
                    {activeProject?.id === project.id && (
                      <CheckCircle2 className="w-3 h-3 text-nexus-cyan flex-shrink-0" />
                    )}
                  </button>
                ))}
                <div className="mt-1 pt-1 border-t border-[rgba(255,255,255,0.06)]">
                  <button
                    onClick={() => {
                      onCreateProject?.('New Project');
                      setProjectDropdownOpen(false);
                    }}
                    className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-[rgba(0,240,255,0.08)] transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5 text-nexus-cyan" />
                    <span className="text-xs text-nexus-cyan font-medium">Spawn New Project</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto scrollbar-thin">
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${isActive
                ? 'bg-[rgba(0,240,255,0.12)] text-nexus-cyan border border-[rgba(0,240,255,0.25)]'
                : 'text-nexus-text-secondary hover:text-nexus-text hover:bg-[rgba(255,255,255,0.04)]'
                }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-nexus-cyan' : ''}`} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Bottom Card */}
      <div className="px-3 pt-3 mt-2 border-t border-[rgba(0,240,255,0.08)]">
        <div className="glass-card p-3">
          <div className="flex items-center gap-2 mb-2">
            <FolderOpen className="w-3.5 h-3.5 text-nexus-cyan" />
            <span className="text-xs font-medium text-nexus-text">{projects.length} Projects</span>
          </div>
          <p className="text-[10px] text-nexus-text-secondary">
            {projects.filter(p => p.status === 'active').length} active •{' '}
            {projects.filter(p => p.status === 'paused').length} paused •{' '}
            {projects.filter(p => p.status === 'completed').length} done
          </p>
        </div>
      </div>
    </div>
  );
}