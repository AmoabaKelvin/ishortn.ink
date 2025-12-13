"use client";

import { ArrowUpRight, BarChart2, Cpu, Globe, QrCode } from "lucide-react";
import { useState } from "react";

export const Features = () => {
  const [activeFeature, setActiveFeature] = useState(0);

  const features = [
    {
      title: "Click Analytics",
      desc: "See exactly who clicks your links and where they are coming from. Simple, clear charts.",
      icon: <BarChart2 className="w-6 h-6" />,
      visual: (
        <div className="w-full h-full flex flex-col justify-between p-6 bg-neutral-900 border border-white/10">
          <div className="flex justify-between items-end border-b border-white/10 pb-4">
            <div>
              <div className="text-xs text-neutral-500 font-mono mb-1">
                TOTAL CLICKS
              </div>
              <div className="text-4xl font-black tracking-tighter text-white">
                12,405
              </div>
            </div>
            <div className="text-[#FF3300] font-mono text-xs flex items-center gap-1">
              <div className="w-2 h-2 bg-[#FF3300] animate-pulse" /> LIVE
            </div>
          </div>
          <div className="space-y-4 mt-4 font-mono text-xs">
            <div className="space-y-1">
              <div className="flex justify-between text-neutral-400">
                <span>Instagram</span>
                <span className="text-white">65%</span>
              </div>
              <div className="w-full bg-neutral-800 h-1 rounded-full">
                <div className="bg-[#FF3300] h-1 w-[65%] rounded-full" />
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-neutral-400">
                <span>Twitter / X</span>
                <span className="text-white">25%</span>
              </div>
              <div className="w-full bg-neutral-800 h-1 rounded-full">
                <div className="bg-white h-1 w-[25%] rounded-full" />
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: "Your Brand",
      desc: "Stop using generic links. Connect your own domain to make every link look professional.",
      icon: <Globe className="w-6 h-6" />,
      visual: (
        <div className="w-full h-full flex items-center justify-center p-6 bg-neutral-900 border border-white/10 relative overflow-hidden">
          <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.05)_50%,transparent_75%,transparent_100%)] bg-[length:250%_250%,100%_100%] bg-[position:0_0,0_0] animate-shine" />
          <div className="bg-black border border-white/20 p-6 w-full max-w-xs font-mono text-sm relative z-10">
            <div className="flex flex-col gap-4">
              <div className="opacity-50 line-through text-neutral-500">
                ishortn.ink/x9s8z
              </div>
              <div className="flex justify-center">
                <ArrowUpRight className="text-[#FF3300]" />
              </div>
              <div className="text-lg font-bold text-white border-b-2 border-[#FF3300] pb-1 inline-block text-center">
                links.jessica.com/new
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: "Smart QR Codes",
      desc: "Instantly create QR codes for your flyers, business cards, or stickers.",
      icon: <QrCode className="w-6 h-6" />,
      visual: (
        <div className="w-full h-full bg-[#0A0A0A] p-8 flex items-center justify-center border border-white/10 relative">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,#FF3300_0%,transparent_70%)] opacity-10 blur-xl" />
          <div className="bg-white p-4 rounded-xl shadow-2xl transform rotate-3 transition-transform group-hover:rotate-0 duration-500">
            <QrCode className="w-32 h-32 text-black" />
          </div>
        </div>
      ),
    },
  ];

  return (
    <section id="features" className="py-32 max-w-7xl mx-auto px-4 sm:px-6">
      <div className="flex flex-col md:flex-row justify-between items-end mb-20 border-b border-white/10 pb-8">
        <h2 className="text-5xl md:text-6xl font-black tracking-tighter text-white">
          POWERFUL TOOLS. <br />
          <span className="text-neutral-600">ZERO HASSLE.</span>
        </h2>
        <p className="font-mono text-[#FF3300] mb-2 md:mb-0 flex items-center gap-2">
          <Cpu size={16} />
          SIMPLE_BY_DESIGN
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-white/10 border border-white/10">
        {features.map((feature, index) => (
          <div
            key={index}
            className="bg-[#050505] group hover:bg-[#0A0A0A] transition-colors duration-500 h-[500px] flex flex-col relative"
            onMouseEnter={() => setActiveFeature(index)}
          >
            <div className="p-8 flex-1 relative z-10">
              <div className="w-12 h-12 bg-[#111] border border-white/10 flex items-center justify-center text-white mb-6 group-hover:bg-[#FF3300] group-hover:text-black transition-colors duration-300">
                {feature.icon}
              </div>
              <h3 className="text-xl font-bold text-white mb-2 tracking-tight">
                {feature.title}
              </h3>
              <p className="text-neutral-500 text-sm leading-relaxed max-w-[80%]">
                {feature.desc}
              </p>
            </div>

            <div className="flex-1 relative overflow-hidden mx-6 mb-6 border border-white/5 bg-black/50">
              {feature.visual}
            </div>

            {/* Corner Accent */}
            <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-[#FF3300] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          </div>
        ))}
      </div>
    </section>
  );
};
