import React, { useState, useEffect, useRef } from 'react';
import { Menu, ChevronDown, LogOut, User } from 'lucide-react';

export default function Header({ onMenuClick, onLogout, user }) {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-3 z-10">
      {/* Hamburger */}
      <button
        onClick={onMenuClick}
        className="text-gray-500 hover:text-gray-700 p-1 rounded-lg hover:bg-gray-100"
      >
        <Menu size={20} />
      </button>

      <div className="flex-1" />

      {/* User avatar + dropdown */}
      <div className="relative" ref={userMenuRef}>
        <button
          onClick={() => setUserMenuOpen(v => !v)}
          className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          title="Account"
        >
          <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold select-none">
            {user?.firstName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || <User size={14} />}
          </div>
          <ChevronDown size={13} className="text-gray-400" />
        </button>

        {userMenuOpen && (
          <div className="absolute right-0 top-full mt-1 w-56 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
            {/* User info */}
            <div className="px-4 py-3 border-b border-gray-100">
              <div className="text-sm font-semibold text-gray-900 truncate">
                {user?.firstName && user?.lastName
                  ? `${user.firstName} ${user.lastName}`
                  : user?.email || 'User'}
              </div>
              <div className="text-xs text-gray-400 truncate mt-0.5">{user?.email}</div>
              {user?.role && (
                <span className="inline-block mt-1 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-100">
                  {user.role}
                </span>
              )}
            </div>
            {/* Sign out */}
            <button
              onClick={() => { setUserMenuOpen(false); onLogout?.(); }}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
            >
              <LogOut size={15} /> Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
