"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import { Form} from "@/components/ui/form"
import Link from "next/link";
import {toast} from "sonner";
import FormField from "@/components/FormField";
import {useRouter} from "next/navigation";
import {useState} from "react";
import {
    createUserWithEmailAndPassword,
    GoogleAuthProvider,
    signInWithEmailAndPassword,
    signInWithPopup,
} from "firebase/auth";
import {auth} from "@/firebase/client";
import Logo from "@/components/Logo";
import {signIn, signInWithGoogle, signUp} from "@/lib/actions/auth.action";

const authFormSchema = (type: FormType) => {
    return z.object({
        name: type === 'sign-up' ? z.string().min(3) : z.string().optional(),
        email: z.string().email(),
        // Firebase rejects anything under 6 characters server-side; matching it
        // here fails fast with a clear message instead of a raw Firebase error.
        password: z.string().min(6, 'Password must be at least 6 characters'),
    })
}

/** Friendly copy for the Firebase Auth errors users actually hit. */
const describeAuthError = (error: unknown): string => {
    const code = (error as { code?: string })?.code ?? '';
    switch (code) {
        case 'auth/invalid-credential':
        case 'auth/wrong-password':
        case 'auth/user-not-found':
            return 'Incorrect email or password.';
        case 'auth/email-already-in-use':
            return 'An account with this email already exists. Sign in instead.';
        case 'auth/weak-password':
            return 'Please choose a stronger password (at least 6 characters).';
        case 'auth/too-many-requests':
            return 'Too many attempts. Please wait a moment and try again.';
        case 'auth/network-request-failed':
            return 'Network error. Check your connection and try again.';
        case 'auth/popup-blocked':
            return 'Your browser blocked the Google sign-in window. Allow pop-ups for this site and try again.';
        case 'auth/account-exists-with-different-credential':
            return 'This email already has a PrepWise account. Sign in with your email and password.';
        case 'auth/unauthorized-domain':
        case 'auth/operation-not-allowed':
            return "Google sign-in isn't available right now. Please use email and password.";
        default:
            return 'Something went wrong. Please try again.';
    }
}

/** Closing the Google window or double-clicking isn't an error worth a toast. */
const DISMISSED = new Set(['auth/popup-closed-by-user', 'auth/cancelled-popup-request', 'auth/user-cancelled']);

/** Google's "G" mark, as its sign-in branding guidelines require on this button. */
const GoogleMark = () => (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
        <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/>
        <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
        <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
        <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/>
    </svg>
);

const AuthForm = ({ type }: { type: FormType }) => {
    const router = useRouter();
    const [googleBusy, setGoogleBusy] = useState(false);

    // One button for both pages: the server creates the profile on first use.
    async function onGoogle() {
        setGoogleBusy(true);
        try {
            const provider = new GoogleAuthProvider();
            provider.setCustomParameters({ prompt: 'select_account' });
            const credential = await signInWithPopup(auth, provider);

            const result = await signInWithGoogle({ idToken: await credential.user.getIdToken() });
            if (!result.success) {
                toast.error(result.message ?? 'Google sign-in failed. Please try again.');
                return;
            }

            toast.success(result.isNewUser ? 'Welcome to PrepWise!' : 'Signed in successfully.');
            router.push('/');
        } catch (error) {
            const code = (error as { code?: string })?.code ?? '';
            if (DISMISSED.has(code)) return;
            console.error(error);
            toast.error(describeAuthError(error));
        } finally {
            setGoogleBusy(false);
        }
    }
    const formSchema = authFormSchema(type);

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: "",
            email: "",
            password: "",
        },
    })

    async function onSubmit(values: z.infer<typeof formSchema>) {
        try {
            if(type === 'sign-up') {
                const { name, email, password } = values;

                const userCredentials = await createUserWithEmailAndPassword(auth, email, password);

                // Only the ID token goes to our server — never the password.
                const result = await signUp({
                    idToken: await userCredentials.user.getIdToken(),
                    name: name!,
                })

                if(!result?.success) {
                    toast.error(result?.message);
                    return;
                }

                toast.success('Account created successfully. Please sign in.');
                router.push('/sign-in')
            } else {
                const { email, password } = values;

                const userCredential = await signInWithEmailAndPassword(auth, email, password);

                const idToken = await userCredential.user.getIdToken();

                if(!idToken) {
                    toast.error('Sign in failed')
                    return;
                }

                // signIn returns { success: false } on failure instead of
                // throwing — previously that was ignored and "success" shown.
                const result = await signIn({
                    email, idToken
                })
                if (result && result.success === false) {
                    toast.error(result.message ?? 'Sign in failed. Please try again.');
                    return;
                }

                toast.success('Signed in successfully.');
                router.push('/')
            }
        } catch (error) {
            console.error(error);
            toast.error(describeAuthError(error))
        }
    }

    const isSignIn = type === 'sign-in';

    return (
        <div className="card-border w-full max-w-[566px] fade-up">
            <div className="flex flex-col gap-6 card py-14 px-10 max-sm:py-10 max-sm:px-6">
                <div className="flex justify-center">
                    <Logo size={32} />
                </div>

                <h1 className="text-2xl font-semibold text-center text-balance">
                    {isSignIn ? 'Welcome back' : 'Create your account'}
                </h1>
                <p className="text-center text-light-400 -mt-3">Practice job interviews with an AI interviewer</p>

                <button
                    type="button"
                    onClick={onGoogle}
                    disabled={googleBusy || form.formState.isSubmitting}
                    aria-busy={googleBusy}
                    className="btn-secondary !w-full mt-2"
                >
                    <GoogleMark />
                    {googleBusy ? 'Opening Google…' : 'Continue with Google'}
                </button>

                <div className="flex items-center gap-3 text-xs text-fg-muted" role="separator" aria-label="or">
                    <span className="h-px flex-1 bg-line" aria-hidden="true" />
                    <span aria-hidden="true">or</span>
                    <span className="h-px flex-1 bg-line" aria-hidden="true" />
                </div>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="w-full space-y-6 form">
                        {!isSignIn && (
                            <FormField
                                control={form.control}
                                name="name"
                                label="Name"
                                placeholder="Your Name"
                                autoComplete="name"
                            />
                        )}
                        <FormField
                            control={form.control}
                            name="email"
                            label="Email"
                            placeholder="Your email address"
                            type="email"
                            autoComplete="email"
                        />

                        <FormField
                            control={form.control}
                            name="password"
                            label="Password"
                            placeholder="Enter your password"
                            type="password"
                            autoComplete={isSignIn ? 'current-password' : 'new-password'}
                        />

                        <Button className="btn" type="submit" disabled={form.formState.isSubmitting || googleBusy} aria-busy={form.formState.isSubmitting}>
                            {form.formState.isSubmitting
                                ? (isSignIn ? 'Signing in…' : 'Creating account…')
                                : (isSignIn ? 'Sign in' : 'Create an Account')}
                        </Button>
                    </form>
                </Form>
                
                <p className="text-center">
                    {isSignIn ? 'No account yet?' : 'Have an account already?'}
                    <Link href={!isSignIn ? '/sign-in' : '/sign-up'} className="font-bold text-primary-200 ml-1 underline-offset-4 hover:underline">
                        {!isSignIn ? "Sign in" : 'Sign up'}
                    </Link>
                </p>
            </div>
        </div>
    )
}
export default AuthForm
