/**
 * Stands in for the recipient's address in the footer's "Sent to …" line. renderEmail swaps it
 * for the real address at send time, so templates don't need the address as a prop. A string
 * rather than React context: these modules are reachable from server components, where
 * createContext is unavailable. Kept apart from layout.tsx so the send helper can import it
 * without loading the components.
 */
export const RECIPIENT_TOKEN = "{{recipient}}";
