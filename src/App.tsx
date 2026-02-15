import React from 'react';
import { ProjectProvider, useProjectStore } from './stores/projectStore';
import { UIProvider, useUIStore } from './stores/uiStore';
import { ThemeProvider } from './contexts/ThemeContext';

// Views
import { DashboardView } from './components/Dashboard/DashboardView';
import { EditorView } from './components/Editor/EditorView';

// Modals
import { BuildingModal } from './components/Modals/BuildingModals';
import { StructuralManagerModal } from './components/Modals/StructuralManagerModal';
import { RoomManagerModal } from './components/Modals/RoomManagerModal';

const AppLayout = () => {
    const { activeView, activeModal, activeModalUnitId, closeModal } = useUIStore();
    const { units, structuralUnits, buildingStats, setBuildingStats, isFetchingHeat, updateUnit, costs, updateCostItem } = useProjectStore();

    // Helper to find unit for modals
    const getModalUnit = () => {
        if (!activeModalUnitId) return null;
        return units.find(u => u.id === activeModalUnitId) || structuralUnits.find(u => u.id === activeModalUnitId);
    };
    
    const modalUnit = getModalUnit();

    return (
        <>
            {activeView === 'dashboard' ? <DashboardView /> : <EditorView />}

            {/* Global Modals Controlled by UI Store */}
            {activeModal === 'building' && (
                <BuildingModal 
                    onClose={closeModal}
                    buildingStats={buildingStats}
                    setBuildingStats={setBuildingStats}
                    handleProvinceChange={(e) => setBuildingStats({...buildingStats, province: e.target.value})} // Simplified for brevity, logic in store ideally
                    handleDistrictChange={(e) => setBuildingStats({...buildingStats, district: e.target.value})}
                    isFetchingHeat={isFetchingHeat}
                />
            )}

            {activeModal === 'structuralManager' && modalUnit && (
                <StructuralManagerModal
                    unit={modalUnit}
                    onClose={closeModal}
                    onUpdateUnit={updateUnit}
                />
            )}

            {activeModal === 'roomManager' && modalUnit && (
                <RoomManagerModal
                    unit={modalUnit}
                    onClose={closeModal}
                    onUpdateUnit={updateUnit}
                    costs={costs}
                    buildingStats={buildingStats}
                    onUpdateCostItem={updateCostItem}
                />
            )}
        </>
    );
};

export const App = () => {
    return (
        <ThemeProvider>
            <ProjectProvider>
                <UIProvider>
                    <AppLayout />
                </UIProvider>
            </ProjectProvider>
        </ThemeProvider>
    );
};