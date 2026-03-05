"use client";

import { motion } from "framer-motion";
import { IconChevronDown } from "@tabler/icons-react";
import { useState } from "react";

const CloudflareIssuesCard = () => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="overflow-hidden rounded-lg border border-neutral-200">
      <button
        type="button"
        className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-neutral-50"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span className="text-[13px] font-medium text-neutral-700">
          Having issues with Cloudflare domains?
        </span>
        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <IconChevronDown size={14} stroke={1.5} className="text-neutral-400" />
        </motion.div>
      </button>
      <motion.div
        initial="collapsed"
        animate={isExpanded ? "expanded" : "collapsed"}
        variants={{
          expanded: { opacity: 1, height: "auto" },
          collapsed: { opacity: 0, height: 0 },
        }}
        transition={{ duration: 0.2 }}
      >
        <div className="border-t border-neutral-200 px-4 py-3">
          <p className="text-[12px] leading-relaxed text-neutral-600">
            To resolve this issue, set the &quot;SSL/TLS&quot; option in Cloudflare to
            &quot;Full&quot;.
          </p>
          <div className="mt-3 text-[12px] leading-relaxed text-neutral-600">
            <p className="font-medium text-neutral-700">
              Using Cloudflare as a DNS provider?
            </p>
            <ol className="mt-1.5 list-inside list-decimal space-y-1">
              <li>In your Cloudflare dashboard, add the provided record.</li>
              <li>
                Set the Proxy status to &quot;DNS only&quot; to redirect DNS queries to
                iShortn DNS servers.
              </li>
            </ol>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default CloudflareIssuesCard;
