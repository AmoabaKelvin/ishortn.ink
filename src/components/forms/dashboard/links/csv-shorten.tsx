"use client";

import Papa from "papaparse";
import { toast } from "sonner";


import { quickLinkShorten } from "@/actions/link-actions";
import { Button } from "@/components/ui/button";

import { useTransition } from "react";


const CsvShortenForm = () => {
   
    
  const [loading, startTransition] = useTransition();
    interface CSVRow {
        links: string;
      }
      function isURL(str: string): boolean {
        const urlRegex = /^(?:https?|ftp):\/\/(?:\w+\.?)+/i;
        return urlRegex.test(str);
      }
      const handleCSV = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
          console.log(file.type);
          if (file.type === "text/csv") {
            const reader = new FileReader();
            reader.onload = (e) => {
              const csvText = e.target?.result as string;
              const parsedData = Papa.parse<CSVRow>(csvText, { header: true });
              const linksColumn = parsedData.data.map((row: CSVRow) => row.links);
              console.log(linksColumn);
              // linksCol is a array of all links, now shorten it
              window.scrollTo({
                top: document.body.scrollHeight,
                behavior: "smooth",
              });
              startTransition(async () => {
                try {
                  const shortenPromises = linksColumn.map(async (link) => {
                    if (!isURL(link)) {
                      toast.error(`Invalid URL: ${link}`);
                      return false;
                    }
                    const response = await quickLinkShorten(link);
                    if (response && "id" in response) {
                      return true;
                    } else {
                      throw new Error(
                        "An error occurred while shortening your link."
                      );
                    }
                  });
    
                  await Promise.all(shortenPromises);
    
                  toast.success("Your links have been shortened.");
                  //router.push("/dashboard/");
                } catch (error) {
                  const errorMessage = (error as Error).message;
                  toast.error(
                    errorMessage || "An error occurred while shortening your links."
                  );
                }
              });
            };
    
            reader.readAsText(file);
          }
        }
      };
    
      return (
        <>
        <Button
                className="border border-white-900 border-2 mt-2 px-3 py-2 w-full"
                onClick={() => {
                  document.getElementById("inputCSV")?.click();
                }}
              >
                {" "}
                Upload CSV
              </Button>
              <input
                type="file"
                id="inputCSV"
                style={{ display: "none" }}
                onChange={handleCSV}
              ></input>
              </>
      );
}

export default CsvShortenForm;