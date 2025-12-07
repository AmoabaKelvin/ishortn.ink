import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface QRCodeContentProps {
  qrCodeTitle: string;
  setQRCodeTitle: (title: string) => void;
  enteredContent: string;
  setEnteredContent: (content: string) => void;
}

function QRCodeContent({
  qrCodeTitle,
  setQRCodeTitle,
  enteredContent,
  setEnteredContent,
}: QRCodeContentProps) {
  return (
    <div className="space-y-4">
      <div className="grid gap-2">
        <Label htmlFor="qr-content">Content</Label>
        <Input
          id="qr-content"
          placeholder="Enter the content for the QR Code (text, URL, etc.)"
          value={enteredContent}
          onChange={(e) => setEnteredContent(e.target.value)}
        />
        <p className="text-sm text-muted-foreground">
          Enter any text, URL, or data you want to encode in the QR code
        </p>
      </div>
    </div>
  );
}

export default QRCodeContent;
