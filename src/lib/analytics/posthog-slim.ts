// posthog.ts loads this module with a dynamic import. The extension bundles are imported
// statically here so the bundler can drop the ones the site doesn't use; a dynamic import of
// posthog-js/dist/extension-bundles ships every extension. Import posthog-js only through
// posthog-js/dist/module.slim, or the default build is bundled as well.
export { default as posthog } from "posthog-js/dist/module.slim";
export { AnalyticsExtensions, ToolbarExtensions } from "posthog-js/dist/extension-bundles";
