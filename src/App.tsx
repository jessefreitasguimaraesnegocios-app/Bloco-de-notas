import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search,
  Mic,
  Plus,
  Maximize2,
  Minimize2,
  Shield,
  Lock,
  Eye,
  EyeOff,
  Trash2,
  Cpu,
  Terminal,
  LogOut,
  User,
  Download
} from 'lucide-react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase, handleSupabaseError } from './supabase';
import { identifySecret } from './services/gemini';
import { cn } from './lib/utils';

// --- Types ---
interface Secret {
  id: string;
  title: string;
  content: string;
  type: 'password' | 'seed_phrase' | 'private_key' | 'api_key' | 'note';
  category: string;
  uid: string;
  createdAt: string;
}

const SECRET_TYPES: Secret['type'][] = [
  'password',
  'seed_phrase',
  'private_key',
  'api_key',
  'note'
];

function normalizeType(value: unknown): Secret['type'] {
  const s = typeof value === 'string' ? value : '';
  return SECRET_TYPES.includes(s as Secret['type']) ? (s as Secret['type']) : 'note';
}

function truncateTitle(label: string, max = 200): string {
  return label.length <= max ? label : label.slice(0, max);
}

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};

function isRunningAsInstalledPWA(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: window-controls-overlay)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function mapRowToSecret(row: {
  id: string;
  title: string | null;
  content: string;
  type: string;
  category: string;
  user_id: string;
  created_at: string;
}): Secret {
  return {
    id: row.id,
    title: row.title ?? '',
    content: row.content,
    type: row.type as Secret['type'],
    category: row.category,
    uid: row.user_id,
    createdAt: row.created_at
  };
}

export default function App() {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [secrets, setSecrets] = useState<Secret[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isMinimized, setIsMinimized] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [newContent, setNewContent] = useState('');
  const [isIdentifying, setIsIdentifying] = useState(false);
  const [visibleSecrets, setVisibleSecrets] = useState<Record<string, boolean>>({});
  const [isListening, setIsListening] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);

  useEffect(() => {
    if (isRunningAsInstalledPWA()) return;
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as InstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall);
  }, []);

  const handleInstallPWA = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    setInstallPrompt(null);
  };

  const fetchSecrets = async (userId: string) => {
    const { data, error } = await supabase
      .from('secrets')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) handleSupabaseError(error, 'list', 'secrets');
    setSecrets((data ?? []).map(mapRowToSecret));
  };

  // --- Auth ---
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // --- Secrets (fetch + realtime) ---
  useEffect(() => {
    if (!user) {
      setSecrets([]);
      return;
    }
    fetchSecrets(user.id);
    const channel = supabase
      .channel(`secrets:${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'secrets', filter: `user_id=eq.${user.id}` },
        () => fetchSecrets(user.id)
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const handleLogin = async () => {
    try {
      const redirectTo = `${window.location.origin}${window.location.pathname || '/'}`;
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo }
      });
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  const handleLogout = () => supabase.auth.signOut();

  // --- Actions ---
  const handleAddSecret = async () => {
    if (!newContent.trim() || !user) return;
    setIsIdentifying(true);
    try {
      const identity = await identifySecret(newContent);
      const { error } = await supabase.from('secrets').insert({
        title: truncateTitle(String(identity.label || 'New Secret')),
        content: newContent,
        type: normalizeType(identity.type),
        category: String(identity.category || 'unknown').slice(0, 500),
        user_id: user.id
      });
      if (error) handleSupabaseError(error, 'create', 'secrets');
      setNewContent('');
      setIsAdding(false);
    } catch (e) {
      console.error(e);
    } finally {
      setIsIdentifying(false);
    }
  };

  const handleDeleteSecret = async (id: string) => {
    try {
      const { error } = await supabase.from('secrets').delete().eq('id', id);
      if (error) handleSupabaseError(error, 'delete', `secrets/${id}`);
    } catch (e) {
      console.error(e);
    }
  };

  const toggleVisibility = (id: string) => {
    setVisibleSecrets(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // --- Voice Search ---
  const startVoiceSearch = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Voice recognition not supported in this browser.');
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'pt-BR';
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setSearchQuery(transcript);
    };
    recognition.start();
  };

  const filteredSecrets = secrets.filter(s =>
    s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-cyber-dark">
        <div className="glass p-8 rounded-2xl w-full max-w-md text-center neon-border relative overflow-hidden">
          <div className="scanline" />
          <Shield className="w-16 h-16 mx-auto mb-6 text-cyber-blue animate-pulse" />
          <h1 className="text-3xl font-bold mb-2 neon-text-blue uppercase tracking-widest">CyberVault AI</h1>
          <p className="text-white/60 mb-8 text-sm">SECURE NEURAL LINK REQUIRED</p>
          <button
            onClick={handleLogin}
            className="w-full py-4 bg-cyber-blue text-black font-bold rounded-lg hover:bg-white transition-all flex items-center justify-center gap-2 group"
          >
            <User className="w-5 h-5 group-hover:rotate-12 transition-transform" />
            INITIALIZE AUTHENTICATION
          </button>
          {installPrompt && (
            <button
              type="button"
              onClick={handleInstallPWA}
              className="mt-4 w-full py-3 border border-cyber-blue/40 text-cyber-blue text-xs font-bold rounded-lg hover:bg-cyber-blue/10 flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              INSTALAR COMO APP (PWA)
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 flex items-start justify-center md:justify-end bg-transparent">
      <motion.div
        drag
        dragMomentum={false}
        className={cn(
          'glass rounded-2xl neon-border relative flex flex-col transition-all duration-300 overflow-hidden',
          isMinimized ? 'w-16 h-16' : 'w-full max-w-md h-[600px]'
        )}
      >
        <div className="scanline" />
        <div className="p-4 border-b border-white/10 flex items-center justify-between cursor-move select-none">
          {!isMinimized && (
            <div className="flex items-center gap-2">
              <Cpu className="w-5 h-5 text-cyber-blue" />
              <span className="font-bold text-xs tracking-tighter uppercase neon-text-blue">Vault_OS v2.5</span>
            </div>
          )}
          <div className="flex items-center gap-1 ml-auto">
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="p-1 hover:bg-white/10 rounded transition-colors"
            >
              {isMinimized ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
            </button>
            {!isMinimized && installPrompt && (
              <button
                type="button"
                onClick={handleInstallPWA}
                title="Instalar como app"
                className="p-1 hover:bg-cyber-blue/20 text-cyber-blue rounded transition-colors"
              >
                <Download size={16} />
              </button>
            )}
            {!isMinimized && (
              <button
                onClick={handleLogout}
                className="p-1 hover:bg-red-500/20 text-red-400 rounded transition-colors"
              >
                <LogOut size={16} />
              </button>
            )}
          </div>
        </div>

        {!isMinimized && (
          <>
            <div className="px-4 py-2">
              <div className="relative flex items-center">
                <Search className="absolute left-3 text-white/40" size={18} />
                <input
                  type="text"
                  placeholder="SEARCH NEURAL RECORDS..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-lg py-2 pl-10 pr-10 text-sm focus:outline-none focus:border-cyber-blue/50 transition-all placeholder:text-white/20"
                />
                <button
                  onClick={startVoiceSearch}
                  className={cn(
                    'absolute right-2 p-1.5 rounded-md transition-all',
                    isListening ? 'bg-cyber-pink text-white animate-pulse' : 'hover:bg-white/10 text-white/40'
                  )}
                >
                  <Mic size={16} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
              <AnimatePresence mode="popLayout">
                {filteredSecrets.map(secret => (
                  <motion.div
                    key={secret.id}
                    layout
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="glass p-3 rounded-xl border-l-2 border-l-cyber-blue group hover:bg-white/5 transition-all"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] px-1.5 py-0.5 bg-cyber-blue/20 text-cyber-blue rounded uppercase font-bold tracking-widest">
                            {secret.type}
                          </span>
                          <span className="text-[10px] text-white/40 uppercase">{secret.category}</span>
                        </div>
                        <h3 className="font-bold text-sm mt-1 neon-text-blue">{secret.title}</h3>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => toggleVisibility(secret.id)}
                          className="p-1.5 hover:bg-white/10 rounded text-white/60"
                        >
                          {visibleSecrets[secret.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                        <button
                          onClick={() => handleDeleteSecret(secret.id)}
                          className="p-1.5 hover:bg-red-500/20 rounded text-red-400"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    <div className="relative">
                      <div
                        className={cn(
                          'bg-black/40 p-2 rounded border border-white/5 text-xs break-all font-mono',
                          !visibleSecrets[secret.id] && 'blur-sm select-none'
                        )}
                      >
                        {secret.content}
                      </div>
                      {!visibleSecrets[secret.id] && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Lock size={14} className="text-white/20" />
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {filteredSecrets.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-white/20 py-20">
                  <Terminal size={48} className="mb-4 opacity-20" />
                  <p className="text-xs uppercase tracking-widest">No records found</p>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-white/10 bg-black/20">
              <AnimatePresence mode="wait">
                {isAdding ? (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    className="space-y-3"
                  >
                    <textarea
                      autoFocus
                      placeholder="PASTE SECRET CONTENT HERE..."
                      value={newContent}
                      onChange={e => setNewContent(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-xs focus:outline-none focus:border-cyber-pink/50 h-24 resize-none"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => setIsAdding(false)}
                        className="flex-1 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-bold transition-all"
                      >
                        ABORT
                      </button>
                      <button
                        disabled={!newContent.trim() || isIdentifying}
                        onClick={handleAddSecret}
                        className="flex-[2] py-2 bg-cyber-pink text-white rounded-lg text-xs font-bold hover:bg-white hover:text-black transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {isIdentifying ? (
                          <>
                            <Cpu className="w-3 h-3 animate-spin" />
                            ANALYZING...
                          </>
                        ) : (
                          <>
                            <Plus className="w-3 h-3" />
                            ENCRYPT & SAVE
                          </>
                        )}
                      </button>
                    </div>
                  </motion.div>
                ) : (
                  <motion.button
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setIsAdding(true)}
                    className="w-full py-3 border border-dashed border-cyber-blue/30 rounded-xl text-cyber-blue text-xs font-bold flex items-center justify-center gap-2 hover:bg-cyber-blue/5 transition-all"
                  >
                    <Plus size={16} />
                    NEW NEURAL RECORD
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
          </>
        )}
      </motion.div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0, 255, 255, 0.1); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(0, 255, 255, 0.3); }
      `}</style>
    </div>
  );
}
