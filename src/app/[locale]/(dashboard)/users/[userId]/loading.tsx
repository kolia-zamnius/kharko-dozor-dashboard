import { Spinner } from "@/components/ui/feedback/spinner";

/**
 * Route-level loading fallback for `/users/[userId]`.
 *
 * Next.js mounts this while the Server Component in `page.tsx` is
 * running — during the split second between navigation and the async
 * loader finishing, the user sees a single centered spinner instead of
 * a blank screen. Once the real tree streams in, this unmounts.
 *
 * The `Spinner` primitive is deliberately not tagged `"use client"` so
 * it works here without dragging the whole fallback across the client
 * boundary. Pure CSS + Tailwind, zero JS runtime, zero React Context,
 * same visual as every other loading indicator in the app.
 *
 * All downstream loading states (activity, timeline, sessions, detail)
 * are hoisted to `UserDetailShell`, which renders its own `<Spinner />`
 * for its initial-mount gate. `keepPreviousData` on those queries means
 * no spinner ever appears again after the first success. So there is
 * at most ONE spinner on screen at any moment.
 */
export default function UserDetailLoading() {
  return (
    <div className="mx-auto flex max-w-5xl justify-center py-24">
      <Spinner />
    </div>
  );
}
