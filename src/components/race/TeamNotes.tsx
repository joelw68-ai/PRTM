import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';
import { CrewRole } from '@/lib/permissions';
import {
  fetchTeamNotes,
  upsertTeamNote,
  deleteTeamNote as dbDeleteTeamNote,
  TeamNote
} from '@/lib/database';
import {
  FileText,
  Plus,
  Search,
  Filter,
  X,
  Edit2,
  Trash2,
  Pin,
  PinOff,
  Loader2,
  RefreshCw,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Tag,
  Clock,
  User
} from 'lucide-react';

interface TeamNotesProps {
  currentRole?: CrewRole;
}

const TeamNotes: React.FC<TeamNotesProps> = ({ currentRole = 'Crew' }) => {
  const { user, isDemoMode } = useAuth();
  const { teamMembers } = useApp();

  // Database-backed state - starts EMPTY
  const [notes, setNotes] = useState<TeamNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingNote, setEditingNote] = useState<TeamNote | null>(null);
  const [expandedNote, setExpandedNote] = useState<string | null>(null);

  const [newNote, setNewNote] = useState<Partial<TeamNote>>({
    title: '',
    content: '',
    category: 'General',
    createdBy: '',
    isPinned: false
  });

  const categories = ['General', 'Safety', 'Engine', 'Drivetrain', 'Suspension', 'Electronics', 'Race Strategy', 'Setup Notes', 'Travel', 'Sponsor', 'Meeting Notes'];

  // ============ LOAD DATA FROM DATABASE ============
  const loadNotes = useCallback(async () => {
    if (isDemoMode) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setLoadError(null);
    try {
      const items = await fetchTeamNotes(user?.id);
      setNotes(items);
    } catch (err) {
      console.error('Failed to load team notes:', err);
      setLoadError(err instanceof Error ? err.message : 'Failed to load team notes');
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, isDemoMode]);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  // ============ CRUD HANDLERS ============
  const handleAddNote = async () => {
    if (!newNote.title) return;

    const note: TeamNote = {
      id: `NOTE-${Date.now()}`,
      title: newNote.title,
      content: newNote.content || '',
      category: newNote.category || 'General',
      createdBy: newNote.createdBy || currentRole,
      isPinned: newNote.isPinned || false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Optimistic update
    setNotes(prev => [note, ...prev]);
    setShowAddModal(false);
    setNewNote({ title: '', content: '', category: 'General', createdBy: '', isPinned: false });

    try {
      setIsSaving(true);
      await upsertTeamNote(note, user?.id);
    } catch (err) {
      console.error('Failed to save note:', err);
      setNotes(prev => prev.filter(n => n.id !== note.id));
      alert(`Failed to save note: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditNote = async () => {
    if (!editingNote) return;

    const updatedNote: TeamNote = {
      ...editingNote,
      updatedAt: new Date().toISOString()
    };

    const previousNotes = [...notes];
    setNotes(prev => prev.map(n => n.id === editingNote.id ? updatedNote : n));
    setEditingNote(null);

    try {
      setIsSaving(true);
      await upsertTeamNote(updatedNote, user?.id);
    } catch (err) {
      console.error('Failed to update note:', err);
      setNotes(previousNotes);
      alert(`Failed to update note: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteNote = async (note: TeamNote) => {
    if (!confirm(`Delete note "${note.title}"?`)) return;

    const previousNotes = [...notes];
    setNotes(prev => prev.filter(n => n.id !== note.id));

    try {
      setIsSaving(true);
      await dbDeleteTeamNote(note.id);
    } catch (err) {
      console.error('Failed to delete note:', err);
      setNotes(previousNotes);
      alert(`Failed to delete note: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTogglePin = async (note: TeamNote) => {
    const updatedNote: TeamNote = {
      ...note,
      isPinned: !note.isPinned,
      updatedAt: new Date().toISOString()
    };

    const previousNotes = [...notes];
    setNotes(prev => prev.map(n => n.id === note.id ? updatedNote : n));

    try {
      await upsertTeamNote(updatedNote, user?.id);
    } catch (err) {
      console.error('Failed to toggle pin:', err);
      setNotes(previousNotes);
    }
  };

  // ============ FILTERING ============
  const filteredNotes = useMemo(() => {
    let items = [...notes];
    if (filterCategory !== 'all') {
      items = items.filter(n => n.category === filterCategory);
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      items = items.filter(n =>
        n.title.toLowerCase().includes(term) ||
        n.content.toLowerCase().includes(term) ||
        n.category.toLowerCase().includes(term)
      );
    }
    // Pinned first, then by updated date
    items.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
    return items;
  }, [notes, filterCategory, searchTerm]);

  const stats = useMemo(() => ({
    total: notes.length,
    pinned: notes.filter(n => n.isPinned).length,
    categories: [...new Set(notes.map(n => n.category))].length
  }), [notes]);

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      'General': 'bg-slate-500/20 text-slate-400',
      'Safety': 'bg-red-500/20 text-red-400',
      'Engine': 'bg-orange-500/20 text-orange-400',
      'Drivetrain': 'bg-yellow-500/20 text-yellow-400',
      'Suspension': 'bg-green-500/20 text-green-400',
      'Electronics': 'bg-blue-500/20 text-blue-400',
      'Race Strategy': 'bg-purple-500/20 text-purple-400',
      'Setup Notes': 'bg-cyan-500/20 text-cyan-400',
      'Travel': 'bg-teal-500/20 text-teal-400',
      'Sponsor': 'bg-pink-500/20 text-pink-400',
      'Meeting Notes': 'bg-indigo-500/20 text-indigo-400'
    };
    return colors[category] || 'bg-slate-500/20 text-slate-400';
  };

  return (
    <section className="py-8 px-4">
      <div className="max-w-[1920px] mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
              <FileText className="w-7 h-7 text-orange-500" />
              Team Notes
              {isSaving && <Loader2 className="w-5 h-5 text-orange-400 animate-spin" />}
            </h2>
            <p className="text-slate-400">Shared notes, meeting minutes, and team documentation</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={loadNotes}
              disabled={isLoading}
              className="flex items-center gap-2 px-3 py-2 bg-slate-700/50 text-slate-400 rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-50"
              title="Refresh from database"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-lg font-medium hover:from-orange-600 hover:to-red-700 transition-all"
            >
              <Plus className="w-5 h-5" />
              Add Note
            </button>
          </div>
        </div>

        {/* Load Error */}
        {loadError && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-red-400 font-medium">Failed to load notes</p>
              <p className="text-red-400/70 text-sm">{loadError}</p>
            </div>
            <button onClick={loadNotes} className="px-3 py-1.5 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 text-sm">
              Retry
            </button>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
            <p className="text-slate-400 text-sm">Total Notes</p>
            <p className="text-2xl font-bold text-white">{stats.total}</p>
          </div>
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
            <p className="text-slate-400 text-sm">Pinned</p>
            <p className="text-2xl font-bold text-orange-400">{stats.pinned}</p>
          </div>
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
            <p className="text-slate-400 text-sm">Categories</p>
            <p className="text-2xl font-bold text-blue-400">{stats.categories}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search notes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg pl-10 pr-4 py-2 text-white placeholder-slate-400"
              />
            </div>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
            >
              <option value="all">All Categories</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-12 text-center">
            <Loader2 className="w-10 h-10 text-orange-500 mx-auto mb-4 animate-spin" />
            <p className="text-slate-400">Loading notes from database...</p>
          </div>
        )}

        {/* Notes List */}
        {!isLoading && (
          <div className="space-y-3">
            {filteredNotes.length === 0 ? (
              <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-8 text-center">
                <FileText className="w-12 h-12 text-slate-500 mx-auto mb-3" />
                <p className="text-slate-400">
                  {notes.length === 0 ? 'No notes yet' : 'No notes match your search'}
                </p>
                <p className="text-sm text-slate-500 mt-1">
                  {notes.length === 0 ? 'Add your first note to get started' : 'Try adjusting your filters'}
                </p>
                {notes.length === 0 && (
                  <button
                    onClick={() => setShowAddModal(true)}
                    className="mt-4 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
                  >
                    Add Your First Note
                  </button>
                )}
              </div>
            ) : (
              filteredNotes.map(note => (
                <div
                  key={note.id}
                  className={`bg-slate-800/50 rounded-xl border p-4 transition-all ${
                    note.isPinned ? 'border-orange-500/30' : 'border-slate-700/50'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-2">
                          {note.isPinned && <Pin className="w-4 h-4 text-orange-400 flex-shrink-0" />}
                          <h3 className="font-medium text-white">{note.title}</h3>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${getCategoryColor(note.category)}`}>
                            {note.category}
                          </span>
                        </div>
                      </div>

                      {/* Content preview or full */}
                      {note.content && (
                        <div className="mt-2">
                          <p className={`text-sm text-slate-400 whitespace-pre-wrap ${
                            expandedNote === note.id ? '' : 'line-clamp-3'
                          }`}>
                            {note.content}
                          </p>
                          {note.content.length > 200 && (
                            <button
                              onClick={() => setExpandedNote(expandedNote === note.id ? null : note.id)}
                              className="text-xs text-orange-400 hover:text-orange-300 mt-1"
                            >
                              {expandedNote === note.id ? 'Show less' : 'Show more'}
                            </button>
                          )}
                        </div>
                      )}

                      {/* Meta */}
                      <div className="flex flex-wrap items-center gap-4 mt-3 text-sm">
                        {note.createdBy && (
                          <span className="text-slate-500 flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {note.createdBy}
                          </span>
                        )}
                        <span className="text-slate-500 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(note.updatedAt).toLocaleDateString()} {new Date(note.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => handleTogglePin(note)}
                        className={`p-2 rounded-lg transition-colors ${
                          note.isPinned
                            ? 'bg-orange-500/20 text-orange-400 hover:bg-orange-500/30'
                            : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700'
                        }`}
                        title={note.isPinned ? 'Unpin' : 'Pin'}
                      >
                        {note.isPinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => setEditingNote(note)}
                        className="p-2 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteNote(note)}
                        className="p-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {(showAddModal || editingNote) && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl max-w-lg w-full p-6 border border-slate-700 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">
                {editingNote ? 'Edit Note' : 'Add New Note'}
              </h3>
              <button
                onClick={() => { setShowAddModal(false); setEditingNote(null); }}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Title *</label>
                <input
                  type="text"
                  value={editingNote?.title || newNote.title}
                  onChange={(e) => editingNote
                    ? setEditingNote({ ...editingNote, title: e.target.value })
                    : setNewNote({ ...newNote, title: e.target.value })
                  }
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  placeholder="Note title"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Content</label>
                <textarea
                  value={editingNote?.content || newNote.content}
                  onChange={(e) => editingNote
                    ? setEditingNote({ ...editingNote, content: e.target.value })
                    : setNewNote({ ...newNote, content: e.target.value })
                  }
                  rows={8}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  placeholder="Write your note here..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Category</label>
                  <select
                    value={editingNote?.category || newNote.category}
                    onChange={(e) => editingNote
                      ? setEditingNote({ ...editingNote, category: e.target.value })
                      : setNewNote({ ...newNote, category: e.target.value })
                    }
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  >
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-slate-400 mb-1">Author</label>
                  <select
                    value={editingNote?.createdBy || newNote.createdBy}
                    onChange={(e) => editingNote
                      ? setEditingNote({ ...editingNote, createdBy: e.target.value })
                      : setNewNote({ ...newNote, createdBy: e.target.value })
                    }
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  >
                    <option value="">Select author</option>
                    <option value={currentRole}>{currentRole}</option>
                    {teamMembers.map(m => (
                      <option key={m.id} value={m.name}>{m.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => editingNote
                    ? setEditingNote({ ...editingNote, isPinned: !editingNote.isPinned })
                    : setNewNote({ ...newNote, isPinned: !newNote.isPinned })
                  }
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                    (editingNote?.isPinned || newNote.isPinned)
                      ? 'bg-orange-500/20 text-orange-400'
                      : 'bg-slate-700 text-slate-400'
                  }`}
                >
                  <Pin className="w-4 h-4" />
                  {(editingNote?.isPinned || newNote.isPinned) ? 'Pinned' : 'Pin this note'}
                </button>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { setShowAddModal(false); setEditingNote(null); }}
                className="flex-1 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600"
              >
                Cancel
              </button>
              <button
                onClick={editingNote ? handleEditNote : handleAddNote}
                disabled={!(editingNote?.title || newNote.title) || isSaving}
                className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                {editingNote ? 'Save Changes' : 'Add Note'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default TeamNotes;
