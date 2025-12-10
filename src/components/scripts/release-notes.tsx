import Script from "next/script";

export function ReleaseNotesScript() {
  return (
    <>
      <Script
        id="headway-config"
        strategy="lazyOnload"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: <explanation>
        dangerouslySetInnerHTML={{
          __html: `
            var HW_config = {
              selector: ".headway-badge",
              account: "7OGKj7"
            };
          `,
        }}
      />
      <Script
        id="headway-widget"
        strategy="lazyOnload"
        src="https://cdn.headwayapp.co/widget.js"
      />
    </>
  );
}
