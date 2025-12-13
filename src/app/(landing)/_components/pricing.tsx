import { CheckCircle2 } from "lucide-react";

export const Pricing = () => {
  const pricing = [
    {
      name: "STARTER",
      price: "Free",
      desc: "For hobbyists and creators.",
      features: ["50 Links / Month", "Basic Analytics", "Standard Support"],
      cta: "Start Free",
    },
    {
      name: "PRO",
      price: "$12",
      period: "/mo",
      desc: "For power users and small biz.",
      highlight: true,
      features: [
        "Unlimited Links",
        "Custom Domains",
        "QR Codes",
        "1-Year Data Retention",
      ],
      cta: "Go Pro",
    },
    {
      name: "TEAMS",
      price: "$49",
      period: "/mo",
      desc: "For agencies and big teams.",
      features: [
        "Everything in Pro",
        "5 Team Members",
        "SSO & Priority Support",
        "API Access",
      ],
      cta: "Contact Sales",
    },
  ];

  return (
    <section
      id="pricing"
      className="py-20 bg-[#0A0A0A] border-t border-white/10"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="mb-16 text-center max-w-2xl mx-auto">
          <h2 className="text-4xl font-black tracking-tighter text-white mb-4">
            FAIR PRICING.
          </h2>
          <p className="text-neutral-500">
            Start for free. Upgrade when you grow.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {pricing.map((plan, i) => (
            <div
              key={i}
              className={`relative p-8 border ${
                plan.highlight
                  ? "border-[#FF3300] bg-[#0F0F0F]"
                  : "border-white/10 bg-[#050505]"
              } flex flex-col`}
            >
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#FF3300] text-black text-xs font-bold px-3 py-1 uppercase tracking-widest">
                  Most Popular
                </div>
              )}
              <div className="mb-8">
                <h3 className="text-lg font-bold text-white mb-2">
                  {plan.name}
                </h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-black text-white">
                    {plan.price}
                  </span>
                  <span className="text-neutral-500">{plan.period}</span>
                </div>
                <p className="text-sm text-neutral-500 mt-2">{plan.desc}</p>
              </div>

              <div className="space-y-4 mb-8 flex-1">
                {plan.features.map((feat, j) => (
                  <div
                    key={j}
                    className="flex items-center gap-3 text-sm text-neutral-300"
                  >
                    <CheckCircle2
                      size={16}
                      className={
                        plan.highlight ? "text-[#FF3300]" : "text-neutral-600"
                      }
                    />
                    {feat}
                  </div>
                ))}
              </div>

              <button
                className={`w-full py-4 text-xs font-black uppercase tracking-widest border transition-all ${
                  plan.highlight
                    ? "bg-[#FF3300] border-[#FF3300] text-black hover:bg-white hover:border-white"
                    : "bg-transparent border-white/20 text-white hover:bg-white hover:text-black"
                }`}
              >
                {plan.cta}
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
