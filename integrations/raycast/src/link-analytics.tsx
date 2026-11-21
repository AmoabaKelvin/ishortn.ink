import {
  Action,
  ActionPanel,
  Form,
  getPreferenceValues,
  Icon,
  List,
  openExtensionPreferences,
  useNavigation,
} from "@raycast/api";
import { useForm, usePromise } from "@raycast/utils";

import { capitalize, topEntries, windowLabel } from "./lib/analytics";
import { getLinkAnalytics } from "./lib/api";
import { toApiFailure } from "./lib/errors";
import { showApiFailure } from "./lib/feedback";
import { dashboardAnalyticsUrl, PRICING_URL } from "./lib/links";
import { parseLinkReference } from "./lib/url";

import type { LinkReference } from "./lib/url";
import type { ReactNode } from "react";

type FormValues = { alias: string; domain: string };

export default function Command() {
  const { defaultDomain } = getPreferenceValues<Preferences>();
  const { push } = useNavigation();

  const { handleSubmit, itemProps } = useForm<FormValues>({
    validation: {
      alias: (value) => (parseLinkReference(value ?? "") ? undefined : "Enter an alias or a short link"),
    },
    onSubmit(values) {
      const reference = parseLinkReference(values.alias, values.domain);
      if (!reference) return;
      // The preference only fills in when neither the field nor a pasted short link names a domain.
      push(
        <LinkAnalyticsView alias={reference.alias} domain={reference.domain ?? (defaultDomain?.trim() || undefined)} />,
      );
    },
  });

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Show Analytics" icon={Icon.BarChart} onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.TextField title="Alias" placeholder="launch-day or https://isht.app/launch-day" {...itemProps.alias} />
      <Form.TextField
        title="Domain"
        placeholder="Your account's default domain"
        info="Only needed for an alias on a domain other than your default. A pasted short link already names its domain."
        {...itemProps.domain}
      />
    </Form>
  );
}

function LinkAnalyticsView({ alias, domain }: LinkReference) {
  const { apiKey } = getPreferenceValues<Preferences>();
  const { data, isLoading, error } = usePromise(getLinkAnalytics, [apiKey, alias, domain], {
    onError: (cause) => void showApiFailure(cause),
  });

  const title = domain ? `${domain}/${alias}` : alias;
  const actions = (
    <ActionPanel>
      <Action.OpenInBrowser title="Open in Dashboard" url={dashboardAnalyticsUrl(alias, domain)} />
    </ActionPanel>
  );

  if (error) {
    const failure = toApiFailure(error);
    return (
      <List navigationTitle={title}>
        <List.EmptyView
          icon={Icon.Warning}
          title={failure.title}
          description={failure.message}
          actions={
            <ActionPanel>
              {failure.kind === "invalid-key" && (
                <Action title="Open Extension Preferences" icon={Icon.Gear} onAction={openExtensionPreferences} />
              )}
              {failure.kind === "plan-required" && <Action.OpenInBrowser title="View Plans" url={PRICING_URL} />}
              <Action.OpenInBrowser title="Open in Dashboard" url={dashboardAnalyticsUrl(alias, domain)} />
            </ActionPanel>
          }
        />
      </List>
    );
  }

  if (data && data.totalClicks === 0) {
    return (
      <List navigationTitle={title}>
        <List.EmptyView
          icon={Icon.BarChart}
          title="No clicks yet"
          description={`${windowLabel(data.window)}. Clicks show up here once people open the link.`}
          actions={actions}
        />
      </List>
    );
  }

  return (
    <List isLoading={isLoading} navigationTitle={title}>
      {data && (
        <>
          <List.Section title="Overview">
            <List.Item
              icon={Icon.Mouse}
              title="Total clicks"
              subtitle={windowLabel(data.window)}
              accessories={[{ text: data.totalClicks.toLocaleString() }]}
              actions={actions}
            />
          </List.Section>
          <Breakdown title="Top countries" icon={Icon.Globe} counts={data.clicksPerCountry} actions={actions} />
          <Breakdown
            title="Top devices"
            icon={Icon.Mobile}
            counts={data.clicksPerDevice}
            formatLabel={capitalize}
            actions={actions}
          />
          <Breakdown title="Top referrers" icon={Icon.Link} counts={data.clicksPerReferrer} actions={actions} />
        </>
      )}
    </List>
  );
}

function Breakdown(props: {
  title: string;
  icon: Icon;
  counts: Record<string, number>;
  actions: ReactNode;
  formatLabel?: (label: string) => string;
}) {
  const entries = topEntries(props.counts);
  if (!entries.length) return null;
  return (
    <List.Section title={props.title}>
      {entries.map((entry) => (
        <List.Item
          key={entry.label}
          icon={props.icon}
          title={props.formatLabel?.(entry.label) ?? entry.label}
          accessories={[{ text: entry.share }, { text: entry.clicks.toLocaleString(), tooltip: "Clicks" }]}
          actions={props.actions}
        />
      ))}
    </List.Section>
  );
}
