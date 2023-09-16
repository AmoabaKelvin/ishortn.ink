import { getDocs, addDoc, collection, query, where } from "firebase/firestore";
import { db } from "../utils/db";
import { generateShortUrl } from "../utils/links";
import { Link } from "@/config/schemas/link";

export const checkIfAliasExists = async (alias: string) => {
  const q = query(collection(db, "links"), where("alias", "==", alias));
  const docs = await getDocs(q);
  const docSnap = docs.docs[0];
  if (docSnap) {
    return true;
  }
  return false;
};

export const insertLink = async (
  url: string,
  alias: string,
): Promise<string> => {
  const shortCode = await generateShortUrl(url);
  const whatToInsert = alias ? alias : shortCode;
  await addDoc(collection(db, "links"), {
    originalUrl: url.trim(),
    alias: whatToInsert,
  });
  return whatToInsert;
};

export const getLink = async (url: string): Promise<Link | null> => {
  const q = query(collection(db, "links"), where("originalUrl", "==", url));
  const docs = await getDocs(q);
  const docSnap = docs.docs[0];
  if (docSnap) {
    return docSnap.data() as Link;
  }
  return null;
};

export const retrieveShortenedLink = async (
  alias: string,
): Promise<string | null> => {
  const q = query(collection(db, "links"), where("alias", "==", alias));
  const docs = await getDocs(q);
  const docSnap = docs.docs[0];
  if (docSnap) {
    return docSnap.data().originalUrl;
  }
  return null;
};
