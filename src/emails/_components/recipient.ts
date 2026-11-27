import { createContext } from "react";

/**
 * The address an email is being sent to, for the footer's "Sent to …" line. Provided by
 * renderEmail at send time; templates rendered without it (previews, tests) leave the line out.
 * Kept apart from layout.tsx so the send helper can import it without loading the components.
 */
export const EmailRecipientContext = createContext<string | null>(null);
