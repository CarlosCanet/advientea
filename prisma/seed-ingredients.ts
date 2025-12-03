import { prisma } from "@/lib/prisma";

const INGREDIENTS = [
  // Bases
  "Té Negro",
  "Té Verde",
  "Té Blanco",
  "Té Rojo (Pu Erh)",
  "Té Oolong (Azul)",
  "Té Matcha",
  "Rooibos",
  "Honeybush",
  "Yerba Mate",

  // Especias y Hierbas
  "Canela",
  "Jengibre",
  "Cardamomo",
  "Clavo",
  "Pimienta negra",
  "Pimienta rosa",
  "Anís estrellado",
  "Anís verde",
  "Hinojo",
  "Regaliz",
  "Vainilla",
  "Menta",
  "Hierbabuena",
  "Hierba limón (Lemongrass)",
  "Melisa",
  "Cúrcuma",
  "Chile",
  "Cilantro",
  "Ortiga",
  "Valeriana",
  "Tila",

  // Cítricos
  "Cáscara de naranja",
  "Cáscara de limón",
  "Lima",
  "Bergamota",
  "Pomelo",
  "Mandarina",
  "Flor de Azahar",

  // Frutas
  "Manzana",
  "Fresa",
  "Frambuesa",
  "Arándano",
  "Grosella",
  "Cereza",
  "Melocotón",
  "Albaricoque",
  "Mango",
  "Piña",
  "Papaya",
  "Coco",
  "Higo",
  "Dátil",
  "Pasas",
  "Fruta de la pasión",
  "Plátano",
  "Bayas de Goji",
  "Saúco",
  "Escaramujo",

  // Flores
  "Pétalos de rosa",
  "Hibisco",
  "Lavanda",
  "Jazmín",
  "Manzanilla",
  "Aciano (Flor de aciano)",
  "Caléndula",
  "Malva",
  "Girasol",
  "Azafrán silvestre",
  "Osmanthus",

  // Dulces y Gourmand
  "Cacao",
  "Cáscara de cacao",
  "Trozos de chocolate",
  "Chocolate blanco",
  "Caramelo",
  "Toffee",
  "Nubes de azúcar (Marshmallows)",
  "Turrón",
  "Almendra",
  "Nuez",
  "Avellana",
  "Pistacho",
  "Nuez de Macadamia",
  "Miel",
  "Yogur",
  "Nata",
  "Sirope de arce",

  // Otros
  "Zanahoria",
  "Remolacha",
  "Calabaza",
  "Arroz tostado (Genmaicha)",
  "Algas",
  "Hojas de zarzamora",
  "Eucalipto",
];

async function main() {
  console.log("Seeding ingredients");
  for (const name of INGREDIENTS) {
    await prisma.teaIngredient.upsert({
      where: { name },
      create: { name },
      update: {},
    });
  }
  console.log("Done. Ingredients seeded");
}

main()