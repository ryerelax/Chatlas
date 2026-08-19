"use client";

function getInitials(name) {
  const words = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  return words.map((word) => word[0]?.toUpperCase()).join("") || "CT";
}

export default function ProfileAvatar({
  name = "Chatlas traveller",
  src = "",
  size = "medium",
}) {
  const sizeClasses = {
    small: "h-9 w-9 text-xs",
    medium: "h-14 w-14 text-base",
    large: "h-24 w-24 text-2xl",
  };

  return (
    <div
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-attraction-primary-soft-strong font-bold text-attraction-primary-dark ${sizeClasses[size] || sizeClasses.medium}`}
      aria-label={`${name} profile picture`}
    >
      <span aria-hidden="true">{getInitials(name)}</span>
      {src && (
        // Profile images may include legacy Google URLs as well as Cloudinary.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          onError={(event) => {
            event.currentTarget.hidden = true;
          }}
        />
      )}
    </div>
  );
}
