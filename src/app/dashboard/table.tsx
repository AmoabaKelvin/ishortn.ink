"use client";

import { ShareIcon } from "@heroicons/react/24/outline";

/* This example requires Tailwind CSS v2.0+ */
const shortnedLinks = [
  {
    originalUrl: "https://www.google.com",
    shortnedUrl: "https://ishortn.com/xva12",
    dateCreated: "2021-08-01",
  },
  {
    originalUrl: "https://www.facebook.com",
    shortnedUrl: "https://ishortn.com/abc34",
    dateCreated: "2021-08-02",
  },
  {
    originalUrl: "https://www.twitter.com",
    shortnedUrl: "https://ishortn.com/def56",
    dateCreated: "2021-08-03",
  },
  {
    originalUrl: "https://www.youtube.com",
    shortnedUrl: "https://ishortn.com/ghi78",
    dateCreated: "2021-08-04",
  },
  {
    originalUrl: "https://www.linkedin.com",
    shortnedUrl: "https://ishortn.com/jkl90",
    dateCreated: "2021-08-05",
  },
];

export default function DashboardTable() {
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="flex flex-col">
      <div className="-my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
        <div className="py-2 align-middle inline-block min-w-full sm:px-6 lg:px-8">
          <div className="shadow overflow-hidden border-b border-gray-200 sm:rounded-lg">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    ORIGINAL URL
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    SHORTENED URL
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    DATE CREATED
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    <span className="sr-only">Share</span>
                  </th>
                  <th scope="col" className="relative px-6 py-3">
                    <span className="sr-only">Edit</span>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {shortnedLinks.map((shortened) => (
                  <tr key={shortened.shortnedUrl}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {shortened.originalUrl}
                    </td>
                    <td
                      className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 hover:cursor-pointer hover:text-indigo-600"
                      onClick={() => copyToClipboard(shortened.shortnedUrl)}
                    >
                      {shortened.shortnedUrl}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {shortened.dateCreated}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <ShareIcon className="h-5 w-5 text-gray-400 hover:cursor-pointer" />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <a
                        href="#"
                        className="text-indigo-600 hover:text-indigo-900"
                      >
                        Edit
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
