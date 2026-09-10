"use client";

import { EXPLORER_RANK } from "@/business/services/explorationRankService";
import { useLanguage } from "@/presentation/contexts/LanguageContext";
import { createExplorationRankPresentation } from "@/presentation/lib/explorationRankPresentation";

const RANK_BADGE_CLASSES = Object.freeze({
  [EXPLORER_RANK.NEW]: "border-[#BBC8D0] bg-[#F1F4F6] text-[#405066]",
  [EXPLORER_RANK.BRONZE]: "border-[#D9B38C] bg-[#FFF3E6] text-[#714000]",
  [EXPLORER_RANK.SILVER]: "border-[#BCC8D3] bg-[#F4F7FA] text-[#354A5F]",
  [EXPLORER_RANK.GOLD]: "border-[#E3BF5B] bg-[#FFF8D9] text-[#6B4A00]",
  [EXPLORER_RANK.MASTER]: "border-[#87CFB4] bg-[#E6F7F0] text-[#004638]",
});

export default function ExplorerRankBadge({ rank }) {
  const { lang } = useLanguage();
  const presentation = createExplorationRankPresentation(rank, lang);

  if (!presentation || !RANK_BADGE_CLASSES[rank.id]) return null;

  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full border px-3 py-1 text-xs font-bold ${RANK_BADGE_CLASSES[rank.id]}`}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-label={presentation.rankAriaLabel}
    >
      {presentation.rankLabel}
    </span>
  );
}
