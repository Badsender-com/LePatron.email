import Vue from 'vue';

// Import commonly used Lucide icons for global registration
import {
  // Navigation & UI
  Settings,
  HelpCircle,
  LogOut,
  Menu,
  X,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  ExternalLink,
  MoreVertical,
  MoreHorizontal,

  // Actions
  Plus,
  Pencil,
  Trash2,
  Save,
  Copy,
  Download,
  Upload,
  RefreshCw,
  Search,
  Eye,
  EyeOff,
  Check,

  // Status & Feedback
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle2,
  XCircle,

  // Content & Data
  Mail,
  MailPlus,
  User,
  Users,
  UserPlus,
  Folder,
  FolderOpen,
  File,
  FileText,
  FilePlus,

  // Features
  Palette,
  LineChart,
  BarChart3,
  LayoutDashboard,
  Puzzle,
  Link,
  Globe,
  Languages,
  Sparkles,
  Cable,
  Bot,
  BadgeCheck,

  // Media
  Image,
  Play,
  Pause,
} from 'lucide-vue';

// Register all icons globally with 'Icon' prefix
const icons = {
  // Navigation & UI
  IconSettings: Settings,
  IconHelpCircle: HelpCircle,
  IconLogOut: LogOut,
  IconMenu: Menu,
  IconX: X,
  IconChevronDown: ChevronDown,
  IconChevronUp: ChevronUp,
  IconChevronLeft: ChevronLeft,
  IconChevronRight: ChevronRight,
  IconArrowLeft: ArrowLeft,
  IconArrowRight: ArrowRight,
  IconArrowUp: ArrowUp,
  IconArrowDown: ArrowDown,
  IconExternalLink: ExternalLink,
  IconMoreVertical: MoreVertical,
  IconMoreHorizontal: MoreHorizontal,

  // Actions
  IconPlus: Plus,
  IconPencil: Pencil,
  IconTrash2: Trash2,
  IconSave: Save,
  IconCopy: Copy,
  IconDownload: Download,
  IconUpload: Upload,
  IconRefreshCw: RefreshCw,
  IconSearch: Search,
  IconEye: Eye,
  IconEyeOff: EyeOff,
  IconCheck: Check,

  // Status & Feedback
  IconAlertTriangle: AlertTriangle,
  IconAlertCircle: AlertCircle,
  IconInfo: Info,
  IconCheckCircle2: CheckCircle2,
  IconXCircle: XCircle,

  // Content & Data
  IconMail: Mail,
  IconMailPlus: MailPlus,
  IconUser: User,
  IconUsers: Users,
  IconUserPlus: UserPlus,
  IconFolder: Folder,
  IconFolderOpen: FolderOpen,
  IconFile: File,
  IconFileText: FileText,
  IconFilePlus: FilePlus,

  // Features
  IconPalette: Palette,
  IconLineChart: LineChart,
  IconBarChart3: BarChart3,
  IconLayoutDashboard: LayoutDashboard,
  IconPuzzle: Puzzle,
  IconLink: Link,
  IconGlobe: Globe,
  IconLanguages: Languages,
  IconSparkles: Sparkles,
  IconCable: Cable,
  IconBot: Bot,
  IconBadgeCheck: BadgeCheck,

  // Media
  IconImage: Image,
  IconPlay: Play,
  IconPause: Pause,
};

// Register all icons as global components
Object.entries(icons).forEach(([name, component]) => {
  Vue.component(name, component);
});

// Export for direct imports if needed
export default icons;
