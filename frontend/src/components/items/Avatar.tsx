interface AvatarProps {
  firstname?: string;
  lastname?: string;
  size?: number;
  textSize?: number;
  profileImage?: string | null;
}

export const Avatar = ({ firstname = "", lastname = "", size = 45, textSize = 20, profileImage }: AvatarProps) => {
  const firstInitial = firstname?.charAt(0).toUpperCase() ?? "";
  const lastInitial = lastname?.charAt(0).toUpperCase() ?? "";
  const initials = `${firstInitial}${lastInitial}`;

  return (
    <div className="avatar">
      <div className="rounded-full" style={{ width: size, height: size }}>
        {profileImage ? (
          <img src={profileImage} alt={`${firstname} ${lastname}`} className="object-cover w-full h-full rounded-full" />
        ) : (
          <div className="bg-accent font-semibold text-accent-content rounded-full flex items-center justify-center w-full h-full">
            <span style={{ fontSize: textSize }}>{initials}</span>
          </div>
        )}
      </div>
    </div>
  );
};
