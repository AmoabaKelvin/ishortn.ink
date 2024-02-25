import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import LinkShortenerTab from "./_tabs/link-shortener-tab";
import QRGenerationTab from "./_tabs/qr-generation-tab";

export function LinkShortenerAndQRGenerator() {
  return (
    <Tabs defaultValue="shorten-link" className="w-full mx-auto">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger
          value="shorten-link"
          className="data-[state=active]:bg-green-500"
        >
          Shorten Link
        </TabsTrigger>
        <TabsTrigger
          value="qr-code"
          className="data-[state=active]:bg-green-500"
        >
          Generate QR
        </TabsTrigger>
      </TabsList>
      <TabsContent value="shorten-link">
        <LinkShortenerTab />
      </TabsContent>
      <TabsContent value="qr-code">
        <QRGenerationTab />
      </TabsContent>
    </Tabs>
  );
}
