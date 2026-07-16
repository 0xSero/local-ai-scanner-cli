/** Apple Silicon category page — Mac Studio + MacBook Pro M1/M2/M3 Max & Ultra. */
import { loadSnapshot } from "../../lib/data";
import { CategoryView } from "../components/category-view";

export const revalidate = 3600;

export default async function ApplePage() {
  const snapshot = await loadSnapshot();
  return <CategoryView category="apple" snapshot={snapshot} />;
}
