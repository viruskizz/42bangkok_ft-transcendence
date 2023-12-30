"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { leaveMatch } from "../../_actions/game";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export function GameHeader(props: any) {
  const { user, match } = props;
  const router = useRouter();

  const handleLeave = async () => {
    const res = await leaveMatch(match?.matchId);
    if (res.error) {
      toast.error(res.error);
    } else {
      toast.success("Left match successfully");
      router.push("/trancendence");
    }
  };

  return (
    <>
      <div className="flex justify-around">
        <div className="flex flex-col items-center">
          <Avatar className="w-16 h-16">
            <AvatarImage src={match?.player1?.imageUrl} />
            <AvatarFallback>
              {match?.player1?.displayName ?? "-"}
            </AvatarFallback>
          </Avatar>
          <Badge>{match?.player1?.displayName ?? "-"}</Badge>
        </div>
        <div className="flex flex-col gap-2 w-[200px] justify-center items-center">
          <Button variant={"outline"}>{match?.status}</Button>
          <Button size={"sm"} variant={"destructive"} onClick={handleLeave}>
            Leave
          </Button>
        </div>
        <div className="flex flex-col items-center">
          <Avatar className="w-16 h-16">
            <AvatarImage src={match?.player2?.imageUrl} />
            <AvatarFallback>
              {match?.player2?.displayName ?? "-"}
            </AvatarFallback>
          </Avatar>
          <Badge>{match?.player2?.displayName ?? "-"}</Badge>
        </div>
      </div>
    </>
  );
}
