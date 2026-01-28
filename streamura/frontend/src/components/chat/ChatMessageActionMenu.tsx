import { useState, useRef, useEffect } from 'react';
import { MoreVertical, Trash2, Ban, Clock } from 'lucide-react';

interface ChatMessageActionMenuProps {
    isOwner: boolean;
    isAdmin: boolean;
    isModerator?: boolean; // Future proofing
    canDelete: boolean;
    onDelete: () => void;
    onTimeout: () => void;
    onBan: () => void;
}

export function ChatMessageActionMenu({
    isOwner,
    isAdmin,
    isModerator = false,
    canDelete,
    onDelete,
    onTimeout,
    onBan
}: ChatMessageActionMenuProps) {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    const canModerate = isOwner || isAdmin || isModerator;

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    if (!canModerate && !canDelete) return null;

    return (
        <div className="relative group/menu" ref={menuRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="opacity-0 group-hover:opacity-100 group-hover/menu:opacity-100 p-1 rounded hover:bg-slate-600 transition-opacity text-slate-400 hover:text-white"
                title="Message actions"
            >
                <MoreVertical className="w-3.5 h-3.5" />
            </button>

            {isOpen && (
                <div className="absolute right-0 bottom-full mb-1 w-36 bg-slate-800 border border-slate-700 rounded shadow-xl z-50 py-1 overflow-hidden">
                    {canModerate && (
                        <>
                            <button
                                onClick={() => {
                                    onTimeout();
                                    setIsOpen(false);
                                }}
                                className="w-full text-left px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700 hover:text-yellow-400 flex items-center gap-2"
                            >
                                <Clock className="w-3.5 h-3.5" />
                                Timeout
                            </button>
                            <button
                                onClick={() => {
                                    onBan();
                                    setIsOpen(false);
                                }}
                                className="w-full text-left px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700 hover:text-red-400 flex items-center gap-2"
                            >
                                <Ban className="w-3.5 h-3.5" />
                                Ban User
                            </button>
                            <div className="my-1 border-t border-slate-700 mx-1" />
                        </>
                    )}

                    {canDelete && (
                        <button
                            onClick={() => {
                                onDelete();
                                setIsOpen(false);
                            }}
                            className="w-full text-left px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700 hover:text-red-400 flex items-center gap-2"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                            Delete
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
