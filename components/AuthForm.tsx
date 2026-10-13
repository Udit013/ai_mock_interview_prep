"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import { Form} from "@/components/ui/form"
import Image from "next/image";
import Link from "next/link";
import {toast} from "sonner";
import FormField from "@/components/FormField";
import {useRouter} from "next/navigation";
import {createUserWithEmailAndPassword, signInWithEmailAndPassword} from "firebase/auth";
import {auth} from "@/firebase/client";
import {signIn, signUp} from "@/lib/actions/auth.action";

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
        default:
            return 'Something went wrong. Please try again.';
    }
}

const AuthForm = ({ type }: { type: FormType }) => {
    const router = useRouter();
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
                <div className="flex flex-row gap-2 justify-center">
                    <Image
                        src="/logo.svg"
                        alt=""
                        height={32}
                        width={38}
                    />
                    <span className="text-primary-100 text-3xl font-semibold">PrepWise</span>
                </div>

                <h1 className="text-2xl font-semibold text-center text-balance">
                    {isSignIn ? 'Welcome back' : 'Create your account'}
                </h1>
                <p className="text-center text-light-400 -mt-3">Practice job interviews with an AI interviewer</p>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="w-full space-y-6 mt-4 form">
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

                        <Button className="btn" type="submit" disabled={form.formState.isSubmitting} aria-busy={form.formState.isSubmitting}>
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
