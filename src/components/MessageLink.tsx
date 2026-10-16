import { Link } from "react-router";
import { MessageCircle } from "lucide-react";
import { useDb } from "../data/store";
import { cn } from "../lib/cn";

export function MessageLink({ peerId, children = "Message pro", className, perspective = "customer" }: {
  peerId: string; children?: string; className?: string; perspective?: "customer" | "worker";
}) {
  const session = useDb((db) => db.session);
  const target = `${perspective === "worker" ? "/work/messages" : "/messages"}?to=${encodeURIComponent(peerId)}`;
  return <Link className={cn("message-link", className)} to={session?.role === perspective ? target : `/login?as=${perspective}&next=${encodeURIComponent(target)}`}>
    <MessageCircle size={17} aria-hidden />{children}
  </Link>;
}
