import type { Conversation, HistoryGroup } from "./types";

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function groupConversationsByDate(
  conversations: Conversation[],
): HistoryGroup[] {
  const today = startOfDay(new Date());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const groups: Record<string, Conversation[]> = {
    today: [],
    yesterday: [],
    previous7Days: [],
    older: [],
  };

  const sorted = [...conversations].sort(
    (a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );

  for (const conv of sorted) {
    const d = startOfDay(new Date(conv.updatedAt));
    if (d.getTime() === today.getTime()) {
      groups.today.push(conv);
    } else if (d.getTime() === yesterday.getTime()) {
      groups.yesterday.push(conv);
    } else if (d >= sevenDaysAgo) {
      groups.previous7Days.push(conv);
    } else {
      groups.older.push(conv);
    }
  }

  const labels: Record<string, string> = {
    today: "Hôm nay",
    yesterday: "Hôm qua",
    previous7Days: "7 ngày trước",
    older: "Cũ hơn",
  };

  return (["today", "yesterday", "previous7Days", "older"] as const)
    .filter((key) => groups[key].length > 0)
    .map((key) => ({
      key,
      label: labels[key],
      conversations: groups[key],
    }));
}
