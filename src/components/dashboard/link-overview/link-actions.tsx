import {
  Copy,
  MoreVertical,
  Pencil,
  QrCode,
  ToggleLeft,
  ToggleRight,
  Trash,
} from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type linkActionsProps = {
  handleModal: () => void;
  handleDelete: () => void;
  handleQRCodeModal: () => void;
  handleDisable?: () => void;
  handleEnable?: () => void;
  isLinkActive?: boolean;
  isLinkStatsPublic?: boolean;
  handleLinkPublicToggle?: (toggle: boolean) => void;
  copyPublicLinkAnalyticsToClipboard?: () => void;
};

export function LinkActions({
  handleDelete,
  handleModal,
  handleQRCodeModal,
  handleDisable,
  handleEnable,
  isLinkActive,
  isLinkStatsPublic,
  handleLinkPublicToggle,
  copyPublicLinkAnalyticsToClipboard,
}: linkActionsProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <MoreVertical className="w-4 h-4 hover:cursor-pointer" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => handleModal()}>
            <Pencil className="w-4 h-4 mr-2" />
            <span>Edit</span>
            {/* <DropdownMenuShortcut>⇧⌘P</DropdownMenuShortcut> */}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleQRCodeModal()}>
            <QrCode className="w-4 h-4 mr-2" />
            <span>QrCode</span>
          </DropdownMenuItem>
          {handleLinkPublicToggle && (
            <DropdownMenuItem
              className=""
              onClick={() =>
                handleLinkPublicToggle &&
                handleLinkPublicToggle(!isLinkStatsPublic)
              }
            >
              {isLinkStatsPublic ? (
                <>
                  <ToggleLeft className="w-4 h-4 mr-2" />
                  <span>Disable Public Stats</span>
                </>
              ) : (
                <>
                  <ToggleRight className="w-4 h-4 mr-2" />
                  <span>Enable Public Stats</span>
                </>
              )}
            </DropdownMenuItem>
          )}

          {copyPublicLinkAnalyticsToClipboard && isLinkStatsPublic && (
            <DropdownMenuItem
              onClick={() => copyPublicLinkAnalyticsToClipboard()}
            >
              <Copy className="w-4 h-4 mr-2" />
              <span>Copy Public Stats Link</span>
            </DropdownMenuItem>
          )}
          {handleEnable && (
            <>
              {isLinkActive ? (
                <DropdownMenuItem
                  className="text-red-500"
                  onClick={() => handleDisable && handleDisable()}
                >
                  <ToggleLeft className="w-4 h-4 mr-2" />
                  <span>Deactivate</span>
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  // className="text-green-700"
                  onClick={() => handleEnable && handleEnable()}
                >
                  <ToggleLeft className="w-4 h-4 mr-2" />
                  <span>Activate</span>
                </DropdownMenuItem>
              )}
            </>
          )}
          <DropdownMenuItem className="text-red-500" onClick={handleDelete}>
            <Trash className="w-4 h-4 mr-2" />
            <span>Delete</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
