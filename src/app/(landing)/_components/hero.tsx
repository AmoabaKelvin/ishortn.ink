"use client";

import { ArrowUpRight, Copy, Zap } from "lucide-react";
import { useState } from "react";

export const Hero = () => {
  const [urlInput, setUrlInput] = useState("");
  const [shortenedLink, setShortenedLink] = useState<{
    original: string;
    short: string;
    clicks: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleShorten = (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput) return;

    setIsLoading(true);
    setTimeout(() => {
      setShortenedLink({
        original: urlInput,
        short: `ishortn.ink/${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
        clicks: 0,
      });
      setIsLoading(false);
    }, 800);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <main className="relative pt-40 pb-20 z-10 max-w-7xl mx-auto px-4 sm:px-6">
      <div className="grid lg:grid-cols-12 gap-16 items-center">
        {/* Left Column: Content */}
        <div className="lg:col-span-7 space-y-8">
          {/* <div className="inline-flex items-center gap-3 px-3 py-1 border border-white/10 bg-neutral-900/50 backdrop-blur text-xs font-mono text-[#FF3300] reveal-1">
            <span className="w-1.5 h-1.5 bg-[#FF3300] animate-pulse" />
            NOW WITH INSTAGRAM BIO SUPPORT
          </div> */}

          <h1 className="text-6xl sm:text-7xl lg:text-8xl font-black tracking-tighter text-white leading-[0.9] reveal-2">
            SHORTEN.
            <br />
            <span className="text-neutral-700">SHARE.</span>
            <br />
            TRACK.
          </h1>

          <p className="text-xl text-neutral-400 max-w-xl leading-relaxed border-l-2 border-[#FF3300] pl-6 reveal-3">
            The fastest way to manage your links. Perfect for creators,
            influencers, and small businesses who want to look professional.
          </p>

          <div className="pt-8 reveal-3">
            <div className="relative group max-w-xl">
              <div className="absolute -inset-1 bg-gradient-to-r from-[#FF3300] to-white opacity-20 group-hover:opacity-40 blur transition duration-500" />
              <div className="relative flex bg-[#0A0A0A] border border-white/10 p-1">
                <input
                  type="text"
                  placeholder="Paste your long link here..."
                  className="w-full bg-transparent p-4 text-white placeholder-neutral-600 focus:outline-none font-mono text-sm"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                />
                <button
                  onClick={handleShorten}
                  className="bg-white hover:bg-[#FF3300] text-black px-8 font-black text-sm uppercase tracking-wider transition-all flex items-center gap-2"
                >
                  {isLoading ? (
                    "WORKING..."
                  ) : (
                    <>
                      Shorten <Zap size={16} />
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Result Block */}
            {shortenedLink && (
              <div className="mt-4 bg-[#111] border border-white/10 p-4 flex items-center justify-between animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="font-mono text-sm">
                  <div className="text-neutral-500 text-xs mb-1">
                    YOUR LINK IS READY
                  </div>
                  <a
                    href={`https://${shortenedLink.short}`}
                    className="text-[#FF3300] hover:underline flex items-center gap-2"
                  >
                    {shortenedLink.short} <ArrowUpRight size={14} />
                  </a>
                </div>
                <button
                  onClick={() => copyToClipboard(shortenedLink.short)}
                  className="p-2 hover:bg-white/10 text-white transition-colors"
                >
                  <Copy size={18} />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Visual */}
        <div className="lg:col-span-5 relative reveal-3 delay-300 hidden lg:block">
          <div className="absolute inset-0 bg-[#FF3300] blur-[100px] opacity-10" />
          <div className="relative bg-[#0A0A0A] border border-white/10 p-1">
            <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-[#111]">
              <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-neutral-700" />
                <div className="w-3 h-3 rounded-full bg-neutral-700" />
              </div>
              <div className="font-mono text-xs text-neutral-500">
                YOUR DASHBOARD
              </div>
            </div>
            <div className="p-6 space-y-6">
              {/* Stats Row */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#111] p-4 border border-white/5">
                  <div className="text-neutral-500 text-xs font-mono mb-2">
                    TODAY'S CLICKS
                  </div>
                  <div className="text-2xl font-bold text-white">142</div>
                </div>
                <div className="bg-[#111] p-4 border border-white/5">
                  <div className="text-neutral-500 text-xs font-mono mb-2">
                    TOP SOURCE
                  </div>
                  <div className="text-2xl font-bold text-[#FF3300]">
                    Instagram
                  </div>
                </div>
              </div>
              {/* Graph Area */}
              <div className="h-40 bg-[#111] border border-white/5 relative overflow-hidden flex items-end px-1 gap-1">
                {[
                  40, 70, 45, 90, 65, 85, 50, 75, 60, 95, 80, 55, 90, 70, 100,
                  85,
                ].map((h, i) => (
                  <div
                    key={i}
                    className="flex-1 bg-neutral-800 hover:bg-[#FF3300] transition-colors duration-300"
                    style={{ height: `${h}%` }}
                  />
                ))}
                <div className="absolute top-0 w-full h-px bg-[#FF3300] opacity-50 scanline" />
              </div>
              {/* Code block */}
              <div className="font-mono text-xs text-neutral-400 bg-black p-3 border-l-2 border-[#FF3300]">
                latest_activity:
                <br />- New click from New York
                <br />-{" "}
                <span className="text-white">Goal reached: 100 clicks!</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
};
