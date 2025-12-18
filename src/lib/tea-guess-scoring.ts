import { TeaType } from "@/generated/prisma/client";
import { distance } from "fastest-levenshtein";
import { cleanGuessName } from "./utils";
import { TeaGuessFormData } from "./types";

function calculateNameScore(originalName: string, guessName: string): number {
  const cleantOriginalName = cleanGuessName(originalName);
  const cleanNameGuess = cleanGuessName(guessName);
  const d = distance(cleantOriginalName, cleanNameGuess);
  const normalizedD = Math.min(1, d/cleantOriginalName.length);
  const score = (1 - normalizedD) * 200;
  return Math.floor(score);
}

export function calculateTeaNameScore(teaName: string, teaNameGuess: string): number {
  return calculateNameScore(teaName, teaNameGuess);
}

export function calculateTeaTypeScore(teaType: TeaType, teaTypeGuess: TeaType): number {
  return teaType === teaTypeGuess ? 200 : 0;
}

export function calculatePersonNameScore(personName: string, personNameGuess: string): number {
  return calculateNameScore(personName, personNameGuess);
}

export function calculateIngredientsScore(ingredients: Array<string>, ingredientsGuess: Array<string>): number {
  if (ingredients.length === 0) return 0;
  const ingredientsGuessSet = new Set(ingredientsGuess);
  const matches = ingredients.filter(ingredient => ingredientsGuessSet.has(ingredient)).length;
  const score = (matches / ingredients.length) * 200;
  return Math.floor(score);
}

export function calculateTimeScore(timestamp: Date): number{
  const START_HOUR = 10;
  const END_HOUR = 20;
  const hour = timestamp.getHours()
  const normalizedH = Math.min(1, (hour - START_HOUR) / (END_HOUR - START_HOUR));
  const score = (1 - normalizedH) * 200;
  return hour < START_HOUR ? 200 : score;
}

export function calculateDailyScore(teaData: TeaGuessFormData, teaGuess: TeaGuessFormData, guessTimestamp: Date): number{
  let score = 0;
  if (teaData.teaName && teaGuess.teaName) {
    score += calculateTeaNameScore(teaData.teaName, teaGuess.teaName);
  }
  if (teaData.teaType && teaGuess.teaType) {
    score += calculateTeaTypeScore(teaData.teaType, teaGuess.teaType);
  }
  if (guessTimestamp) {
    score += calculateTimeScore(guessTimestamp);
  }
  if (teaData.ingredients && teaGuess.ingredients) {
    score += calculateIngredientsScore(teaData.ingredients, teaGuess.ingredients);
  }
  if (teaData.personName && teaGuess.personName) {
    score += calculatePersonNameScore(teaData.personName, teaGuess.personName);
  }
  return score;
}