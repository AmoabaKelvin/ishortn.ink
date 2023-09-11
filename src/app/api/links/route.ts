import { getDocs, addDoc, collection, query, where } from "firebase/firestore";
import { db } from "../utils/db";
import { generateShortUrl } from "../utils/links";

export async function POST(req: Request) {
  const { url } = await req.json();

  if (!url) {
    return new Response("Invalid URL", { status: 400 });
  }

  const q = query(collection(db, "links"), where("original_url", "==", url));
  const docs = await getDocs(q);
  const docSnap = docs.docs[0];

  if (docSnap) {
    console.log(docSnap.data());
    return new Response(JSON.stringify({ url: docSnap.data().original_url }));
  }

  const shortUrl = await generateShortUrl(url);
  await addDoc(collection(db, "links"), {
    original_url: url,
    short_code: shortUrl,
  });

  const urlToShorten = `ishortn.ink/${shortUrl}`;
  return new Response(JSON.stringify({ url: urlToShorten }), { status: 201 });
}

export async function GET(req: Request) {
  const url = new URL(req.url).searchParams.get("url");

  const q = query(collection(db, "links"), where("short_code", "==", url));
  const docs = await getDocs(q);
  const docSnap = docs.docs[0];

  if (docSnap) {
    return new Response(JSON.stringify({ url: docSnap.data().original_url }));
  }

  return new Response("Not Found", { status: 404 });
}
