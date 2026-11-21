import {
  Action,
  ActionPanel,
  Clipboard,
  Form,
  getPreferenceValues,
  getSelectedText,
  Icon,
  Keyboard,
  open,
  showToast,
  Toast,
} from "@raycast/api";
import { useForm, usePromise } from "@raycast/utils";

import { createLink } from "./lib/api";
import { showApiFailure } from "./lib/feedback";
import { parseHttpUrl } from "./lib/url";

type FormValues = { url: string; alias: string; domain: string };

async function detectUrl(): Promise<string> {
  try {
    const selected = parseHttpUrl(await getSelectedText());
    if (selected) return selected;
  } catch {
    // No text is selected, or Raycast lacks the accessibility permission to read it.
  }
  return parseHttpUrl(await Clipboard.readText()) ?? "";
}

export default function Command() {
  const { data, isLoading } = usePromise(detectUrl);
  // useForm reads initial values once, so mount the form after detection finishes.
  if (isLoading) return <Form isLoading />;
  return <ShortenLinkForm initialUrl={data ?? ""} />;
}

function ShortenLinkForm({ initialUrl }: { initialUrl: string }) {
  const { apiKey, defaultDomain } = getPreferenceValues<Preferences>();

  const { handleSubmit, itemProps, reset, focus } = useForm<FormValues>({
    initialValues: { url: initialUrl, alias: "", domain: defaultDomain?.trim() ?? "" },
    validation: {
      url: (value) => (parseHttpUrl(value) ? undefined : "Enter a URL that starts with http:// or https://"),
    },
    async onSubmit(values) {
      const toast = await showToast({ style: Toast.Style.Animated, title: "Shortening link…" });
      try {
        const link = await createLink(apiKey, { url: values.url.trim(), alias: values.alias, domain: values.domain });
        await Clipboard.copy(link.shortLink);

        toast.style = Toast.Style.Success;
        toast.title = "Short link copied";
        toast.message = link.shortLink;
        toast.primaryAction = {
          title: "Open in Browser",
          shortcut: Keyboard.Shortcut.Common.Open,
          onAction: () => void open(link.shortLink),
        };
        toast.secondaryAction = {
          title: "Copy",
          shortcut: Keyboard.Shortcut.Common.Copy,
          onAction: () => void Clipboard.copy(link.shortLink),
        };

        reset({ url: "", alias: "", domain: values.domain });
        focus("url");
      } catch (error) {
        await showApiFailure(error, toast);
      }
    },
  });

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Shorten Link" icon={Icon.Link} onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.TextField title="URL" placeholder="https://example.com/page" {...itemProps.url} />
      <Form.TextField
        title="Alias"
        placeholder="Random if empty"
        info="Letters, numbers, - and _, up to 20 characters."
        {...itemProps.alias}
      />
      <Form.TextField
        title="Domain"
        placeholder="Your account's default domain"
        info="A platform domain such as isht.app, or a custom domain active in your personal workspace. Leave empty to use your account's default."
        {...itemProps.domain}
      />
    </Form>
  );
}
