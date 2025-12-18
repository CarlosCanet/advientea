
export function getYouTubeId(url: string): string | null {
  if (!url) return null;

  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;  
  const match = url.match(regExp);

  return (match && match[2].length === 11) ? match[2] : null;
}

export function cleanGuessName(teaName: string): string {
  if (!teaName) return "";

  return teaName
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export const TEA_TYPE_LABELS: Record<string,string> = {
  BLACK: "Té Negro",
  GREEN: "Té Verde",
  RED: "Té Rojo (Pu-Ehr)",
  WHITE: "Té Blanco",
  OOLONG: "Té Azul (Oolong)",
  ROOIBOS: "Rooibos",
  HERBAL: "Infusión",
  MATE: "Mate",
  CHAI: "Chai",
  MATCHA: "Matcha",
  BLEND: "Mezcla",
};