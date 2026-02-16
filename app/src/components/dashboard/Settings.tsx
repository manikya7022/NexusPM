import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Settings, 
  Bell, 
  Shield, 
  Database,
  Users,
  Key,
  Globe,
  Save,
  CheckCircle2
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';

interface SettingSection {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

const sections: SettingSection[] = [
  { id: 'general', title: 'General', icon: Settings, description: 'Basic preferences' },
  { id: 'notifications', title: 'Notifications', icon: Bell, description: 'Alert settings' },
  { id: 'security', title: 'Security', icon: Shield, description: 'Access control' },
  { id: 'data', title: 'Data & Storage', icon: Database, description: 'Retention policies' },
  { id: 'team', title: 'Team', icon: Users, description: 'Members & roles' },
  { id: 'api', title: 'API Keys', icon: Key, description: 'Developer settings' },
];

export default function SettingsPanel() {
  const [activeSection, setActiveSection] = useState('general');
  const [saved, setSaved] = useState(false);
  
  // Settings state
  const [settings, setSettings] = useState({
    darkMode: true,
    autoSync: true,
    emailNotifications: true,
    slackNotifications: true,
    browserNotifications: false,
    twoFactor: true,
    sessionTimeout: '30',
    dataRetention: '90',
  });

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const renderSectionContent = () => {
    switch (activeSection) {
      case 'general':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between p-4 rounded-xl bg-nexus-bg-secondary/50">
              <div>
                <p className="font-medium text-nexus-text">Dark Mode</p>
                <p className="text-sm text-nexus-text-secondary">Use dark theme throughout the app</p>
              </div>
              <Switch 
                checked={settings.darkMode} 
                onCheckedChange={(v) => setSettings({ ...settings, darkMode: v })}
              />
            </div>
            <div className="flex items-center justify-between p-4 rounded-xl bg-nexus-bg-secondary/50">
              <div>
                <p className="font-medium text-nexus-text">Auto-sync</p>
                <p className="text-sm text-nexus-text-secondary">Automatically sync with connected platforms</p>
              </div>
              <Switch 
                checked={settings.autoSync} 
                onCheckedChange={(v) => setSettings({ ...settings, autoSync: v })}
              />
            </div>
            <div className="flex items-center justify-between p-4 rounded-xl bg-nexus-bg-secondary/50">
              <div>
                <p className="font-medium text-nexus-text">Language</p>
                <p className="text-sm text-nexus-text-secondary">Interface language</p>
              </div>
              <select className="px-3 py-2 bg-nexus-bg-secondary border border-nexus-cyan/20 rounded-lg text-sm text-nexus-text">
                <option>English</option>
                <option>Spanish</option>
                <option>French</option>
              </select>
            </div>
          </div>
        );
      
      case 'notifications':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between p-4 rounded-xl bg-nexus-bg-secondary/50">
              <div>
                <p className="font-medium text-nexus-text">Email Notifications</p>
                <p className="text-sm text-nexus-text-secondary">Receive updates via email</p>
              </div>
              <Switch 
                checked={settings.emailNotifications} 
                onCheckedChange={(v) => setSettings({ ...settings, emailNotifications: v })}
              />
            </div>
            <div className="flex items-center justify-between p-4 rounded-xl bg-nexus-bg-secondary/50">
              <div>
                <p className="font-medium text-nexus-text">Slack Notifications</p>
                <p className="text-sm text-nexus-text-secondary">Send alerts to your Slack workspace</p>
              </div>
              <Switch 
                checked={settings.slackNotifications} 
                onCheckedChange={(v) => setSettings({ ...settings, slackNotifications: v })}
              />
            </div>
            <div className="flex items-center justify-between p-4 rounded-xl bg-nexus-bg-secondary/50">
              <div>
                <p className="font-medium text-nexus-text">Browser Notifications</p>
                <p className="text-sm text-nexus-text-secondary">Show desktop notifications</p>
              </div>
              <Switch 
                checked={settings.browserNotifications} 
                onCheckedChange={(v) => setSettings({ ...settings, browserNotifications: v })}
              />
            </div>
          </div>
        );
      
      case 'security':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between p-4 rounded-xl bg-nexus-bg-secondary/50">
              <div>
                <p className="font-medium text-nexus-text">Two-Factor Authentication</p>
                <p className="text-sm text-nexus-text-secondary">Require 2FA for login</p>
              </div>
              <Switch 
                checked={settings.twoFactor} 
                onCheckedChange={(v) => setSettings({ ...settings, twoFactor: v })}
              />
            </div>
            <div className="flex items-center justify-between p-4 rounded-xl bg-nexus-bg-secondary/50">
              <div>
                <p className="font-medium text-nexus-text">Session Timeout</p>
                <p className="text-sm text-nexus-text-secondary">Auto-logout after inactivity</p>
              </div>
              <select 
                value={settings.sessionTimeout}
                onChange={(e) => setSettings({ ...settings, sessionTimeout: e.target.value })}
                className="px-3 py-2 bg-nexus-bg-secondary border border-nexus-cyan/20 rounded-lg text-sm text-nexus-text"
              >
                <option value="15">15 minutes</option>
                <option value="30">30 minutes</option>
                <option value="60">1 hour</option>
                <option value="240">4 hours</option>
              </select>
            </div>
          </div>
        );
      
      case 'data':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between p-4 rounded-xl bg-nexus-bg-secondary/50">
              <div>
                <p className="font-medium text-nexus-text">Data Retention</p>
                <p className="text-sm text-nexus-text-secondary">Keep agent history for</p>
              </div>
              <select 
                value={settings.dataRetention}
                onChange={(e) => setSettings({ ...settings, dataRetention: e.target.value })}
                className="px-3 py-2 bg-nexus-bg-secondary border border-nexus-cyan/20 rounded-lg text-sm text-nexus-text"
              >
                <option value="7">7 days</option>
                <option value="30">30 days</option>
                <option value="90">90 days</option>
                <option value="365">1 year</option>
              </select>
            </div>
            <div className="p-4 rounded-xl bg-nexus-bg-secondary/50">
              <p className="font-medium text-nexus-text mb-2">Export Data</p>
              <p className="text-sm text-nexus-text-secondary mb-3">Download all your project data</p>
              <button className="px-4 py-2 bg-nexus-bg border border-nexus-cyan/30 rounded-lg text-sm text-nexus-cyan hover:bg-nexus-cyan/10 transition-colors">
                Export to JSON
              </button>
            </div>
          </div>
        );
      
      case 'team':
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-xl bg-nexus-bg-secondary/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-nexus-cyan/20 flex items-center justify-center">
                  <span className="text-nexus-cyan font-semibold">JD</span>
                </div>
                <div>
                  <p className="font-medium text-nexus-text">John Doe</p>
                  <p className="text-sm text-nexus-text-secondary">Admin</p>
                </div>
              </div>
              <span className="px-2 py-1 rounded-full bg-nexus-green/10 text-nexus-green text-xs">Active</span>
            </div>
            <div className="flex items-center justify-between p-4 rounded-xl bg-nexus-bg-secondary/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-nexus-violet/20 flex items-center justify-center">
                  <span className="text-nexus-violet font-semibold">SM</span>
                </div>
                <div>
                  <p className="font-medium text-nexus-text">Sarah Miller</p>
                  <p className="text-sm text-nexus-text-secondary">Editor</p>
                </div>
              </div>
              <span className="px-2 py-1 rounded-full bg-nexus-green/10 text-nexus-green text-xs">Active</span>
            </div>
            <button className="w-full p-3 rounded-xl border border-dashed border-nexus-cyan/30 text-nexus-cyan hover:bg-nexus-cyan/5 transition-colors flex items-center justify-center gap-2">
              <Users className="w-4 h-4" />
              Invite Team Member
            </button>
          </div>
        );
      
      case 'api':
        return (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-nexus-bg-secondary/50">
              <div className="flex items-center justify-between mb-2">
                <p className="font-medium text-nexus-text">API Key</p>
                <button className="text-xs text-nexus-cyan hover:underline">Regenerate</button>
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 bg-nexus-bg rounded-lg text-sm text-nexus-text-secondary font-mono">
                  nxsk_••••••••••••••••••••••••••
                </code>
                <button className="p-2 rounded-lg bg-nexus-cyan/10 text-nexus-cyan hover:bg-nexus-cyan/20 transition-colors">
                  <Key className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="p-4 rounded-xl bg-nexus-bg-secondary/50">
              <p className="font-medium text-nexus-text mb-2">Webhook URL</p>
              <input 
                type="text" 
                placeholder="https://your-app.com/webhook"
                className="w-full px-3 py-2 bg-nexus-bg border border-nexus-cyan/20 rounded-lg text-sm text-nexus-text placeholder-nexus-text-secondary focus:outline-none focus:border-nexus-cyan"
              />
            </div>
            <div className="p-4 rounded-xl bg-nexus-bg-secondary/50">
              <p className="font-medium text-nexus-text mb-2">Documentation</p>
              <a href="#" className="text-sm text-nexus-cyan hover:underline flex items-center gap-1">
                <Globe className="w-4 h-4" />
                View API docs
              </a>
            </div>
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="h-full flex gap-6">
      {/* Left Sidebar */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5 }}
        className="w-64 glass-card-strong p-4"
      >
        <h2 className="font-heading font-bold text-lg text-nexus-text mb-4">Settings</h2>
        <div className="space-y-1">
          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`w-full p-3 rounded-xl flex items-center gap-3 transition-all ${
                  activeSection === section.id 
                    ? 'bg-nexus-cyan/10 border border-nexus-cyan/30' 
                    : 'hover:bg-white/5'
                }`}
              >
                <Icon className={`w-5 h-5 ${activeSection === section.id ? 'text-nexus-cyan' : 'text-nexus-text-secondary'}`} />
                <div className="text-left">
                  <p className={`text-sm font-medium ${activeSection === section.id ? 'text-nexus-cyan' : 'text-nexus-text'}`}>
                    {section.title}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </motion.div>

      {/* Right Content */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="flex-1 glass-card-strong p-6"
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="font-heading font-semibold text-xl text-nexus-text">
              {sections.find(s => s.id === activeSection)?.title}
            </h3>
            <p className="text-sm text-nexus-text-secondary">
              {sections.find(s => s.id === activeSection)?.description}
            </p>
          </div>
          <button 
            onClick={handleSave}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all ${
              saved 
                ? 'bg-nexus-green/20 text-nexus-green' 
                : 'btn-primary'
            }`}
          >
            {saved ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Saved
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Changes
              </>
            )}
          </button>
        </div>

        {renderSectionContent()}
      </motion.div>
    </div>
  );
}