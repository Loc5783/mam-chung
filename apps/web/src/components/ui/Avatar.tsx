import { Profile } from "../../features/auth/store";
export function Avatar({
  user,
  small = false,
}: {
  user: Profile | null;
  small?: boolean;
}) {
  return (
    <span className={`avatar${small ? " small" : ""}`}>
      <span>{user?.name.charAt(0).toUpperCase() || "B"}</span>
      {user?.avatar && (
        <img
          key={user.avatar}
          src={user.avatar}
          alt={`Ảnh đại diện của ${user.name}`}
          referrerPolicy="no-referrer"
          onError={(event) => {
            event.currentTarget.hidden = true;
          }}
        />
      )}
    </span>
  );
}
