import {
  Wind,
  Gauge,
  Fan,
  Wrench,
  BarChart3,
  Building2,
  Package,
  GitCompare,
  Clock,
  Printer,
  Zap,
  ShieldCheck,
  FolderOpen,
} from 'lucide-react';

export const ROUTE_PATHS = {
  DASHBOARD:       '/',
  COMPANY:         '/company',
  PROJECTS:        '/projects',
  GENERAL:         '/general',
  DUCT:            '/duct',
  DIFFUSER:        '/diffuser',
  UNIT_SCHEDULE:   '/unit-schedule',
  FAN_SCHEDULE:    '/fan-schedule',
  ELEC_HEAT:       '/electric-heat',
  LOUVERS:         '/louvers',
  SUPPLIER_RFQ:    '/supplier-rfq',
  SCENARIOS:       '/scenarios',
  CHANGELOG:       '/changelog',
  PROPOSAL_PDF:    '/proposal-pdf',
  SETTINGS:        '/settings',
  SUMMARY:         '/summary',
  ADMIN_ANALYTICS: '/admin/analytics',
};

export const NAV_SECTIONS = [
  {
    title: 'Projects',
    items: [
      { to: ROUTE_PATHS.PROJECTS, label: 'My Projects', icon: FolderOpen },
      { to: ROUTE_PATHS.COMPANY,  label: 'Company',     icon: Building2, adminOnly: true },
    ],
  },
  {
    title: 'Estimating',
    items: [
      { to: ROUTE_PATHS.SUMMARY,       label: 'Bid Summary',            icon: BarChart3 },
      { to: ROUTE_PATHS.GENERAL,       label: 'General Items',          icon: Wrench    },
      { to: ROUTE_PATHS.DUCT,          label: 'Metal Duct',             icon: Wind      },
      { to: ROUTE_PATHS.DIFFUSER,      label: 'Diffuser Schedule',      icon: Gauge     },
      { to: ROUTE_PATHS.UNIT_SCHEDULE, label: 'Unit Schedule',          icon: Building2 },
      { to: ROUTE_PATHS.FAN_SCHEDULE,  label: 'Fan Schedule',           icon: Fan       },
      { to: ROUTE_PATHS.ELEC_HEAT,     label: 'Electric Unit Heaters',  icon: Zap       },
      { to: ROUTE_PATHS.LOUVERS,       label: 'Louvers & Dampers',      icon: Wind      },
      { to: ROUTE_PATHS.SUPPLIER_RFQ,  label: 'Supplier RFQ',           icon: Package   },
      { to: ROUTE_PATHS.SCENARIOS,     label: 'Scenario Compare',       icon: GitCompare },
      { to: ROUTE_PATHS.CHANGELOG,     label: 'Change Log',             icon: Clock     },
      { to: ROUTE_PATHS.PROPOSAL_PDF,  label: 'Proposal PDF',           icon: Printer   },
      { to: ROUTE_PATHS.SETTINGS,      label: 'Settings',               icon: Wrench,  adminOnly: true },
    ],
  },
  {
    title: 'Reports',
    items: [
      { to: ROUTE_PATHS.ADMIN_ANALYTICS, label: 'Admin Analytics', icon: ShieldCheck, adminOnly: true },
    ],
  },
];
