import React, { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { GripVertical, RotateCcw, X, Wrench, FolderOpen, ChevronRight } from 'lucide-react';
import { NAV_SECTIONS, ROUTE_PATHS } from '@config/navigation';
import { useAuth } from '@contexts/AuthContext';
import { useActiveProject } from '@contexts/ActiveProjectContext';

const ORDER_STORAGE_KEY = 'sidebar_estimating_order';
const estimatingSection = NAV_SECTIONS.find((section) => section.title === 'Estimating');
const defaultEstimatingOrder = (estimatingSection?.items || []).map((item) => item.to);
const estimatingItemByRoute = new Map((estimatingSection?.items || []).map((item) => [item.to, item]));

function normalizeOrder(savedOrder) {
  const known = new Set(defaultEstimatingOrder);
  const ordered = Array.isArray(savedOrder) ? savedOrder.filter((to) => known.has(to)) : [];
  const missing = defaultEstimatingOrder.filter((to) => !ordered.includes(to));
  return [...ordered, ...missing];
}

function loadOrder() {
  try {
    return normalizeOrder(JSON.parse(localStorage.getItem(ORDER_STORAGE_KEY) || 'null'));
  } catch {
    return defaultEstimatingOrder;
  }
}

export default function Sidebar({ open, onClose }) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const { activeProject, clearActiveProject } = useActiveProject();
  const navigate = useNavigate();
  const [estimatingOrder, setEstimatingOrder] = useState(loadOrder);
  const [draggedRoute, setDraggedRoute] = useState(null);

  useEffect(() => {
    try {
      localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(estimatingOrder));
    } catch {}
  }, [estimatingOrder]);

  const moveRoute = (fromRoute, toRoute) => {
    if (!fromRoute || !toRoute || fromRoute === toRoute) return;
    setEstimatingOrder((current) => {
      const fromIndex = current.indexOf(fromRoute);
      const toIndex = current.indexOf(toRoute);
      if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return current;
      const next = [...current];
      next.splice(fromIndex, 1);
      next.splice(toIndex, 0, fromRoute);
      return next;
    });
  };

  const resetOrder = () => setEstimatingOrder(defaultEstimatingOrder);

  return (
    <>
      {/* Overlay (mobile) */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-20 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-30
          flex flex-col w-64 bg-gray-900 text-white
          transition-transform duration-200
          ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
              <Wrench size={16} className="text-white" />
            </div>
            <div>
              <div className="font-bold text-sm leading-tight">Mercury Control</div>
              <div className="text-xs text-gray-400">Estimation Tool</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden text-gray-400 hover:text-white p-1"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV_SECTIONS.map((section) => {
            // Filter out adminOnly items for non-admin users
            const visibleItems = section.items.filter(item => !item.adminOnly || isAdmin);
            if (visibleItems.length === 0) return null;
            return (
            <div key={section.title}>
              <div className="flex items-center justify-between gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wider px-3 mb-3 mt-5 first:mt-0">
                <span>{section.title}</span>
                {section.title === 'Estimating' && (
                  <button
                    type="button"
                    onClick={resetOrder}
                    className="flex items-center gap-1 rounded-md px-2 py-1 normal-case tracking-normal text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
                    title="Reset module order"
                  >
                    <RotateCcw size={12} />
                    Reset
                  </button>
                )}
              </div>
              {section.title === 'Estimating'
                ? <>
                    {/* Active project chip — shown when a project is selected */}
                    {activeProject ? (
                      <div className="mx-1 mb-2 px-3 py-2 bg-blue-600/20 border border-blue-500/30 rounded-lg">
                        <div className="flex items-center gap-2 min-w-0">
                          <FolderOpen size={13} className="text-blue-400 flex-shrink-0" />
                          <button
                            onClick={() => navigate(`/projects/${activeProject.id}`)}
                            className="flex-1 text-left text-xs font-semibold text-blue-300 truncate hover:text-white transition-colors"
                            title={activeProject.name}
                          >
                            {activeProject.name}
                          </button>
                          <button
                            onClick={clearActiveProject}
                            className="text-blue-500 hover:text-white flex-shrink-0 transition-colors"
                            title="Deselect project"
                          >
                            <X size={12} />
                          </button>
                        </div>
                        <div className="text-[10px] text-blue-500 mt-0.5 pl-5">Active project</div>
                      </div>
                    ) : (
                      <button
                        onClick={() => navigate('/projects')}
                        className="mx-1 mb-2 flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-gray-700 text-gray-500 hover:border-gray-500 hover:text-gray-300 transition-colors text-xs w-[calc(100%-8px)]"
                      >
                        <FolderOpen size={13} />
                        <span className="flex-1 text-left">Select a project</span>
                        <ChevronRight size={12} />
                      </button>
                    )}

                    {estimatingOrder.map((to) => {
                    const item = estimatingItemByRoute.get(to);
                    if (!item) return null;
                    // Respect adminOnly flag — same rule as non-Estimating sections
                    if (item.adminOnly && !isAdmin) return null;
                    const { label, icon: Icon, ai } = item;
                    const isDragging = draggedRoute === to;
                    // Append ?projectId= when a project is active
                    const linkTo = activeProject ? `${to}?projectId=${activeProject.id}` : to;
                    return (
                      <div
                        key={to}
                        className={`flex items-stretch gap-2 rounded-lg ${isDragging ? 'opacity-50' : ''}`}
                        draggable
                        onDragStart={(event) => {
                          event.dataTransfer.effectAllowed = 'move';
                          event.dataTransfer.setData('text/plain', to);
                          setDraggedRoute(to);
                        }}
                        onDragEnd={() => setDraggedRoute(null)}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => {
                          event.preventDefault();
                          const sourceRoute = event.dataTransfer.getData('text/plain') || draggedRoute;
                          moveRoute(sourceRoute, to);
                          setDraggedRoute(null);
                        }}
                      >
                        <div className="flex items-center px-1 text-gray-500 cursor-grab active:cursor-grabbing select-none" aria-hidden="true" title="Drag to reorder">
                          <GripVertical size={14} />
                        </div>
                        <NavLink
                          to={linkTo}
                          end={to === ROUTE_PATHS.DASHBOARD}
                          // isActive matches on the pathname only, ignoring ?projectId
                          className={({ isActive }) =>
                            `flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                              isActive
                                ? 'bg-blue-600 text-white'
                                : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                            }`
                          }
                        >
                          <Icon size={18} />
                          <span className="flex-1 truncate">{label}</span>
                          {ai && (
                            <span className="text-xs bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded font-medium">
                              AI
                            </span>
                          )}
                        </NavLink>
                      </div>
                    );
                  })}</>

                : visibleItems.map(({ to, label, icon: Icon, ai }) => {
                    // Append ?projectId= for routes that work in project context
                    const projectAwareTo = activeProject && to !== '/projects' && !to.startsWith('/admin')
                      ? `${to}?projectId=${activeProject.id}`
                      : to;
                    return (
                    <NavLink
                      key={to}
                      to={projectAwareTo}
                      end={to === ROUTE_PATHS.DASHBOARD || to === '/projects'}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                          isActive
                            ? 'bg-blue-600 text-white'
                            : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                        }`
                      }
                    >
                      <Icon size={18} />
                      <span className="flex-1">{label}</span>
                      {ai && (
                        <span className="text-xs bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded font-medium">
                          AI
                        </span>
                      )}
                    </NavLink>
                    );
                  })}
            </div>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-700">
          <div className="text-xs text-gray-500">v1.0.0 — Local Mode</div>
        </div>
      </aside>
    </>
  );
}
