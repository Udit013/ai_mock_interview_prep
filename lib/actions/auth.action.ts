'use server';

import {db, auth} from "@/firebase/admin";
import {cookies} from "next/headers";
import {getSessionUser} from "@/lib/auth/session";
import {profileFromClaims} from "@/lib/auth/profile";

const ONE_WEEK = 60 * 60 * 24 * 7;

export async function signUp(params: SignUpParams) {
    const { idToken, name } = params;

    try {
        // Public endpoint: derive the account from a verified ID token rather
        // than trusting a caller-supplied uid/email, so nobody can write a
        // profile for an account they don't hold.
        const { uid, email } = await auth.verifyIdToken(idToken);
        const displayName = typeof name === 'string' ? name.trim().slice(0, 100) : '';

        if(!email || !displayName) {
            return {
                success: false,
                message: 'Failed to create an account'
            }
        }

        const userRecord = await db.collection('users').doc(uid).get();

        if(userRecord.exists) {
            return {
                success: false,
                message: 'User already exists. Please sign in instead.'
            }
        }

        await db.collection('users').doc(uid).set({
            name: displayName, email
        })

        return {
            success: true,
            message: 'Account created successfully. Please sign in.'
        }
    } catch (e) {
        console.error('Error creating a user', e);

        if((e as { code?: string })?.code === 'auth/email-already-exists') {
            return {
                success: false,
                message: 'This email is already in use.'
            }
        }

        return {
            success: false,
            message: 'Failed to create an account'
        }
    }
}

export async function signIn(params: SignInParams) {
    const { email, idToken } = params;

    try {
        const userRecord = await auth.getUserByEmail(email);

        if(!userRecord) {
            return {
                success: false,
                message: 'User does not exist. Create an account instead.'
            }
        }

        await setSessionCookie(idToken);
    } catch (e) {
        console.log(e);

        return {
            success: false,
            message: 'Failed to log into an account.'
        }
    }
}

/**
 * "Continue with Google" — signs in, creating the PrepWise profile on first use.
 *
 * Everything is derived from the verified ID token (uid, email, name, and that
 * the sign-in really came from Google), never from caller-supplied fields.
 * One call covers both sign-up and sign-in, as users expect from this button.
 */
export async function signInWithGoogle(params: { idToken: string }) {
    try {
        const decoded = await auth.verifyIdToken(params.idToken);
        const profile = profileFromClaims(decoded);
        if (!profile) {
            return { success: false, message: 'Google sign-in failed. Please try again.' };
        }

        // create() fails if the document exists, so a returning user's profile
        // (including a name they set at sign-up) is never overwritten.
        let isNewUser = true;
        try {
            await db.collection('users').doc(decoded.uid).create(profile);
        } catch (e) {
            if ((e as { code?: number })?.code !== 6 /* ALREADY_EXISTS */) throw e;
            isNewUser = false;
        }

        await setSessionCookie(params.idToken);
        return { success: true, isNewUser };
    } catch (e) {
        console.error('Google sign-in failed', e);
        return { success: false, message: 'Google sign-in failed. Please try again.' };
    }
}

// Not exported: every export of a "use server" module is a public RPC endpoint,
// and this one mints a session from a raw ID token. Keeping it module-private
// forces callers to go through signIn(), which verifies the user first.
async function setSessionCookie(idToken: string) {
    const cookieStore = await cookies();

    const sessionCookie = await auth.createSessionCookie(idToken, {
        expiresIn: ONE_WEEK * 1000,
    })

    cookieStore.set('session', sessionCookie, {
        maxAge: ONE_WEEK,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        sameSite: 'lax'
    })
}

export async function getCurrentUser(): Promise<User | null> {
    return getSessionUser();
}

export async function isAuthenticated() {
    const user = await getCurrentUser();

    return !!user;
}

export async function signOut() {
    const cookieStore = await cookies();
    cookieStore.delete('session');
}