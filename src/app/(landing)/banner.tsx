export const LandingPageBanner = () => {
  return (
    <div
      id="banner"
      tabIndex={-1}
      className="fixed z-50 w-full gap-8 px-4 py-5 bg-red-300"
    >
      <p className="font-light text-center text-black ">
        We are currently
        <b> facing issues with our servers</b>, making services unavailable. We
        are working to resolve the issue as soon as possible. We apologize for
        the inconvenience.
      </p>
    </div>
  );
};
