import {
  LayoutDashboard,
  Wind,
  Gauge,
  Wrench,
  FileImage,
  TrendingUp,
  FileText,
  BarChart3,
  Building2,
  Package,
  GitCompare,
} from 'lucide-react';

export const ROUTE_PATHS = {
  DASHBOARD:     '/',
  DUCT:          '/duct',
  DIFFUSER:      '/diffuser',
  UNIT_SCHEDULE: '/unit-schedule',
  SUPPLIER_RFQ:  '/supplier-rfq',
  SCENARIOS:     '/scenarios',
  SETTINGS:      '/settings',
  DRAWINGS:      '/drawings',
  PRICES:        '/prices',
  PROPOSAL:      '/proposal',
  SUMMARY:       '/summary',
};

export const NAV_SECTIONS = [
  {
    title: 'Estimating',
    items: [
      { to: ROUTE_PATHS.DASHBOARD,      label: 'Dashboard',         icon: LayoutDashboard },
      { to: ROUTE_PATHS.DUCT,           label: 'Metal Duct',        icon: Wind },
      { to: ROUTE_PATHS.DIFFUSER,       label: 'Diffuser Schedule', icon: Gauge },
      { to: ROUTE_PATHS.UNIT_SCHEDULE,  label: 'Unit Schedule',     icon: Building2 },
      { to: ROUTE_PATHS.SUPPLIER_RFQ,  label: 'Supplier RFQ',      icon: Package },
      { to: ROUTE_PATHS.SCENARIOS,     label: 'Scenario Compare',  icon: GitCompare },
      { to: ROUTE_PATHS.SETTINGS,      label: 'Settings',          icon: Wrench },
    ],
  },
  {
    title: 'AI Features',
    items: [
      { to: ROUTE_PATHS.DRAWINGS, label: 'Drawing Analyzer',   icon: FileImage,  ai: true },
      { to: ROUTE_PATHS.PRICES,   label: 'Live Prices',        icon: TrendingUp, ai: true },
      { to: ROUTE_PATHS.PROPOSAL, label: 'Proposal Generator', icon: FileText,   ai: true },
    ],
  },
  {
    title: 'Reports',
    items: [
      { to: ROUTE_PATHS.SUMMARY, label: 'Bid Summary', icon: BarChart3 },
    ],
  },
];
