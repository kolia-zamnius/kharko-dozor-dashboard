import { Avatar, AvatarFallback, AvatarGroup, AvatarImage } from "@/components/ui/primitives/avatar";
import type { Session } from "next-auth";

type DoubleAvatarProps = {
  user?: Session["user"];
  orgImage?: string;
  hasNotification?: boolean;
};

export function DoubleAvatar({ user, orgImage, hasNotification }: DoubleAvatarProps) {
  return (
    <div className="relative">
      <AvatarGroup>
        <Avatar size="sm" className="opacity-80">
          {orgImage ? <AvatarImage src={orgImage} alt="" /> : null}
          <AvatarFallback />
        </Avatar>
        <Avatar size="sm">
          {user?.image ? <AvatarImage src={user.image} alt={user.name || ""} /> : null}
          <AvatarFallback />
        </Avatar>
      </AvatarGroup>
      {hasNotification && (
        <span
          aria-hidden
          className="bg-destructive ring-background pointer-events-none absolute -top-0.5 -right-0.5 size-2.5 rounded-full ring-2"
        />
      )}
    </div>
  );
}
