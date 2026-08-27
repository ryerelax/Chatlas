import { EXPLORER_RANK } from "@/business/services/explorationRankService";

const RANK_COPY = Object.freeze({
  en: {
    locale: "en-MY",
    labels: {
      [EXPLORER_RANK.NEW]: "New Explorer",
      [EXPLORER_RANK.BRONZE]: "Bronze Explorer",
      [EXPLORER_RANK.SILVER]: "Silver Explorer",
      [EXPLORER_RANK.GOLD]: "Gold Explorer",
      [EXPLORER_RANK.MASTER]: "Melaka Master",
    },
    rankAriaLabel: (rankLabel) => `Explorer rank: ${rankLabel}`,
    nextRankMessage: (percentage, nextRankLabel) =>
      `${percentage}% more to reach ${nextRankLabel}`,
    completeMessage:
      "All supported attractions explored — Melaka Master achieved!",
  },
  zh: {
    locale: "zh-CN",
    labels: {
      [EXPLORER_RANK.NEW]: "新晋探索者",
      [EXPLORER_RANK.BRONZE]: "铜级探索者",
      [EXPLORER_RANK.SILVER]: "银级探索者",
      [EXPLORER_RANK.GOLD]: "金级探索者",
      [EXPLORER_RANK.MASTER]: "马六甲大师",
    },
    rankAriaLabel: (rankLabel) => `探索等级：${rankLabel}`,
    nextRankMessage: (percentage, nextRankLabel) =>
      `再探索 ${percentage}% 即可晋升为${nextRankLabel}`,
    completeMessage: "已探索所有支持的景点——达成马六甲大师！",
  },
  ms: {
    locale: "ms-MY",
    labels: {
      [EXPLORER_RANK.NEW]: "Penjelajah Baharu",
      [EXPLORER_RANK.BRONZE]: "Penjelajah Gangsa",
      [EXPLORER_RANK.SILVER]: "Penjelajah Perak",
      [EXPLORER_RANK.GOLD]: "Penjelajah Emas",
      [EXPLORER_RANK.MASTER]: "Pakar Melaka",
    },
    rankAriaLabel: (rankLabel) => `Taraf penjelajah: ${rankLabel}`,
    nextRankMessage: (percentage, nextRankLabel) =>
      `Terokai lagi ${percentage}% untuk mencapai ${nextRankLabel}`,
    completeMessage:
      "Semua tarikan yang disokong telah diterokai — tahap Pakar Melaka dicapai!",
  },
});

function getRankCopy(language) {
  const resolvedLanguage = language === "bm" ? "ms" : language;
  return RANK_COPY[resolvedLanguage] || RANK_COPY.en;
}

export function createExplorationRankPresentation(rank, language = "en") {
  if (!rank) return null;

  const copy = getRankCopy(language);
  const rankLabel = copy.labels[rank.id];
  if (!rankLabel) return null;

  let message = copy.completeMessage;
  if (!rank.isComplete) {
    const nextRankLabel = copy.labels[rank.nextRankId];
    if (!nextRankLabel || !Number.isFinite(rank.percentageToNext)) {
      return null;
    }

    const percentage = new Intl.NumberFormat(copy.locale, {
      maximumFractionDigits: 1,
    }).format(rank.percentageToNext);
    message = copy.nextRankMessage(percentage, nextRankLabel);
  }

  return Object.freeze({
    rankLabel,
    rankAriaLabel: copy.rankAriaLabel(rankLabel),
    message,
  });
}
