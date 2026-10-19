export function getYouTubeId(url: string): null | string {
  if (!url) return null;

  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);

  return match && match[2].length === 11 ? match[2] : null;
}

export function cleanGuessName(teaName: string): string {
  if (!teaName) return "";

  return teaName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export const TEA_TYPE_LABELS: Record<string, string> = {
  BLACK: "Té Negro",
  BLEND: "Mezcla",
  CHAI: "Chai",
  GREEN: "Té Verde",
  HERBAL: "Infusión",
  MATCHA: "Matcha",
  MATE: "Mate",
  OOLONG: "Té Azul (Oolong)",
  RED: "Té Rojo (Pu-Ehr)",
  ROOIBOS: "Rooibos",
  WHITE: "Té Blanco",
};
