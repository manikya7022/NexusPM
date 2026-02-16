import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  FolderKanban,
  BarChart3,
  Users,
  GitBranch,
  ArrowUpRight,
  Plus,
  CheckCircle2,
  AlertCircle,
  Clock,
  Loader2,
  Edit2,
  Trash2,
  X
} from 'lucide-react';
import { useProjects } from '../../hooks/useProjects';

interface MultiProjectWorkspaceProps {
  onNavigate?: (view: string) => void;
}

const statusIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  active: CheckCircle2,
  review: AlertCircle,
  blocked: Clock,
  completed: CheckCircle2,
};

const statusColors: Record<string, string> = {
  active: 'text-nexus-green bg-nexus-green/10',
  review: 'text-[#FFB800] bg-[#FFB800]/10',
  blocked: 'text-red-500 bg-red-500/10',
  completed: 'text-nexus-cyan bg-nexus-cyan/10',
};

export default function MultiProjectWorkspace({ onNavigate }: MultiProjectWorkspaceProps) {
  const { projects, loading, create: createProject, update: updateProject, remove: removeProject, switchProject } = useProjects();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');

  // Edit State
  const [editingProject, setEditingProject] = useState<{ id: string, name: string, description: string } | null>(null);

  const handleCreate = async () => {
    if (!newProjectName.trim()) return;
    await createProject(newProjectName.trim());
    setNewProjectName('');
    setShowCreateForm(false);
  };

  const handleUpdate = async () => {
    if (!editingProject || !editingProject.name.trim()) return;
    await updateProject(editingProject.id, {
      name: editingProject.name,
      description: editingProject.description
    });
    setEditingProject(null);
  };

  const handleDelete = async (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to delete "${name}"? This cannot be undone.`)) {
      await removeProject(id);
    }
  };

  // Compute metrics from real project data
  const metrics = [
    {
      label: 'Projects',
      value: projects.length,
      icon: FolderKanban,
      color: 'text-nexus-cyan',
    },
    {
      label: 'Active',
      value: projects.filter(p => p.status === 'active' || !p.status).length,
      icon: Users,
      color: 'text-nexus-green',
    },
    {
      label: 'In Review',
      value: projects.filter(p => p.status === 'review').length,
      icon: GitBranch,
      color: 'text-[#FFB800]',
    },
    {
      label: 'Completed',
      value: projects.filter(p => p.status === 'completed').length,
      icon: BarChart3,
      color: 'text-nexus-violet',
    },
  ];

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-nexus-cyan animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & Metrics */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="glass-card-strong p-6"
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-nexus-cyan/10 flex items-center justify-center">
              <FolderKanban className="w-5 h-5 text-nexus-cyan" />
            </div>
            <div>
              <h2 className="font-heading font-bold text-2xl text-nexus-text">Workspace</h2>
              <p className="text-xs text-nexus-text-secondary">Manage all projects</p>
            </div>
          </div>
          <button
            onClick={() => setShowCreateForm(true)}
            className="px-4 py-2 btn-primary text-sm flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Project
          </button>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {metrics.map((metric, i) => {
            const Icon = metric.icon;
            return (
              <motion.div
                key={metric.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="p-4 rounded-xl bg-nexus-bg-secondary/50 border border-[rgba(0,240,255,0.08)]"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Icon className={`w-4 h-4 ${metric.color}`} />
                  <span className="text-xs text-nexus-text-secondary uppercase tracking-wider">{metric.label}</span>
                </div>
                <p className="text-3xl font-heading font-bold text-nexus-text">{metric.value}</p>
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      {/* Create Form */}
      {showCreateForm && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="glass-card-strong p-6"
        >
          <h3 className="font-heading font-semibold text-lg text-nexus-text mb-4">Create Project</h3>
          <div className="flex gap-3">
            <input
              type="text"
              value={newProjectName}
              onChange={e => setNewProjectName(e.target.value)}
              placeholder="Project name..."
              className="flex-1 px-4 py-2 bg-nexus-bg-secondary border border-nexus-cyan/20 rounded-xl text-sm text-nexus-text placeholder-nexus-text-secondary focus:outline-none focus:border-nexus-cyan"
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              autoFocus
            />
            <button onClick={handleCreate} className="px-6 py-2 btn-primary text-sm">Create</button>
            <button onClick={() => setShowCreateForm(false)} className="px-4 py-2 text-nexus-text-secondary hover:text-nexus-text text-sm">Cancel</button>
          </div>
        </motion.div>
      )}

      {/* Project Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {projects.length === 0 && (
          <div className="col-span-2 text-center py-12 text-nexus-text-secondary text-sm glass-card-strong p-6">
            No projects yet. Create your first project to get started.
          </div>
        )}
        {projects.map((project, index) => {
          const status = project.status || 'active';
          const StatusIcon = statusIcons[status] || CheckCircle2;
          const colorClass = statusColors[status] || statusColors.active;

          return (
            <motion.div
              key={project.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
              whileHover={{ scale: 1.02 }}
              className="glass-card-strong p-5 cursor-pointer group relative"
              onClick={() => {
                switchProject(project.id);
                onNavigate?.('dashboard');
              }}
            >
              <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingProject({
                      id: project.id,
                      name: project.name,
                      description: project.description || ''
                    });
                  }}
                  className="p-1.5 rounded-lg bg-nexus-bg-secondary hover:bg-nexus-cyan/20 hover:text-nexus-cyan transition-colors"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={(e) => handleDelete(project.id, project.name, e)}
                  className="p-1.5 rounded-lg bg-nexus-bg-secondary hover:bg-red-500/20 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex items-start justify-between mb-3 pr-16">
                <div>
                  <h3 className="font-heading font-semibold text-lg text-nexus-text group-hover:text-nexus-cyan transition-colors">
                    {project.name}
                  </h3>
                  <p className="text-xs text-nexus-text-secondary line-clamp-2">
                    {project.description || 'No description'}
                  </p>
                </div>
                <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs ${colorClass}`}>
                  <StatusIcon className="w-3 h-3" />
                  {status}
                </div>
              </div>

              <div className="flex items-center justify-between mt-4">
                <div className="flex items-center gap-3 text-xs text-nexus-text-secondary">
                  <span>ID: {project.id.slice(0, 8)}</span>
                  {project.createdAt && (
                    <span>Created: {new Date(project.createdAt).toLocaleDateString()}</span>
                  )}
                </div>
                <ArrowUpRight className="w-4 h-4 text-nexus-text-secondary group-hover:text-nexus-cyan transition-colors" />
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Edit Modal */}
      {editingProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setEditingProject(null)}>
          <div className="w-full max-w-md glass-card-strong p-6" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-heading font-semibold text-lg">Edit Project</h3>
              <button onClick={() => setEditingProject(null)}><X className="w-5 h-5 text-nexus-text-secondary" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-nexus-text-secondary uppercase tracking-wider mb-1.5 block">Project Name</label>
                <input
                  value={editingProject.name}
                  onChange={e => setEditingProject({ ...editingProject, name: e.target.value })}
                  className="w-full px-4 py-2 bg-nexus-bg-secondary border border-[rgba(0,240,255,0.1)] rounded-xl focus:border-nexus-cyan outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-nexus-text-secondary uppercase tracking-wider mb-1.5 block">Description</label>
                <textarea
                  value={editingProject.description}
                  onChange={e => setEditingProject({ ...editingProject, description: e.target.value })}
                  className="w-full px-4 py-2 bg-nexus-bg-secondary border border-[rgba(0,240,255,0.1)] rounded-xl focus:border-nexus-cyan outline-none h-24 resize-none"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={handleUpdate} className="flex-1 btn-primary py-2">Save Changes</button>
                <button onClick={() => setEditingProject(null)} className="flex-1 py-2 rounded-xl border border-[rgba(255,255,255,0.1)] hover:bg-[rgba(255,255,255,0.05)]">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex justify-center">
        <button
          onClick={() => onNavigate?.('dashboard')}
          className="flex items-center gap-2 text-nexus-cyan text-sm font-medium hover:underline"
        >
          <span>View all activity</span>
          <ArrowUpRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}