import { api } from "@/trpc/server";

export default function VercelPage() {
  const responseFromCheckingVercelHeaders = api.link.checkVercelHeaders.query();
  return (
    <div>
      <h1>Vercel</h1>
      <p>{JSON.stringify(responseFromCheckingVercelHeaders)}</p>
    </div>
  );
}
