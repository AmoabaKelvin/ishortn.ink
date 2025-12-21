"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";

interface SelectionContextType {
  selectedLinkIds: number[];
  isSelectionMode: boolean;
  toggleSelection: (linkId: number) => void;
  selectAll: (linkIds: number[]) => void;
  clearSelection: () => void;
  isSelected: (linkId: number) => boolean;
  enterSelectionMode: () => void;
  exitSelectionMode: () => void;
}

const SelectionContext = createContext<SelectionContextType | undefined>(
  undefined
);

export function SelectionProvider({ children }: { children: ReactNode }) {
  const [selectedLinkIds, setSelectedLinkIds] = useState<number[]>([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  const toggleSelection = useCallback((linkId: number) => {
    // Auto-enter selection mode when first item is selected
    setIsSelectionMode(true);
    setSelectedLinkIds((prev) =>
      prev.includes(linkId)
        ? prev.filter((id) => id !== linkId)
        : [...prev, linkId]
    );
  }, []);

  const selectAll = useCallback((linkIds: number[]) => {
    setSelectedLinkIds(linkIds);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedLinkIds([]);
  }, []);

  const isSelected = useCallback(
    (linkId: number) => selectedLinkIds.includes(linkId),
    [selectedLinkIds]
  );

  const enterSelectionMode = useCallback(() => {
    setIsSelectionMode(true);
  }, []);

  const exitSelectionMode = useCallback(() => {
    setIsSelectionMode(false);
    setSelectedLinkIds([]);
  }, []);

  return (
    <SelectionContext.Provider
      value={{
        selectedLinkIds,
        isSelectionMode,
        toggleSelection,
        selectAll,
        clearSelection,
        isSelected,
        enterSelectionMode,
        exitSelectionMode,
      }}
    >
      {children}
    </SelectionContext.Provider>
  );
}

export function useSelection() {
  const context = useContext(SelectionContext);
  if (context === undefined) {
    throw new Error("useSelection must be used within a SelectionProvider");
  }
  return context;
}
