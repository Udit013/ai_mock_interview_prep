/**
 * Session lookup shared by layouts, pages and route handlers.
 *
 * Not `"use server"`: this is a plain server module, so nothing here becomes a
 * public RPC endpoint. `lib/actions/auth.action.ts` re-exposes it.
 */

import { cache } from "react";
import { cookies } from "next/headers";
import { db, auth } from "@/firebase/admin";

/**
 * The signed-in user, or null.
 *
 * Wrapped in React `cache()` so the layout's auth guard and the page below it
 * share one lookup per request instead of each paying for a revocation check
 * against Firebase Auth plus a Firestore read. Outside a React render (route
 * handlers, server actions) it simply runs once per call.
 */
export const getSessionUser = cache(async (): Promise<User | null> => {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session")?.value;
  if (!sessionCookie) return null;

  try {
    const decodedClaims = await auth.verifySessionCookie(sessionCookie, true);
    const userRecord = await db.collection("users").doc(decodedClaims.uid).get();
    if (!userRecord.exists) return null;

    return { ...userRecord.data(), id: userRecord.id } as User;
  } catch (e) {
    console.log(e);
    return null;
  }
});
