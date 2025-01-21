import { headers } from "next/headers";

export default function VercelPage() {
  const incomingHeaders = headers();
  const countryInformation = incomingHeaders.get("X-Vercel-IP-Country ");
  const cityInformation = incomingHeaders.get("X-Vercel-IP-City ");
  // const responseFromCheckingVercelHeaders = api.link.checkVercelHeaders.query();
  return (
    <div>
      <h1>Vercel</h1>
      {/* <p>{JSON.stringify(responseFromCheckingVercelHeaders)}</p> */}
      <p>{countryInformation}</p>
      <p>{cityInformation}</p>
    </div>
  );
}
