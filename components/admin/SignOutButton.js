"use client";
import { useRouter } from "next/navigation";
import Icon from "../Icon";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function SignOutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      className="btn btn-ghost"
      onClick={async () => {
        await supabaseBrowser().auth.signOut();
        router.replace("/login");
        router.refresh();
      }}
    >
      <Icon name="logout" />Keluar
    </button>
  );
}
