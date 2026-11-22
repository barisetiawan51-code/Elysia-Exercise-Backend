import { Elysia, t } from "elysia"; // Mengimpor Elysia dan 't' (TypeBox) untuk membuat aturan validasi tipe data

// Skema validasi body: memastikan request JSON berbentuk objek dengan field `text` bertipe string
const textBodySchema = t.Object({
  text: t.String(),
});

// Helper 1: Menghitung jumlah huruf vokal (a, i, u, e, o) pada teks
function countVowels(input: string): number {
  // `.match(/[aeiou]/gi)`: mencari semua huruf vokal; 'g' = semua kecocokan, 'i' = tidak peduli huruf besar/kecil
  const matches = input.match(/[aeiou]/gi);
  // Jika ada kecocokan kembalikan jumlahnya, jika tidak ada (null) kembalikan 0
  return matches ? matches.length : 0;
}

// Helper 2: Menghitung jumlah kata dalam teks
function countWords(input: string): number {
  const trimmed = input.trim(); // Menghapus spasi kosong di awal dan akhir teks
  if (!trimmed) return 0; // Jika setelah di-trim teks kosong, berarti 0 kata
  // `.split(/\s+/)`: memotong teks menjadi array berdasarkan 1 atau lebih spasi/tab/baris baru
  return trimmed.split(/\s+/).length;
}

// Helper 3: Mengubah teks menjadi format slug URL (huruf kecil & dipisah tanda '-')
function toSlug(input: string): string {
  return input
    .toLowerCase() // Mengubah semua huruf menjadi lowercase
    .trim() // Menghapus spasi di ujung kiri dan kanan
    .replace(/[^a-z0-9\s-]/g, "") // Menghapus karakter selain huruf a-z, angka 0-9, spasi, dan '-'
    .replace(/\s+/g, "-") // Mengubah spasi (satu atau lebih) menjadi satu tanda '-'
    .replace(/-+/g, "-") // Menggabungkan tanda '-' beruntun (misal "--") menjadi satu '-'
    .replace(/^-|-$/g, ""); // Menghapus tanda '-' jika berada di awal atau akhir hasil
}

// Membuat instance Elysia terpisah sebagai plugin dengan prefix "/text"
// Semua route di dalam plugin ini otomatis diawali "/text" (misal "/count" -> "/text/count")
export const textPlugin = new Elysia({ prefix: "/text", name: "text-plugin" })
  // Endpoint POST /text/count: menghitung karakter, kata, dan vokal
  .post(
    "/count",
    // `{ body }`: mengambil data JSON yang sudah lolos validasi `textBodySchema`
    ({ body }) => ({
      characters: body.text.length, // Total panjang karakter termasuk spasi
      words: countWords(body.text), // Total kata
      vowels: countVowels(body.text), // Total huruf vokal
    }),
    { body: textBodySchema } // Menerapkan validasi body ke route ini
  )
  // Endpoint POST /text/reverse: membalik urutan karakter teks
  .post(
    "/reverse",
    ({ body }) => ({
      // `[...body.text]`: memecah string menjadi array karakter (aman untuk karakter Unicode/emoji), lalu dibalik
      reversed: [...body.text].reverse().join(""),
    }),
    { body: textBodySchema }
  )
  // Endpoint POST /text/slug: mengubah teks menjadi slug
  .post(
    "/slug",
    ({ body }) => ({
      slug: toSlug(body.text),
    }),
    { body: textBodySchema }
  );