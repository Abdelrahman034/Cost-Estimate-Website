import {
  LayoutDashboard,
  Wind,
  Gauge,
  Wrench,
  FileImage,
  TrendingUp,
  FileText,
  BarChart3,
} from 'lucide-react';

export const ROUTE_PATHS = {
  DASHBOARD: '/',
  DUCT: '/duct',
  DIFFUSER: '/diffuser',
  SETTINGS: '/settings',
  DRAWINGS: '/drawings',
  PRICES: '/prices',
  PROPOSAL: '/proposal',
  SUMMARY: '/summary',
};

export const NAV_SECTIONS = [
  {
    title: 'Estimating',
    items: [
      { to: ROUTE_PATHS.DASHBOARD, label: 'Dashboard', icon: LayoutDashboard },
      { to: ROUTE_PATHS.DUCT, label: 'Metal Duct', icon: Wind },
      { to: ROUTE_PATHS.DIFFUSER, label: 'Diffuser Schedule', icon: Gauge },
      { to: ROUTE_PATHS.SETTINGS, label: 'Settings', icon: Wrench },
    ],
  },
  {
    title: 'AI Features',
    items: [
      { to: ROUTE_PATHS.DRAWINGS, label: 'Drawing Analyzer', icon: FileImage, ai: true },
      { to: ROUTE_PATHS.PRICES, label: 'Live Prices', icon: TrendingUp, ai: true },
      { to: ROUTE_PATHS.PROPOSAL, label: 'Proposal Generator', icon: FileText, ai: true },
    ],
  },
  {
    title: 'Reports',
    items: [
      { to: ROUTE_PATHS.SUMMARY, label: 'Bid Summary', icon: BarChart3 },
    ],
  },
];
