"use client";

// Central icon shim — maps lucide-react API names to Phosphor Icons with
// duotone weight as default, matching the Splitzy brand gradient aesthetic.
// All app components import from here instead of "lucide-react".

import { createElement } from "react";
import type { Icon, IconProps } from "@phosphor-icons/react";
import {
  Pulse            as _Activity,
  WarningCircle    as _AlertCircle,
  Warning          as _AlertTriangle,
  Archive          as _Archive,
  ArrowLeft        as _ArrowLeft,
  ArrowRight       as _ArrowRight,
  ArrowsLeftRight  as _ArrowRightLeft,
  Prohibit         as _Ban,
  Calculator       as _Calculator,
  Calendar         as _Calendar,
  Camera           as _Camera,
  Check            as _Check,
  CheckCircle      as _CheckCircle2,
  CaretDown        as _ChevronDown,
  CaretRight       as _ChevronRight,
  CaretUp          as _ChevronUp,
  Circle           as _Circle,
  Clock            as _Clock,
  Cloud            as _Cloud,
  CloudSlash       as _CloudOff,
  Copy             as _Copy,
  Crown            as _Crown,
  PencilSimple     as _Edit2,
  Eye              as _Eye,
  Gift             as _Gift,
  GitPullRequest   as _GitPullRequestArrow,
  Globe            as _Globe,
  HandHeart        as _HandHeart,
  ClockCounterClockwise as _History,
  House            as _Home,
  Image            as _ImageIcon,
  Info             as _Info,
  Lightbulb        as _Lightbulb,
  Bank             as _Landmark,
  Stack            as _Layers,
  SquaresFour      as _LayoutDashboard,
  Link             as _Link2,
  CircleNotch      as _Loader2,
  Lock             as _Lock,
  SignIn           as _LogIn,
  SignOut          as _LogOut,
  Envelope         as _Mail,
  ChatCircle       as _MessageCircle,
  Minus            as _Minus,
  MinusCircle      as _MinusCircle,
  Moon             as _Moon,
  TreeStructure    as _Network,
  Confetti         as _PartyPopper,
  Pencil           as _Pencil,
  PencilLine       as _PencilLine,
  Airplane         as _Plane,
  Plus             as _Plus,
  PlusCircle       as _PlusCircle,
  Receipt          as _Receipt,
  ArrowCounterClockwise as _ArrowCCW,
  ArrowClockwise   as _ArrowCW,
  Scan             as _Scan,
  MagnifyingGlass  as _Search,
  ShareNetwork     as _Share2,
  Shield           as _Shield,
  ShieldCheck      as _ShieldCheck,
  ShoppingCart     as _ShoppingCart,
  Sparkle          as _Sparkles,
  Sun              as _Sun,
  Tag              as _Tag,
  Target           as _Target,
  Trash            as _Trash2,
  Upload           as _Upload,
  User             as _User,
  UserPlus         as _UserPlus,
  Users            as _Users,
  Wallet           as _Wallet,
  Wrench           as _Wrench,
  X                as _X,
  Lightning        as _Zap,
} from "@phosphor-icons/react";

export type { Icon as LucideIcon } from "@phosphor-icons/react";

function w(PhIcon: Icon, defaultWeight: IconProps["weight"] = "duotone"): Icon {
  const Wrapped = ({ weight = defaultWeight, ...props }: IconProps) =>
    createElement(PhIcon, { weight, ...props });
  return Wrapped as Icon;
}

// ── Navigation & layout ────────────────────────────────────────────────────
export const ArrowLeft        = w(_ArrowLeft,       "regular");
export const ArrowRight       = w(_ArrowRight,      "regular");
export const ChevronDown      = w(_ChevronDown,     "bold");
export const ChevronRight     = w(_ChevronRight,    "bold");
export const ChevronUp        = w(_ChevronUp,       "bold");
export const Home             = w(_Home,            "regular");
export const LayoutDashboard  = w(_LayoutDashboard);
export const LogIn            = w(_LogIn,           "regular");
export const LogOut           = w(_LogOut,          "regular");

// ── Action / button ────────────────────────────────────────────────────────
export const Archive          = w(_Archive);
export const Ban              = w(_Ban);
export const Camera           = w(_Camera,          "regular");
export const Check            = w(_Check,           "bold");
export const Copy             = w(_Copy,            "regular");
export const Edit2            = w(_Edit2,           "regular");
export const Eye              = w(_Eye,             "regular");
export const GitPullRequestArrow = w(_GitPullRequestArrow);
export const Link2            = w(_Link2,           "regular");
export const Minus            = w(_Minus,           "bold");
export const MinusCircle      = w(_MinusCircle);
export const Pencil           = w(_Pencil,          "regular");
export const PencilLine       = w(_PencilLine,      "regular");
export const Plus             = w(_Plus,            "bold");
export const PlusCircle       = w(_PlusCircle);
export const RefreshCcw       = w(_ArrowCCW,        "regular");
export const RefreshCw        = w(_ArrowCW,         "regular");
export const RotateCcw        = w(_ArrowCCW,        "regular");
export const Search           = w(_Search,          "regular");
export const SearchX          = w(_Search,          "regular");
export const Share2           = w(_Share2);
export const Trash2           = w(_Trash2,          "regular");
export const Upload           = w(_Upload,          "regular");
export const UserPlus         = w(_UserPlus,        "regular");
export const X                = w(_X,               "bold");

// ── Status & feedback ──────────────────────────────────────────────────────
export const AlertCircle      = w(_AlertCircle,     "fill");
export const AlertTriangle    = w(_AlertTriangle,   "fill");
export const CheckCircle2     = w(_CheckCircle2,    "fill");
export const Circle           = w(_Circle,          "regular");
export const Clock            = w(_Clock);
export const Info             = w(_Info,            "fill");
export const Lightbulb        = w(_Lightbulb,       "fill");
export const Loader2          = w(_Loader2,         "regular");

// ── Feature / brand ────────────────────────────────────────────────────────
export const Activity         = w(_Activity);
export const ArrowRightLeft   = w(_ArrowRightLeft);
export const Calculator       = w(_Calculator);
export const Calendar         = w(_Calendar);
export const Cloud            = w(_Cloud);
export const CloudOff         = w(_CloudOff);
export const Crown            = w(_Crown,           "fill");
export const Gift             = w(_Gift);
export const Globe            = w(_Globe);
export const History          = w(_History);
export const ImageIcon        = w(_ImageIcon,       "regular");
export const Landmark         = w(_Landmark);
export const Layers           = w(_Layers);
export const Lock             = w(_Lock,            "fill");
export const Mail             = w(_Mail);
export const MessageCircle    = w(_MessageCircle);
export const Moon             = w(_Moon,            "fill");
export const Network          = w(_Network);
export const PartyPopper      = w(_PartyPopper,     "fill");
export const Plane            = w(_Plane);
export const Receipt          = w(_Receipt);
export const Scan             = w(_Scan);
export const ScanLine         = w(_Scan);
export const Shield           = w(_Shield,          "fill");
export const ShieldCheck      = w(_ShieldCheck,     "fill");
export const ShoppingCart     = w(_ShoppingCart);
export const Sparkles         = w(_Sparkles,        "fill");
export const Sun              = w(_Sun,             "fill");
export const Tag              = w(_Tag);
export const Target           = w(_Target);
export const User             = w(_User);
export const Users            = w(_Users);
export const Wallet           = w(_Wallet);
export const Wrench           = w(_Wrench);
export const Zap              = w(_Zap,             "fill");

// ── Decorative ─────────────────────────────────────────────────────────────
export const HandHeart        = w(_HandHeart,       "fill");
