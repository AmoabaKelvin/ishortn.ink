import { forwardRef, type SVGProps } from "react";
import { cn } from "@/lib/utils";
import { DiscordLogoIcon } from "@radix-ui/react-icons";

export const discord = {
  discord: DiscordLogoIcon,
};
const GitHub = forwardRef<SVGSVGElement, SVGProps<SVGSVGElement>>(({ className, ...props }) => (
  <svg
    height="24"
    aria-hidden="true"
    viewBox="0 0 16 16"
    version="1.1"
    width="24"
    fill="currentColor"
    data-view-component="true"
    {...props}
    className={cn(className)}
  >
    <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z"></path>
  </svg>
));

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
      <rect x="2" y="5" width="20" height="14" rx="2"></rect>
      <line x1="2" y1="10" x2="22" y2="10"></line>
    </svg>
  ),
);
CreditCard.displayName = "CreditCard";

export { AnimatedSpinner, CreditCard, GitHub };

export {
  EyeOpenIcon,
  EyeNoneIcon as EyeCloseIcon,
  SunIcon,
  MoonIcon,
  ExclamationTriangleIcon,
  ExitIcon,
  EnterIcon,
  GearIcon,
  RocketIcon,
  PlusIcon,
  HamburgerMenuIcon,
  Pencil2Icon,
  UpdateIcon,
  CheckCircledIcon,
  PlayIcon,
  TrashIcon,
  ArchiveIcon,
  ResetIcon,
  DiscordLogoIcon,
  FileTextIcon,
  IdCardIcon,
  PlusCircledIcon,
  FilePlusIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  DotsHorizontalIcon,
  ArrowLeftIcon,
} from "@radix-ui/react-icons";
