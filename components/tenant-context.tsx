"use client";

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";

interface TenantContextValue {
  currentTenantId: string | null;
  setCurrentTenantId: (id: string | null) => void;
  refreshKey: number;
  triggerRefresh: () => void;
}

const TenantContext = createContext<TenantContextValue | null>(null);

interface TenantProviderProps {
  children: React.ReactNode;
  initialTenantId: string | null;
}

export function TenantProvider({ children, initialTenantId }: TenantProviderProps) {
  const [currentTenantId, setCurrentTenantId] = useState<string | null>(initialTenantId);
  const [refreshKey, setRefreshKey] = useState(0);

  // Update state when prop changes (e.g., after router.refresh())
  useEffect(() => {
    setCurrentTenantId(initialTenantId);
  }, [initialTenantId]);

  const triggerRefresh = useCallback(() => {
    setRefreshKey(prev => prev + 1);
  }, []);

  const handleSetTenantId = useCallback((id: string | null) => {
    setCurrentTenantId(id);
    // Trigger refresh for all subscribed components
    setRefreshKey(prev => prev + 1);
  }, []);

  return (
    <TenantContext.Provider
      value={{
        currentTenantId,
        setCurrentTenantId: handleSetTenantId,
        refreshKey,
        triggerRefresh,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error("useTenant must be used within a TenantProvider");
  }
  return context;
}

export function useTenantRefresh(callback: () => void) {
  const { refreshKey } = useTenant();
  const callbackRef = useRef(callback);
  
  // Keep callback ref up to date
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);
  
  useEffect(() => {
    // Skip initial mount (refreshKey starts at 0)
    if (refreshKey > 0) {
      callbackRef.current();
    }
  }, [refreshKey]);
}
