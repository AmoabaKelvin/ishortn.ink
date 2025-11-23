export const InfiniteLogos = () => {
  return (
    <div className="border-y border-white/10 bg-[#0A0A0A] overflow-hidden py-8">
      <div className="flex w-full whitespace-nowrap overflow-hidden">
        <div className="flex animate-marquee items-center gap-20 pr-20 opacity-40 grayscale">
          {[
            "INSTAGRAM",
            "TIKTOK",
            "YOUTUBE",
            "LINKEDIN",
            "TWITTER",
            "SHOPIFY",
          ].map((brand, i) => (
            <span
              key={i}
              className="text-2xl font-black text-white tracking-widest"
            >
              {brand}
            </span>
          ))}
        </div>
        <div
          className="flex animate-marquee items-center gap-20 pr-20 opacity-40 grayscale"
          aria-hidden="true"
        >
          {[
            "INSTAGRAM",
            "TIKTOK",
            "YOUTUBE",
            "LINKEDIN",
            "TWITTER",
            "SHOPIFY",
          ].map((brand, i) => (
            <span
              key={i}
              className="text-2xl font-black text-white tracking-widest"
            >
              {brand}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};
