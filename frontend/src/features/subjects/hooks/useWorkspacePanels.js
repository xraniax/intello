import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useMaterialStore } from '@/store/useMaterialStore';
import { MaterialService } from '@/services/MaterialService';
import toast from 'react-hot-toast';

/**
 * useWorkspacePanels
 * Owns: tabs, activeTab, selection, upload modal, delete modal, panel collapse.
 * Depends on: subjectId (for localStorage keys), materials (for enhancedTabs).
 */
export const useWorkspacePanels = ({ subjectId, materials }) => {
    const fetchMaterials = useMaterialStore(s => s.actions.fetchMaterials);
    const clearMaterialMetadata = useMaterialStore(s => s.actions.clearMaterialMetadata);
    const clearAllMaterialMetadata = useMaterialStore(s => s.actions.clearAllMaterialMetadata);

    const savedTabsKey    = `cognify_tabs_${subjectId}`;
    const savedActiveKey  = `cognify_active_tab_${subjectId}`;

    // ── Tabs ──────────────────────────────────────────────────────────────────
    const [tabs, setTabs] = useState(() => {
        const base = { id: 'generator', title: 'Study Intelligence', type: 'generator', pinned: true };
        try {
            const saved = localStorage.getItem(savedTabsKey);
            if (saved) {
                const parsed = JSON.parse(saved);
                return [base, ...parsed.filter(t => t.id !== 'generator')];
            }
        } catch { /* corrupt storage — start fresh */ }
        return [base];
    });

    const [activeTabId, setActiveTabId] = useState(
        () => localStorage.getItem(savedActiveKey) || 'generator'
    );

    useEffect(() => {
        localStorage.setItem(savedTabsKey, JSON.stringify(tabs));
    }, [tabs, savedTabsKey]);

    useEffect(() => {
        if (activeTabId) localStorage.setItem(savedActiveKey, activeTabId);
    }, [activeTabId, savedActiveKey]);

    const enhancedTabs = useMemo(() => tabs.map(tab => {
        if (tab.id === 'generator') return { ...tab, isDeleted: false };
        const material = (materials || []).find(m => String(m.id) === String(tab.id));
        return {
            ...tab,
            isDeleted: !material,
            material: material || tab.material
        };
    }), [tabs, materials]);

    // ── Global Tab Open Listener ──────────────────────────────────────────────
    useEffect(() => {
        const openTab = (material, id, type, page) => {
            setTabs(prev => {
                const existing = prev.find(t => String(t.id) === String(id));
                if (existing) {
                    return prev.map(t => String(t.id) === String(id) ? { ...t, requestedPage: page } : t);
                }
                return [...prev, { id: String(id), title: material.title, type, material, requestedPage: page }];
            });
            setActiveTabId(String(id));
        };

        const handleOpen = async (e) => {
            const { id, type, page } = e.detail;
            let material = (materials || []).find(m => String(m.id) === String(id));
            if (!material) {
                const refreshed = await fetchMaterials().catch(() => []);
                material = (refreshed || []).find(m => String(m.id) === String(id));
            }
            if (!material) return;
            openTab(material, id, type, page);
        };
        window.addEventListener('open-material', handleOpen);
        return () => window.removeEventListener('open-material', handleOpen);
    }, [materials, fetchMaterials, setTabs, setActiveTabId]);

    // ── Selection ─────────────────────────────────────────────────────────────
    const [selectedUploads, setSelectedUploads] = useState([]);

    const toggleSelection = useCallback((mid) => {
        setSelectedUploads(prev => {
            const isAdding = !prev.includes(mid);
            if (isAdding) setActiveTabId('generator');
            return isAdding ? [...prev, mid] : prev.filter(id => id !== mid);
        });
    }, []);

    // ── Upload modal ──────────────────────────────────────────────────────────
    const [showUploadModal, setShowUploadModal] = useState(false);

    const handleUploadSuccess = useCallback(async () => {
        await fetchMaterials();
        setShowUploadModal(false);
    }, [fetchMaterials]);

    // ── Rename material ───────────────────────────────────────────────────────
    const handleRenameMaterial = useCallback(async (materialId, newTitle) => {
        if (!newTitle.trim()) return;
        const updateMaterialOptimistically = useMaterialStore.getState().actions.updateMaterialOptimistically;
        try {
            // optimistically update locally
            updateMaterialOptimistically(materialId, { title: newTitle.trim() });
            setTabs(prev => prev.map(tab => 
                String(tab.id) === String(materialId) 
                    ? { ...tab, title: newTitle.trim(), material: { ...tab.material, title: newTitle.trim() } } 
                    : tab
            ));
            
            // send to backend
            await MaterialService.rename(materialId, newTitle.trim());
            toast.success('Renamed successfully');
        } catch {
            // revert optimism by refetching
            fetchMaterials();
            toast.error('Failed to rename material');
        }
    }, [fetchMaterials]);

    // ── Delete modal ──────────────────────────────────────────────────────────
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalConfig, setModalConfig] = useState({});

    const handleDeleteUpload = useCallback((materialId, materialName) => {
        setModalConfig({
            title: 'Move to Trash?',
            message: `Are you sure you want to move "${materialName || 'this file'}" to the trash? It will be archived and can be recovered later.`,
            type: 'warning',
            confirmText: 'Move to Trash',
            onConfirm: async () => {
                try {
                    await MaterialService.delete(materialId);
                    clearMaterialMetadata(materialId);
                    await fetchMaterials();
                    setSelectedUploads(prev => prev.filter(id => id !== materialId));
                    toast.success('Document removed');
                } catch {
                    toast.error('Failed to delete material');
                } finally {
                    setIsModalOpen(false);
                }
            },
        });
        setIsModalOpen(true);
    }, [fetchMaterials]);

    // ── Panel visibility ──────────────────────────────────────────────────────
    const [filePanelCollapsed, setFilePanelCollapsed] = useState(false);

    // ── Expose a stable tabs ref for cross-hook async reads ──────────────────
    const tabsRef = useRef([]);
    useEffect(() => { tabsRef.current = tabs; }, [tabs]);

    // ── Lifecycle Cleanup ────────────────────────────────────────────────────────
    useEffect(() => {
        return () => {
            // Optional: clear UI transient state on workspace unmount
            clearAllMaterialMetadata(); 
        };
    }, [clearAllMaterialMetadata]);

    return {
        // Tabs
        tabs: enhancedTabs,
        setTabs,
        tabsRef,
        activeTabId,
        setActiveTabId,
        // Selection
        selectedUploads,
        setSelectedUploads,
        toggleSelection,
        // Upload modal
        showUploadModal,
        setShowUploadModal,
        handleUploadSuccess,
        handleRenameMaterial,
        // Delete modal
        isModalOpen,
        setIsModalOpen,
        modalConfig,
        handleDeleteUpload,
        // Panel visibility
        filePanelCollapsed,
        setFilePanelCollapsed,
    };
};
