import { TeaType } from '@/generated/prisma/enums'
import { calculateIngredientsScore, calculatePersonNameScore, calculateTeaNameScore, calculateTeaTypeScore, calculateTimeScore } from '@/lib/tea-guess-scoring'
import { describe, expect, it, vi } from 'vitest'

describe("Tea guess scoring", () => { 
  describe("TeaName scoring", () => { 
    it("should give 200 points to guess name", () => {
      const result1 = calculateTeaNameScore("Té Pakistaní", "Té Pakistaní");
      const result2 = calculateTeaNameScore("Té Pakistaní", "Te Pakistani");
      const result3 = calculateTeaNameScore("Té Pakistaní", "Te paKistani");
      
      expect(result1).toBe(200);
      expect(result2).toBe(200);
      expect(result3).toBe(200);
    })

    it("should give 0 points to be incredibly wrong", () => {
      const result1 = calculateTeaNameScore("Té Pakistaní", "Chai ruta del desierto con dulces frutos del bosque");
      const result2 = calculateTeaNameScore("Té Pakistaní", "Infusión de hierbas");
      const result3 = calculateTeaNameScore("Té Pakistaní", "Blanco de la pradera");
      const result4 = calculateTeaNameScore("Té Pakistaní", "Chai Pu-Ehr");
      
      expect(result1).toBe(0);
      expect(result2).toBe(0);
      expect(result3).toBe(0);
      expect(result4).toBe(0);
    })

    it("should give around 100 points to be somewhat on the middle", () => {
      const result1 = calculateTeaNameScore("Té Oolong con hierbas", "Té oolong");
      const result2 = calculateTeaNameScore("Té Oolong con hierbas", "Infusión de hierbas");
      expect(result1).toBe(85);
      expect(result2).toBe(104);
    })
  })

  describe("TeaType scoring", () => { 
    it("should give 200 points if you guessed it", () => {
      const result1 = calculateTeaTypeScore(TeaType.BLACK, TeaType.BLACK);
      const result2 = calculateTeaTypeScore(TeaType.GREEN, TeaType.GREEN);
      const result3 = calculateTeaTypeScore(TeaType.OOLONG, TeaType.OOLONG);
      expect(result1).toBe(200);
      expect(result2).toBe(200);
      expect(result3).toBe(200);
    })

    it("should give 0 points if you don't guessed it", () => {
      const result1 = calculateTeaTypeScore(TeaType.BLACK, TeaType.GREEN);
      const result2 = calculateTeaTypeScore(TeaType.GREEN, TeaType.BLACK);
      const result3 = calculateTeaTypeScore(TeaType.OOLONG, TeaType.BLACK);
      expect(result1).toBe(0);
      expect(result2).toBe(0);
      expect(result3).toBe(0);
    })
  })

  describe("Timestamp scoring", () => { 
    it("should give 200 points if you guessed it before 10:00 h", () => { 
      const date = new Date();
      date.setHours(10, 0, 0, 0);
      const result1 = calculateTimeScore(date);
      expect(result1).toBe(200);

      
    })
    it("should give 100 points if you guessed it at 15:00 h ", () => { 
      const date = new Date();
      date.setHours(15, 0, 0, 0);
      const result1 = calculateTimeScore(date);
      expect(result1).toBe(100);

      
    })
    it("should give 0 points if you guessed it at 20:00 h", () => { 
      const date = new Date();
      date.setHours(20, 0, 0, 0);
      const result1 = calculateTimeScore(date);
      expect(result1).toBe(0);
    })
    
  })

  describe("Person Name scoring", () => { 
    it("should give 200 points to guess name", () => {
      const result1 = calculatePersonNameScore("Carlos", "Carlos")
      const result2 = calculateTeaNameScore("Ana", "ana");
      const result3 = calculateTeaNameScore("Ana", "aNa");
      
      expect(result1).toBe(200);
      expect(result2).toBe(200);
      expect(result3).toBe(200);
    })

    it("should give 0 points to be incredibly wrong", () => {
      const result1 = calculatePersonNameScore("Carlos", "Eve")
      const result2 = calculateTeaNameScore("Ana", "Carlos");
      const result3 = calculateTeaNameScore("Ana", "miko");
      
      expect(result1).toBe(0);
      expect(result2).toBe(0);
      expect(result3).toBe(0);
    })

    it("should give around 100 points to be somewhat on the middle", () => {
      const result1 = calculatePersonNameScore("Carlos", "Carlota")
      const result2 = calculateTeaNameScore("Ana", "anita");
      expect(result1).toBe(133);
      expect(result2).toBe(66);
    })
  })

  describe("Tea ingredients scoring", () => { 
    const ingredients1: Array<string> = ["Manzana", "Jengibre", "Limón", "Azahar"];
    const ingredients2: Array<string> = ["Manzana", "Jengibre", "Limón"];

    it("should give 200 points to guess all ingredients", () => {
      const result1 = calculateIngredientsScore(ingredients1, ["Manzana", "Azahar", "Limón", "Jengibre"]);
      const result2 = calculateIngredientsScore(ingredients1, ["Manzana", "Jengibre", "Limón", "Azahar"]);
      
      expect(result1).toBe(200);
      expect(result2).toBe(200);
    })

    it("should give 0 points to don't guess any ingredient", () => {
      const result1 = calculateIngredientsScore(ingredients1, ["Melocotón"]);
      const result2 = calculateIngredientsScore(ingredients1, ["Melocotón", "Naranja", "Pétalos de Rosa"]);
      const result3 = calculateIngredientsScore(ingredients1, ["Melocotón", "Naranja", "Pétalos de Rosa", "Jugo"]);
      
      expect(result1).toBe(0);
      expect(result2).toBe(0);
      expect(result3).toBe(0);
    })

    it("should give around half points to guess half the ingredients", () => {
      const result1 = calculateIngredientsScore(ingredients1, ["Manzana", "Limón"]);
      const result2 = calculateIngredientsScore(ingredients1, ["Melocotón", "Naranja", "Pétalos de Rosa", "Manzana", "Limón"]);
      const result3 = calculateIngredientsScore(ingredients1, ["Melocotón", "Jugo", "Manzana", "Limón"]);
      const result4 = calculateIngredientsScore(ingredients2, ["Manzana"]);
      const result5 = calculateIngredientsScore(ingredients2, ["Melocotón", "Naranja", "Pétalos de Rosa", "Jugo", "Limón"]);
      const result6 = calculateIngredientsScore(ingredients2, ["Melocotón", "Naranja", "Limón"]);
      expect(result1).toBe(100);
      expect(result2).toBe(100);
      expect(result3).toBe(100);
      expect(result4).toBe(66);
      expect(result5).toBe(66);
      expect(result6).toBe(66);
    })

    it("should give 0 points if there is no ingredients", () => {
      const result1 = calculateIngredientsScore([], []);
      expect(result1).toBe(0);
    })
  })
})