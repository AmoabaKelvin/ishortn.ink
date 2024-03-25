import { currentUser } from "@clerk/nextjs";
import fs from "fs";
import { GeistMono } from "geist/font/mono";
import matter from "gray-matter";
import Link from "next/link";
import Markdown from "react-markdown";

import { Button } from "@/components/ui/button";

const getChangeLogsFromDirectory = () => {
  const files = fs.readdirSync(process.cwd() + "/src/content/changelog");
  const markdownFiles = files.filter((file) => file.endsWith(".md"));

  const parsedFiles = markdownFiles.map((file) => {
    return {
      slug: file.replace(".md", ""),
      ...matter(fs.readFileSync(`src/content/changelog/${file}`, "utf-8")),
    };
  });

  const sortedFiles = parsedFiles.sort((a, b) => {
    if (a.data.dateReleased < b.data.dateReleased) {
      return 1;
    } else {
      return -1;
    }
  });

  return sortedFiles;
};

const ChangeLogPage = async () => {
  const user = await currentUser();
  const changeLogs = getChangeLogsFromDirectory();

  return (
    <>
      <nav className="flex items-center justify-between max-w-5xl mx-auto my-8">
        <Link className={`text-2xl font-bold ${GeistMono.className}`} href="/">
          iShortn
        </Link>
        <Button asChild>
          <Link href={user ? "/dashboard" : "/auth/sign-up"}>
            {user ? "Dashboard" : "Sign Up"}
          </Link>
        </Button>
      </nav>
      <div
        className={`flex flex-col justify-center max-w-5xl p-4 mx-auto border rounded-md ${GeistMono.className} shadow-sm`}
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
          <div className="col-span-2"></div>
          <div className="col-span-10">
            <h1 className="text-3xl font-bold">ChangeLog</h1>
            <p className="mt-2 mb-8 text-slate-500">
              Here you can find all the changes that have been made to the
              application ❤️
            </p>
          </div>

          {changeLogs.map((changeLog) => {
            return (
              <>
                <div className="col-span-2" key={changeLog.slug}>
                  <p className="text-md text-slate-500">
                    {new Date(changeLog.data.dateReleased).toLocaleDateString(
                      "en-US",
                      {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      },
                    )}
                  </p>
                </div>

                <div className="col-span-10 mb-8">
                  <h2 className="text-xl font-bold">{changeLog.data.title}</h2>
                  <div className="mt-4 prose-sm prose text-slate-500 max-w-none prose-a:text-black prose-a:underline">
                    <Markdown>{changeLog.content}</Markdown>
                  </div>
                </div>
              </>
            );
          })}
        </div>
      </div>
    </>
  );
};

export default ChangeLogPage;
