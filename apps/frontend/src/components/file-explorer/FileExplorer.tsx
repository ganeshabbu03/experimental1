import { useState, useRef, useEffect } from 'react';
import { ChevronRight, ChevronDown, FilePlus, FolderPlus, FileText, RefreshCw, Layers, Copy, Scissors, Clipboard, Hash, Folder } from 'lucide-react';
import { DndContext, useDraggable, useDroppable, DragOverlay, type DragStartEvent, type DragEndEvent, useSensor, useSensors, PointerSensor, closestCenter } from '@dnd-kit/core';
import { useFileStore, type FileNode } from '@/stores/useFileStore';
import { cn } from '@/utils/cn';
import FileOperationModal from './FileOperationModal';

interface ContextMenuPosition {
    x: number;
    y: number;
    nodeId: string | null;
}

interface FileTreeItemProps {
    node: FileNode;
    level: number;
    onContextMenu: (e: React.MouseEvent, nodeId: string) => void;
    renamingId: string | null;
    onRenameSubmit: (id: string, newName: string) => void;
    creationState: { parentId: string | null; type: 'file' | 'folder' } | null;
    onCreationSubmit: (parentId: string | null, name: string, type: 'file' | 'folder') => void;
    onCreationCancel: () => void;
    selectedId: string | null;
    onSelect: (id: string) => void;
}

interface CreationItemProps {
    type: 'file' | 'folder';
    level: number;
    onSubmit: (name: string) => void;
    onCancel: () => void;
}

// ... CreationItem component ...
const CreationItem = ({ type, level, onSubmit, onCancel }: CreationItemProps) => {
    const [name, setName] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    const indent = level * 12;

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            if (name.trim()) onSubmit(name);
            else onCancel();
        } else if (e.key === 'Escape') {
            onCancel();
        }
    };

    return (
        <div style={{ paddingLeft: `${indent + 8}px` }} className="flex items-center h-6 pr-2">
            <span className="mr-1 flex-shrink-0 w-4 p-0.5 opacity-0"></span>
            <span className="mr-1.5 flex-shrink-0 w-5 flex items-center justify-center">
                {type === 'folder' ? (
                    <Folder className="h-3.5 w-3.5 text-[var(--text-secondary)]" />
                ) : (
                    <FileText className="h-3.5 w-3.5 text-[var(--text-secondary)]" />
                )}
            </span>
            <input
                ref={inputRef}
                className="bg-[var(--bg-surface)] text-[var(--text-primary)] border border-orange-500 px-1 h-5 text-xs flex-1 outline-none"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => { if (name.trim()) onSubmit(name); else onCancel(); }}
                onKeyDown={handleKeyDown}
            />
        </div>
    );
};

// ... git/file icon helpers ...
const getGitStatus = (name: string) => {
    if (name.endsWith('.tsx')) return { type: 'M', color: 'text-orange-400' };
    if (name.endsWith('.ts')) return { type: 'M', color: 'text-orange-400' };
    if (name.endsWith('.md')) return { type: 'U', color: 'text-green-400' };
    return null;
};

const getFileIcon = (name: string) => {
    if (name.endsWith('.tsx')) return <span className="text-blue-400 text-[10px] font-medium">TSX</span>;
    if (name.endsWith('.ts')) return <span className="text-blue-400 text-[10px] font-medium">TS</span>;
    if (name.endsWith('.css')) return <Hash className="h-3.5 w-3.5 text-purple-400" />;
    if (name.endsWith('.json')) return <span className="text-yellow-400 text-[10px] font-medium">{'{}'}</span>;
    if (name.endsWith('.md')) return <span className="text-[var(--text-secondary)] text-[10px] font-medium">MD</span>;
    return <FileText className="h-3.5 w-3.5 text-[var(--text-secondary)]" />;
};

const FileTreeItem = ({ node, level, onContextMenu, renamingId, onRenameSubmit, creationState, onCreationSubmit, onCreationCancel, selectedId, onSelect }: FileTreeItemProps) => {
    const { toggleFolder, openFile } = useFileStore();
    const [editName, setEditName] = useState(node.name);
    const inputRef = useRef<HTMLInputElement>(null);
    const indent = level * 12;

    const { attributes, listeners, setNodeRef: setDraggableRef, isDragging } = useDraggable({
        id: node.id,
        data: node
    });

    const { setNodeRef: setDroppableRef, isOver } = useDroppable({
        id: node.id,
        data: node
    });

    const style = {
        opacity: isDragging ? 0.4 : 1,
    };

    useEffect(() => {
        if (renamingId === node.id) {
            setEditName(node.name);
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [renamingId, node.id, node.name]);

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onSelect(node.id);
        if (node.type === 'folder') {
            toggleFolder(node.id);
        } else {
            openFile(node.id);
        }
    };

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        onContextMenu(e, node.id);
    };

    const isSelected = selectedId === node.id;
    const isRenaming = renamingId === node.id;
    const gitStatus = getGitStatus(node.name);

    return (
        <div
            ref={setDroppableRef}
            className={cn("select-none text-xs", isOver && node.type === 'folder' && "bg-orange-500/10 rounded")}
        >
            <div
                ref={setDraggableRef}
                {...attributes}
                {...listeners}
                style={{ ...style, paddingLeft: `${indent + 8}px` }}
                className={cn(
                    "flex items-center h-7 pr-2 cursor-pointer transition-all duration-300 group relative border-l-2",
                    isSelected && !isRenaming ? "bg-white/5 border-orange-500 text-[var(--text-primary)] shadow-sm backdrop-blur-sm" : "border-transparent text-[var(--text-secondary)] hover:bg-white/5 hover:text-[var(--text-primary)]",
                    isOver && node.type === 'folder' && "outline outline-1 outline-orange-500 rounded-sm"
                )}
                onClick={handleClick}
                onContextMenu={handleContextMenu}
            >
                {/* Arrow */}
                <span
                    className={cn("mr-1 flex-shrink-0 w-4 hover:bg-[var(--bg-surface-hover)] p-0.5 rounded", node.type !== 'folder' && "opacity-0")}
                    onPointerDown={(e) => e.stopPropagation()} // Prevent drag when clicking arrow
                    onClick={(e) => { e.stopPropagation(); toggleFolder(node.id); }}
                >
                    {node.isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                </span>

                {/* Icon */}
                <span className="mr-1.5 flex-shrink-0 w-5 flex items-center justify-center">
                    {node.type === 'folder' ? (
                        <Folder className={cn("h-3.5 w-3.5", node.isOpen ? "text-orange-400" : "text-[var(--text-secondary)]")} />
                    ) : (
                        getFileIcon(node.name)
                    )}
                </span>

                {/* Name */}
                {isRenaming ? (
                    <input
                        ref={inputRef}
                        className="bg-[var(--bg-surface)] text-[var(--text-primary)] border border-orange-500 px-1 h-5 text-xs flex-1 outline-none"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onBlur={() => onRenameSubmit(node.id, editName)}
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.key === 'Enter' && onRenameSubmit(node.id, editName)}
                        onPointerDown={(e) => e.stopPropagation()} // Prevent drag input
                    />
                ) : (
                    <span className="truncate flex-1">{node.name}</span>
                )}

                {/* Git Status */}
                {!isRenaming && gitStatus && (
                    <span className={cn("ml-2 text-[10px] font-medium", gitStatus.color)}>
                        {gitStatus.type}
                    </span>
                )}
            </div>

            {node.type === 'folder' && node.isOpen && node.children && (
                <div className="relative">
                    <div className="absolute left-[13px] top-0 bottom-0 w-[1px] bg-gradient-to-b from-transparent via-white/5 to-transparent pointer-events-none" />
                    <div>
                        {creationState && creationState.parentId === node.id && (
                            <CreationItem
                                type={creationState.type}
                                level={level + 1}
                                onSubmit={(name) => onCreationSubmit(node.id, name, creationState.type)}
                                onCancel={onCreationCancel}
                            />
                        )}
                        {node.children.map((child) => (
                            <FileTreeItem
                                key={child.id}
                                node={child}
                                level={level + 1}
                                onContextMenu={onContextMenu}
                                renamingId={renamingId}
                                onRenameSubmit={onRenameSubmit}
                                creationState={creationState}
                                onCreationSubmit={onCreationSubmit}
                                onCreationCancel={onCreationCancel}
                                selectedId={selectedId}
                                onSelect={onSelect}
                            />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default function FileExplorer() {
    const { files, createFile, deleteNode, renameNode, collapseAllFolders, copyNode, cutNode, pasteNode, projectName, moveNode, activeFileId } = useFileStore();
    const [contextMenu, setContextMenu] = useState<ContextMenuPosition | null>(null);
    const [renamingId, setRenamingId] = useState<string | null>(null);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [activeDragId, setActiveDragId] = useState<string | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [selectedId, setSelectedId] = useState<string | null>(null);

    // Sync activeFileId to selectedId when it changes (e.g. switching tabs), but only if it's a file
    useEffect(() => {
        if (activeFileId) setSelectedId(activeFileId);
    }, [activeFileId]);

    // ... (Modal State)
    const [modalOpen, setModalOpen] = useState(false);
    const [modalType, setModalType] = useState<'delete'>('delete');
    const [targetNodeId, setTargetNodeId] = useState<string | null>(null);
    const [itemTypeForDelete, setItemTypeForDelete] = useState<'file' | 'folder'>('file');
    const [deleteName, setDeleteName] = useState('');

    // Creation State
    const [creationState, setCreationState] = useState<{ parentId: string | null; type: 'file' | 'folder' } | null>(null);

    // ... (Dnd Sensors)
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8, // Require drag of 8px to start
            },
        })
    );

    // ... (Drag Handlers)
    const handleDragStart = (event: DragStartEvent) => {
        setActiveDragId(event.active.id as string);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveDragId(null);

        if (over && active.id !== over.id) {
            moveNode(active.id as string, over.id as string);
        }
    };

    const getDragOverlayItem = () => {
        if (!activeDragId) return null;
        return (
            <div className="flex items-center px-4 py-2 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded shadow-xl opacity-90">
                <FileText className="h-4 w-4 mr-2" />
                <span className="text-sm">Moving...</span>
            </div>
        );
    };

    useEffect(() => {
        const handleClick = () => setContextMenu(null);
        document.addEventListener('click', handleClick);
        return () => document.removeEventListener('click', handleClick);
    }, []);

    const handleContextMenu = (e: React.MouseEvent, nodeId: string | null) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, nodeId });
        // Optional: Select on right click too?
        if (nodeId) setSelectedId(nodeId);
    };

    const handleAction = (action: 'newFile' | 'newFolder' | 'rename' | 'delete' | 'refresh' | 'collapse' | 'copy' | 'cut' | 'paste') => {
        const targetId = contextMenu?.nodeId || null;
        const rootId = files[0]?.id;

        // Helpers for finding node and parent
        const findNode = (nodes: FileNode[], id: string): FileNode | null => {
            for (const node of nodes) {
                if (node.id === id) return node;
                if (node.children) {
                    const found = findNode(node.children, id);
                    if (found) return found;
                }
            }
            return null;
        };

        const findParent = (nodes: FileNode[], targetId: string, parentId: string | null = null): string | null => {
            for (const node of nodes) {
                if (node.id === targetId) return parentId;
                if (node.children) {
                    const found = findParent(node.children, targetId, node.id);
                    if (found) return found;
                }
            }
            return null;
        };

        const getEffectiveParentId = (tId: string | null): string | null => {
            // If no context menu target, try selectedId (which could be a folder or file)
            let effectiveTargetId = tId;
            if (!effectiveTargetId && selectedId) {
                effectiveTargetId = selectedId;
            }

            if (!effectiveTargetId) return rootId; // No target and no selected item -> Root

            const node = findNode(files, effectiveTargetId);
            if (!node) return rootId;

            if (node.type === 'folder') {
                return node.id; // Target is folder -> Inside folder
            } else {
                // Target is file -> Inside its parent (sibling)
                return findParent(files, effectiveTargetId);
            }
        };

        switch (action) {
            case 'newFile':
                {
                    const effectiveParentId = getEffectiveParentId(targetId);
                    setCreationState({ parentId: effectiveParentId, type: 'file' });
                    if (effectiveParentId) useFileStore.getState().toggleFolder(effectiveParentId, true);
                }
                break;
            case 'newFolder':
                {
                    const effectiveParentId = getEffectiveParentId(targetId);
                    setCreationState({ parentId: effectiveParentId, type: 'folder' });
                    if (effectiveParentId) useFileStore.getState().toggleFolder(effectiveParentId, true);
                }
                break;
            case 'rename':
                if (targetId) setRenamingId(targetId);
                break;
            case 'delete':
                if (targetId) {
                    const node = findNode(files, targetId);
                    if (node) {
                        setTargetNodeId(targetId);
                        setDeleteName(node.name);
                        setItemTypeForDelete(node.type);
                        setModalType('delete');
                        setModalOpen(true);
                    }
                }
                break;
            case 'refresh':
                setIsRefreshing(true);
                setTimeout(() => setIsRefreshing(false), 700);
                break;
            case 'collapse':
                collapseAllFolders();
                break;
            case 'copy':
                if (targetId) copyNode(targetId);
                break;
            case 'cut':
                if (targetId) cutNode(targetId);
                break;
            case 'paste':
                // For paste, we also want to be smart. If pasting onto file -> paste into parent.
                {
                    const effectiveParentId = getEffectiveParentId(targetId);
                    pasteNode(effectiveParentId);
                }
                break;
        }
        setContextMenu(null);
    };

    const handleModalSubmit = (_: string) => {
        if (modalType === 'delete') {
            if (targetNodeId) deleteNode(targetNodeId);
        }
    };

    const handleCreationSubmit = (parentId: string | null, name: string, _: 'file' | 'folder') => {
        createFile(parentId, name);
        setCreationState(null);
    };

    const onRenameSubmit = (id: string, newName: string) => {
        if (newName && newName.trim()) renameNode(id, newName);
        setRenamingId(null);
    }

    const rootFiles = files[0]?.children || [];

    return (
        <div
            className="h-full bg-[var(--bg-surface)] flex flex-col relative"
            onContextMenu={(e) => handleContextMenu(e, null)}
            ref={containerRef}
        >
            {/* Project Header */}
            <div className="px-3 py-2 flex items-center justify-between text-xs text-[var(--text-secondary)] cursor-pointer hover:bg-[var(--bg-surface-hover)] group">
                <div className="flex items-center overflow-hidden">
                    <ChevronDown className="h-3 w-3 mr-1 flex-shrink-0" />
                    <span className="truncate font-medium">{projectName}</span>
                </div>

                <div className="flex items-center space-x-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button title="New File" onClick={(e) => { e.stopPropagation(); handleAction('newFile'); }} className="p-1 hover:bg-[var(--bg-surface-hover)] rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                        <FilePlus className="h-3.5 w-3.5" />
                    </button>
                    <button title="New Folder" onClick={(e) => { e.stopPropagation(); handleAction('newFolder'); }} className="p-1 hover:bg-[var(--bg-surface-hover)] rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                        <FolderPlus className="h-3.5 w-3.5" />
                    </button>
                    <button title="Refresh" onClick={(e) => { e.stopPropagation(); handleAction('refresh'); }} className="p-1 hover:bg-[var(--bg-surface-hover)] rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                        <RefreshCw className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")} />
                    </button>
                    <button title="Collapse All" onClick={(e) => { e.stopPropagation(); handleAction('collapse'); }} className="p-1 hover:bg-[var(--bg-surface-hover)] rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                        <Layers className="h-3.5 w-3.5" />
                    </button>
                </div>
            </div>

            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
            >
                <div className="flex-1 overflow-y-auto py-1">
                    {rootFiles.length === 0 && (
                        <div className="p-4 text-center text-[var(--text-secondary)] italic text-xs">
                            No files. Right click to create.
                        </div>
                    )}
                    {rootFiles.map((node) => (
                        <FileTreeItem
                            key={node.id}
                            node={node}
                            level={0}
                            onContextMenu={handleContextMenu}
                            renamingId={renamingId}
                            onRenameSubmit={onRenameSubmit}
                            creationState={creationState}
                            onCreationSubmit={handleCreationSubmit}
                            onCreationCancel={() => setCreationState(null)}
                            selectedId={selectedId}
                            onSelect={setSelectedId}
                        />
                    ))}
                    {/* Inline creation at root level */}
                    {creationState && (creationState.parentId === null || creationState.parentId === files[0]?.id) && (
                        <CreationItem
                            type={creationState.type}
                            level={0}
                            onSubmit={(name) => handleCreationSubmit(creationState.parentId, name, creationState.type)}
                            onCancel={() => setCreationState(null)}
                        />
                    )}
                </div>
                <DragOverlay>
                    {getDragOverlayItem()}
                </DragOverlay>
            </DndContext>

            {/* Context Menu */}
            {contextMenu && (
                <div
                    className="fixed bg-[var(--bg-surface)] border border-[var(--border-default)] rounded shadow-xl py-1 z-50 min-w-[140px]"
                    style={{ top: contextMenu.y, left: contextMenu.x }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <button className="w-full text-left px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)]" onClick={() => handleAction('newFile')}>
                        New File
                    </button>
                    <button className="w-full text-left px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)]" onClick={() => handleAction('newFolder')}>
                        New Folder
                    </button>

                    {contextMenu.nodeId && (
                        <>
                            <div className="h-px bg-[var(--border-default)] my-1" />
                            <button className="w-full text-left px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)] flex items-center" onClick={() => handleAction('cut')}>
                                <Scissors className="h-3 w-3 mr-2" /> Cut
                            </button>
                            <button className="w-full text-left px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)] flex items-center" onClick={() => handleAction('copy')}>
                                <Copy className="h-3 w-3 mr-2" /> Copy
                            </button>
                        </>
                    )}

                    <button className="w-full text-left px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)] flex items-center" onClick={() => handleAction('paste')}>
                        <Clipboard className="h-3 w-3 mr-2" /> Paste
                    </button>

                    {contextMenu.nodeId && (
                        <>
                            <div className="h-px bg-[var(--border-default)] my-1" />
                            <button className="w-full text-left px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)]" onClick={() => handleAction('rename')}>Rename</button>
                            <button className="w-full text-left px-3 py-1.5 text-xs text-red-500 hover:bg-[var(--bg-surface-hover)]" onClick={() => handleAction('delete')}>
                                Delete
                            </button>
                        </>
                    )}
                </div>
            )}


            <FileOperationModal
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                onSubmit={handleModalSubmit}
                type="delete"
                itemType={itemTypeForDelete}
                initialValue={deleteName}
            />
        </div>
    );
}
