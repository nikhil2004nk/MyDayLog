import { useState } from 'react';

export type Task = {
  id: string;
  title: string;
  done: boolean;
  notes?: string;
};

export default function DailyTasks({ k, tasks, onToggle, onRemove, onEditNotes, onRename, onReorder, selectedIds, onToggleSelect, selectMode, onSelectAll }: { k: string; tasks: Task[]; onToggle: (k: string, id: string) => void; onRemove: (k: string, id: string) => void; onEditNotes: (k: string, id: string) => void; onRename: (k: string, id: string, title: string) => void; onReorder: (k: string, fromIndex: number, toIndex: number) => void; selectedIds: string[]; onToggleSelect: (id: string) => void; selectMode: boolean; onSelectAll: (ids: string[], checked: boolean) => void; }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const startEdit = (id: string, current: string) => {
    setEditingId(id);
    setDraft(current);
  };
  const commit = (id: string) => {
    const title = draft.trim();
    if (title) onRename(k, id, title);
    setEditingId(null);
  };
  const cancel = () => setEditingId(null);

  return (
    <div className="space-y-2">
      {selectMode && (
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {(() => {
            const allSelected = tasks.length > 0 && selectedIds.length === tasks.length;
            const someSelected = selectedIds.length > 0 && !allSelected;
            return (
              <input
                type="checkbox"
                checked={allSelected}
                ref={(el) => { if (el) el.indeterminate = someSelected; }}
                onChange={(e) => onSelectAll(tasks.map(t => t.id), e.target.checked)}
                title="Select All"
              />
            );
          })()}
          <span>Select All</span>
        </div>
      )}
      {tasks.length === 0 && <div className="text-sm text-gray-500 dark:text-gray-400">No tasks yet.</div>}
      {tasks.map((t, idx) => (
        <div
          key={t.id}
          className={`flex items-center justify-between border rounded px-3 py-2 dark:border-gray-700 ${dragIndex === idx ? 'opacity-60' : ''}`}
          draggable
          onDragStart={(e) => {
            setDragIndex(idx);
            try {
              e.dataTransfer.setData('application/json', JSON.stringify({ fromKey: k, taskId: t.id }));
            } catch {}
          }}
          onDragOver={(e) => { e.preventDefault(); }}
          onDrop={() => {
            if (dragIndex === null || dragIndex === idx) return;
            onReorder(k, dragIndex, idx);
            setDragIndex(null);
          }}
          onDragEnd={() => setDragIndex(null)}
        >
          <div className="flex items-center gap-2">
            {selectMode ? (
              <input type="checkbox" checked={selectedIds.includes(t.id)} onChange={() => onToggleSelect(t.id)} title="Select" />
            ) : (
              <input type="checkbox" checked={t.done} onChange={() => onToggle(k, t.id)} title="Done" />
            )}
            {editingId === t.id ? (
              <input
                className="border rounded px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-800"
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={() => commit(t.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commit(t.id);
                  if (e.key === 'Escape') cancel();
                }}
              />
            ) : (
              <button
                className={`text-left ${t.done ? 'line-through text-gray-500 dark:text-gray-400' : ''}`}
                onClick={() => startEdit(t.id, t.title)}
                title="Click to edit title"
              >
                {t.title}
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button className="text-sm" title={t.notes ? 'Edit notes' : 'Add notes'} onClick={() => onEditNotes(k, t.id)}>📝</button>
            <button className="text-red-600 text-sm" onClick={() => onRemove(k, t.id)}>Remove</button>
          </div>
        </div>
      ))}
    </div>
  );
}
