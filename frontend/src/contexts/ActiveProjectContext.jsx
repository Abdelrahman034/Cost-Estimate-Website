// contexts/ActiveProjectContext.jsx
//
// Tracks the currently active project across the app.
// Set when the user opens a project from ProjectDetailPage.
// The Sidebar reads this to append ?projectId= to all Estimating module links,
// so the user can navigate between modules without losing their project context.

import React, { createContext, useContext, useState } from 'react';

const ActiveProjectContext = createContext(null);

export function ActiveProjectProvider({ children }) {
  const [activeProject, setActiveProject] = useState(null); // { id, name } or null

  const clearActiveProject = () => setActiveProject(null);

  return (
    <ActiveProjectContext.Provider value={{ activeProject, setActiveProject, clearActiveProject }}>
      {children}
    </ActiveProjectContext.Provider>
  );
}

export function useActiveProject() {
  const ctx = useContext(ActiveProjectContext);
  if (!ctx) throw new Error('useActiveProject must be used inside ActiveProjectProvider');
  return ctx;
}
