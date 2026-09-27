function normalizeDateValue(value) {
  if (!value) return null;
  if (typeof value === "number") return value > 1e12 ? value : value * 1000;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function filterArticles(articles, {
  keyword = "",
  from = null,
  to = null,
  fields = ["title", "digest", "author", "text"]
} = {}) {
  const query = String(keyword || "").trim().toLowerCase();
  const fromTs = normalizeDateValue(from);
  const toTs = normalizeDateValue(to);

  return (articles || []).filter(article => {
    if (query) {
      const haystack = fields
        .map(field => String(article?.[field] ?? ""))
        .join("\n")
        .toLowerCase();

      if (!haystack.includes(query)) return false;
    }

    if (fromTs || toTs) {
      const articleTs =
        normalizeDateValue(article.publishTime) ??
        normalizeDateValue(article.createTime) ??
        normalizeDateValue(article.sentTime);

      if (!articleTs) return false;
      if (fromTs && articleTs < fromTs) return false;
      if (toTs && articleTs > toTs) return false;
    }

    return true;
  });
}
