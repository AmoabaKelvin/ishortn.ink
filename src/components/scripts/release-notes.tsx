import Script from "next/script";

export function ReleaseNotesScript() {
  return (
    <Script
      id=""
      strategy="lazyOnload"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: <explanation>
      dangerouslySetInnerHTML={{
        __html: `
          (function (w,d,s,o,f,js,fjs) { w['ReleaseNotesWidget']=o;w[o] = w[o] || function () { (w[o].q = w[o].q || []).push(arguments) }; js = d.createElement(s), fjs = d.getElementsByTagName(s)[0]; js.id = o; js.src = f; js.async = 1; fjs.parentNode.insertBefore(js, fjs); }
          (window, document, 'script', 'rnw', 'https://s3.amazonaws.com/cdn.releasenotes.io/v1/bootstrap.js'));

          rnw('init', {
              account: 'ishortn.releasenotes.io',
              selector: '.rn-badge', // change the CSS selector to apply the badge and link to
              title: 'Latest Updates from iShortn',
          });
      `,
      }}
    />
  );
}
