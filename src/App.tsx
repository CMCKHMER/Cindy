import { useState } from 'react';
import {
  FolderOpen, Search, Copy, AlertTriangle, Type, Download,
  BarChart3, FileText, Settings, Terminal, Shield,
  HardDrive, CheckCircle, XCircle, Trash2,
  Move, Eye, ChevronRight, Play, Pause, Zap,
  Brain, Image, Music, Film, Archive, FileCode,
  TrendingUp, RefreshCw, Undo2,
  Folder, File, X, Check, AlertCircle,
  Cpu, Database, Wifi, Bell, Menu
} from 'lucide-react';
import { ViewType } from './types';
import { mockDuplicates, mockBrokenFiles, mockRenameSuggestions, downloadFiles, storageData, scanHistory } from './data';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, AreaChart, Area } from 'recharts';

/* ───────────────────────── helpers ───────────────────────── */

const formatSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const navItems: { id: ViewType; icon: React.ComponentType<{ className?: string }>; label: string; badge?: number }[] = [
  { id: 'dashboard', icon: BarChart3, label: 'Dashboard' },
  { id: 'scanner', icon: Search, label: 'Scanner' },
  { id: 'duplicates', icon: Copy, label: 'Duplicates', badge: mockDuplicates.length },
  { id: 'broken', icon: AlertTriangle, label: 'Broken Files', badge: mockBrokenFiles.length },
  { id: 'rename', icon: Type, label: 'AI Rename' },
  { id: 'downloads', icon: Download, label: 'Downloads' },
  { id: 'analytics', icon: TrendingUp, label: 'Analytics' },
  { id: 'reports', icon: FileText, label: 'Reports' },
  { id: 'commands', icon: Terminal, label: 'AI Commands' },
  { id: 'settings', icon: Settings, label: 'Settings' },
];

/* ───────────────────────── Stat Card ─────────────────────── */

const colorMap: Record<string, string> = {
  indigo: 'bg-indigo-500/20 text-indigo-400',
  red: 'bg-red-500/20 text-red-400',
  amber: 'bg-amber-500/20 text-amber-400',
  cyan: 'bg-cyan-500/20 text-cyan-400',
};

function StatCard({ icon: Icon, label, value, subtext, color }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; value: string; subtext: string; color: string;
}) {
  return (
    <div className="bg-[#1e1e2e] rounded-xl border border-slate-700/50 p-4">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorMap[color] ?? colorMap.indigo}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-lg font-bold text-white">{value}</p>
          <p className="text-xs text-slate-400">{label}</p>
          <p className="text-[10px] text-slate-500">{subtext}</p>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── Dashboard ─────────────────────── */

function DashboardView({ isScanning, scanProgress }: { isScanning: boolean; scanProgress: number }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={HardDrive} label="Total Files" value="12,847" subtext="45.6 GB total" color="indigo" />
        <StatCard icon={Copy} label="Duplicates Found" value="23 files" subtext="890 MB reclaimable" color="red" />
        <StatCard icon={AlertTriangle} label="Broken Files" value="6 files" subtext="3 repairable" color="amber" />
        <StatCard icon={Type} label="Rename Suggestions" value="6 files" subtext="AI-powered" color="cyan" />
      </div>

      {isScanning && (
        <div className="bg-[#1e1e2e] rounded-xl border border-slate-700/50 p-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-indigo-500 rounded-full animate-pulse" />
              <span className="text-sm font-medium text-white">Scanning in progress...</span>
            </div>
            <span className="text-sm text-indigo-400">{scanProgress}%</span>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-3">
            <div className="bg-gradient-to-r from-indigo-500 to-cyan-500 h-3 rounded-full transition-all duration-300" style={{ width: `${scanProgress}%` }} />
          </div>
          <div className="flex justify-between mt-2 text-xs text-slate-400">
            <span>Files scanned: {Math.floor(12847 * scanProgress / 100).toLocaleString()}</span>
            <span>ETA: {Math.max(1, Math.floor((100 - scanProgress) * 0.5))}s</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Storage Breakdown */}
        <div className="bg-[#1e1e2e] rounded-xl border border-slate-700/50 p-6">
          <h3 className="text-sm font-semibold text-white mb-4">Storage Breakdown</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={storageData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                {storageData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => `${v} GB`} contentStyle={{ background: '#1e1e2e', border: '1px solid #334155', borderRadius: '8px' }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {storageData.map(item => (
              <div key={item.name} className="flex items-center gap-2 text-xs">
                <div className="w-2 h-2 rounded-full" style={{ background: item.color }} />
                <span className="text-slate-400">{item.name}</span>
                <span className="text-slate-300 ml-auto">{item.value}GB</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-[#1e1e2e] rounded-xl border border-slate-700/50 p-6">
          <h3 className="text-sm font-semibold text-white mb-4">Recent Activity</h3>
          <div className="space-y-3">
            {[
              { action: 'Organized', detail: '24 files moved to Documents/', time: '2 min ago', Icon: Folder, color: 'text-indigo-400' },
              { action: 'Detected', detail: '3 duplicate files found', time: '5 min ago', Icon: Copy, color: 'text-red-400' },
              { action: 'Renamed', detail: 'IMG_9283.jpg → golden-retriever...', time: '8 min ago', Icon: Type, color: 'text-cyan-400' },
              { action: 'Flagged', detail: '2 broken files detected', time: '12 min ago', Icon: AlertTriangle, color: 'text-amber-400' },
              { action: 'Scanned', detail: 'Downloads folder analyzed', time: '15 min ago', Icon: Search, color: 'text-green-400' },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className={`mt-0.5 ${item.color}`}><item.Icon className="w-3.5 h-3.5" /></div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-300"><span className="font-medium text-white">{item.action}</span> {item.detail}</p>
                  <p className="text-[10px] text-slate-500">{item.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-[#1e1e2e] rounded-xl border border-slate-700/50 p-6">
          <h3 className="text-sm font-semibold text-white mb-4">Quick Actions</h3>
          <div className="space-y-2">
            {[
              { label: 'Clean Downloads', Icon: Download, desc: '12 files need attention' },
              { label: 'Find Duplicates', Icon: Copy, desc: 'Scan for duplicate files' },
              { label: 'AI Rename Images', Icon: Image, desc: '6 images pending rename' },
              { label: 'Fix Broken Files', Icon: AlertTriangle, desc: '6 files need review' },
              { label: 'Generate Report', Icon: FileText, desc: 'Export scan results' },
            ].map((item, i) => (
              <button key={i} className="w-full flex items-center gap-3 p-3 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 transition-all text-left group">
                <item.Icon className="w-4 h-4 text-indigo-400 group-hover:text-indigo-300" />
                <div>
                  <p className="text-xs font-medium text-slate-200">{item.label}</p>
                  <p className="text-[10px] text-slate-500">{item.desc}</p>
                </div>
                <ChevronRight className="w-3 h-3 text-slate-600 ml-auto group-hover:text-slate-400" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Folder Structure Preview */}
      <div className="bg-[#1e1e2e] rounded-xl border border-slate-700/50 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-white">Suggested Folder Structure</h3>
          <button className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
            <Eye className="w-3 h-3" /> View Full Structure
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { name: 'Documents', count: '3,420 files', size: '8.9 GB', Icon: FileText, color: 'from-indigo-500/20 to-indigo-600/10' },
            { name: 'Media', count: '5,600 files', size: '28.9 GB', Icon: Image, color: 'from-cyan-500/20 to-cyan-600/10' },
            { name: 'Projects', count: '1,800 files', size: '5.6 GB', Icon: FileCode, color: 'from-green-500/20 to-green-600/10' },
            { name: 'Archives', count: '1,200 files', size: '1.8 GB', Icon: Archive, color: 'from-amber-500/20 to-amber-600/10' },
          ].map((folder, i) => (
            <div key={i} className={`bg-gradient-to-br ${folder.color} rounded-lg p-4 border border-slate-700/30`}>
              <folder.Icon className="w-6 h-6 text-slate-300 mb-2" />
              <p className="text-sm font-medium text-white">{folder.name}</p>
              <p className="text-xs text-slate-400">{folder.count}</p>
              <p className="text-xs text-slate-500">{folder.size}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── Scanner ───────────────────────── */

function ScannerView({ isScanning, scanProgress, startScan, selectedFolder, setSelectedFolder }: {
  isScanning: boolean; scanProgress: number;
  startScan: () => void;
  selectedFolder: string; setSelectedFolder: (f: string) => void;
}) {
  const folders = ['/Users/me/', '/Users/me/Documents/', '/Users/me/Downloads/', '/Users/me/Pictures/', '/Users/me/Desktop/'];

  return (
    <div className="space-y-6">
      <div className="bg-[#1e1e2e] rounded-xl border border-slate-700/50 p-6">
        <h3 className="text-sm font-semibold text-white mb-4">Folder Selection</h3>
        <div className="flex flex-wrap gap-2 mb-4">
          {folders.map(folder => (
            <button key={folder} onClick={() => setSelectedFolder(folder)}
              className={`px-3 py-1.5 rounded-lg text-xs transition-all ${selectedFolder === folder ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700/50 border border-transparent'}`}>
              <Folder className="w-3 h-3 inline mr-1.5" />{folder}
            </button>
          ))}
          <button className="px-3 py-1.5 rounded-lg text-xs bg-slate-800/50 text-slate-400 hover:bg-slate-700/50 border border-dashed border-slate-600">+ Add Folder</button>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={startScan} disabled={isScanning}
            className="flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 px-6 py-2.5 rounded-lg text-sm font-medium text-white transition-all disabled:opacity-50">
            {isScanning ? <Pause className="w-4 h-4" /> : <Search className="w-4 h-4" />}
            {isScanning ? 'Pause Scan' : 'Start Deep Scan'}
          </button>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Shield className="w-3.5 h-3.5 text-green-400" />
            <span>Read-only scan • No files will be modified</span>
          </div>
        </div>
      </div>

      {isScanning && (
        <div className="bg-[#1e1e2e] rounded-xl border border-slate-700/50 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <RefreshCw className="w-5 h-5 text-indigo-400 animate-spin" />
              <div>
                <p className="text-sm font-medium text-white">Scanning {selectedFolder}</p>
                <p className="text-xs text-slate-400">Analyzing file types, checking for duplicates...</p>
              </div>
            </div>
            <span className="text-2xl font-bold text-indigo-400">{scanProgress}%</span>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-4 mb-3 overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-500 via-cyan-500 to-indigo-500 h-4 rounded-full transition-all duration-300 relative" style={{ width: `${scanProgress}%` }}>
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent scan-animation" />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-4 text-center">
            <div><p className="text-lg font-bold text-white">{Math.floor(12847 * scanProgress / 100).toLocaleString()}</p><p className="text-[10px] text-slate-400">Files Scanned</p></div>
            <div><p className="text-lg font-bold text-red-400">{Math.floor(23 * scanProgress / 100)}</p><p className="text-[10px] text-slate-400">Duplicates</p></div>
            <div><p className="text-lg font-bold text-amber-400">{Math.floor(6 * scanProgress / 100)}</p><p className="text-[10px] text-slate-400">Broken Files</p></div>
            <div><p className="text-lg font-bold text-cyan-400">{Math.max(1, Math.floor((100 - scanProgress) * 0.5))}s</p><p className="text-[10px] text-slate-400">ETA</p></div>
          </div>
        </div>
      )}

      <div className="bg-[#1e1e2e] rounded-xl border border-slate-700/50 p-6">
        <h3 className="text-sm font-semibold text-white mb-4">Scan Results - File Categories</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700/50">
                <th className="text-left py-2 text-xs text-slate-400 font-medium">Category</th>
                <th className="text-left py-2 text-xs text-slate-400 font-medium">Files</th>
                <th className="text-left py-2 text-xs text-slate-400 font-medium">Size</th>
                <th className="text-left py-2 text-xs text-slate-400 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {[
                { cat: 'Images/Photos', files: 2100, size: '8.9 GB', status: 'Organized' },
                { cat: 'Images/Screenshots', files: 600, size: '1.8 GB', status: 'Needs Review' },
                { cat: 'Documents/PDF', files: 1200, size: '3.4 GB', status: 'Organized' },
                { cat: 'Videos', files: 890, size: '14.5 GB', status: '3 Broken' },
                { cat: 'Music', files: 1200, size: '2.0 GB', status: '2 Duplicates' },
                { cat: 'Archives', files: 1200, size: '1.8 GB', status: '1 Corrupted' },
                { cat: 'Projects/Coding', files: 900, size: '2.3 GB', status: 'Organized' },
              ].map((row, i) => (
                <tr key={i} className="border-b border-slate-700/30 hover:bg-slate-800/30">
                  <td className="py-2.5 text-slate-300">{row.cat}</td>
                  <td className="py-2.5 text-slate-400">{row.files.toLocaleString()}</td>
                  <td className="py-2.5 text-slate-400">{row.size}</td>
                  <td className="py-2.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      row.status === 'Organized' ? 'bg-green-500/20 text-green-400' :
                      row.status.includes('Review') ? 'bg-amber-500/20 text-amber-400' :
                      row.status.includes('Broken') || row.status.includes('Corrupted') ? 'bg-red-500/20 text-red-400' :
                      'bg-blue-500/20 text-blue-400'
                    }`}>{row.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── Duplicates ────────────────────── */

function DuplicatesView() {
  const [actions, setActions] = useState<Record<string, string>>({});

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#1e1e2e] rounded-xl border border-slate-700/50 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center"><Copy className="w-5 h-5 text-red-400" /></div>
          <div><p className="text-lg font-bold text-white">4 Groups</p><p className="text-xs text-slate-400">Duplicate sets found</p></div>
        </div>
        <div className="bg-[#1e1e2e] rounded-xl border border-slate-700/50 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center"><HardDrive className="w-5 h-5 text-amber-400" /></div>
          <div><p className="text-lg font-bold text-white">890 MB</p><p className="text-xs text-slate-400">Space reclaimable</p></div>
        </div>
        <div className="bg-[#1e1e2e] rounded-xl border border-slate-700/50 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center"><Shield className="w-5 h-5 text-indigo-400" /></div>
          <div><p className="text-lg font-bold text-white">Safe Mode</p><p className="text-xs text-slate-400">Approval required</p></div>
        </div>
      </div>

      <div className="space-y-4">
        {mockDuplicates.map(group => (
          <div key={group.id} className="bg-[#1e1e2e] rounded-xl border border-slate-700/50 overflow-hidden">
            <div className="p-4 border-b border-slate-700/30 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center"><Copy className="w-4 h-4 text-red-400" /></div>
                <div>
                  <p className="text-sm font-medium text-white">Duplicate Group</p>
                  <p className="text-xs text-slate-400">SHA256: {group.hash} • {group.similarity}% similar • {group.files.length} files</p>
                </div>
              </div>
              <span className="text-xs text-slate-400">{formatSize(group.files.reduce((s, f) => s + f.size, 0))} total</span>
            </div>

            <div className="p-4 space-y-2">
              {group.files.map((file, idx) => (
                <div key={file.id} className={`flex items-center gap-3 p-3 rounded-lg ${idx === 0 ? 'bg-green-500/5 border border-green-500/20' : 'bg-slate-800/30 border border-slate-700/30'}`}>
                  <div className={`w-2 h-2 rounded-full ${idx === 0 ? 'bg-green-400' : 'bg-red-400'}`} />
                  <File className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-200 truncate">{file.name}</p>
                    <p className="text-[10px] text-slate-500">{file.path}</p>
                  </div>
                  <span className="text-xs text-slate-400 flex-shrink-0">{formatSize(file.size)}</span>
                  <span className="text-[10px] text-slate-500 flex-shrink-0">{file.modified}</span>
                  {idx === 0 && <span className="text-[10px] text-green-400 bg-green-500/20 px-1.5 py-0.5 rounded">Original</span>}
                </div>
              ))}
            </div>

            <div className="px-4 pb-4 flex items-center gap-2 flex-wrap">
              <span className="text-xs text-slate-400 mr-2">Action:</span>
              {(['delete', 'keep', 'review', 'ignore'] as const).map(action => {
                const icons = { delete: Trash2, keep: CheckCircle, review: Move, ignore: Eye };
                const labels = { delete: 'Delete Duplicates', keep: 'Keep All', review: 'Move to Review', ignore: 'Ignore' };
                const colors: Record<string, string> = {
                  delete: 'bg-red-500/20 text-red-300 border-red-500/30',
                  keep: 'bg-green-500/20 text-green-300 border-green-500/30',
                  review: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
                  ignore: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
                };
                const Icon = icons[action];
                const active = actions[group.id] === action;
                return (
                  <button key={action} onClick={() => setActions(p => ({ ...p, [group.id]: action }))}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all ${active ? colors[action] + ' border' : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700/50'}`}>
                    <Icon className="w-3 h-3" />{labels[action]}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 flex items-start gap-3">
        <Shield className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-amber-300">Safety First</p>
          <p className="text-xs text-slate-400 mt-1">No files will be deleted automatically. All actions require your explicit approval. A backup is created before any destructive operation.</p>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── Broken Files ──────────────────── */

function BrokenFilesView() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#1e1e2e] rounded-xl border border-slate-700/50 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center"><XCircle className="w-5 h-5 text-red-400" /></div>
          <div><p className="text-lg font-bold text-white">6 Files</p><p className="text-xs text-slate-400">Broken or corrupted</p></div>
        </div>
        <div className="bg-[#1e1e2e] rounded-xl border border-slate-700/50 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center"><CheckCircle className="w-5 h-5 text-green-400" /></div>
          <div><p className="text-lg font-bold text-white">2 Repairable</p><p className="text-xs text-slate-400">Can be fixed automatically</p></div>
        </div>
        <div className="bg-[#1e1e2e] rounded-xl border border-slate-700/50 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center"><AlertCircle className="w-5 h-5 text-amber-400" /></div>
          <div><p className="text-lg font-bold text-white">4 Unrepairable</p><p className="text-xs text-slate-400">Delete or archive</p></div>
        </div>
      </div>

      <div className="bg-[#1e1e2e] rounded-xl border border-slate-700/50 overflow-hidden">
        <div className="p-4 border-b border-slate-700/30">
          <h3 className="text-sm font-semibold text-white">Broken File Review</h3>
          <p className="text-xs text-slate-400 mt-1">Review each file and choose an action. No files will be modified without approval.</p>
        </div>
        <div className="divide-y divide-slate-700/30">
          {mockBrokenFiles.map(broken => (
            <div key={broken.id} className="p-4 hover:bg-slate-800/20">
              <div className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  broken.severity === 'high' ? 'bg-red-500/20' : broken.severity === 'medium' ? 'bg-amber-500/20' : 'bg-slate-500/20'
                }`}>
                  <AlertTriangle className={`w-4 h-4 ${
                    broken.severity === 'high' ? 'text-red-400' : broken.severity === 'medium' ? 'text-amber-400' : 'text-slate-400'
                  }`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-white">{broken.file.name}</p>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                      broken.severity === 'high' ? 'bg-red-500/20 text-red-400' :
                      broken.severity === 'medium' ? 'bg-amber-500/20 text-amber-400' :
                      'bg-slate-500/20 text-slate-400'
                    }`}>{broken.severity}</span>
                    {broken.repairable && <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-400">Repairable</span>}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">{broken.file.path}</p>
                  <p className="text-xs text-slate-500 mt-1"><span className="text-amber-300">Issue:</span> {broken.issue}</p>
                  <p className="text-[10px] text-slate-500 mt-1">Size: {formatSize(broken.file.size)} • Modified: {broken.file.modified}</p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {broken.repairable && (
                    <button className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs bg-green-500/10 text-green-400 hover:bg-green-500/20 border border-green-500/20">
                      <RefreshCw className="w-3 h-3" /> Repair
                    </button>
                  )}
                  <button className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20">
                    <Trash2 className="w-3 h-3" /> Delete
                  </button>
                  <button className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/20">
                    <Archive className="w-3 h-3" /> Archive
                  </button>
                  <button className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs bg-slate-500/10 text-slate-400 hover:bg-slate-500/20 border border-slate-500/20">
                    <Eye className="w-3 h-3" /> Ignore
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── Rename ────────────────────────── */

function RenameView() {
  const [approved, setApproved] = useState<Record<string, boolean>>({});

  return (
    <div className="space-y-6">
      <div className="bg-[#1e1e2e] rounded-xl border border-slate-700/50 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center"><Brain className="w-5 h-5 text-cyan-400" /></div>
          <div>
            <h3 className="text-sm font-semibold text-white">AI-Powered Image Renaming</h3>
            <p className="text-xs text-slate-400">AI analyzes image content and generates descriptive filenames</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-cyan-600 px-4 py-2 rounded-lg text-sm font-medium text-white hover:from-cyan-600 hover:to-cyan-700">
            <Brain className="w-4 h-4" /> Analyze All Images
          </button>
          <button className="flex items-center gap-2 bg-green-500/20 text-green-400 px-4 py-2 rounded-lg text-sm hover:bg-green-500/30 border border-green-500/20">
            <Check className="w-4 h-4" /> Approve All
          </button>
          <span className="text-xs text-slate-400">6 suggestions pending approval</span>
        </div>
      </div>

      <div className="space-y-3">
        {mockRenameSuggestions.map(suggestion => (
          <div key={suggestion.id} className={`bg-[#1e1e2e] rounded-xl border p-4 transition-all ${approved[suggestion.id] ? 'border-green-500/30 bg-green-500/5' : 'border-slate-700/50'}`}>
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0"><Image className="w-6 h-6 text-slate-500" /></div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-slate-500 line-through">{suggestion.originalName}</span>
                  <ChevronRight className="w-3 h-3 text-slate-600" />
                  <span className="text-sm font-medium text-cyan-300">{suggestion.suggestedName}</span>
                </div>
                <p className="text-xs text-slate-400">{suggestion.path}</p>
                <div className="flex items-center gap-1 mt-2">
                  <Brain className="w-3 h-3 text-cyan-400" />
                  <span className="text-[10px] text-slate-400">{suggestion.aiReason}</span>
                </div>
                <div className="flex items-center gap-1 mt-2">
                  <div className="w-16 bg-slate-700 rounded-full h-1.5">
                    <div className="bg-cyan-400 h-1.5 rounded-full" style={{ width: `${suggestion.confidence}%` }} />
                  </div>
                  <span className="text-[10px] text-slate-400">{suggestion.confidence}% confidence</span>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => setApproved(p => ({ ...p, [suggestion.id]: true }))}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs transition-all ${approved[suggestion.id] ? 'bg-green-500/20 text-green-300 border border-green-500/30' : 'bg-slate-800/50 text-slate-400 hover:bg-green-500/10 hover:text-green-400'}`}>
                  <Check className="w-3 h-3" /> {approved[suggestion.id] ? 'Approved' : 'Approve'}
                </button>
                <button className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs bg-slate-800/50 text-slate-400 hover:bg-red-500/10 hover:text-red-400">
                  <X className="w-3 h-3" /> Skip
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ───────────────────────── Downloads ─────────────────────── */

function DownloadsView() {
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);

  const toggleFile = (id: string) => setSelectedFiles(p => p.includes(id) ? p.filter(f => f !== id) : [...p, id]);
  const toggleAll = () => setSelectedFiles(p => p.length === downloadFiles.length ? [] : downloadFiles.map(f => f.id));

  return (
    <div className="space-y-6">
      <div className="bg-[#1e1e2e] rounded-xl border border-slate-700/50 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-white">Downloads Folder Cleanup</h3>
            <p className="text-xs text-slate-400 mt-1">12 files analyzed • Organize by type for better management</p>
          </div>
          {selectedFiles.length > 0 && (
            <button className="flex items-center gap-2 bg-indigo-500/20 text-indigo-300 px-4 py-2 rounded-lg text-sm hover:bg-indigo-500/30 border border-indigo-500/20">
              <Move className="w-4 h-4" /> Move {selectedFiles.length} files
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2 mb-4">
          {[
            { cat: 'Software', count: 3, color: 'bg-indigo-500/20 text-indigo-400' },
            { cat: 'Documents', count: 3, color: 'bg-green-500/20 text-green-400' },
            { cat: 'Images', count: 2, color: 'bg-cyan-500/20 text-cyan-400' },
            { cat: 'Videos', count: 1, color: 'bg-purple-500/20 text-purple-400' },
            { cat: 'Archives', count: 2, color: 'bg-amber-500/20 text-amber-400' },
            { cat: 'Audio', count: 1, color: 'bg-pink-500/20 text-pink-400' },
          ].map(item => (
            <div key={item.cat} className={`${item.color} rounded-lg p-2 text-center`}>
              <p className="text-lg font-bold">{item.count}</p>
              <p className="text-[10px]">{item.cat}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-[#1e1e2e] rounded-xl border border-slate-700/50 overflow-hidden">
        <div className="p-4 border-b border-slate-700/30 flex items-center justify-between">
          <h3 className="text-sm font-medium text-white">Files in Downloads</h3>
          <button onClick={toggleAll} className="text-xs text-indigo-400 hover:text-indigo-300">
            {selectedFiles.length === downloadFiles.length ? 'Deselect All' : 'Select All'}
          </button>
        </div>
        <div className="divide-y divide-slate-700/30">
          {downloadFiles.map(file => (
            <div key={file.id} onClick={() => toggleFile(file.id)}
              className={`p-3 flex items-center gap-3 cursor-pointer hover:bg-slate-800/30 transition-all ${selectedFiles.includes(file.id) ? 'bg-indigo-500/5' : ''}`}>
              <div className={`w-4 h-4 rounded border flex items-center justify-center ${selectedFiles.includes(file.id) ? 'bg-indigo-500 border-indigo-500' : 'border-slate-600'}`}>
                {selectedFiles.includes(file.id) && <Check className="w-2.5 h-2.5 text-white" />}
              </div>
              <File className="w-4 h-4 text-slate-400" />
              <div className="flex-1 min-w-0"><p className="text-xs text-slate-200 truncate">{file.name}</p></div>
              <span className="text-xs text-slate-500">{formatSize(file.size)}</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                file.category === 'Software' ? 'bg-indigo-500/20 text-indigo-400' :
                file.category === 'Documents' ? 'bg-green-500/20 text-green-400' :
                file.category === 'Images' ? 'bg-cyan-500/20 text-cyan-400' :
                file.category === 'Videos' ? 'bg-purple-500/20 text-purple-400' :
                file.category === 'Archives' ? 'bg-amber-500/20 text-amber-400' :
                'bg-pink-500/20 text-pink-400'
              }`}>{file.category}</span>
              <span className="text-[10px] text-slate-500">{file.date}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-[#1e1e2e] rounded-xl border border-slate-700/50 p-6">
        <h3 className="text-sm font-semibold text-white mb-3">Suggested Organization</h3>
        <div className="space-y-2">
          {[
            { action: 'Move 3 installers to', target: '/Software/Installers/', files: 'chrome-installer.exe, node-v20-setup.msi, vscode-update.exe' },
            { action: 'Move 3 documents to', target: '/Documents/', files: 'annual-report-2024.pdf, invoice-march.pdf, resume-2024.docx' },
            { action: 'Move 2 images to', target: '/Media/Images/', files: 'profile-picture.jpg, vacation-photo.jpg' },
            { action: 'Move 2 archives to', target: '/Archives/', files: 'project-backup.zip, design-assets.rar' },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-3 p-3 bg-slate-800/30 rounded-lg">
              <Move className="w-4 h-4 text-indigo-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-300">{item.action} <span className="text-indigo-300 font-medium">{item.target}</span></p>
                <p className="text-[10px] text-slate-500 truncate">{item.files}</p>
              </div>
              <button className="text-xs text-green-400 hover:text-green-300 flex-shrink-0">Approve</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── Analytics ─────────────────────── */

function AnalyticsView() {
  const areaData = scanHistory.map((h, i) => ({ name: h.date.slice(5), storage: 42 + i * 0.5 }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#1e1e2e] rounded-xl border border-slate-700/50 p-6">
          <h3 className="text-sm font-semibold text-white mb-4">Storage Usage Trend</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={areaData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <Tooltip contentStyle={{ background: '#1e1e2e', border: '1px solid #334155', borderRadius: '8px' }} />
              <Area type="monotone" dataKey="storage" stroke="#6366f1" fill="#6366f1" fillOpacity={0.2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-[#1e1e2e] rounded-xl border border-slate-700/50 p-6">
          <h3 className="text-sm font-semibold text-white mb-4">Scan History</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={scanHistory}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }} tickFormatter={(v: string) => v.slice(5)} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <Tooltip contentStyle={{ background: '#1e1e2e', border: '1px solid #334155', borderRadius: '8px' }} />
              <Line type="monotone" dataKey="filesScanned" stroke="#06b6d4" strokeWidth={2} dot={{ fill: '#06b6d4' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-[#1e1e2e] rounded-xl border border-slate-700/50 p-6">
          <h3 className="text-sm font-semibold text-white mb-4">Duplicates & Broken Files</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={scanHistory}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }} tickFormatter={(v: string) => v.slice(5)} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <Tooltip contentStyle={{ background: '#1e1e2e', border: '1px solid #334155', borderRadius: '8px' }} />
              <Bar dataKey="duplicates" fill="#ef4444" radius={[4, 4, 0, 0]} />
              <Bar dataKey="broken" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-[#1e1e2e] rounded-xl border border-slate-700/50 p-6">
          <h3 className="text-sm font-semibold text-white mb-4">File Type Distribution</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={storageData} cx="50%" cy="50%" outerRadius={80} dataKey="value"
                label={({ name, percent }: { name: string; percent: number }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                {storageData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}
              </Pie>
              <Tooltip formatter={(v: number) => `${v} GB`} contentStyle={{ background: '#1e1e2e', border: '1px solid #334155', borderRadius: '8px' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-[#1e1e2e] rounded-xl border border-slate-700/50 p-6">
        <h3 className="text-sm font-semibold text-white mb-4">Largest Files</h3>
        <div className="space-y-2">
          {[
            { name: 'video-tutorial.mp4', size: 450000000, path: '/Downloads/' },
            { name: 'design-assets.rar', size: 230000000, path: '/Downloads/' },
            { name: 'project-backup.zip', size: 120000000, path: '/Downloads/' },
            { name: 'chrome-installer.exe', size: 95000000, path: '/Downloads/' },
            { name: 'vscode-update.exe', size: 89000000, path: '/Downloads/' },
          ].map((file, i) => (
            <div key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-800/30">
              <span className="text-xs text-slate-500 w-4">{i + 1}</span>
              <File className="w-4 h-4 text-slate-400" />
              <span className="text-xs text-slate-300 flex-1">{file.name}</span>
              <span className="text-[10px] text-slate-500">{file.path}</span>
              <span className="text-xs text-slate-400">{formatSize(file.size)}</span>
              <div className="w-24 bg-slate-700 rounded-full h-1.5">
                <div className="bg-indigo-400 h-1.5 rounded-full" style={{ width: `${(file.size / 450000000) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── Reports ───────────────────────── */

function ReportsView() {
  return (
    <div className="space-y-6">
      <div className="bg-[#1e1e2e] rounded-xl border border-slate-700/50 p-6">
        <h3 className="text-sm font-semibold text-white mb-4">Generate Report</h3>
        <p className="text-xs text-slate-400 mb-4">Export a comprehensive report of all file organization activities.</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Export PDF', sub: 'Formatted report', color: 'red' },
            { label: 'Export CSV', sub: 'Spreadsheet format', color: 'green' },
            { label: 'Export JSON', sub: 'Machine-readable', color: 'amber' },
          ].map((item, i) => (
            <button key={i} className={`flex items-center gap-3 p-4 rounded-lg bg-${item.color}-500/10 border border-${item.color}-500/20 hover:bg-${item.color}-500/20 transition-all`}>
              <FileText className={`w-5 h-5 text-${item.color}-400`} />
              <div className="text-left">
                <p className="text-sm text-white">{item.label}</p>
                <p className="text-[10px] text-slate-400">{item.sub}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-[#1e1e2e] rounded-xl border border-slate-700/50 p-6">
        <h3 className="text-sm font-semibold text-white mb-4">Last Scan Report - July 10, 2024</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { val: '12,847', label: 'Files Scanned', color: 'text-indigo-400' },
            { val: '156', label: 'Files Moved', color: 'text-green-400' },
            { val: '23', label: 'Files Renamed', color: 'text-cyan-400' },
            { val: '890 MB', label: 'Storage Saved', color: 'text-amber-400' },
          ].map((s, i) => (
            <div key={i} className="text-center p-3 bg-slate-800/30 rounded-lg">
              <p className={`text-2xl font-bold ${s.color}`}>{s.val}</p>
              <p className="text-[10px] text-slate-400">{s.label}</p>
            </div>
          ))}
        </div>
        <div className="space-y-3">
          <h4 className="text-xs font-medium text-slate-300">Detailed Breakdown</h4>
          {[
            { label: 'Duplicates Found', value: '23 files (4 groups)', Icon: Copy, color: 'text-red-400' },
            { label: 'Broken Files Detected', value: '6 files (2 repairable)', Icon: AlertTriangle, color: 'text-amber-400' },
            { label: 'AI Rename Suggestions', value: '6 images renamed', Icon: Type, color: 'text-cyan-400' },
            { label: 'Downloads Organized', value: '12 files categorized', Icon: Download, color: 'text-indigo-400' },
            { label: 'Folders Reorganized', value: '3 folders renamed', Icon: Folder, color: 'text-green-400' },
            { label: 'Storage Recovered', value: '890 MB from duplicates', Icon: HardDrive, color: 'text-purple-400' },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-800/30">
              <item.Icon className={`w-4 h-4 ${item.color}`} />
              <span className="text-xs text-slate-300 flex-1">{item.label}</span>
              <span className="text-xs text-slate-400">{item.value}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-[#1e1e2e] rounded-xl border border-slate-700/50 p-6">
        <h3 className="text-sm font-semibold text-white mb-4">Undo History</h3>
        <div className="space-y-2">
          {[
            { action: 'Moved 5 files from Downloads/ to Documents/', time: '10 min ago', undone: false },
            { action: 'Renamed IMG_9283.jpg to golden-retriever-running-in-park.jpg', time: '15 min ago', undone: false },
            { action: 'Deleted 2 duplicate files (recovered 8.9 MB)', time: '1 hour ago', undone: false },
            { action: 'Moved folder "Random Stuff" to "Organized Files"', time: '2 hours ago', undone: true },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-3 p-3 bg-slate-800/30 rounded-lg">
              <Undo2 className={`w-4 h-4 ${item.undone ? 'text-amber-400' : 'text-slate-400'}`} />
              <div className="flex-1">
                <p className={`text-xs ${item.undone ? 'text-slate-500 line-through' : 'text-slate-300'}`}>{item.action}</p>
                <p className="text-[10px] text-slate-500">{item.time}</p>
              </div>
              {!item.undone ? (
                <button className="text-[10px] text-indigo-400 hover:text-indigo-300 px-2 py-1 rounded bg-indigo-500/10">Undo</button>
              ) : (
                <span className="text-[10px] text-amber-400 px-2 py-1 rounded bg-amber-500/10">Undone</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── Commands ──────────────────────── */

interface HistoryEntry { type: 'input' | 'output'; text: string }

function getCommandResponse(cmd: string): string {
  const l = cmd.toLowerCase();
  if (l.includes('download')) return '📁 Scanning Downloads folder... Found 12 files. 3 installers, 3 documents, 2 images, 1 video, 2 archives, 1 audio. Suggest organizing into categorized subfolders. Ready to proceed?';
  if (l.includes('duplicate')) return '🔍 Found 4 duplicate groups (9 files total). 890 MB can be reclaimed. Review the Duplicates tab to take action on each group.';
  if (l.includes('rename')) return '🤖 AI analyzing images... Found 6 images with generic names. Generated descriptive names with 87-96% confidence. Review in AI Rename tab.';
  if (l.includes('music')) return '🎵 Found 1,200 music files (2.0 GB). 2 duplicates detected. Suggest organizing by genre/artist. Ready to organize?';
  if (l.includes('large') || l.includes('1gb')) return '📊 Files larger than 1GB: video-tutorial.mp4 (450MB), design-assets.rar (230MB), project-backup.zip (120MB). No files exceed 1GB threshold.';
  if (l.includes('broken')) return '⚠️ Found 6 broken files: 1 zero-byte image, 1 incomplete download, 1 corrupted video, 1 damaged PDF, 1 dead shortcut, 1 empty file. 2 are repairable.';
  if (l.includes('old')) return '📅 Files not modified in 6+ months: 847 files (3.2 GB). Oldest: backup-2022.zip (Jan 2022). Suggest archiving or reviewing.';
  if (l.includes('backup')) return '💾 Creating backup of Documents/ folder... Estimated size: 8.9 GB. Backup will be saved to /Backup/Documents-2024-07-10/. Proceed?';
  return '🤔 I understand you want to: "' + cmd + '". Let me analyze your request and find the best approach. Could you be more specific about which folder or file type?';
}

const commandSuggestions = [
  'Clean my Downloads folder', 'Find duplicate photos', 'Rename all screenshots',
  'Organize my music', 'Show files larger than 1GB', 'Find broken files',
  'Scan for old files', 'Create backup of Documents',
];

function CommandsView() {
  const [commandInput, setCommandInput] = useState('');
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const execute = (cmd: string) => {
    if (!cmd.trim()) return;
    setHistory(p => [...p, { type: 'input', text: cmd }, { type: 'output', text: getCommandResponse(cmd) }]);
    setCommandInput('');
  };

  return (
    <div className="space-y-6">
      <div className="bg-[#1e1e2e] rounded-xl border border-slate-700/50 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center"><Terminal className="w-5 h-5 text-indigo-400" /></div>
          <div>
            <h3 className="text-sm font-semibold text-white">AI Natural Language Commands</h3>
            <p className="text-xs text-slate-400">Control the organizer with natural language</p>
          </div>
        </div>
        <div className="flex gap-2 mb-4">
          <div className="flex-1 relative">
            <input type="text" value={commandInput}
              onChange={e => setCommandInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && execute(commandInput)}
              placeholder="Type a command... (e.g., 'Clean my Downloads folder')"
              className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 text-slate-200 placeholder-slate-500" />
            <Zap className="w-4 h-4 absolute right-3 top-3.5 text-slate-500" />
          </div>
          <button onClick={() => execute(commandInput)} className="bg-indigo-500 hover:bg-indigo-600 px-4 py-2 rounded-lg text-sm text-white font-medium">Run</button>
        </div>
        <div className="flex flex-wrap gap-2">
          {commandSuggestions.map((s, i) => (
            <button key={i} onClick={() => execute(s)}
              className="px-3 py-1.5 rounded-lg text-xs bg-slate-800/50 text-slate-400 hover:bg-indigo-500/20 hover:text-indigo-300 border border-slate-700/50 hover:border-indigo-500/30 transition-all">
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-[#1e1e2e] rounded-xl border border-slate-700/50 p-6">
        <h3 className="text-sm font-semibold text-white mb-4">Command History</h3>
        <div className="bg-[#0f0f1a] rounded-lg p-4 font-mono text-xs space-y-3 max-h-96 overflow-y-auto">
          {history.length === 0 ? (
            <p className="text-slate-500">No commands executed yet. Try one of the suggestions above.</p>
          ) : (
            history.map((item, i) =>
              item.type === 'input' ? (
                <p key={i} className="text-indigo-400"><span className="text-slate-500">$ </span>{item.text}</p>
              ) : (
                <p key={i} className="text-slate-300 pl-4 whitespace-pre-wrap">{item.text}</p>
              )
            )
          )}
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── Settings ──────────────────────── */

function SettingsView() {
  const [toggles, setToggles] = useState<Record<string, boolean>>({
    autoScan: true, realtime: false, ai: true, visual: true, incremental: true, lowMem: false,
    askDelete: true, askRename: true, backup: true, protect: true, undo: true, log: true,
  });

  const toggle = (key: string) => setToggles(p => ({ ...p, [key]: !p[key] }));

  const Toggle = ({ on, onColor = 'bg-indigo-500', onClick }: { on: boolean; onColor?: string; onClick: () => void }) => (
    <div className={`w-10 h-5 rounded-full relative cursor-pointer transition-all ${on ? onColor : 'bg-slate-600'}`} onClick={onClick}>
      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${on ? 'left-5' : 'left-0.5'}`} />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="bg-[#1e1e2e] rounded-xl border border-slate-700/50 p-6">
        <h3 className="text-sm font-semibold text-white mb-4">General Settings</h3>
        <div className="space-y-4">
          {[
            { key: 'autoScan', label: 'Auto-scan on startup', desc: 'Automatically scan configured folders when the app starts' },
            { key: 'realtime', label: 'Real-time monitoring', desc: 'Watch for file changes and organize automatically' },
            { key: 'ai', label: 'AI-powered categorization', desc: 'Use local AI models for intelligent file classification' },
            { key: 'visual', label: 'Visual duplicate detection', desc: 'Use image similarity for finding near-duplicate photos' },
            { key: 'incremental', label: 'Incremental scanning', desc: 'Only scan changed files for faster subsequent scans' },
            { key: 'lowMem', label: 'Low memory mode', desc: 'Reduce memory usage for large file collections' },
          ].map(s => (
            <div key={s.key} className="flex items-center justify-between p-3 rounded-lg bg-slate-800/30">
              <div><p className="text-xs font-medium text-slate-200">{s.label}</p><p className="text-[10px] text-slate-500">{s.desc}</p></div>
              <Toggle on={toggles[s.key]} onClick={() => toggle(s.key)} />
            </div>
          ))}
        </div>
      </div>

      <div className="bg-[#1e1e2e] rounded-xl border border-slate-700/50 p-6">
        <h3 className="text-sm font-semibold text-white mb-4">Safety & Protection</h3>
        <div className="space-y-4">
          {[
            { key: 'askDelete', label: 'Always ask before deleting', desc: 'Never delete files without explicit user approval' },
            { key: 'askRename', label: 'Always ask before renaming', desc: 'Show rename suggestions and require approval' },
            { key: 'backup', label: 'Create backups before changes', desc: 'Automatically backup files before any modification' },
            { key: 'protect', label: 'Protect system folders', desc: 'Never modify OS-critical directories' },
            { key: 'undo', label: 'Maintain undo history', desc: 'Keep track of all changes for easy reversal' },
            { key: 'log', label: 'Log all operations', desc: 'Record every file operation for audit trail' },
          ].map(s => (
            <div key={s.key} className="flex items-center justify-between p-3 rounded-lg bg-slate-800/30">
              <div><p className="text-xs font-medium text-slate-200">{s.label}</p><p className="text-[10px] text-slate-500">{s.desc}</p></div>
              <Toggle on={toggles[s.key]} onColor="bg-green-500" onClick={() => toggle(s.key)} />
            </div>
          ))}
        </div>
      </div>

      <div className="bg-[#1e1e2e] rounded-xl border border-slate-700/50 p-6">
        <h3 className="text-sm font-semibold text-white mb-4">AI Model Configuration</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { Icon: Cpu, label: 'Image Recognition Model', detail: 'ONNX ResNet-50 • 25MB', color: 'text-indigo-400' },
            { Icon: Database, label: 'Similarity Search (FAISS)', detail: 'Index: 12,847 vectors • 128-dim', color: 'text-cyan-400' },
            { Icon: Brain, label: 'OCR Engine', detail: 'Tesseract ONNX • 15MB', color: 'text-amber-400' },
            { Icon: Wifi, label: 'NLP Command Parser', detail: 'Local transformer • 45MB', color: 'text-purple-400' },
          ].map((m, i) => (
            <div key={i} className="p-4 rounded-lg bg-slate-800/30 border border-slate-700/30">
              <div className="flex items-center gap-2 mb-2"><m.Icon className={`w-4 h-4 ${m.color}`} /><p className="text-xs font-medium text-slate-200">{m.label}</p></div>
              <p className="text-[10px] text-slate-400 mb-2">{m.detail}</p>
              <div className="w-full bg-slate-700 rounded-full h-1.5"><div className="bg-green-400 h-1.5 rounded-full w-full" /></div>
              <p className="text-[10px] text-green-400 mt-1">Loaded & Ready</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-[#1e1e2e] rounded-xl border border-slate-700/50 p-6">
        <h3 className="text-sm font-semibold text-white mb-4">Platform Info</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[{ l: 'Platform', v: 'Cross-Platform' }, { l: 'Version', v: '2.0.0' }, { l: 'Database', v: 'SQLite' }, { l: 'Backend', v: 'FastAPI' }].map((p, i) => (
            <div key={i} className="text-center p-3 bg-slate-800/30 rounded-lg">
              <p className="text-xs text-slate-400">{p.l}</p>
              <p className="text-sm font-medium text-white">{p.v}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════ APP (root) ═══════════════════════ */

export default function App() {
  const [activeView, setActiveView] = useState<ViewType>('dashboard');
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [selectedFolder, setSelectedFolder] = useState('/Users/me/');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const startScan = () => {
    setIsScanning(true);
    setScanProgress(0);
    const interval = setInterval(() => {
      setScanProgress(prev => {
        if (prev >= 100) { clearInterval(interval); setIsScanning(false); return 100; }
        return prev + 2;
      });
    }, 100);
  };

  const renderView = () => {
    switch (activeView) {
      case 'dashboard': return <DashboardView isScanning={isScanning} scanProgress={scanProgress} />;
      case 'scanner': return <ScannerView isScanning={isScanning} scanProgress={scanProgress} startScan={startScan} selectedFolder={selectedFolder} setSelectedFolder={setSelectedFolder} />;
      case 'duplicates': return <DuplicatesView />;
      case 'broken': return <BrokenFilesView />;
      case 'rename': return <RenameView />;
      case 'downloads': return <DownloadsView />;
      case 'analytics': return <AnalyticsView />;
      case 'reports': return <ReportsView />;
      case 'commands': return <CommandsView />;
      case 'settings': return <SettingsView />;
      default: return null;
    }
  };

  return (
    <div className="flex h-screen bg-[#0f0f1a] text-slate-200 overflow-hidden">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-16'} transition-all duration-300 bg-[#1a1a2e] border-r border-slate-700/50 flex flex-col flex-shrink-0`}>
        <div className="p-4 flex items-center gap-3 border-b border-slate-700/50">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center flex-shrink-0">
            <Brain className="w-5 h-5 text-white" />
          </div>
          {sidebarOpen && (
            <div>
              <h1 className="font-bold text-sm text-white">AI File Organizer</h1>
              <p className="text-[10px] text-slate-400">v2.0 Cross-Platform</p>
            </div>
          )}
        </div>

        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          {navItems.map(item => (
            <button key={item.id} onClick={() => setActiveView(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                activeView === item.id
                  ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                  : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-200'
              }`}>
              <item.icon className="w-4 h-4 flex-shrink-0" />
              {sidebarOpen && <span>{item.label}</span>}
              {sidebarOpen && item.badge && (
                <span className="ml-auto bg-red-500/20 text-red-400 text-[10px] px-1.5 py-0.5 rounded-full">{item.badge}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="p-3 border-t border-slate-700/50">
          {sidebarOpen && (
            <div className="bg-slate-800/50 rounded-lg p-3 mb-2">
              <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
                <HardDrive className="w-3 h-3" /><span>Storage Used</span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-2">
                <div className="bg-gradient-to-r from-indigo-500 to-cyan-500 h-2 rounded-full" style={{ width: '67%' }} />
              </div>
              <p className="text-[10px] text-slate-500 mt-1">45.6 GB / 68 GB</p>
            </div>
          )}
          <button onClick={() => setSidebarOpen(o => !o)}
            className="w-full flex items-center justify-center p-2 rounded-lg hover:bg-slate-700/50 text-slate-400">
            <Menu className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        <header className="h-14 border-b border-slate-700/50 bg-[#1a1a2e]/80 backdrop-blur-sm flex items-center px-6 justify-between flex-shrink-0">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold text-white capitalize">
              {activeView === 'dashboard' ? 'Overview Dashboard' : navItems.find(n => n.id === activeView)?.label}
            </h2>
            {isScanning && (
              <div className="flex items-center gap-2 bg-indigo-500/20 px-3 py-1 rounded-full">
                <div className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse" />
                <span className="text-xs text-indigo-300">Scanning... {scanProgress}%</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="relative hidden md:block">
              <input type="text" placeholder="Quick search..."
                className="bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-1.5 text-sm w-48 focus:outline-none focus:border-indigo-500 text-slate-300 placeholder-slate-500" />
              <Search className="w-3.5 h-3.5 absolute right-2.5 top-2 text-slate-500" />
            </div>
            <button className="relative p-2 rounded-lg hover:bg-slate-700/50 text-slate-400">
              <Bell className="w-4 h-4" />
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full text-[9px] flex items-center justify-center text-white">3</span>
            </button>
            <button onClick={startScan} disabled={isScanning}
              className="flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 px-4 py-1.5 rounded-lg text-sm font-medium text-white transition-all disabled:opacity-50">
              {isScanning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              {isScanning ? 'Pause' : 'Scan'}
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6">
          {renderView()}
        </div>
      </main>
    </div>
  );
}
