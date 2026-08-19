import Link from "next/link";

export default function SocialProfileStatus({
  icon = "i",
  title,
  message,
  actionHref = "",
  actionLabel = "",
  tone = "neutral",
}) {
  const toneClasses = {
    neutral: "bg-attraction-surface-soft text-attraction-body",
    info: "bg-[#EAF3FA] text-attraction-body",
    error: "bg-[#FDECEC] text-attraction-body",
  };

  return (
    <div
      className={`rounded-[18px] px-6 py-11 text-center ${toneClasses[tone] || toneClasses.neutral}`}
      role={tone === "error" ? "alert" : "status"}
    >
      <span
        className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-white text-lg font-bold text-attraction-primary shadow-sm"
        aria-hidden="true"
      >
        {icon}
      </span>
      <h2 className="mt-4 text-lg font-bold text-attraction-ink">{title}</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed">{message}</p>
      {actionHref && actionLabel && (
        <Link
          href={actionHref}
          className="mt-5 inline-flex min-h-11 items-center justify-center rounded-[10px] bg-attraction-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-attraction-primary-hover focus:outline-none focus:ring-2 focus:ring-attraction-primary focus:ring-offset-2"
        >
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
