import { MoreVertical, Pencil, QrCode, ToggleLeft, Trash } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type linkActionsProps = {
  handleModal: () => void;
  handleDelete: () => void;
  handleQRCodeModal: () => void;
  handleDisable?: () => void;
};

export function LinkActions({
  handleDelete,
  handleModal,
  handleQRCodeModal,
  handleDisable,
}: linkActionsProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {/* <Button variant="outline"> */}
        <MoreVertical className="w-4 h-4 hover:cursor-pointer" />
        {/* </Button> */}
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56">
        {/* <DropdownMenuLabel>My Account</DropdownMenuLabel> */}
        {/* <DropdownMenuSeparator /> */}
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => handleModal()}>
            <Pencil className="w-4 h-4 mr-2" />
            <span>Edit</span>
            {/* <DropdownMenuShortcut>⇧⌘P</DropdownMenuShortcut> */}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleQRCodeModal()}>
            <QrCode className="w-4 h-4 mr-2" />
            <span>QrCode</span>
            <DropdownMenuShortcut>⌘B</DropdownMenuShortcut>
          </DropdownMenuItem>
          {handleDisable && (
            <DropdownMenuItem
              className="text-red-500"
              onClick={() => handleDisable()}
            >
              <ToggleLeft className="w-4 h-4 mr-2" />
              <span>Deactivate</span>
              <DropdownMenuShortcut>⌘S</DropdownMenuShortcut>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem className="text-red-500" onClick={handleDelete}>
            <Trash className="w-4 h-4 mr-2" />
            <span>Delete</span>
            <DropdownMenuShortcut>⌘K</DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
