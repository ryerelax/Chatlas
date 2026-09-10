const MONTHS_SHORT = {
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  zh: ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"],
  ms: ["Jan", "Feb", "Mac", "Apr", "Mei", "Jun", "Jul", "Ogos", "Sep", "Okt", "Nov", "Dis"],
};

const MONTHS_LONG = {
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  zh: ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"],
  ms: ["Januari", "Februari", "Mac", "April", "Mei", "Jun", "Julai", "Ogos", "September", "Oktober", "November", "Disember"],
};

/**
 * @param {string|Date|number} value
 * @param {"en"|"zh"|"ms"} lang
 * @param {"short"|"long"} style
 */
export function formatLocaleDate(value, lang = "en", style = "short") {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const table = style === "long" ? MONTHS_LONG : MONTHS_SHORT;
  const months = table[lang] || table.en;
  const day = date.getDate();
  const month = months[date.getMonth()];
  const year = date.getFullYear();

  if (lang === "zh") {
    return `${year}年${month}${day}日`;
  }
  // en / ms: 28 Ogos 2026
  return `${day} ${month} ${year}`;
}