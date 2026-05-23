import {
  LayoutDashboard,
  Wind,
  Gauge,
  Fan,
  Wrench,
  FileImage,
  TrendingUp,
  FileText,
  BarChart3,
  Building2,
  Package,
  GitCompare,
  Clock,
  Printer,
  Zap,
  ShieldCheck,
  PlayCircle,
} from 'lucide-react';

export const ROUTE_PATHS = {
  DASHBOARD:       '/',
  DUCT:            '/duct',
  DIFFUSER:        '/diffuser',
  UNIT_SCHEDULE:   '/unit-schedule',
  FAN_SCHEDULE:    '/fan-schedule',
  ELEC_HEAT:       '/electric-heat',
  SUPPLIER_RFQ:    '/supplier-rfq',
  SCENARIOS:       '/scenarios',
  CHANGELOG:       '/changelog',
  PROPOSAL_PDF:    '/proposal-pdf',
  SETTINGS:        '/settings',
  DRAWINGS:        '/drawings',
  PRICES:          '/prices',
  PROPOSAL:        '/proposal',
  SUMMARY:         '/summary',
  ADMIN_ANALYTICS: '/admin/analytics',
  DEMO_SETUP:      '/demo-setup',
};

export const NAV_SECTIONS = [
  {
    title: 'Estimating',
    items: [
      { to: ROUTE_PATHS.DASHBOARD,      label: 'Dashboard',         icon: LayoutDashboard },
      { to: ROUTE_PATHS.DUCT,           label: 'Metal Duct',        icon: Wind },
      { to: ROUTE_PATHS.DIFFUSER,       label: 'Diffuser Schedule', icon: Gauge },
      { to: ROUTE_PATHS.UNIT_SCHEDULE,  label: 'Unit Schedule',     icon: Building2 },
      { to: ROUTE_PATHS.FAN_SCHEDULE,  label: 'Fan Schedule',           icon: Fan },
      { to: ROUTE_PATHS.ELEC_HEAT,     label: 'Electric Unit Heaters',  icon: Zap },
      { to: ROUTE_PATHS.SUPPLIER_RFQ,  label: 'Supplier RFQ',           icon: Package },
      { to: ROUTE_PATHS.SCENARIOS,     label: 'Scenario Compare',  icon: GitCompare },
      { to: ROUTE_PATHS.CHANGELOG,     label: 'Change Log',        icon: Clock },
      { to: ROUTE_PATHS.PROPOSAL_PDF,  label: 'Proposal PDF',      icon: Printer },
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
      { to: ROUTE_PATHS.SUMMARY,         label: 'Bid Summary',        icon: BarChart3    },
      { to: ROUTE_PATHS.ADMIN_ANALYTICS, label: 'Admin Analytics',    icon: ShieldCheck  },
      { to: ROUTE_PATHS.DEMO_SETUP,      label: 'Demo Setup',         icon: PlayCircle   },
    ],
  },
];
