import { cn } from "@/lib/utils";

import { presetColors } from "./constants";

interface ColorPickerProps {
  selectedColor: string;
  setSelectedColor: (color: string) => void;
}

function ColorPicker({ selectedColor, setSelectedColor }: ColorPickerProps) {
  return (
    <div>
      <span className="text-lg">Select color</span>
      <div className="mt-2 flex flex-wrap gap-4">
        {presetColors.map((color) => (
          <div
            key={color}
            className={cn("rounded-full border-2 p-1 hover:cursor-pointer", {
              "border-blue-400": selectedColor === color,
            })}
            onClick={() => setSelectedColor(color)}
          >
            <div className="size-11 rounded-full" style={{ backgroundColor: color }}></div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ColorPicker;
