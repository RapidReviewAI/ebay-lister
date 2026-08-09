export const convertToEbayCSV = (items: any[]) => {
  const headers = [
    "Action",
    "Category",
    "Title",
    "Description",
    "ConditionID",
    "PicURL",
    "Quantity",
    "StartPrice",
    "C:Brand",
    "C:Size",
    "C:Color"
  ];

  const rows = items.map((item) => {
    const brand = item.item_specifics?.Brand || item.brand || "Unbranded";
    const size = item.item_specifics?.Size || item.size || "N/A";
    const color = item.item_specifics?.Color || item.color || "Multicolor";
    const photos = Array.isArray(item.photos) ? item.photos.join("|") : "";

    return [
      "Add",
      item.categoryId || "260010",
      (item.title || "").substring(0, 80),
      item.description || "",
      item.condition || "3000", // Default to Pre-owned
      photos,
      "1",
      item.price || "19.99",
      brand,
      size,
      color
    ];
  });

  return [headers, ...rows]
    .map((row) =>
      row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")
    )
    .join("\n");
};
