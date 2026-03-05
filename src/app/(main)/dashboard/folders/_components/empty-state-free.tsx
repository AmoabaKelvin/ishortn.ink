"use client";

import { IconDiamond, IconFolder } from "@tabler/icons-react";
import { motion } from "framer-motion";
import { Link } from "next-view-transitions";

export function EmptyStateFree() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="relative flex min-h-[400px] flex-col items-center justify-center overflow-hidden py-20"
    >
      {/* Grid background */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgb(212 212 212 / 0.5) 1px, transparent 1px)",
          backgroundSize: "20px 20px",
          maskImage:
            "radial-gradient(ellipse 60% 50% at 50% 50%, black 20%, transparent 100%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 60% 50% at 50% 50%, black 20%, transparent 100%)",
        }}
      />

      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.15 }}
        className="relative"
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-neutral-100">
          <IconFolder size={24} stroke={1.5} className="text-neutral-400" />
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.25 }}
        className="mt-6 text-center"
      >
        <p className="text-[14px] font-medium text-neutral-900">
          Organize your links with folders
        </p>
        <p className="mt-1 max-w-xs text-[13px] leading-relaxed text-neutral-400">
          Group links by project, campaign, or client. Folders are available on the Pro plan.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.35 }}
      >
        <Link
          href="/dashboard/settings#billing"
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-blue-700"
        >
          <IconDiamond size={16} stroke={1.5} />
          Upgrade to Pro
        </Link>
      </motion.div>
    </motion.div>
  );
}
