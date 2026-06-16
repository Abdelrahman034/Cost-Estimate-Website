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
  SlidersHorizontal,
  Users,
  Shield,
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
  VAV_SCHEDULE:    '/vav-schedule',
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

// All available permission keys — used by RolesPage to build the permissions editor
export const ALL_PERMISSIONS = [
  { key: 'SUMMARY',       label: 'Bid Summary'           },
  { key: 'GENERAL',       label: 'General Items'         },
  { key: 'DUCT',          label: 'Metal Duct'            },
  { key: 'DIFFUSER',      label: 'Diffuser Schedule'     },
  { key: 'UNIT_SCHEDULE', label: 'Unit Schedule'         },
  { key: 'FAN_SCHEDULE',  label: 'Fan Schedule'          },
  { key: 'VAV_SCHEDULE',  label: 'VAV Schedule'          },
  { key: 'ELEC_HEAT',     label: 'Electric Unit Heaters' },
  { key: 'LOUVERS',       label: 'Louvers & Dampers'     },
  { key: 'SUPPLIER_RFQ',  label: 'Supplier RFQ'          },
  { key: 'SCENARIOS',     label: 'Scenario Compare'      },
  { key: 'CHANGELOG',     label: 'Change Log'            },
  { key: 'PROPOSAL_PDF',  label: 'Proposal PDF'          },
  { key: 'ADMIN_ANALYTICS', label: 'Admin Analytics'     },
];

export const NAV_SECTIONS = [
  {
    title: 'Projects',
    items: [
      { to: ROUTE_PATHS.PROJECTS, label: 'My Projects', icon: FolderOpen },
      { to: ROUTE_PATHS.COMPANY,  label: 'Company',     icon: Building2, ownerOnly: true },
      { to: '/team',  label: 'Team',    icon: Users,    ownerOnly: true },
      { to: '/roles', label: 'Roles',   icon: Shield,   ownerOnly: true },
    ],
  },
  {
    title: 'Estimating',
    items: [
      { to: ROUTE_PATHS.SUMMARY,       label: 'Bid Summary',            icon: BarChart3,         permKey: 'SUMMARY'       },
      { to: ROUTE_PATHS.GENERAL,       label: 'General Items',          icon: Wrench,            permKey: 'GENERAL'       },
      { to: ROUTE_PATHS.DUCT,          label: 'Metal Duct',             icon: Wind,              permKey: 'DUCT'          },
      { to: ROUTE_PATHS.DIFFUSER,      label: 'Diffuser Schedule',      icon: Gauge,             permKey: 'DIFFUSER'      },
      { to: ROUTE_PATHS.UNIT_SCHEDULE, label: 'Unit Schedule',          icon: Building2,         permKey: 'UNIT_SCHEDULE' },
      { to: ROUTE_PATHS.FAN_SCHEDULE,  label: 'Fan Schedule',           icon: Fan,               permKey: 'FAN_SCHEDULE'  },
      { to: ROUTE_PATHS.VAV_SCHEDULE,  label: 'VAV Schedule',           icon: SlidersHorizontal, permKey: 'VAV_SCHEDULE'  },
      { to: ROUTE_PATHS.ELEC_HEAT,     label: 'Electric Unit Heaters',  icon: Zap,               permKey: 'ELEC_HEAT'     },
      { to: ROUTE_PATHS.LOUVERS,       label: 'Louvers & Dampers',      icon: Wind,              permKey: 'LOUVERS'       },
      { to: ROUTE_PATHS.SUPPLIER_RFQ,  label: 'Supplier RFQ',           icon: Package,           permKey: 'SUPPLIER_RFQ'  },
      { to: ROUTE_PATHS.SCENARIOS,     label: 'Scenario Compare',       icon: GitCompare,        permKey: 'SCENARIOS'     },
      { to: ROUTE_PATHS.CHANGELOG,     label: 'Change Log',             icon: Clock,             permKey: 'CHANGELOG'     },
      { to: ROUTE_PATHS.PROPOSAL_PDF,  label: 'Proposal PDF',           icon: Printer,           permKey: 'PROPOSAL_PDF'  },
      { to: ROUTE_PATHS.SETTINGS,      label: 'Settings',               icon: Wrench,            ownerOnly: true          },
    ],
  },
  {
    title: 'Reports',
    items: [
      { to: ROUTE_PATHS.ADMIN_ANALYTICS, label: 'Admin Analytics', icon: ShieldCheck, permKey: 'ADMIN_ANALYTICS' },
    ],
  },
];
