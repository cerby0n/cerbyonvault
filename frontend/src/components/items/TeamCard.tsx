import AvatarList from "./AvatarList";
import { Check } from "lucide-react";

interface User {
  id: number;
  first_name: string;
  last_name: string;
}

interface Team {
  id: number;
  name: string;
  created_at: string;
  members: User[];
  isCurrentUserMember?: boolean;
}

interface TeamCardProps {
  team: Team;
  onClick: () => void;
}

export default function TeamCard({ team, onClick }: TeamCardProps) {
  return (
    <div
      className="card p-4 rounded-lg w-full max-w-sm cursor-pointer hover:bg-base-100 transition"
      onClick={onClick}
    >
      <AvatarList team={team}/>

      <h2 className="text-md font-semibold">{team.name}</h2>
      <p className="text-sm text-gray-500">
        {team.members.length} member{team.members.length > 1 && "s"}{" "}
        {team.isCurrentUserMember && (
          <span className="text-secondary font-medium ml-1 inline-flex items-center gap-1">
            <Check size={14} />
            Member
          </span>
        )}
      </p>
    </div>
  );
}
