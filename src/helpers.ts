// Type union di TypeScript: nilai hanya boleh salah satu dari "c", "f", atau "k"
export type TempUnit = "c" | "f" | "k";

// Fungsi konversi suhu antar Celsius ('c'), Fahrenheit ('f'), dan Kelvin ('k')
export function convertTemperature(value: number, from: TempUnit, to: TempUnit): number {
  if (from === to) return value; // Jika satuan asal sama dengan tujuan, tidak perlu dihitung ulang

  // Langkah 1: Konversi nilai awal ke Celsius sebagai satuan tengah
  let celsius: number;
  if (from === "c") celsius = value;
  else if (from === "f") celsius = ((value - 32) * 5) / 9;
  else celsius = value - 273.15; // Jika 'from' adalah 'k' (Kelvin)

  // Langkah 2: Konversi dari Celsius ke satuan tujuan yang diminta
  let result: number;
  if (to === "c") result = celsius;
  else if (to === "f") result = (celsius * 9) / 5 + 32;
  else result = celsius + 273.15; // Jika 'to' adalah 'k' (Kelvin)

  // `.toFixed(2)` membulatkan 2 angka desimal (menghasilkan string), lalu `Number(...)` mengubahnya kembali ke tipe number
  return Number(result.toFixed(2));
}

// Fungsi menentukan kategori BMI berdasarkan angka BMI yang sudah dihitung
export function getBmiCategory(bmi: number): "Underweight" | "Normal" | "Overweight" | "Obese" {
  if (bmi < 18.5) return "Underweight"; // Kurang dari 18.5
  if (bmi < 25) return "Normal"; // 18.5 sampai < 25
  if (bmi < 30) return "Overweight"; // 25 sampai < 30
  return "Obese"; // 30 atau lebih
}