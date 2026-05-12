'use strict';

// Zone 1: Modules (product surfaces that can be subscribed to)
export const SIDEBAR_MODULES = [
  {
    id: 'email-builder',
    icon: 'Mail',
    labelKey: 'sidebar.modules.emailBuilder',
    route: '/mailings',
    enabledFlag: 'enableEmailBuilder',
  },
  {
    id: 'crm-intelligence',
    icon: 'LineChart',
    labelKey: 'sidebar.modules.crmIntelligence',
    route: '/crm-intelligence',
    enabledFlag: 'enableCrmIntelligence',
  },
  {
    id: 'deliverability',
    icon: 'Shield',
    labelKey: 'sidebar.modules.deliverability',
    route: '/deliverability',
    enabledFlag: 'enableDeliverability',
  },
  // Future modules (commented out until implemented):
  // {
  //   id: 'design-system',
  //   icon: 'Palette',
  //   labelKey: 'sidebar.modules.designSystem',
  //   route: '/design-system',
  //   enabledFlag: null,
  // },
  // {
  //   id: 'ai-studio',
  //   icon: 'Sparkles',
  //   labelKey: 'sidebar.modules.aiStudio',
  //   route: '/ai-studio',
  //   enabledFlag: 'enableAIStudio',
  // },
];

// Zone 3: System (always available, pinned to bottom)
export const SYSTEM_ITEMS = [
  {
    id: 'settings',
    icon: 'Settings',
    labelKey: 'sidebar.system.settings',
    route: '/groups',
  },
  {
    id: 'help',
    icon: 'HelpCircle',
    labelKey: 'sidebar.system.help',
    action: 'openHelp',
  },
  {
    id: 'logout',
    icon: 'LogOut',
    labelKey: 'sidebar.system.logout',
    action: 'logout',
  },
];
