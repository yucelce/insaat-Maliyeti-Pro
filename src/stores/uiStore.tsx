import React, { createContext, useContext, useState, useCallback } from 'react';

type ViewType = 'dashboard' | 'editor';
type ModalType = 'building' | 'structuralManager' | 'roomManager' | null;

interface UIContextType {
    activeView: ViewType;
    editorScope: 'architectural' | 'structural';
    activeUnitId: string | null;
    activeModal: ModalType;
    activeModalUnitId: string | null;
    
    // Actions
    navigateToDashboard: () => void;
    navigateToEditor: (unitId: string, scope: 'architectural' | 'structural') => void;
    openModal: (type: ModalType, unitId?: string | null) => void;
    closeModal: () => void;
    
    // Dashboard Specific
    expandedCategories: Record<string, boolean>;
    toggleCategory: (id: string) => void;
}

const UIContext = createContext<UIContextType | undefined>(undefined);

export const UIProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [activeView, setActiveView] = useState<ViewType>('dashboard');
    const [editorScope, setEditorScope] = useState<'architectural' | 'structural'>('architectural');
    const [activeUnitId, setActiveUnitId] = useState<string | null>(null);
    
    const [activeModal, setActiveModal] = useState<ModalType>(null);
    const [activeModalUnitId, setActiveModalUnitId] = useState<string | null>(null);
    
    const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

    const navigateToDashboard = useCallback(() => {
        setActiveView('dashboard');
        setActiveUnitId(null);
    }, []);

    const navigateToEditor = useCallback((unitId: string, scope: 'architectural' | 'structural') => {
        setActiveUnitId(unitId);
        setEditorScope(scope);
        setActiveView('editor');
    }, []);

    const openModal = useCallback((type: ModalType, unitId: string | null = null) => {
        setActiveModal(type);
        setActiveModalUnitId(unitId);
    }, []);

    const closeModal = useCallback(() => {
        setActiveModal(null);
        setActiveModalUnitId(null);
    }, []);

    const toggleCategory = useCallback((id: string) => {
        setExpandedCategories(prev => ({ ...prev, [id]: !prev[id] }));
    }, []);

    return (
        <UIContext.Provider value={{
            activeView, editorScope, activeUnitId, activeModal, activeModalUnitId,
            navigateToDashboard, navigateToEditor, openModal, closeModal,
            expandedCategories, toggleCategory
        }}>
            {children}
        </UIContext.Provider>
    );
};

export const useUIStore = () => {
    const context = useContext(UIContext);
    if (!context) throw new Error("useUIStore must be used within UIProvider");
    return context;
};