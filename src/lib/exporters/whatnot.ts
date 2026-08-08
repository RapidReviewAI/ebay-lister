import { MasterItem } from "../../types/inventory";

export function generateWhatnotCSV(items: MasterItem[]): string {
  const headers = ["Title", "Description", "Price", "Quantity", "Category"];

  const cleanCell = (val: any) => `"${String(val ?? '').replace(/[\r\n]+/g, ' ').replace(/"/g, '""')}"`;

  const rows = items.map((item) => {
    const title = (item.title || "").substring(0, 80);
    const description = item.description || "";
    const price = item.price || "19.99";
    const category = item.category || "";

    return [
      title,
      description,
      price,
      "1",
      category
    ].map(cleanCell).join(",");
  });

  return [headers.join(","), ...rows].join("\n");
}
