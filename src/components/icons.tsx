import { forwardRef } from "react";

import { cn } from "@/lib/utils";

import type { SVGProps } from "react";

const AnimatedSpinner = forwardRef<SVGSVGElement, SVGProps<SVGSVGElement>>(
  ({ className, ...props }, ref) => (
    <svg
      ref={ref}
      {...props}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      fill="currentColor"
      className={cn(className)}
    >
      <g className="animated-spinner">
        <rect x="11" y="1" width="2" height="5" opacity=".14" />
        <rect x="11" y="1" width="2" height="5" transform="rotate(30 12 12)" opacity=".29" />
        <rect x="11" y="1" width="2" height="5" transform="rotate(60 12 12)" opacity=".43" />
        <rect x="11" y="1" width="2" height="5" transform="rotate(90 12 12)" opacity=".57" />
        <rect x="11" y="1" width="2" height="5" transform="rotate(120 12 12)" opacity=".71" />
        <rect x="11" y="1" width="2" height="5" transform="rotate(150 12 12)" opacity=".86" />
        <rect x="11" y="1" width="2" height="5" transform="rotate(180 12 12)" />
      </g>
    </svg>
  ),
);
AnimatedSpinner.displayName = "AnimatedSpinner";

const CreditCard = forwardRef<SVGSVGElement, SVGProps<SVGSVGElement>>(
  ({ className, ...props }, ref) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      ref={ref}
      {...props}
      viewBox="0 0 24 24"
      className={cn(className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <line x1="2" y1="10" x2="22" y2="10" />
    </svg>
  ),
);
CreditCard.displayName = "CreditCard";

export { AnimatedSpinner, CreditCard };

export {
  ArchiveIcon,
  ArrowLeftIcon,
  CheckCircledIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  DiscordLogoIcon,
  DotsHorizontalIcon,
  EnterIcon,
  ExclamationTriangleIcon,
  ExitIcon,
  EyeNoneIcon as EyeCloseIcon,
  EyeOpenIcon,
  FilePlusIcon,
  FileTextIcon,
  GearIcon,
  HamburgerMenuIcon,
  IdCardIcon,
  MoonIcon,
  Pencil2Icon,
  PlayIcon,
  PlusCircledIcon,
  PlusIcon,
  ResetIcon,
  RocketIcon,
  SunIcon,
  TrashIcon,
  UpdateIcon,
} from "@radix-ui/react-icons";
